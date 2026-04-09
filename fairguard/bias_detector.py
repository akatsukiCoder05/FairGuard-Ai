import pandas as pd
import numpy as np
from sklearn.ensemble import RandomForestClassifier, GradientBoostingClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.model_selection import train_test_split, cross_val_score
from sklearn.preprocessing import LabelEncoder, StandardScaler
from sklearn.metrics import (
    accuracy_score, precision_score, recall_score,
    f1_score, roc_auc_score, confusion_matrix
)
from fairlearn.metrics import (
    demographic_parity_difference,
    equalized_odds_difference,
    demographic_parity_ratio,
    MetricFrame
)
from fairlearn.reductions import ExponentiatedGradient, DemographicParity, EqualizedOdds
from fairlearn.postprocessing import ThresholdOptimizer
import shap
import warnings
import json
warnings.filterwarnings("ignore")


class FairGuardEngine:
    def __init__(self):
        self.df = None
        self.target_col = None
        self.sensitive_col = None
        self.feature_cols = None
        self.label_encoders = {}
        self.scaler = StandardScaler()
        self.original_model = None
        self.fair_model = None
        self.X_train = None
        self.X_test = None
        self.y_train = None
        self.y_test = None
        self.sensitive_train = None
        self.sensitive_test = None
        self.bias_report = {}
        self.fair_report = {}

    # ─────────────────────────────────────────────
    # 1. LOAD DATASET
    # ─────────────────────────────────────────────
    def load_dataset(self, filepath: str):
        try:
            if filepath.endswith(".csv"):
                self.df = pd.read_csv(filepath)
            elif filepath.endswith(".xlsx") or filepath.endswith(".xls"):
                self.df = pd.read_excel(filepath)
            elif filepath.endswith(".json"):
                self.df = pd.read_json(filepath)
            else:
                raise ValueError("Unsupported format. Use CSV, Excel, or JSON.")

            self.df.dropna(inplace=True)
            self.df.reset_index(drop=True, inplace=True)

            # Detect potential sensitive columns
            sensitive_hints = ["gender", "sex", "race", "ethnicity", "age", "religion", "caste", "nationality"]
            detected_sensitive = [
                col for col in self.df.columns
                if any(hint in col.lower() for hint in sensitive_hints)
            ]

            return {
                "status": "success",
                "rows": int(self.df.shape[0]),
                "columns": int(self.df.shape[1]),
                "column_names": list(self.df.columns),
                "dtypes": {col: str(dtype) for col, dtype in self.df.dtypes.items()},
                "preview": self.df.head(5).to_dict(orient="records"),
                "detected_sensitive_cols": detected_sensitive,
                "missing_values": int(self.df.isnull().sum().sum()),
                "class_distribution": {}
            }
        except Exception as e:
            return {"status": "error", "message": str(e)}

    # ─────────────────────────────────────────────
    # 2. PREPROCESS DATA
    # ─────────────────────────────────────────────
    def preprocess(self, target_col: str, sensitive_col: str):
        self.target_col = target_col
        self.sensitive_col = sensitive_col

        df = self.df.copy()

        # Get class distribution before encoding
        class_dist = df[target_col].value_counts().to_dict()
        class_dist = {str(k): int(v) for k, v in class_dist.items()}

        # Sensitive group distribution
        group_dist = df[sensitive_col].value_counts().to_dict()
        group_dist = {str(k): int(v) for k, v in group_dist.items()}

        # Encode all categorical columns
        for col in df.select_dtypes(include=["object"]).columns:
            le = LabelEncoder()
            df[col] = le.fit_transform(df[col].astype(str))
            self.label_encoders[col] = le

        self.feature_cols = [c for c in df.columns if c != target_col]

        X = df[self.feature_cols]
        y = df[target_col]
        sensitive = df[sensitive_col]

        X_scaled = self.scaler.fit_transform(X)
        X_scaled = pd.DataFrame(X_scaled, columns=self.feature_cols)

        (
            self.X_train, self.X_test,
            self.y_train, self.y_test,
            self.sensitive_train, self.sensitive_test,
        ) = train_test_split(X_scaled, y, sensitive, test_size=0.3, random_state=42)

        return {
            "status": "success",
            "features_used": self.feature_cols,
            "train_size": int(len(self.X_train)),
            "test_size": int(len(self.X_test)),
            "class_distribution": class_dist,
            "group_distribution": group_dist
        }

    # ─────────────────────────────────────────────
    # 3. TRAIN ORIGINAL (BIASED) MODEL
    # ─────────────────────────────────────────────
    def train_original_model(self):
        self.original_model = RandomForestClassifier(n_estimators=150, random_state=42)
        self.original_model.fit(self.X_train, self.y_train)
        y_pred = self.original_model.predict(self.X_test)
        y_prob = self.original_model.predict_proba(self.X_test)[:, 1]

        acc = accuracy_score(self.y_test, y_pred)
        precision = precision_score(self.y_test, y_pred, average="weighted", zero_division=0)
        recall = recall_score(self.y_test, y_pred, average="weighted", zero_division=0)
        f1 = f1_score(self.y_test, y_pred, average="weighted", zero_division=0)

        try:
            auc = roc_auc_score(self.y_test, y_prob)
        except Exception:
            auc = 0.0

        cm = confusion_matrix(self.y_test, y_pred).tolist()

        # Feature importance
        importances = self.original_model.feature_importances_
        feature_importance = sorted(
            zip(self.feature_cols, importances.tolist()),
            key=lambda x: x[1], reverse=True
        )[:10]

        return {
            "model_name": "Random Forest (Original)",
            "accuracy": round(float(acc), 4),
            "precision": round(float(precision), 4),
            "recall": round(float(recall), 4),
            "f1_score": round(float(f1), 4),
            "roc_auc": round(float(auc), 4),
            "confusion_matrix": cm,
            "top_features": [{"feature": f, "importance": round(i, 4)} for f, i in feature_importance]
        }

    # ─────────────────────────────────────────────
    # 4. DETECT BIAS — MULTIPLE FAIRNESS METRICS
    # ─────────────────────────────────────────────
    def detect_bias(self):
        y_pred = self.original_model.predict(self.X_test)
        sensitive = self.sensitive_test

        # Core fairness metrics
        dpd = demographic_parity_difference(self.y_test, y_pred, sensitive_features=sensitive)
        dpr = demographic_parity_ratio(self.y_test, y_pred, sensitive_features=sensitive)
        eod = equalized_odds_difference(self.y_test, y_pred, sensitive_features=sensitive)

        # Per-group accuracy
        mf = MetricFrame(
            metrics=accuracy_score,
            y_true=self.y_test,
            y_pred=y_pred,
            sensitive_features=sensitive
        )
        group_accuracies = {str(k): round(float(v), 4) for k, v in mf.by_group.items()}
        overall_accuracy = round(float(mf.overall), 4)

        # Per-group selection rate
        def selection_rate(y_true, y_pred):
            return float(np.mean(y_pred))

        mf_sel = MetricFrame(
            metrics=selection_rate,
            y_true=self.y_test,
            y_pred=y_pred,
            sensitive_features=sensitive
        )
        group_selection = {str(k): round(float(v), 4) for k, v in mf_sel.by_group.items()}

        # Bias severity level
        dpd_abs = abs(float(dpd))
        if dpd_abs < 0.05:
            severity = "LOW"
            severity_color = "green"
        elif dpd_abs < 0.10:
            severity = "MODERATE"
            severity_color = "yellow"
        elif dpd_abs < 0.20:
            severity = "HIGH"
            severity_color = "orange"
        else:
            severity = "CRITICAL"
            severity_color = "red"

        self.bias_report = {
            "demographic_parity_difference": round(float(dpd), 4),
            "demographic_parity_ratio": round(float(dpr), 4),
            "equalized_odds_difference": round(float(eod), 4),
            "group_accuracies": group_accuracies,
            "group_selection_rates": group_selection,
            "overall_accuracy": overall_accuracy,
            "bias_severity": severity,
            "bias_severity_color": severity_color,
            "bias_detected": dpd_abs >= 0.05,
            "interpretation": self._interpret_bias(dpd_abs, dpr, eod)
        }
        return self.bias_report

    def _interpret_bias(self, dpd, dpr, eod):
        interpretations = []
        if dpd >= 0.20:
            interpretations.append("CRITICAL: Extreme disparity found between groups. Immediate action required.")
        elif dpd >= 0.10:
            interpretations.append("HIGH: Significant bias detected. Model unfairly favors certain groups.")
        elif dpd >= 0.05:
            interpretations.append("MODERATE: Some bias present. Model decisions are slightly unequal.")
        else:
            interpretations.append("LOW: Model is mostly fair with minimal bias detected.")

        if dpr < 0.8:
            interpretations.append("Demographic Parity Ratio below 0.8 — violates the 80% rule used in legal standards.")
        if abs(eod) >= 0.10:
            interpretations.append("Equalized Odds Difference is high — model has different error rates across groups.")

        return interpretations

    # ─────────────────────────────────────────────
    # 5. MITIGATE BIAS — 3 METHODS
    # ─────────────────────────────────────────────
    def mitigate_bias(self, method: str = "reductions"):
        base_estimator = LogisticRegression(solver="liblinear", random_state=42)

        if method == "reductions":
            # In-processing: Exponentiated Gradient
            constraint = DemographicParity()
            self.fair_model = ExponentiatedGradient(base_estimator, constraints=constraint)
            self.fair_model.fit(self.X_train, self.y_train, sensitive_features=self.sensitive_train)
            y_pred_fair = self.fair_model.predict(self.X_test)

        elif method == "postprocessing":
            # Post-processing: Threshold Optimizer
            self.fair_model = ThresholdOptimizer(
                estimator=self.original_model,
                constraints="demographic_parity",
                predict_method="predict_proba"
            )
            self.fair_model.fit(self.X_train, self.y_train, sensitive_features=self.sensitive_train)
            y_pred_fair = self.fair_model.predict(self.X_test, sensitive_features=self.sensitive_test)

        elif method == "reweighting":
            # Pre-processing: Sample Reweighting
            sample_weights = self._compute_sample_weights(self.X_train, self.y_train, self.sensitive_train)
            fair_clf = RandomForestClassifier(n_estimators=150, random_state=42)
            fair_clf.fit(self.X_train, self.y_train, sample_weight=sample_weights)
            self.fair_model = fair_clf
            y_pred_fair = self.fair_model.predict(self.X_test)
        else:
            raise ValueError("Method must be: reductions, postprocessing, or reweighting")

        # Metrics after mitigation
        acc_fair = accuracy_score(self.y_test, y_pred_fair)
        f1_fair = f1_score(self.y_test, y_pred_fair, average="weighted", zero_division=0)

        dpd_fair = demographic_parity_difference(self.y_test, y_pred_fair, sensitive_features=self.sensitive_test)
        dpr_fair = demographic_parity_ratio(self.y_test, y_pred_fair, sensitive_features=self.sensitive_test)
        eod_fair = equalized_odds_difference(self.y_test, y_pred_fair, sensitive_features=self.sensitive_test)

        mf_fair = MetricFrame(
            metrics=accuracy_score,
            y_true=self.y_test,
            y_pred=y_pred_fair,
            sensitive_features=self.sensitive_test
        )
        group_accuracies_fair = {str(k): round(float(v), 4) for k, v in mf_fair.by_group.items()}

        severity_fair = self._get_severity(abs(float(dpd_fair)))

        self.fair_report = {
            "method_used": method,
            "accuracy": round(float(acc_fair), 4),
            "f1_score": round(float(f1_fair), 4),
            "demographic_parity_difference": round(float(dpd_fair), 4),
            "demographic_parity_ratio": round(float(dpr_fair), 4),
            "equalized_odds_difference": round(float(eod_fair), 4),
            "group_accuracies": group_accuracies_fair,
            "bias_severity": severity_fair,
        }
        return self.fair_report

    def _compute_sample_weights(self, X, y, sensitive):
        weights = np.ones(len(y))
        groups = sensitive.unique()
        for g in groups:
            mask = (sensitive == g)
            group_size = mask.sum()
            weights[mask] = len(y) / (len(groups) * group_size)
        return weights

    def _get_severity(self, dpd_abs):
        if dpd_abs < 0.05:
            return "LOW"
        elif dpd_abs < 0.10:
            return "MODERATE"
        elif dpd_abs < 0.20:
            return "HIGH"
        else:
            return "CRITICAL"

    # ─────────────────────────────────────────────
    # 6. SHAP EXPLAINABILITY
    # ─────────────────────────────────────────────
    def explain_model(self, num_samples: int = 100):
        try:
            sample = self.X_test.iloc[:num_samples]
            explainer = shap.TreeExplainer(self.original_model)
            shap_values = explainer.shap_values(sample)

            if isinstance(shap_values, list):
                shap_vals = shap_values[1]
            else:
                shap_vals = shap_values

            mean_shap = np.abs(shap_vals).mean(axis=0)
            shap_summary = sorted(
                zip(self.feature_cols, mean_shap.tolist()),
                key=lambda x: x[1], reverse=True
            )[:10]

            return {
                "status": "success",
                "shap_feature_importance": [
                    {"feature": f, "shap_value": round(v, 4)}
                    for f, v in shap_summary
                ],
                "explanation": "Higher SHAP value = More influence on model decision"
            }
        except Exception as e:
            return {"status": "error", "message": str(e)}

    # ─────────────────────────────────────────────
    # 7. COMPARE BEFORE vs AFTER
    # ─────────────────────────────────────────────
    def get_comparison(self):
        if not self.bias_report or not self.fair_report:
            return {"error": "Run detect_bias and mitigate_bias first"}

        return {
            "before": {
                "demographic_parity_difference": self.bias_report.get("demographic_parity_difference"),
                "demographic_parity_ratio": self.bias_report.get("demographic_parity_ratio"),
                "equalized_odds_difference": self.bias_report.get("equalized_odds_difference"),
                "overall_accuracy": self.bias_report.get("overall_accuracy"),
                "bias_severity": self.bias_report.get("bias_severity"),
                "group_accuracies": self.bias_report.get("group_accuracies"),
                "group_selection_rates": self.bias_report.get("group_selection_rates"),
            },
            "after": {
                "demographic_parity_difference": self.fair_report.get("demographic_parity_difference"),
                "demographic_parity_ratio": self.fair_report.get("demographic_parity_ratio"),
                "equalized_odds_difference": self.fair_report.get("equalized_odds_difference"),
                "overall_accuracy": self.fair_report.get("accuracy"),
                "bias_severity": self.fair_report.get("bias_severity"),
                "group_accuracies": self.fair_report.get("group_accuracies"),
            },
            "improvement": {
                "dpd_reduced_by": round(
                    abs(self.bias_report.get("demographic_parity_difference", 0)) -
                    abs(self.fair_report.get("demographic_parity_difference", 0)), 4
                ),
                "fairness_improved": abs(self.bias_report.get("demographic_parity_difference", 0)) >
                                     abs(self.fair_report.get("demographic_parity_difference", 0))
            }
        }
