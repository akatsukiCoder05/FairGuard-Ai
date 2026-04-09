from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table,
    TableStyle, HRFlowable, PageBreak
)
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from datetime import datetime
import os


def generate_pdf_report(
    dataset_info: dict,
    preprocess_info: dict,
    original_model_info: dict,
    bias_report: dict,
    fair_report: dict,
    comparison: dict,
    shap_info: dict,
    output_path: str = "fairguard_report.pdf"
):
    doc = SimpleDocTemplate(
        output_path,
        pagesize=A4,
        rightMargin=50,
        leftMargin=50,
        topMargin=60,
        bottomMargin=50
    )

    styles = getSampleStyleSheet()
    elements = []

    # ── Custom Styles ──────────────────────────────
    title_style = ParagraphStyle(
        "TitleStyle",
        parent=styles["Title"],
        fontSize=26,
        textColor=colors.HexColor("#1a1a2e"),
        spaceAfter=6,
        alignment=TA_CENTER,
        fontName="Helvetica-Bold"
    )
    subtitle_style = ParagraphStyle(
        "SubTitle",
        parent=styles["Normal"],
        fontSize=12,
        textColor=colors.HexColor("#4a4e69"),
        alignment=TA_CENTER,
        spaceAfter=4
    )
    section_style = ParagraphStyle(
        "SectionTitle",
        parent=styles["Heading1"],
        fontSize=14,
        textColor=colors.HexColor("#ffffff"),
        backColor=colors.HexColor("#16213e"),
        spaceBefore=12,
        spaceAfter=6,
        fontName="Helvetica-Bold",
        leftIndent=-10,
        rightIndent=-10,
        borderPadding=(6, 8, 6, 8)
    )
    body_style = ParagraphStyle(
        "BodyStyle",
        parent=styles["Normal"],
        fontSize=10,
        textColor=colors.HexColor("#2d2d2d"),
        spaceAfter=4,
        leading=16
    )
    highlight_style = ParagraphStyle(
        "HighlightStyle",
        parent=styles["Normal"],
        fontSize=11,
        textColor=colors.HexColor("#0f3460"),
        fontName="Helvetica-Bold",
        spaceAfter=4
    )

    # ── HEADER ─────────────────────────────────────
    elements.append(Spacer(1, 20))
    elements.append(Paragraph("🛡️ FairGuard AI", title_style))
    elements.append(Paragraph("Bias Detection & Fairness Audit Report", subtitle_style))
    elements.append(Paragraph(f"Generated: {datetime.now().strftime('%B %d, %Y at %I:%M %p')}", subtitle_style))
    elements.append(Spacer(1, 10))
    elements.append(HRFlowable(width="100%", thickness=2, color=colors.HexColor("#e94560")))
    elements.append(Spacer(1, 16))

    # ── EXECUTIVE SUMMARY ─────────────────────────
    severity = bias_report.get("bias_severity", "UNKNOWN")
    severity_colors = {
        "LOW": colors.HexColor("#27ae60"),
        "MODERATE": colors.HexColor("#f39c12"),
        "HIGH": colors.HexColor("#e67e22"),
        "CRITICAL": colors.HexColor("#e74c3c"),
    }
    sev_color = severity_colors.get(severity, colors.gray)

    summary_data = [
        ["Metric", "Value"],
        ["Dataset Rows", str(dataset_info.get("rows", "N/A"))],
        ["Dataset Columns", str(dataset_info.get("columns", "N/A"))],
        ["Target Column", str(preprocess_info.get("target_col", "N/A"))],
        ["Sensitive Attribute", str(preprocess_info.get("sensitive_col", "N/A"))],
        ["Bias Severity", severity],
        ["Original Model Accuracy", f"{original_model_info.get('accuracy', 0) * 100:.2f}%"],
        ["Fair Model Accuracy", f"{fair_report.get('accuracy', 0) * 100:.2f}%"],
        ["Bias Improvement", "✅ YES" if comparison.get('improvement', {}).get('fairness_improved') else "⚠️ CHECK"],
    ]

    summary_table = Table(summary_data, colWidths=[250, 200])
    summary_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#16213e")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, 0), 11),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.HexColor("#f8f9fa"), colors.white]),
        ("TEXTCOLOR", (0, 1), (-1, -1), colors.HexColor("#2d2d2d")),
        ("FONTSIZE", (0, 1), (-1, -1), 10),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#dee2e6")),
        ("ALIGN", (0, 0), (-1, -1), "LEFT"),
        ("PADDING", (0, 0), (-1, -1), 8),
        ("BACKGROUND", (0, 6), (-1, 6), sev_color),
        ("TEXTCOLOR", (0, 6), (-1, 6), colors.white),
        ("FONTNAME", (0, 6), (-1, 6), "Helvetica-Bold"),
    ]))
    elements.append(Paragraph("📋 Executive Summary", section_style))
    elements.append(Spacer(1, 8))
    elements.append(summary_table)
    elements.append(Spacer(1, 16))

    # ── BIAS DETECTION RESULTS ────────────────────
    elements.append(Paragraph("🔍 Bias Detection Results (Before Mitigation)", section_style))
    elements.append(Spacer(1, 8))

    bias_data = [
        ["Fairness Metric", "Value", "Ideal Value", "Status"],
        [
            "Demographic Parity Difference",
            str(bias_report.get("demographic_parity_difference", "N/A")),
            "0.00",
            "✅ OK" if abs(bias_report.get("demographic_parity_difference", 1)) < 0.05 else "❌ BIASED"
        ],
        [
            "Demographic Parity Ratio",
            str(bias_report.get("demographic_parity_ratio", "N/A")),
            "> 0.80",
            "✅ OK" if bias_report.get("demographic_parity_ratio", 0) >= 0.80 else "❌ BIASED"
        ],
        [
            "Equalized Odds Difference",
            str(bias_report.get("equalized_odds_difference", "N/A")),
            "0.00",
            "✅ OK" if abs(bias_report.get("equalized_odds_difference", 1)) < 0.05 else "❌ BIASED"
        ],
    ]

    bias_table = Table(bias_data, colWidths=[200, 80, 80, 90])
    bias_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#e94560")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.HexColor("#fff5f5"), colors.white]),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#dee2e6")),
        ("ALIGN", (0, 0), (-1, -1), "CENTER"),
        ("ALIGN", (0, 0), (0, -1), "LEFT"),
        ("PADDING", (0, 0), (-1, -1), 8),
        ("FONTSIZE", (0, 0), (-1, -1), 10),
    ]))
    elements.append(bias_table)
    elements.append(Spacer(1, 12))

    # Interpretation
    if bias_report.get("interpretation"):
        elements.append(Paragraph("🧠 Interpretation:", highlight_style))
        for interp in bias_report["interpretation"]:
            elements.append(Paragraph(f"• {interp}", body_style))
    elements.append(Spacer(1, 16))

    # ── GROUP-WISE ACCURACY ───────────────────────
    elements.append(Paragraph("👥 Group-wise Accuracy Analysis", section_style))
    elements.append(Spacer(1, 8))

    group_before = bias_report.get("group_accuracies", {})
    group_after = fair_report.get("group_accuracies", {})

    group_data = [["Group", "Accuracy (Before)", "Accuracy (After)", "Change"]]
    for group in group_before:
        before_val = group_before.get(group, 0)
        after_val = group_after.get(group, 0)
        change = round(after_val - before_val, 4)
        change_str = f"+{change}" if change >= 0 else str(change)
        group_data.append([str(group), str(before_val), str(after_val), change_str])

    group_table = Table(group_data, colWidths=[120, 130, 130, 80])
    group_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#0f3460")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.HexColor("#f0f4ff"), colors.white]),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#dee2e6")),
        ("ALIGN", (0, 0), (-1, -1), "CENTER"),
        ("PADDING", (0, 0), (-1, -1), 8),
        ("FONTSIZE", (0, 0), (-1, -1), 10),
    ]))
    elements.append(group_table)
    elements.append(Spacer(1, 16))

    # ── FAIRNESS COMPARISON ───────────────────────
    elements.append(Paragraph("⚖️ Before vs After Bias Mitigation", section_style))
    elements.append(Spacer(1, 8))

    before = comparison.get("before", {})
    after = comparison.get("after", {})

    comp_data = [
        ["Metric", "Before (Biased)", "After (Fair)", "Improvement"],
        [
            "DPD (lower=better)",
            str(before.get("demographic_parity_difference", "N/A")),
            str(after.get("demographic_parity_difference", "N/A")),
            "✅" if abs(before.get("demographic_parity_difference", 0)) > abs(after.get("demographic_parity_difference", 0)) else "⚠️"
        ],
        [
            "DPR (higher=better)",
            str(before.get("demographic_parity_ratio", "N/A")),
            str(after.get("demographic_parity_ratio", "N/A")),
            "✅" if after.get("demographic_parity_ratio", 0) > before.get("demographic_parity_ratio", 0) else "⚠️"
        ],
        [
            "EOD (lower=better)",
            str(before.get("equalized_odds_difference", "N/A")),
            str(after.get("equalized_odds_difference", "N/A")),
            "✅" if abs(before.get("equalized_odds_difference", 0)) > abs(after.get("equalized_odds_difference", 0)) else "⚠️"
        ],
        [
            "Accuracy",
            f"{before.get('overall_accuracy', 0) * 100:.2f}%",
            f"{after.get('overall_accuracy', 0) * 100:.2f}%",
            "—"
        ],
        [
            "Bias Severity",
            before.get("bias_severity", "N/A"),
            after.get("bias_severity", "N/A"),
            "✅" if before.get("bias_severity") != after.get("bias_severity") else "—"
        ],
    ]

    comp_table = Table(comp_data, colWidths=[180, 100, 100, 80])
    comp_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#533483")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.HexColor("#f5f0ff"), colors.white]),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#dee2e6")),
        ("ALIGN", (0, 0), (-1, -1), "CENTER"),
        ("ALIGN", (0, 0), (0, -1), "LEFT"),
        ("PADDING", (0, 0), (-1, -1), 8),
        ("FONTSIZE", (0, 0), (-1, -1), 10),
    ]))
    elements.append(comp_table)
    elements.append(Spacer(1, 16))

    # ── SHAP EXPLAINABILITY ───────────────────────
    if shap_info.get("status") == "success":
        elements.append(Paragraph("🧠 SHAP Feature Importance (AI Explainability)", section_style))
        elements.append(Spacer(1, 8))
        elements.append(Paragraph(
            "Features with highest influence on model decisions:",
            body_style
        ))
        shap_data = [["Rank", "Feature", "SHAP Importance"]]
        for i, item in enumerate(shap_info.get("shap_feature_importance", [])[:8], 1):
            shap_data.append([str(i), item["feature"], str(item["shap_value"])])

        shap_table = Table(shap_data, colWidths=[50, 250, 150])
        shap_table.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#2d6a4f")),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
            ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.HexColor("#f0fff4"), colors.white]),
            ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#dee2e6")),
            ("ALIGN", (0, 0), (-1, -1), "CENTER"),
            ("ALIGN", (0, 1), (1, -1), "LEFT"),
            ("PADDING", (0, 0), (-1, -1), 8),
            ("FONTSIZE", (0, 0), (-1, -1), 10),
        ]))
        elements.append(shap_table)
        elements.append(Spacer(1, 16))

    # ── RECOMMENDATIONS ───────────────────────────
    elements.append(Paragraph("💡 Recommendations", section_style))
    elements.append(Spacer(1, 8))
    recommendations = [
        "1. Regularly audit AI models for bias using fairness metrics like DPD and DPR.",
        "2. Use diverse and representative training datasets to prevent historical bias.",
        "3. Apply bias mitigation techniques (reweighting, reductions) before deployment.",
        "4. Monitor model performance across all demographic groups continuously.",
        "5. Ensure human oversight for high-stakes decisions (loans, hiring, healthcare).",
        "6. Document fairness assessments as part of the AI governance framework.",
        "7. Engage with affected communities to identify real-world discrimination risks.",
    ]
    for rec in recommendations:
        elements.append(Paragraph(rec, body_style))
    elements.append(Spacer(1, 20))

    # ── FOOTER ────────────────────────────────────
    elements.append(HRFlowable(width="100%", thickness=1, color=colors.HexColor("#e94560")))
    elements.append(Spacer(1, 8))
    elements.append(Paragraph(
        "Generated by FairGuard AI — Enterprise Bias Detection Platform | Confidential Audit Report",
        subtitle_style
    ))

    doc.build(elements)
    return output_path
