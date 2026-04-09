# 🛡️ FairGuard AI — Enterprise Bias Detection Platform

## 📁 Project Structure
```
fairguard/
│
├── app.py                  ← FastAPI Backend (Main Server)
├── bias_detector.py        ← Core ML Engine (Bias Detection + Mitigation)
├── report_generator.py     ← PDF Audit Report Generator
├── requirements.txt        ← All Python Libraries
│
├── templates/
│   └── index.html          ← Beautiful Frontend Dashboard
│
└── datasets/
    └── sample_loan_data.csv ← Demo Dataset (Loan Approval)
```

---

## 🚀 Setup & Run (VS Code)

### Step 1 — Open Terminal in VS Code (Ctrl + `)

### Step 2 — Create Virtual Environment
```bash
python -m venv venv
```

### Step 3 — Activate Virtual Environment
```bash
# Windows
venv\Scripts\activate

# Mac/Linux
source venv/bin/activate
```

### Step 4 — Install All Libraries
```bash
pip install -r requirements.txt
```

### Step 5 — Run the Server
```bash
python app.py
```

### Step 6 — Open in Browser
```
http://localhost:8000
```

---

## 🎯 How to Use FairGuard AI

1. **Upload Dataset** — Upload CSV/Excel/JSON (use `datasets/sample_loan_data.csv` for demo)
2. **Configure** — Select target column (`loan_approved`) and sensitive attribute (`gender` or `race`)
3. **Run Analysis** — Click "Run Full Analysis" button
4. **View Results** — See bias metrics, SHAP explainability, before/after comparison
5. **Download Report** — Click "Download PDF Audit Report"

---

## 🧠 What It Detects

| Metric | What it Measures |
|--------|-----------------|
| Demographic Parity Difference | Are positive outcomes equally distributed? |
| Demographic Parity Ratio | Does it meet the 80% legal rule? |
| Equalized Odds Difference | Are error rates equal across groups? |
| SHAP Values | Which features influence AI decisions most? |

---

## ⚙️ Bias Mitigation Methods

| Method | How it Works |
|--------|-------------|
| Reductions | Trains fair model using Exponentiated Gradient (in-processing) |
| Reweighting | Balances sample weights before training (pre-processing) |
| Post-processing | Adjusts decision thresholds after training |

---

## 📊 Demo Dataset

`datasets/sample_loan_data.csv` contains 50 loan applications with:
- Features: age, gender, education, experience, race, income, etc.
- Target: `loan_approved` (0 = rejected, 1 = approved)
- Sensitive attributes: `gender`, `race`

**Note:** This dataset intentionally contains bias to demonstrate the tool.

---

## 🏆 Tech Stack

- **Backend:** FastAPI + Python
- **ML Engine:** Scikit-learn + Fairlearn
- **Explainability:** SHAP
- **PDF Reports:** ReportLab
- **Frontend:** Vanilla JS + Chart.js
- **Deployment Ready:** Uvicorn ASGI Server

---

## 📄 API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/` | GET | Serve frontend |
| `/api/upload` | POST | Upload dataset |
| `/api/full-pipeline` | POST | Run complete analysis |
| `/api/report` | POST | Download PDF report |
| `/api/detect-bias` | POST | Bias detection only |
| `/api/mitigate` | POST | Mitigation only |
| `/api/explain` | POST | SHAP analysis only |

---

Built with ❤️ for National Level Hackathon — FairGuard AI Team
