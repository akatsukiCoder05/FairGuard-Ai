let sessionId = null;
let pipelineData = null;
let compChart = null, groupChart = null, featChart = null;
let columnInfo = {};
let uploadedFileText = "";
let uploadedFileName = "";
let sensitiveColUsed = "";
let lastResultData = null; // store for PDF + history

// ── UTILS ──────────────────────────────────────────────────────────────────
function showAlert(msg, type = "error") {
  const c = document.getElementById("alert-container");
  c.innerHTML = `<div class="alert alert-${type}">⚠️ ${msg}</div>`;
  setTimeout(() => c.innerHTML = "", 7000);
}

function goToSection(name) {
  document.querySelectorAll(".result-section").forEach(s => s.classList.remove("active"));
  document.getElementById(`section-${name}`).classList.add("active");
  const stepMap = { upload: "step1", config: "step2", scanresults: "step2", pipeline: "step3", results: "step4" };
  document.querySelectorAll(".step").forEach(s => s.classList.remove("active", "done"));
  const steps = ["step1", "step2", "step3", "step4"];
  const current = steps.indexOf(stepMap[name]);
  steps.forEach((s, i) => {
    const el = document.getElementById(`${s}-indicator`);
    if (i < current) el.classList.add("done");
    else if (i === current) el.classList.add("active");
  });
}

function goToConfig() { goToSection("config"); }

function setPipelineStep(id, state) {
  const el = document.getElementById(id);
  el.className = `pipeline-step ${state}`;
  el.querySelector(".step-status").textContent = { running: "🔄", done: "✅", error: "❌" }[state] || "⏳";
}

function severityIcon(sev) {
  return { LOW: "🟢", MODERATE: "🟡", HIGH: "🟠", CRITICAL: "🔴" }[sev] || "⚪";
}

// ── HISTORY ────────────────────────────────────────────────────────────────
function getCurrentUserId() {
  return localStorage.getItem("fg_user_id") || sessionStorage.getItem("fg_user_id") || "guest";
}

function getHistoryKey() {
  return `fairguard_history_${getCurrentUserId()}`;
}

function saveToHistory(fileName, sensitiveCol, data) {
  try {
    const history = getHistory();
    const entry = {
      id: Date.now(),
      date: new Date().toLocaleString(),
      fileName,
      sensitiveCol,
      accuracy: (data.original_model.accuracy * 100).toFixed(1),
      biasSeverity: data.bias_report.bias_severity,
      dpd: data.bias_report.demographic_parity_difference,
      dpr: data.bias_report.demographic_parity_ratio,
      fairAccuracy: (data.fair_report.accuracy * 100).toFixed(1),
    };
    history.unshift(entry);
    if (history.length > 10) history.pop();

    localStorage.setItem(getHistoryKey(), JSON.stringify(history));
    renderHistory();
  } catch (e) {
    console.warn("History save failed:", e);
  }
}

function getHistory() {
  try {
    return JSON.parse(localStorage.getItem(getHistoryKey()) || "[]");
  } catch (e) {
    return [];
  }
}

function toggleHistory() {
  const panel = document.getElementById("history-panel");
  panel.style.display = panel.style.display === "none" ? "block" : "none";
  if (panel.style.display === "block") renderHistory();
}

function clearHistory() {
  localStorage.removeItem(getHistoryKey());
  renderHistory();
}

function renderHistory() {
  const history = getHistory();
  const list = document.getElementById("history-list");

  if (!list) return;

  if (history.length === 0) {
    list.innerHTML = `<div class="empty-state-text">No history yet. Run an analysis to save it here.</div>`;
    return;
  }

  list.innerHTML = history.map(h => `
    <div class="history-item">
      <div class="history-top-row">
        <div class="history-main-info">
          <div class="history-file-name">📄 ${h.fileName}</div>
          <div class="history-meta-line">
            Sensitive: <strong>${h.sensitiveCol}</strong> &bull; ${h.date}
          </div>
        </div>

        <div class="history-severity-wrap">
          <span class="history-severity-pill history-severity-${String(h.biasSeverity || "").toLowerCase()}">
            ${h.biasSeverity}
          </span>
        </div>
      </div>

      <div class="history-stats-row">
        <div class="history-stat">
          <div class="history-stat-val">${h.accuracy}%</div>
          <div class="history-stat-label">Accuracy</div>
        </div>

        <div class="history-stat">
          <div class="history-stat-val">${h.fairAccuracy}%</div>
          <div class="history-stat-label">Fair Accuracy</div>
        </div>

        <div class="history-stat">
          <div class="history-stat-val ${parseFloat(h.dpd) > 0.1 ? 'metric-danger-text' : 'metric-success-text'}">
            ${h.dpd}
          </div>
          <div class="history-stat-label">DPD</div>
        </div>

        <div class="history-stat">
          <div class="history-stat-val ${parseFloat(h.dpr) < 0.8 ? 'metric-danger-text' : 'metric-success-text'}">
            ${h.dpr}
          </div>
          <div class="history-stat-label">DPR</div>
        </div>
      </div>
    </div>
  `).join("");
}

// ── ABOUT PANEL ────────────────────────────────────────────────────────────
function toggleAbout() {
  const panel = document.getElementById("about-panel");
  if (!panel) return;
  const isOpen = panel.style.display === "block";
  panel.style.display = isOpen ? "none" : "block";
  if (!isOpen) renderAboutPanel();
}

function closeAbout() {
  const panel = document.getElementById("about-panel");
  if (panel) panel.style.display = "none";
}

function renderAboutPanel() {
  const container = document.getElementById("about-panel-content");
  if (!container) return;

  container.innerHTML = `
    <div class="about-header-row">
      <div class="about-logo-wrap">
        <div class="about-logo-icon">🛡️</div>
        <div>
          <div class="about-title">FairGuard AI</div>
          <div class="about-subtitle">AI Bias Detection & Fairness Auditing Platform</div>
        </div>
      </div>
      <button class="about-close-btn" onclick="closeAbout()">✕</button>
    </div>

    <div class="about-description-box">
      <strong>FairGuard AI</strong> is an intelligent bias detection platform that automatically scans your datasets, uncovers hidden discrimination patterns, and provides actionable fairness corrections — all with full transparency and explainability.
    </div>

    <div class="about-stats-grid">
      <div class="about-stat-card">
        <div class="about-stat-val">6+</div>
        <div class="about-stat-label">Fairness Metrics</div>
      </div>
      <div class="about-stat-card">
        <div class="about-stat-val">3</div>
        <div class="about-stat-label">Mitigation Methods</div>
      </div>
      <div class="about-stat-card">
        <div class="about-stat-val">PDF</div>
        <div class="about-stat-label">Audit Reports</div>
      </div>
      <div class="about-stat-card">
        <div class="about-stat-val">SHAP</div>
        <div class="about-stat-label">Explainability</div>
      </div>
    </div>

    <div class="about-section">
      <h3 class="about-section-heading">🎯 Our Mission</h3>
      <p class="about-section-body">To make AI systems fair, transparent, and accountable. FairGuard AI empowers developers, researchers, and organizations to identify and eliminate bias before it causes real-world harm — ensuring every individual is treated equitably regardless of their background.</p>
    </div>

    <div class="about-section">
      <h3 class="about-section-heading">🔍 What It Does</h3>
      <p class="about-section-body">Upload any dataset (CSV, Excel, JSON, or PDF), select your target column, and let FairGuard auto-scan every column for potential bias. It trains a model, computes 6+ fairness metrics, applies bias mitigation, and generates a comprehensive before-vs-after comparison — complete with SHAP explainability and downloadable PDF audit reports.</p>
    </div>

    <div class="about-section">
      <h3 class="about-section-heading">⚖️ Why It Matters</h3>
      <p class="about-section-body">AI systems can unintentionally discriminate based on gender, caste, race, religion, age, or related proxy variables. Without proper auditing, these biases get baked into critical decisions — hiring, lending, criminal justice, and healthcare. FairGuard helps catch these risks early so decisions remain transparent, ethical, and legally compliant.</p>
    </div>

    <div class="about-section">
      <h3 class="about-section-heading">🧠 How It Works</h3>
      <div class="about-steps">
        <div class="about-step"><span class="about-step-num">1</span><span>Upload your dataset — CSV, Excel, JSON, or PDF supported</span></div>
        <div class="about-step"><span class="about-step-num">2</span><span>Select the target column (what AI predicts) and columns to scan for bias</span></div>
        <div class="about-step"><span class="about-step-num">3</span><span>FairGuard auto-scans all columns, ranks them by bias severity (DPD, DPR, EOD)</span></div>
        <div class="about-step"><span class="about-step-num">4</span><span>Bias mitigation is applied using your chosen method (Reweighting, Reductions, or Post-processing)</span></div>
        <div class="about-step"><span class="about-step-num">5</span><span>View detailed results with SHAP explainability, download corrected dataset & PDF audit report</span></div>
      </div>
    </div>

    <div class="about-section">
      <h3 class="about-section-heading">📋 Supported Fairness Metrics</h3>
      <div class="about-metrics-list">
        <span class="about-metric-tag">Demographic Parity Difference (DPD)</span>
        <span class="about-metric-tag">Demographic Parity Ratio (DPR)</span>
        <span class="about-metric-tag">Equalized Odds Difference (EOD)</span>
        <span class="about-metric-tag">Group-wise Accuracy</span>
        <span class="about-metric-tag">SHAP Feature Importance</span>
        <span class="about-metric-tag">80% Rule (EEOC Compliance)</span>
      </div>
    </div>

    <div class="about-section">
      <h3 class="about-section-heading">🔧 Mitigation Methods</h3>
      <div class="about-methods">
        <div class="about-method-card">
          <div class="about-method-name">⚡ Reweighting (Recommended)</div>
          <div class="about-method-desc">Pre-processing technique that adjusts sample weights during training. Best accuracy preservation with effective bias reduction.</div>
        </div>
        <div class="about-method-card">
          <div class="about-method-name">🎯 Reductions (Fairlearn)</div>
          <div class="about-method-desc">In-processing method that applies fairness constraints during model training. Excellent balance of fairness and model performance.</div>
        </div>
        <div class="about-method-card">
          <div class="about-method-name">🔄 Post-processing (Threshold Optimizer)</div>
          <div class="about-method-desc">Adjusts model prediction thresholds after training. Ideal when model retraining is not feasible.</div>
        </div>
      </div>
    </div>

    <div class="about-section">
      <h3 class="about-section-heading">🛠️ Tech Stack</h3>
      <div class="about-metrics-list">
        <span class="about-metric-tag">Python + Flask</span>
        <span class="about-metric-tag">Scikit-learn</span>
        <span class="about-metric-tag">Fairlearn</span>
        <span class="about-metric-tag">SHAP</span>
        <span class="about-metric-tag">Chart.js</span>
        <span class="about-metric-tag">jsPDF</span>
      </div>
    </div>

    <div class="about-footer">
      <div style="margin-bottom:6px;font-size:13px;font-weight:700;color:var(--text, #e2e8f0);">FairGuard AI — v2.0</div>
      <div>Built with ❤️ to make AI fair for everyone</div>
      <div style="margin-top:4px;">© ${new Date().getFullYear()} FairGuard AI. All rights reserved.</div>
    </div>
  `;

  // inject styles if not already present
  if (!document.getElementById("about-panel-styles")) {
    const style = document.createElement("style");
    style.id = "about-panel-styles";
    style.textContent = `
      #about-panel {
        position: fixed;
        top: 0; right: 0;
        width: 480px;
        max-width: 100vw;
        height: 100vh;
        background: var(--card, #1a1d35);
        border-left: 1px solid var(--border, rgba(79,110,247,0.2));
        box-shadow: -8px 0 40px rgba(0,0,0,0.4);
        z-index: 9000;
        overflow-y: auto;
        padding: 28px 28px 40px;
        box-sizing: border-box;
        animation: aboutSlideIn 0.28s cubic-bezier(.34,1.2,.64,1);
      }
      @keyframes aboutSlideIn {
        from { transform: translateX(100%); opacity: 0; }
        to   { transform: translateX(0);   opacity: 1; }
      }
      .about-header-row {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        margin-bottom: 20px;
      }
      .about-logo-wrap {
        display: flex;
        align-items: center;
        gap: 12px;
      }
      .about-logo-icon {
        font-size: 36px;
        filter: drop-shadow(0 2px 8px rgba(79,110,247,0.5));
      }
      .about-title {
        font-size: 20px;
        font-weight: 800;
        color: var(--text, #e2e8f0);
        letter-spacing: -0.4px;
      }
      .about-subtitle {
        font-size: 12px;
        color: var(--muted, #7b8299);
        margin-top: 2px;
      }
      .about-close-btn {
        background: rgba(255,255,255,0.06);
        border: 1px solid rgba(255,255,255,0.1);
        color: var(--muted, #7b8299);
        width: 32px; height: 32px;
        border-radius: 50%;
        font-size: 15px;
        cursor: pointer;
        display: flex; align-items: center; justify-content: center;
        transition: all 0.2s;
        flex-shrink: 0;
      }
      .about-close-btn:hover {
        background: rgba(240,90,126,0.15);
        border-color: rgba(240,90,126,0.4);
        color: #f05a7e;
      }
      .about-description-box {
        background: rgba(79,110,247,0.08);
        border: 1px solid rgba(79,110,247,0.2);
        border-radius: 10px;
        padding: 14px 16px;
        font-size: 13.5px;
        color: var(--muted, #7b8299);
        line-height: 1.6;
        margin-bottom: 20px;
      }
      .about-description-box strong {
        color: var(--text, #e2e8f0);
      }
      .about-stats-grid {
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        gap: 10px;
        margin-bottom: 24px;
      }
      .about-stat-card {
        background: var(--surface, rgba(255,255,255,0.04));
        border: 1px solid var(--border, rgba(255,255,255,0.08));
        border-radius: 10px;
        padding: 14px 8px;
        text-align: center;
        position: relative;
        overflow: hidden;
      }
      .about-stat-card::before {
        content: '';
        position: absolute;
        top: 0; left: 0; right: 0;
        height: 2px;
        background: linear-gradient(90deg, #4f6ef7, #00b894);
      }
      .about-stat-val {
        font-size: 18px;
        font-weight: 800;
        color: var(--accent, #4f6ef7);
        margin-bottom: 4px;
      }
      .about-stat-label {
        font-size: 10px;
        color: var(--muted, #7b8299);
        text-transform: uppercase;
        letter-spacing: 0.5px;
        font-weight: 600;
      }
      .about-section {
        margin-bottom: 22px;
      }
      .about-section-heading {
        font-size: 14px;
        font-weight: 700;
        color: var(--text, #e2e8f0);
        margin: 0 0 10px;
      }
      .about-section-body {
        font-size: 13px;
        color: var(--muted, #7b8299);
        line-height: 1.65;
        margin: 0;
      }
      .about-steps {
        display: flex;
        flex-direction: column;
        gap: 8px;
      }
      .about-step {
        display: flex;
        align-items: flex-start;
        gap: 12px;
        font-size: 13px;
        color: var(--muted, #7b8299);
        line-height: 1.5;
      }
      .about-step-num {
        width: 22px; height: 22px;
        background: linear-gradient(135deg, #4f6ef7, #6d88ff);
        color: #fff;
        border-radius: 50%;
        font-size: 11px;
        font-weight: 700;
        display: flex; align-items: center; justify-content: center;
        flex-shrink: 0;
        margin-top: 1px;
      }
      .about-metrics-list {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
      }
      .about-metric-tag {
        background: rgba(79,110,247,0.1);
        border: 1px solid rgba(79,110,247,0.25);
        color: #4f6ef7;
        padding: 4px 10px;
        border-radius: 20px;
        font-size: 12px;
        font-weight: 600;
      }
      .about-methods {
        display: flex;
        flex-direction: column;
        gap: 10px;
      }
      .about-method-card {
        background: var(--surface, rgba(255,255,255,0.04));
        border: 1px solid var(--border, rgba(255,255,255,0.08));
        border-radius: 10px;
        padding: 12px 14px;
      }
      .about-method-name {
        font-size: 13px;
        font-weight: 700;
        color: var(--text, #e2e8f0);
        margin-bottom: 4px;
      }
      .about-method-desc {
        font-size: 12px;
        color: var(--muted, #7b8299);
        line-height: 1.5;
      }
      .about-footer {
        text-align: center;
        font-size: 12px;
        color: var(--muted, #7b8299);
        margin-top: 28px;
        padding-top: 16px;
        border-top: 1px solid var(--border, rgba(255,255,255,0.06));
      }
    `;
    document.head.appendChild(style);
  }
}

// ── AI EXPLANATION ─────────────────────────────────────────────────────────
function generateAIExplanation(data, fileName, targetCol, sensitiveCol) {
  const el = document.getElementById("ai-explanation-content");
  const bias = data.bias_report;
  const orig = data.original_model;
  const fair = data.fair_report;
  const shap = data.shap;

  const selRates = bias.group_selection_rates || {};
  const groups = Object.entries(selRates);
  const maxRate = Math.max(...groups.map(([, v]) => v), 0.01);
  const minRate = Math.min(...groups.map(([, v]) => v), 1);
  const dpd = Math.abs(bias.demographic_parity_difference);
  const dpr = bias.demographic_parity_ratio;
  const sev = bias.bias_severity;

  let topFeatures = [];
  if (shap && shap.status === "success" && shap.shap_feature_importance) {
    topFeatures = shap.shap_feature_importance.slice(0, 4);
  }

  const sevColor = { CRITICAL: "#b71c1c", HIGH: "#c05000", MODERATE: "#9a6700", LOW: "#00875a" };
  const sevBg = { CRITICAL: "#fde8e8", HIGH: "#fff3e8", MODERATE: "#fff8e8", LOW: "#e8f8f4" };

  const sections = [];

  const accRating2 = orig.accuracy >= 0.85 ? "very good" :
    orig.accuracy >= 0.75 ? "good" :
      orig.accuracy >= 0.60 ? "okay but could be better" :
        "not reliable enough";

  sections.push({
    num: "1", icon: "🤖", title: "How well does the model work?",
    body: `The model is <strong>${accRating2}</strong> at predicting outcomes — it gets the right answer <strong>${(orig.accuracy * 100).toFixed(0)} times out of 100</strong>.<br/><br/>
    It is also <strong>${orig.roc_auc >= 0.85 ? "very good" : orig.roc_auc >= 0.70 ? "decent" : "struggling"}</strong> at telling apart who should be approved versus rejected.`
  });

  const fairVerdict = dpd > 0.3 ? "No — there is serious unfair treatment" :
    dpd > 0.1 ? "Partially — there is a noticeable gap" :
      "Yes — groups are treated similarly";

  sections.push({
    num: "2", icon: "⚖️", title: "Is it treating everyone fairly?",
    color: sevColor[sev], bg: sevBg[sev],
    body: `<strong>${fairVerdict}.</strong><br/><br/>
    The <strong>"${sensitiveCol}"</strong> attribute is being used to divide people into groups. Here is what was found:<br/><br/>
    • The gap in positive outcomes between groups is <strong>${(dpd * 100).toFixed(0)}%</strong>. ${dpd < 0.05 ? "This is acceptable." : dpd < 0.2 ? "This is a moderate gap." : "This is a serious gap — significant unfairness is happening."}<br/>
    • One group receives <strong>${(dpr * 100).toFixed(0)}%</strong> of the outcomes compared to the other. ${dpr >= 0.80 ? "This meets the legal fairness standard." : "This fails the legal fairness standard — the less-favored group is being treated much worse."}`
  });

  const groupItems = groups.map(([g, v]) => `• Group <strong>${g}</strong>: gets a positive outcome <strong>${(v * 100).toFixed(0)}%</strong> of the time`).join("<br/>");
  const rateDiff = ((maxRate - minRate) * 100).toFixed(1);

  sections.push({
    num: "3", icon: "👥", title: "Who is being affected?",
    body: `${groupItems}<br/><br/>
    The best-treated group gets positive outcomes <strong>${(maxRate * 100).toFixed(0)}%</strong> of the time, while the worst-treated group only gets them <strong>${(minRate * 100).toFixed(0)}%</strong> of the time — a difference of <strong>${rateDiff}%</strong>.
    ${parseFloat(rateDiff) > 20 ? " This is very serious." : " This gap should be reduced."}`
  });

  const accDiff = ((orig.accuracy - fair.accuracy) * 100).toFixed(1);
  const sevScore = { "CRITICAL": 4, "HIGH": 3, "MODERATE": 2, "LOW": 1 };
  const corrHelped = (sevScore[fair.bias_severity] || 0) < (sevScore[sev] || 0);

  sections.push({
    num: "4", icon: "🔧", title: "Did the correction help?",
    body: `After applying bias correction, accuracy went from <strong>${(orig.accuracy * 100).toFixed(1)}%</strong> to <strong>${(fair.accuracy * 100).toFixed(1)}%</strong> — ${parseFloat(accDiff) > 20 ? "it dropped because the model was relying on unfair patterns to be accurate." : parseFloat(accDiff) > 5 ? "a small trade-off for better fairness." : "accuracy stayed about the same — good result."}<br/><br/>
    Fairness level changed from <strong>${sev}</strong> to <strong>${fair.bias_severity}</strong>. ${corrHelped ? "Some improvement was achieved." : "The correction alone was not enough. The data itself needs to be fixed."}<br/><br/>
    ${fair.bias_severity === "LOW" ? "The model is now considered fair enough to use." : "More work is needed — download the corrected dataset and re-run the analysis."}`
  });

  if (topFeatures.length > 0) {
    const top3 = topFeatures.slice(0, 3);
    const sensitiveInTop = top3.some(f => f.feature.toLowerCase().includes(sensitiveCol.toLowerCase()) || sensitiveCol.toLowerCase().includes(f.feature.toLowerCase()));
    const featList = top3.map((f, i) => `• <strong>${f.feature}</strong> — has the ${["most", "second most", "third most"][i]} influence on decisions`).join("<br/>");

    sections.push({
      num: "5", icon: "🧠", title: "What is causing the unfairness?",
      body: `The AI pays most attention to these factors when making decisions:<br/><br/>${featList}<br/><br/>
      ${sensitiveInTop
          ? `The AI is directly using <strong>"${sensitiveCol}"</strong> to make decisions. This is the main cause of unfairness — the model is judging people based on who they are, not their qualifications.`
          : `Even though <strong>"${sensitiveCol}"</strong> is not the top factor, other top factors like salary or age can be closely linked to it — causing indirect unfairness.`}`
    });
  }

  const steps = [];
  if (dpd >= 0.05 || dpr < 0.80) steps.push(`Make sure both groups in "${sensitiveCol}" have a similar number of approved and rejected cases in your data.`);
  if (topFeatures.some(f => ["race", "gender", "sex", "ethnicity", "caste"].some(k => f.feature.toLowerCase().includes(k)))) {
    steps.push(`Remove the "${topFeatures[0].feature}" column — the AI should not use this to decide outcomes.`);
  }
  if (parseFloat(accDiff) > 20) {
    steps.push(`Use the "Download Corrected Dataset" button to get a version where outcomes are based only on merit.`);
  }
  steps.push(`Re-run the analysis using the "Reweighting" method — it keeps accuracy higher while reducing unfairness.`);

  sections.push({
    num: topFeatures.length > 0 ? "6" : "5",
    icon: "🛠️",
    title: "What should you do next?",
    body: steps.map((s, i) => `<strong>Step ${i + 1}:</strong> ${s}`).join("<br/><br/>")
  });

  el.innerHTML = sections.map(s => `
    <div class="ai-section">
      <div class="ai-section-title">
        <span class="ai-num">${s.num}</span>
        <span>${s.icon} ${s.title}</span>
      </div>
      <div class="ai-section-body ${s.bg ? 'ai-highlight-box' : ''}"
           ${s.bg ? `style="--ai-box-bg:${s.bg};--ai-box-border:${s.color};"` : ""}>
        ${s.body}
      </div>
    </div>
  `).join("<hr class='ai-divider'/>");
}

// ── CONFIG VALIDATION ──────────────────────────────────────────────────────
function validateConfig() {
  const targetCol = document.getElementById("target-col").value;
  const info = columnInfo[targetCol];
  const targetHint = document.getElementById("target-hint");
  if (info && info.unique_count > 2) {
    targetHint.textContent = `⚠️ Warning: "${targetCol}" has ${info.unique_count} unique values. Target must be binary (0/1).`;
    targetHint.style.color = "var(--warning)";
  } else if (info && info.unique_count === 2) {
    targetHint.textContent = `✅ "${targetCol}" looks binary — good choice for target.`;
    targetHint.style.color = "var(--success)";
  } else {
    targetHint.textContent = "Must contain only binary values: 0 and 1 (e.g. hired, approved, selected)";
    targetHint.style.color = "";
  }
}

// ── CHART THEME HELPER ──────────────────────────────────────────────────────
function getChartTheme() {
  const isDark = document.body.classList.contains("dark-theme");
  return {
    tickColor:   isDark ? "#94a3b8" : "#7b8299",
    gridColor:   isDark ? "#1e293b" : "#f0f1f7",
    legendColor: isDark ? "#e2e8f0" : "#1a1d2e",
    labelColor:  isDark ? "#e2e8f0" : "#1a1d2e",
  };
}

function toggleTheme() {
  document.body.classList.toggle("dark-theme");
  const isDark = document.body.classList.contains("dark-theme");
  localStorage.setItem("fg_theme", isDark ? "dark" : "light");
  if (lastResultData) {
    renderComparisonChart(lastResultData.comparison);
    renderGroupAccChart(lastResultData.comparison);
    renderFeatureChart(lastResultData.original_model);
  }
}

document.addEventListener("DOMContentLoaded", () => {
  const savedTheme = localStorage.getItem("fg_theme");
  if (savedTheme === "dark") {
    document.body.classList.add("dark-theme");
  }
});

// ── AUTO SCAN ──────────────────────────────────────────────────────────────
let scanResults = [];
let worstSensitiveCol = "";

async function runAutoScan() {
  if (!sessionId) return showAlert("Please upload a dataset first.");
  const targetCol = document.getElementById("target-col").value;
  const method = document.getElementById("mitigation-method").value;
  const checkedCols = [...document.querySelectorAll(".scan-col-cb:checked")].map(cb => cb.value);
  if (checkedCols.length === 0) return showAlert("Please select at least one column to scan.");

  goToSection("scanresults");
  document.getElementById("scan-results-table-wrap").style.display = "none";
  document.getElementById("scan-subtitle").textContent = `Scanning ${checkedCols.length} columns for bias...`;
  document.getElementById("scan-progress-bar").style.width = "0%";
  scanResults = [];
  const total = checkedCols.length;

  for (let i = 0; i < checkedCols.length; i++) {
    const col = checkedCols[i];
    document.getElementById("scan-progress-bar").style.width = Math.round((i / total) * 100) + "%";
    document.getElementById("scan-progress-label").textContent = `Scanning: "${col}"`;
    document.getElementById("scan-progress-count").textContent = `${i + 1} / ${total}`;
    document.getElementById("scan-current-col").textContent = `Testing bias based on: ${col}`;
    try {
      const fd = new FormData();
      fd.append("session_id", sessionId);
      fd.append("target_col", targetCol);
      fd.append("sensitive_col", col);
      fd.append("mitigation_method", method);
      const res = await fetch("/api/full-pipeline", { method: "POST", body: fd, headers: { "Authorization": "Bearer " + (localStorage.getItem("fg_token") || "") } });
      const text = await res.text();
      let data;
      try { data = JSON.parse(text); } catch (e) {
        scanResults.push({ col, dpd: null, dpr: null, sev: "ERROR", sevScore: -1, fullData: null });
        continue;
      }
      if (!res.ok) { scanResults.push({ col, dpd: null, dpr: null, sev: "ERROR", sevScore: -1, fullData: null }); continue; }
      const dpd = Math.abs(data.bias_report.demographic_parity_difference);
      const dpr = data.bias_report.demographic_parity_ratio;
      const sev = data.bias_report.bias_severity;
      const sevScore = { CRITICAL: 4, HIGH: 3, MODERATE: 2, LOW: 1 }[sev] || 0;
      scanResults.push({ col, dpd, dpr, sev, sevScore, fullData: data });
    } catch (e) {
      scanResults.push({ col, dpd: null, dpr: null, sev: "ERROR", sevScore: -1, fullData: null });
    }
  }

  scanResults.sort((a, b) => b.sevScore - a.sevScore || (b.dpd || 0) - (a.dpd || 0));
  document.getElementById("scan-progress-bar").style.width = "100%";
  document.getElementById("scan-progress-label").textContent = "Scan complete!";
  document.getElementById("scan-current-col").textContent = "";
  document.getElementById("scan-progress-count").textContent = `${total} / ${total}`;
  renderScanResults();
}

function renderScanResults() {
  const valid = scanResults.filter(r => r.sev !== "ERROR");
  const worst = valid[0];
  worstSensitiveCol = worst ? worst.col : "";
  const sevColor = { CRITICAL: "#b71c1c", HIGH: "#c05000", MODERATE: "#9a6700", LOW: "#00875a" };
  const sevIcon = { CRITICAL: "🔴", HIGH: "🟠", MODERATE: "🟡", LOW: "🟢" };

  document.getElementById("scan-subtitle").textContent =
    `Found bias in ${valid.filter(r => r.sev !== "LOW").length} of ${valid.length} columns scanned`;

  document.getElementById("scan-results-body").innerHTML = scanResults.map((r, idx) => {
    if (r.sev === "ERROR") {
      return `<tr>
        <td>${idx + 1}</td>
        <td><strong>${r.col}</strong></td>
        <td class="muted-text">— Error</td>
        <td>—</td>
        <td>—</td>
        <td><span class="tag tag-neutral">Skipped</span></td>
      </tr>`;
    }

    const isWorst = idx === 0 && r.sev !== "LOW";
    return `<tr class="${isWorst ? 'scan-row-worst' : ''}">
      <td class="${isWorst ? 'scan-rank-worst' : 'muted-text'}">${isWorst ? "🥇" : idx + 1}</td>
      <td><strong>${r.col}</strong>${isWorst ? ` <span class="tag tag-red">Most Biased</span>` : ""}</td>
      <td><span class="scan-severity-text" style="--scan-sev-color:${sevColor[r.sev] || '#64748b'};">${sevIcon[r.sev] || ""} ${r.sev}</span></td>
      <td class="${r.dpd > 0.1 ? 'metric-danger-text' : 'metric-success-text'}"><strong>${r.dpd !== null ? r.dpd.toFixed(4) : "—"}</strong></td>
      <td class="${r.dpr < 0.8 ? 'metric-danger-text' : 'metric-success-text'}"><strong>${r.dpr !== null ? r.dpr.toFixed(4) : "—"}</strong></td>
      <td>${r.sev === "LOW" ? '<span class="tag tag-green">✅ Fair</span>' : '<span class="tag tag-red">❌ Biased</span>'}</td>
    </tr>`;
  }).join("");

  if (worst && worst.sev !== "LOW") {
    document.getElementById("scan-summary-msg").innerHTML =
      `🔍 <strong>"${worst.col}"</strong> causes the most bias — ${worst.sev} level (DPD: ${worst.dpd.toFixed(3)}, DPR: ${worst.dpr.toFixed(3)}). Click below to run full mitigation.`;
    document.getElementById("full-analysis-btn").textContent = `🚀 Run Full Analysis on "${worst.col}"`;
  } else {
    document.getElementById("scan-summary-msg").innerHTML = `✅ No significant bias detected in any column. Your dataset appears fairly unbiased.`;
    document.getElementById("full-analysis-btn").textContent = `🚀 Run Full Analysis Anyway`;
  }
  document.getElementById("scan-results-table-wrap").style.display = "block";
}

function runFullPipelineOnWorst() {
  if (!worstSensitiveCol && scanResults.length > 0) worstSensitiveCol = scanResults[0].col;
  const worst = scanResults.find(r => r.col === worstSensitiveCol);
  if (worst && worst.fullData) {
    sensitiveColUsed = worstSensitiveCol;
    try {
      renderResults(worst.fullData);
      goToSection("results");
    } catch (err) {
      console.error("renderResults error:", err);
      showAlert("Error rendering results: " + err.message);
    }
  } else {
    showAlert("No scan data available. Please run the scan first.");
  }
}

// ── DRAG & DROP ────────────────────────────────────────────────────────────
function initDragDrop() {
  const zone = document.getElementById("uploadZone");
  if (!zone) return;
  zone.addEventListener("dragover", e => { e.preventDefault(); zone.classList.add("dragover"); });
  zone.addEventListener("dragleave", () => zone.classList.remove("dragover"));
  zone.addEventListener("drop", e => {
    e.preventDefault(); zone.classList.remove("dragover");
    const file = e.dataTransfer.files[0];
    if (file) uploadFile(file);
  });
}

function handleFileUpload(e) { uploadFile(e.target.files[0]); }

// ── PDF SUPPORT: Load PDF.js from CDN if not already loaded ───────────────
function loadPdfJs() {
  return new Promise((resolve, reject) => {
    if (window.pdfjsLib) return resolve(window.pdfjsLib);
    const script = document.createElement("script");
    script.src = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
    script.onload = () => {
      window.pdfjsLib.GlobalWorkerOptions.workerSrc =
        "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
      resolve(window.pdfjsLib);
    };
    script.onerror = () => reject(new Error("Failed to load PDF.js"));
    document.head.appendChild(script);
  });
}

// ── PDF → CSV-like text extractor ─────────────────────────────────────────
async function extractCsvFromPdf(file) {
  const pdfjsLib = await loadPdfJs();
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

  const allRows = [];
  let headers = null;

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const content = await page.getTextContent();

    const lineMap = {};
    content.items.forEach(item => {
      const y = Math.round(item.transform[5]);
      if (!lineMap[y]) lineMap[y] = [];
      lineMap[y].push({ x: item.transform[4], text: item.str.trim() });
    });

    const sortedYs = Object.keys(lineMap).map(Number).sort((a, b) => b - a);

    sortedYs.forEach(y => {
      const cells = lineMap[y]
        .sort((a, b) => a.x - b.x)
        .map(c => c.text)
        .filter(t => t !== "");

      if (cells.length === 0) return;

      if (!headers) {
        headers = cells;
        allRows.push(cells.join(","));
      } else if (cells.length >= Math.floor(headers.length * 0.5)) {
        while (cells.length < headers.length) cells.push("");
        allRows.push(cells.slice(0, headers.length).map(v =>
          v.includes(",") ? `"${v}"` : v
        ).join(","));
      }
    });
  }

  if (allRows.length < 2) {
    throw new Error("Could not extract tabular data from this PDF. Please ensure the PDF contains a table with headers.");
  }

  return allRows.join("\n");
}

// ── EXCEL → CSV-like text (using SheetJS) ─────────────────────────────────
function loadSheetJs() {
  return new Promise((resolve, reject) => {
    if (window.XLSX) return resolve(window.XLSX);
    const script = document.createElement("script");
    script.src = "https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js";
    script.onload = () => resolve(window.XLSX);
    script.onerror = () => reject(new Error("Failed to load SheetJS"));
    document.head.appendChild(script);
  });
}

async function extractCsvFromExcel(file) {
  const XLSX = await loadSheetJs();
  const arrayBuffer = await file.arrayBuffer();
  const workbook = XLSX.read(arrayBuffer, { type: "array" });
  const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
  return XLSX.utils.sheet_to_csv(firstSheet);
}

// ── JSON → CSV converter ───────────────────────────────────────────────────
function convertJsonToCsv(jsonText) {
  let data;
  try { data = JSON.parse(jsonText); } catch (e) { throw new Error("Invalid JSON file."); }

  const rows = Array.isArray(data) ? data : (data.data || data.records || data.rows || null);
  if (!rows || !Array.isArray(rows) || rows.length === 0) {
    throw new Error("JSON must contain an array of objects (or a key like 'data', 'records', 'rows' with an array).");
  }

  const headers = Object.keys(rows[0]);
  const csvLines = [headers.join(",")];
  rows.forEach(row => {
    csvLines.push(headers.map(h => {
      const val = String(row[h] ?? "");
      return val.includes(",") ? `"${val}"` : val;
    }).join(","));
  });
  return csvLines.join("\n");
}

// ── MAIN UPLOAD HANDLER ────────────────────────────────────────────────────
async function uploadFile(file) {
  uploadedFileName = file.name;
  const ext = file.name.split(".").pop().toLowerCase();
  const statusDiv = document.getElementById("upload-status");
  statusDiv.style.display = "block";

  const SUPPORTED = ["csv", "xlsx", "xls", "json", "pdf"];
  if (!SUPPORTED.includes(ext)) {
    statusDiv.innerHTML = `<div class="alert alert-error">❌ Unsupported file type ".${ext}". Please upload a CSV, Excel (.xlsx/.xls), JSON, or PDF file.</div>`;
    return;
  }

  statusDiv.innerHTML = `<div class="alert alert-info">⏳ ${ext === "pdf" ? "Extracting table from PDF" : ext === "json" ? "Converting JSON" : ext.startsWith("xl") ? "Reading Excel file" : "Uploading"} — <strong>${file.name}</strong>...</div>`;

  try {
    let csvText = "";

    if (ext === "csv") {
      csvText = await file.text();
    } else if (ext === "xlsx" || ext === "xls") {
      csvText = await extractCsvFromExcel(file);
    } else if (ext === "json") {
      const raw = await file.text();
      csvText = convertJsonToCsv(raw);
    } else if (ext === "pdf") {
      statusDiv.innerHTML = `<div class="alert alert-info">⏳ Reading PDF table — this may take a moment for large files...</div>`;
      csvText = await extractCsvFromPdf(file);
    }

    uploadedFileText = csvText;

    const csvBlob = new Blob([csvText], { type: "text/csv" });
    const csvFile = new File([csvBlob], file.name.replace(/\.[^.]+$/, "") + ".csv", { type: "text/csv" });

    const fd = new FormData();
    fd.append("file", csvFile);

    const res = await fetch("/api/upload", {
      method: "POST",
      body: fd,
      headers: { "Authorization": "Bearer " + (localStorage.getItem("fg_token") || "") }
    });

    const text = await res.text();
    let data;
    try { data = JSON.parse(text); } catch (parseErr) {
      throw new Error(`Server error: ${text.substring(0, 120)}`);
    }
    if (!res.ok) throw new Error(data.detail || "Upload failed");

    sessionId = data.session_id;
    columnInfo = data.column_info || {};
    showDatasetPreview(data);
    statusDiv.innerHTML = `<div class="alert alert-success">✅ ${ext === "pdf" ? "PDF table extracted and" : ext === "json" ? "JSON converted and" : ext.startsWith("xl") ? "Excel file converted and" : "Dataset"} uploaded successfully!</div>`;

  } catch (err) {
    statusDiv.innerHTML = `<div class="alert alert-error">❌ ${err.message}</div>`;
  }
}

function showDatasetPreview(data) {
  document.getElementById("dataset-preview-card").style.display = "block";
  document.getElementById("dataset-meta").textContent =
    `${data.filename} • ${data.rows} rows × ${data.columns} columns`;

  document.getElementById("dataset-stats-grid").innerHTML = `
    <div class="metric-card"><div class="metric-value">${data.rows.toLocaleString()}</div><div class="metric-label">Total Rows</div></div>
    <div class="metric-card"><div class="metric-value">${data.columns}</div><div class="metric-label">Columns</div></div>
    <div class="metric-card"><div class="metric-value">${data.missing_values}</div><div class="metric-label">Missing Values</div></div>
    <div class="metric-card"><div class="metric-value">${data.detected_sensitive_cols.length}</div><div class="metric-label">Sensitive Cols Found</div></div>
  `;

  const hintsDiv = document.getElementById("sensitive-hints");
  hintsDiv.innerHTML = data.detected_sensitive_cols.length > 0
    ? data.detected_sensitive_cols.map(c => `<span class="tag tag-red">⚠️ ${c}</span>`).join("")
    : `<span class="tag tag-blue">None auto-detected — all columns will be scanned</span>`;

  const cols = data.column_names;
  const targetSel = document.getElementById("target-col");
  targetSel.innerHTML = cols.map(c => `<option value="${c}">${c}</option>`).join("");

  if (data.binary_columns && data.binary_columns.length > 0) {
    targetSel.value = data.binary_columns[0];
  } else if (data.detected_sensitive_cols.length > 0) {
    const nonSensitive = cols.find(c => !data.detected_sensitive_cols.includes(c));
    if (nonSensitive) targetSel.value = nonSensitive;
  }

  buildScanCheckboxes(cols, data.detected_sensitive_cols, targetSel.value);
  targetSel.onchange = () => {
    validateConfig();
    buildScanCheckboxes(cols, data.detected_sensitive_cols, targetSel.value);
  };

  renderSamplePreview(uploadedFileText);
  validateConfig();
}

// ── SAMPLE PREVIEW ─────────────────────────────────────────────────────────
function renderSamplePreview(csvText) {
  const wrap = document.getElementById("sample-preview-wrap");
  const container = document.getElementById("sample-table-container");
  if (!wrap || !container || !csvText) return;

  const lines = csvText.split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) return;

  const headers = parseCSVLine(lines[0]);
  const rows = lines.slice(1, 9).map(l => parseCSVLine(l));

  const isNumeric = val => val !== "" && !isNaN(val) && val.trim() !== "";

  const tableHTML = `
    <table class="sample-table">
      <thead>
        <tr>
          <th>#</th>
          ${headers.map(h => `<th title="${h}">${h.length > 14 ? h.slice(0, 13) + "…" : h}</th>`).join("")}
        </tr>
      </thead>
      <tbody>
        ${rows.map((row, i) => `
          <tr>
            <td style="color:var(--muted);font-size:11px;">${i + 1}</td>
            ${headers.map((_, j) => {
              const val = row[j] ?? "—";
              const num = isNumeric(val);
              return `<td class="${num ? 'numeric-cell' : ''}" title="${val}">${val.length > 16 ? val.slice(0, 15) + "…" : val}</td>`;
            }).join("")}
          </tr>`).join("")}
      </tbody>
    </table>`;

  container.innerHTML = tableHTML;
  wrap.style.display = "block";
}

// ── CORRELATION HEATMAP ────────────────────────────────────────────────────
function renderCorrelationHeatmap(csvText, targetCol) {
  const card = document.getElementById("correlation-heatmap-card");
  const container = document.getElementById("heatmap-container");
  if (!card || !container || !csvText) return;

  const lines = csvText.split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 3) return;

  const headers = parseCSVLine(lines[0]);
  const rows = lines.slice(1, 201).map(l => parseCSVLine(l));

  const numericCols = headers.filter((col, idx) => {
    const vals = rows.map(r => r[idx]).filter(v => v !== undefined && v !== "");
    return vals.slice(0, 20).every(v => !isNaN(v) && v.trim() !== "");
  });

  if (numericCols.length < 2) {
    card.style.display = "none";
    return;
  }

  const cols = numericCols.slice(0, 10);

  const colData = {};
  cols.forEach(col => {
    const idx = headers.indexOf(col);
    colData[col] = rows.map(r => parseFloat(r[idx])).filter(v => !isNaN(v));
  });

  function pearson(a, b) {
    const n = Math.min(a.length, b.length);
    if (n < 2) return 0;
    const meanA = a.slice(0, n).reduce((s, v) => s + v, 0) / n;
    const meanB = b.slice(0, n).reduce((s, v) => s + v, 0) / n;
    let num = 0, da = 0, db = 0;
    for (let i = 0; i < n; i++) {
      const dA = a[i] - meanA, dB = b[i] - meanB;
      num += dA * dB;
      da += dA * dA;
      db += dB * dB;
    }
    return da && db ? +(num / Math.sqrt(da * db)).toFixed(2) : 0;
  }

  function corrColor(val) {
    const abs = Math.abs(val);
    if (val >= 0) {
      const r = Math.round(255 - (255 - 239) * abs);
      const g = Math.round(255 - (255 - 68) * abs);
      const b = Math.round(255 - (255 - 68) * abs);
      return `rgb(${r},${g},${b})`;
    } else {
      const r = Math.round(255 - (255 - 37) * abs);
      const g = Math.round(255 - (255 - 99) * abs);
      const b = Math.round(255 - (255 - 235) * abs);
      return `rgb(${r},${g},${b})`;
    }
  }

  function textColor(val) {
    return Math.abs(val) > 0.45 ? "#fff" : "#1a1d2e";
  }

  const shortLabel = s => s.length > 8 ? s.slice(0, 7) + "…" : s;

  let html = `
    <div style="overflow-x:auto;">
      <div style="display:inline-block;min-width:max-content;">
        <div class="heatmap-col-labels" style="margin-left:120px;">
          ${cols.map(c => `<div class="heatmap-col-label" title="${c}">${shortLabel(c)}</div>`).join("")}
        </div>
        ${cols.map(rowCol => {
          const isTarget = rowCol === targetCol;
          return `<div class="heatmap-row">
            <div class="heatmap-label" style="width:120px;${isTarget ? 'color:var(--accent);font-weight:800;' : ''}" title="${rowCol}">
              ${isTarget ? "🎯 " : ""}${shortLabel(rowCol)}
            </div>
            ${cols.map(colCol => {
              const val = pearson(colData[rowCol], colData[colCol]);
              const bg = corrColor(val);
              const tc = textColor(val);
              const isTargetCell = colCol === targetCol || rowCol === targetCol;
              return `<div class="heatmap-cell"
                style="background:${bg};color:${tc};${isTargetCell ? 'outline:2px solid var(--accent);outline-offset:-2px;' : ''}"
                title="${rowCol} ↔ ${colCol}: ${val}">
                ${val.toFixed(2)}
              </div>`;
            }).join("")}
          </div>`;
        }).join("")}
      </div>
    </div>
    <div class="heatmap-legend">
      <span style="font-size:11px;color:var(--muted);">Strong negative</span>
      <div class="heatmap-legend-bar"></div>
      <span style="font-size:11px;color:var(--muted);">Strong positive</span>
      <span style="margin-left:12px;font-size:11px;color:var(--muted);">🎯 = Target column</span>
    </div>`;

  container.innerHTML = html;
  card.style.display = "block";
}

// ── COLUMN TYPE DETECTION ──────────────────────────────────────────────────
function detectColumnTypes(csvText, allCols) {
  const lines = csvText.split(/\r?\n/).filter(l => l.trim());
  const header = parseCSVLine(lines[0]);
  const sampleRows = lines.slice(1, 201).map(l => parseCSVLine(l));
  const colTypes = {};

  header.forEach((col, idx) => {
    const values = sampleRows.map(r => r[idx]).filter(v => v !== undefined && v !== "");
    const uniqueVals = [...new Set(values)];
    const uniqueCount = uniqueVals.length;
    const allNumeric = values.every(v => !isNaN(v) && v.trim() !== "");
    const isCategorical = !allNumeric || (allNumeric && uniqueCount <= 8);
    const isBinary = uniqueCount <= 2;

    colTypes[col] = {
      uniqueCount,
      isCategorical,
      isBinary,
      isNumericContinuous: allNumeric && uniqueCount > 8
    };
  });

  return colTypes;
}

function buildScanCheckboxes(allCols, detectedSensitive, targetCol) {
  const grid = document.getElementById("scan-columns-grid");
  const SENSITIVE_KEYWORDS = ['race', 'gender', 'sex', 'religion', 'nationality', 'ethnicity', 'caste', 'marital', 'marital_status'];
  const colTypes = uploadedFileText ? detectColumnTypes(uploadedFileText, allCols) : {};

  const categorized = allCols.filter(c => c !== targetCol).map(c => {
    const info = colTypes[c] || {};
    const nameMatch = SENSITIVE_KEYWORDS.some(k => c.toLowerCase().includes(k));
    const isDetectedSensitive = detectedSensitive.includes(c);
    const shouldExclude = info.isNumericContinuous === true;
    const isSensitive = nameMatch || isDetectedSensitive;
    return { col: c, info, isSensitive, shouldExclude };
  });

  const includedCols = categorized.filter(c => !c.shouldExclude);
  const excludedCols = categorized.filter(c => c.shouldExclude);

  let html = includedCols.map(({ col, info, isSensitive }) => {
    const badge = isSensitive
      ? `<span class="col-checkbox-badge tag tag-red">⚠️ sensitive</span>`
      : info.isBinary
        ? `<span class="col-checkbox-badge tag tag-blue">binary</span>`
        : `<span class="col-checkbox-badge tag tag-blue">${info.uniqueCount} vals</span>`;

    return `
      <label class="col-checkbox-item ${isSensitive ? "sensitive-detected" : ""}">
        <input type="checkbox" class="scan-col-cb" value="${col}" checked />
        <span class="col-checkbox-label">${col}</span>
        ${badge}
      </label>`;
  }).join("");

  if (excludedCols.length > 0) {
    html += `
    <div class="excluded-cols-box">
      <strong>🚫 Auto-excluded (continuous numbers):</strong>
      <div class="excluded-cols-list">
        ${excludedCols.map(c => `<span class="excluded-col-pill">${c.col}</span>`).join("")}
      </div>
    </div>`;
  }

  grid.innerHTML = html || `<div class="empty-state-text">No suitable categorical columns found.</div>`;
}

function toggleAllCols(checked) {
  document.querySelectorAll(".scan-col-cb").forEach(cb => cb.checked = checked);
}

// ── RENDER RESULTS ─────────────────────────────────────────────────────────
function renderResults(d) {
  lastResultData = d;

  const bias = d.bias_report;
  const fair = d.fair_report;
  const orig = d.original_model;
  const shap = d.shap;
  const comp = d.comparison;
  const targetCol = document.getElementById("target-col").value;

  const sev = bias.bias_severity;
  const sevLabel = {
    CRITICAL: "Serious Problem",
    HIGH: "Major Issue",
    MODERATE: "Some Issues",
    LOW: "Mostly Fair"
  }[sev] || sev;

  const sevDesc = {
    CRITICAL: "The AI is making heavily unfair decisions between groups. Immediate fix needed.",
    HIGH: "The AI shows significant unfairness between groups.",
    MODERATE: "There is some unfairness that should be addressed.",
    LOW: "The AI is treating all groups relatively fairly."
  }[sev] || "";

  document.getElementById("severity-badge-container").innerHTML =
    `<div class="severity-badge severity-${sev}">${severityIcon(sev)} ${sevLabel}</div>`;

  document.getElementById("bias-detected-msg").innerHTML = `
    <div class="bias-desc-text">${sevDesc}</div>
    ${bias.bias_detected
      ? `<span class="tag tag-red result-status-tag">Unfairness found — correction applied</span>`
      : `<span class="tag tag-green result-status-tag">Model is treating groups fairly</span>`}`;

  const dprOk = bias.demographic_parity_ratio >= 0.80;
  const fairOk = sev === "LOW" || sev === "MODERATE";

  document.getElementById("quick-verdict").innerHTML = `
    <div class="verdict-item ${orig.accuracy >= 0.75 ? "verdict-ok" : "verdict-warn"}">
      <div class="verdict-icon">${orig.accuracy >= 0.75 ? "✅" : "⚠️"}</div>
      <div>
        <div class="verdict-label">Model Accuracy</div>
        <div class="verdict-val">${(orig.accuracy * 100).toFixed(1)}%</div>
      </div>
    </div>
    <div class="verdict-item ${fairOk ? "verdict-ok" : "verdict-bad"}">
      <div class="verdict-icon">${fairOk ? "✅" : "🔴"}</div>
      <div>
        <div class="verdict-label">Fairness Level</div>
        <div class="verdict-val">${sevLabel}</div>
      </div>
    </div>
    <div class="verdict-item ${dprOk ? "verdict-ok" : "verdict-bad"}">
      <div class="verdict-icon">${dprOk ? "✅" : "❌"}</div>
      <div>
        <div class="verdict-label">Legal Standard (80% Rule)</div>
        <div class="verdict-val">${dprOk ? "Passes" : "Fails"}</div>
      </div>
    </div>
    <div class="verdict-item verdict-ok">
      <div class="verdict-icon">🔧</div>
      <div>
        <div class="verdict-label">After Correction</div>
        <div class="verdict-val">${(fair.accuracy * 100).toFixed(1)}% accuracy</div>
      </div>
    </div>`;

  function metricCard(val, label, tip, hl) {
    const hlClass = hl === "good"
      ? "metric-value-good"
      : hl === "warn"
        ? "metric-value-warn"
        : "metric-value-accent";

    return `<div class="metric-card">
      <div class="metric-value ${hlClass}">${val}</div>
      <div class="metric-label">${label}</div>
      <div class="metric-tip">${tip}</div>
    </div>`;
  }

  const accRating = orig.accuracy >= 0.85 ? "Excellent"
    : orig.accuracy >= 0.75 ? "Good"
      : orig.accuracy >= 0.60 ? "Fair"
        : "Needs Improvement";

  const f1Rating = orig.f1_score >= 0.80 ? "Well balanced"
    : orig.f1_score >= 0.65 ? "Reasonably balanced"
      : "Imbalanced";

  document.getElementById("model-metrics-grid").innerHTML =
    metricCard(`${(orig.accuracy * 100).toFixed(1)}%`, "Accuracy", accRating, orig.accuracy >= 0.75 ? "good" : "warn") +
    metricCard(`${(orig.f1_score * 100).toFixed(1)}%`, "Reliability", f1Rating, orig.f1_score >= 0.70 ? "good" : "warn") +
    metricCard(
      `${(orig.roc_auc * 100).toFixed(1)}%`,
      "Distinction Ability",
      orig.roc_auc >= 0.85
        ? "Excellent at separating Yes/No"
        : orig.roc_auc >= 0.70
          ? "Decent at separating Yes/No"
          : "Struggles to separate Yes/No",
      orig.roc_auc >= 0.80 ? "good" : "warn"
    );

  const fmDefs = [
    {
      name: "Outcome Gap",
      tech: "Demographic Parity Difference",
      tip: "How big is the difference in approval rates between groups?",
      val: bias.demographic_parity_difference,
      ideal: "0.00",
      threshold: "< 0.05",
      plain: Math.abs(bias.demographic_parity_difference) < 0.05
        ? "Both groups get similar outcomes"
        : `One group gets ${(Math.abs(bias.demographic_parity_difference) * 100).toFixed(0)}% fewer approvals`,
      good: Math.abs(bias.demographic_parity_difference) < 0.05
    },
    {
      name: "Fairness Ratio",
      tech: "Demographic Parity Ratio",
      tip: "What fraction of outcomes does the less-favored group receive?",
      val: bias.demographic_parity_ratio,
      ideal: "> 0.80",
      threshold: ">= 0.80",
      plain: bias.demographic_parity_ratio >= 0.80
        ? "Meets the 80% legal standard"
        : `Below legal standard — only ${(bias.demographic_parity_ratio * 100).toFixed(0)}% ratio`,
      good: bias.demographic_parity_ratio >= 0.80
    },
    {
      name: "Error Fairness",
      tech: "Equalized Odds Difference",
      tip: "Does the AI make the same types of mistakes for all groups?",
      val: bias.equalized_odds_difference,
      ideal: "0.00",
      threshold: "< 0.10",
      plain: Math.abs(bias.equalized_odds_difference) < 0.10
        ? "AI makes similar errors for all groups"
        : "AI is less accurate for some groups than others",
      good: Math.abs(bias.equalized_odds_difference) < 0.10
    }
  ];

  document.getElementById("fairness-metrics-body").innerHTML = fmDefs.map(m => `
    <tr>
      <td>
        <strong>${m.name}</strong>
        <div class="fairness-tech-text">${m.tech}</div>
        <div class="${m.good ? 'metric-success-text fairness-plain-text' : 'metric-danger-text fairness-plain-text'}">${m.plain}</div>
      </td>
      <td><strong class="${m.good ? 'metric-success-text' : 'metric-danger-text'}">${m.val}</strong></td>
      <td class="muted-text">${m.ideal}</td>
      <td class="muted-text">${m.threshold}</td>
      <td>${m.good ? '<span class="tag tag-green">✅ Fair</span>' : '<span class="tag tag-red">❌ Biased</span>'}</td>
    </tr>
  `).join("");

  document.getElementById("interpretation-list").innerHTML =
    (bias.interpretation || []).map(i => `<li>${i}</li>`).join("");

  document.getElementById("fair-metrics-grid").innerHTML =
    metricCard(`${(fair.accuracy * 100).toFixed(1)}%`, "Accuracy After Fix", "How correct the model is after bias correction", fair.accuracy >= 0.70 ? "good" : "warn") +
    metricCard(`${(fair.f1_score * 100).toFixed(1)}%`, "Balance Score After Fix", "Precision and recall combined after correction", fair.f1_score >= 0.70 ? "good" : "warn") +
    metricCard(fair.demographic_parity_difference, "Outcome Gap After Fix", "Difference in approval rates — closer to 0 is better", Math.abs(fair.demographic_parity_difference) < 0.05 ? "good" : "warn") +
    metricCard(fair.demographic_parity_ratio, "Fairness Ratio After Fix", "Approval ratio between groups — above 0.80 meets legal standard", fair.demographic_parity_ratio >= 0.80 ? "good" : "warn") +
    metricCard(fair.bias_severity, "Final Fairness Level", "Overall fairness rating after correction", fair.bias_severity === "LOW" ? "good" : fair.bias_severity === "MODERATE" ? "warn" : "");

  renderComparisonChart(comp);
  renderGroupAccChart(comp);
  renderFeatureChart(orig);
  showFixedDatasetCard(shap);

  const selRates = bias.group_selection_rates || {};
  const selValues = Object.values(selRates);
  const maxSel = selValues.length > 0 ? Math.max(...selValues) : 1;
  const minSel = selValues.length > 0 ? Math.min(...selValues) : 0;
  const gColors = ["#4f6ef7", "#f05a7e", "#00b894", "#f0a500", "#9b59b6"];

  document.getElementById("selection-rates-bars").innerHTML =
    Object.entries(selRates).map(([g, v], idx) => {
      const pct = (v * 100).toFixed(1);
      const isMax = v === maxSel;
      const isMin = v === minSel && selValues.length > 1;

      return `<div class="group-rate-row">
        <div class="group-rate-label">
          <span class="group-dot" style="background:${gColors[idx % gColors.length]}"></span>
          <span>Group ${g}</span>
          ${isMax ? `<span class="tag tag-green compact-tag">Most favored</span>` : ""}
          ${isMin ? `<span class="tag tag-red compact-tag">Least favored</span>` : ""}
        </div>
        <div class="group-rate-bar-wrap">
          <div class="group-rate-bar" style="width:${(v / maxSel) * 100}%;background:${gColors[idx % gColors.length]};"></div>
        </div>
        <div class="group-rate-pct ${isMax ? 'metric-success-text' : isMin ? 'metric-danger-text' : ''}">${pct}%</div>
      </div>`;
    }).join("") +
    (selValues.length > 1 ? `<div class="group-rate-note">
      The gap between most and least favored group is <strong class="metric-danger-text">${((maxSel - minSel) * 100).toFixed(1)}%</strong>.
      ${(maxSel - minSel) > 0.2 ? "This is a serious disparity." : (maxSel - minSel) > 0.1 ? "This gap needs attention." : "Groups are treated fairly similarly."}
    </div>` : "");

  if (shap && shap.status === "success" && shap.shap_feature_importance && shap.shap_feature_importance.length > 0) {
    const shapData = shap.shap_feature_importance;
    const maxShap = Math.max(...shapData.map(d => d.shap_value)) || 1;
    const SENS_KEYS = ["race", "gender", "sex", "ethnicity", "caste", "religion", "nationality"];

    document.getElementById("shap-bars").innerHTML = shapData.map((d, idx) => {
      const isSensitive = SENS_KEYS.some(k => d.feature.toLowerCase().includes(k));
      const rank = ["Most influential", "2nd", "3rd", "4th", "5th", "6th", "7th", "8th"][idx] || `#${idx + 1}`;

      return `<div class="shap-bar-row">
        <div class="shap-feature">
          ${d.feature}
          ${isSensitive ? `<span class="tag tag-red compact-sensitive-tag">sensitive</span>` : ""}
        </div>
        <div class="shap-bar-track">
          <div class="shap-bar-fill" style="width:${(d.shap_value / maxShap) * 100}%;${isSensitive ? "background:linear-gradient(90deg,#f05a7e,#e53935);" : ""}">${d.shap_value}</div>
        </div>
        <div class="shap-rank-text">${rank}</div>
      </div>`;
    }).join("");
  }

  renderCorrelationHeatmap(uploadedFileText, targetCol);

  saveToHistory(uploadedFileName, sensitiveColUsed, d);
  generateAIExplanation(d, uploadedFileName, targetCol, sensitiveColUsed);
}

// ── FIXED DATASET ──────────────────────────────────────────────────────────
let targetColUsedForFix = "";

function showFixedDatasetCard(shap) {
  const card = document.getElementById("fixed-dataset-card");
  card.style.display = "block";

  const SENSITIVE_KEYWORDS = ['race', 'gender', 'sex', 'religion', 'nationality', 'ethnicity', 'caste', 'marital'];
  const biasedCols = new Set([sensitiveColUsed]);

  if (shap && shap.shap_feature_importance) {
    shap.shap_feature_importance.forEach(f => {
      if (SENSITIVE_KEYWORDS.some(k => f.feature.toLowerCase().includes(k))) {
        biasedCols.add(f.feature);
      }
    });
  }

  const baseName = uploadedFileName.replace(/\.[^.]+$/, '');

  document.getElementById("fixed-dataset-subtitle").textContent =
    `"${baseName}_corrected.csv" — target column recalculated on merit only, all columns kept intact`;

  document.getElementById("fixed-dataset-removed-cols").innerHTML = `
    <div class="fixed-dataset-info-wrap">
      <div>
        <div class="fixed-dataset-info-title">🔍 Biased columns detected (kept but neutralized in outcome):</div>
        <div class="fixed-dataset-pill-wrap">${[...biasedCols].map(c => `<span class="tag tag-red">⚠️ ${c}</span>`).join("")}</div>
      </div>
      <div>
        <div class="fixed-dataset-info-title">✅ What changes:</div>
        <span class="tag tag-green">Target column recalculated on merit</span>
      </div>
    </div>`;

  card._biasedCols = [...biasedCols];
}

function downloadFixedDataset() {
  const btn = document.getElementById("fixed-dataset-btn");
  const status = document.getElementById("fixed-dataset-status");
  const card = document.getElementById("fixed-dataset-card");
  const biasedCols = card._biasedCols || [sensitiveColUsed];

  if (!uploadedFileText) {
    status.innerHTML = `<div class="alert alert-error">❌ Original file not found in memory. Please re-upload and run analysis again.</div>`;
    return;
  }

  try {
    btn.disabled = true;
    btn.innerHTML = `<div class="spinner"></div> Recreating dataset...`;

    const lines = uploadedFileText.split(/\r?\n/).filter(l => l.trim());
    if (lines.length < 2) throw new Error("File appears empty or invalid.");

    const header = parseCSVLine(lines[0]);
    const dataRows = lines.slice(1).map(l => {
      const vals = parseCSVLine(l);
      const obj = {};
      header.forEach((h, i) => obj[h] = vals[i] ?? "");
      return obj;
    });

    const targetCol = document.getElementById("target-col").value;
    const targetIdx = header.indexOf(targetCol);
    if (targetIdx === -1) throw new Error(`Target column "${targetCol}" not found in CSV.`);

    const biasedSet = new Set(biasedCols.map(c => c.toLowerCase()));
    const meritCols = header.filter(col => {
      if (col === targetCol) return false;
      if (biasedSet.has(col.toLowerCase())) return false;
      const vals = dataRows.map(r => r[col]).filter(v => v !== "");
      return vals.every(v => !isNaN(v) && v.trim() !== "");
    });

    if (meritCols.length === 0) throw new Error("No numeric merit columns found to calculate fair outcome.");

    const normStats = {};
    meritCols.forEach(col => {
      const nums = dataRows.map(r => parseFloat(r[col])).filter(v => !isNaN(v));
      const min = Math.min(...nums);
      const max = Math.max(...nums);
      normStats[col] = { min, max, range: max - min || 1 };
    });

    const meritScores = dataRows.map(row => {
      let score = 0;
      meritCols.forEach(col => {
        const val = parseFloat(row[col]);
        if (!isNaN(val)) score += (val - normStats[col].min) / normStats[col].range;
      });
      return score / meritCols.length;
    });

    const originalApprovalRate = dataRows.filter(r => r[targetCol] === "1").length / dataRows.length;
    const sorted = [...meritScores].sort((a, b) => b - a);
    const thresholdIdx = Math.floor(sorted.length * originalApprovalRate);
    const threshold = sorted[thresholdIdx] ?? 0.5;

    let noiseIdx = 0;
    const noiseSeeds = [0.012, -0.008, 0.015, -0.011, 0.007, -0.014, 0.009, -0.006, 0.013, -0.010];

    const correctedRows = dataRows.map((row, i) => {
      const noise = noiseSeeds[noiseIdx++ % noiseSeeds.length] * 0.1;
      const newTarget = (meritScores[i] + noise) >= threshold ? "1" : "0";
      return { ...row, [targetCol]: newTarget };
    });

    const newApproval = correctedRows.filter(r => r[targetCol] === "1").length;

    let verifyMsg = "";
    biasedCols.forEach(bc => {
      if (!header.includes(bc)) return;
      const groups = {};
      correctedRows.forEach(row => {
        const g = row[bc];
        if (!groups[g]) groups[g] = { total: 0, approved: 0 };
        groups[g].total++;
        if (row[targetCol] === "1") groups[g].approved++;
      });
      const rates = Object.entries(groups).map(([g, v]) => `${g}: ${(v.approved / v.total * 100).toFixed(0)}%`).join(", ");
      verifyMsg += `<br/>• <strong>${bc}</strong> approval rates: ${rates}`;
    });

    const csvLines = [header.join(",")];
    correctedRows.forEach(row => {
      csvLines.push(header.map(h => {
        const val = row[h] ?? "";
        return val.includes(",") ? `"${val}"` : val;
      }).join(","));
    });

    const blob = new Blob([csvLines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const outBaseName = uploadedFileName.replace(/\.[^.]+$/, '');
    a.href = url;
    a.download = `${outBaseName}_corrected.csv`;
    a.click();
    URL.revokeObjectURL(url);

    status.innerHTML = `
      <div class="alert alert-success">
        ✅ <strong>Corrected dataset downloaded!</strong><br/>
        • All <strong>${header.length} columns kept intact</strong><br/>
        • <strong>"${targetCol}"</strong> recalculated based on: ${meritCols.join(", ")}<br/>
        • Original approval rate preserved (~${(originalApprovalRate * 100).toFixed(0)}%)<br/>
        • Merit-based approvals: ${newApproval}/${correctedRows.length}
        ${verifyMsg}
      </div>`;
  } catch (err) {
    status.innerHTML = `<div class="alert alert-error">❌ ${err.message}</div>`;
  }

  btn.disabled = false;
  btn.innerHTML = "⚙️ Download Corrected Dataset (CSV)";
}

// ── CSV PARSER ─────────────────────────────────────────────────────────────
function parseCSVLine(line) {
  const result = [];
  let cur = "", inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (ch === ',' && !inQuotes) {
      result.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }

  result.push(cur);
  return result;
}

// ── CHARTS ─────────────────────────────────────────────────────────────────
function renderComparisonChart(comp) {
  const canvas = document.getElementById("comparisonChart");
  if (!canvas) return;
  if (compChart) compChart.destroy();

  const ctx = canvas.getContext("2d");
  const b = comp.before, a = comp.after;

  compChart = new Chart(ctx, {
    type: "bar",
    data: {
      labels: ["DPD", "DPR", "EOD"],
      datasets: [
        {
          label: "Before (Biased)",
          data: [
            Math.abs(b.demographic_parity_difference),
            b.demographic_parity_ratio,
            Math.abs(b.equalized_odds_difference)
          ],
          backgroundColor: "rgba(240,90,126,0.75)",
          borderRadius: 6
        },
        {
          label: "After (Fair)",
          data: [
            Math.abs(a.demographic_parity_difference),
            a.demographic_parity_ratio,
            Math.abs(a.equalized_odds_difference)
          ],
          backgroundColor: "rgba(0,184,148,0.75)",
          borderRadius: 6
        }
      ]
    },
    options: {
      responsive: true,
      plugins: {
        legend: { labels: { color: getChartTheme().legendColor } }
      },
      scales: {
        x: { ticks: { color: getChartTheme().tickColor }, grid: { color: getChartTheme().gridColor } },
        y: { ticks: { color: getChartTheme().tickColor }, grid: { color: getChartTheme().gridColor } }
      }
    }
  });
}

function renderGroupAccChart(comp) {
  const canvas = document.getElementById("groupAccChart");
  if (!canvas) return;
  if (groupChart) groupChart.destroy();

  const ctx = canvas.getContext("2d");
  const before = comp.before.group_accuracies || {};
  const after = comp.after.group_accuracies || {};
  const labels = Object.keys(before);

  groupChart = new Chart(ctx, {
    type: "bar",
    data: {
      labels: labels.map(l => `Group ${l}`),
      datasets: [
        {
          label: "Before",
          data: labels.map(l => before[l]),
          backgroundColor: "rgba(240,90,126,0.75)",
          borderRadius: 6
        },
        {
          label: "After",
          data: labels.map(l => after[l] || 0),
          backgroundColor: "rgba(79,110,247,0.75)",
          borderRadius: 6
        }
      ]
    },
    options: {
      responsive: true,
      plugins: {
        legend: { labels: { color: getChartTheme().legendColor } }
      },
      scales: {
        x: { ticks: { color: getChartTheme().tickColor }, grid: { color: getChartTheme().gridColor } },
        y: { ticks: { color: getChartTheme().tickColor }, grid: { color: getChartTheme().gridColor }, min: 0, max: 1 }
      }
    }
  });
}

function renderFeatureChart(orig) {
  if (featChart) featChart.destroy();

  const ctx = document.getElementById("featureChart").getContext("2d");
  const features = (orig.top_features || []).slice(0, 8);

  featChart = new Chart(ctx, {
    type: "bar",
    data: {
      labels: features.map(f => f.feature),
      datasets: [{
        label: "Feature Importance",
        data: features.map(f => f.importance),
        backgroundColor: features.map((_, i) => `hsla(${220 + i * 18},70%,58%,0.85)`),
        borderRadius: 6
      }]
    },
    options: {
      indexAxis: "y",
      responsive: true,
      plugins: {
        legend: { display: false }
      },
      scales: {
        x: { ticks: { color: getChartTheme().tickColor }, grid: { color: getChartTheme().gridColor } },
        y: { ticks: { color: getChartTheme().labelColor, font: { size: 12 } }, grid: { display: false } }
      }
    }
  });
}

// ── DETAILED PDF REPORT ────────────────────────────────────────────────────
async function downloadDetailedPDF() {
  if (!lastResultData) return showAlert("No analysis data. Please run an analysis first.");
  const btn = document.getElementById("report-btn");
  btn.disabled = true;
  btn.innerHTML = `<div class="spinner"></div> Building PDF...`;

  try {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    const d = lastResultData;
    const bias = d.bias_report;
    const orig = d.original_model;
    const fair = d.fair_report;
    const shap = d.shap;
    const pageW = 210, margin = 18;
    let y = 20;

    const text = (txt, x, yPos, opts = {}) => {
      doc.setFontSize(opts.size || 10);
      doc.setFont("helvetica", opts.bold ? "bold" : "normal");
      doc.setTextColor(...(opts.color || [26, 29, 46]));
      doc.text(String(txt), x, yPos, opts);
    };

    const rect = (x, yPos, w, h, fill = [245, 246, 250], stroke = null) => {
      doc.setFillColor(...fill);
      if (stroke) doc.setDrawColor(...stroke);
      else doc.setDrawColor(...fill);
      doc.roundedRect(x, yPos, w, h, 2, 2, stroke ? "FD" : "F");
    };

    const ensureSpace = (needed = 18) => {
      if (y + needed > 275) { doc.addPage(); y = 20; }
    };

    const writeWrappedText = (txt, x, yPos, maxW, opts = {}) => {
      const lines = doc.splitTextToSize(String(txt), maxW);
      doc.setFontSize(opts.size || 10);
      doc.setFont("helvetica", opts.bold ? "bold" : "normal");
      doc.setTextColor(...(opts.color || [26, 29, 46]));
      doc.text(lines, x, yPos, opts);
      return lines.length * ((opts.lineHeight || 5));
    };

    const writeSection = (num, title, items = []) => {
      ensureSpace(22);
      rect(margin, y - 5, pageW - margin * 2, 10, [239, 244, 255]);
      text(`${num}. ${title}`, margin + 4, y + 1.5, { size: 11, bold: true, color: [37, 99, 235] });
      y += 12;

      items.forEach(item => {
        ensureSpace(14);
        if (item.type === "text") {
          const h = writeWrappedText(item.t, margin, y, pageW - margin * 2, { size: 10, lineHeight: 5 });
          y += h + 2;
        }
        if (item.type === "bullet") {
          text("•", margin + 1, y, { size: 11, bold: true, color: [79, 110, 247] });
          const h = writeWrappedText(item.t, margin + 6, y, pageW - margin * 2 - 8, { size: 10, lineHeight: 5 });
          y += h + 1.5;
        }
        if (item.type === "metric") {
          rect(margin, y - 4, pageW - margin * 2, 12, [250, 251, 253], [232, 236, 242]);
          text(item.label, margin + 4, y + 1, { size: 9, bold: true });
          text(item.value, pageW - margin - 4, y + 1, { size: 9, bold: true, align: "right", color: item.good ? [0, 135, 90] : [183, 28, 28] });
          y += 15;
        }
      });
      y += 3;
    };

    doc.setFillColor(79, 110, 247);
    doc.rect(0, 0, pageW, 40, "F");
    text("FairGuard AI", margin, 16, { size: 20, bold: true, color: [255, 255, 255] });
    text("Bias Detection & Fairness Audit Report", margin, 25, { size: 11, color: [200, 210, 255] });
    text(`Generated: ${new Date().toLocaleString()}`, margin, 33, { size: 9, color: [180, 195, 255] });
    text(`Dataset: ${uploadedFileName}`, pageW - margin, 25, { size: 9, color: [200, 210, 255], align: "right" });
    text(`Sensitive Attribute: ${sensitiveColUsed}`, pageW - margin, 33, { size: 9, color: [200, 210, 255], align: "right" });
    y = 52;

    const sevColors = { CRITICAL: [253, 232, 232], HIGH: [255, 243, 232], MODERATE: [255, 248, 232], LOW: [232, 248, 244] };
    const sevStroke = { CRITICAL: [244, 63, 94], HIGH: [245, 158, 11], MODERATE: [250, 204, 21], LOW: [16, 185, 129] };

    rect(margin, y, pageW - margin * 2, 20, sevColors[bias.bias_severity] || [245, 246, 250], sevStroke[bias.bias_severity] || [220, 224, 234]);
    text(`Bias Severity: ${bias.bias_severity}`, margin + 5, y + 7, { size: 12, bold: true, color: [26, 29, 46] });
    text(bias.bias_detected ? "Bias detected — fairness mitigation recommended/applied." : "No strong bias detected.", margin + 5, y + 14, { size: 9, color: [80, 90, 110] });
    y += 28;

    writeSection(1, "Executive Summary", [
      { type: "text", t: `This report analyzes the dataset "${uploadedFileName}" for algorithmic bias using the sensitive attribute "${sensitiveColUsed}". The model achieved ${(orig.accuracy * 100).toFixed(1)}% accuracy before mitigation and ${(fair.accuracy * 100).toFixed(1)}% accuracy after mitigation.` },
      { type: "bullet", t: `Bias severity level: ${bias.bias_severity}` },
      { type: "bullet", t: `Demographic Parity Difference (DPD): ${bias.demographic_parity_difference}` },
      { type: "bullet", t: `Demographic Parity Ratio (DPR): ${bias.demographic_parity_ratio}` },
      { type: "bullet", t: `Equalized Odds Difference (EOD): ${bias.equalized_odds_difference}` }
    ]);

    writeSection(2, "Model Performance", [
      { type: "metric", label: "Accuracy (Before)", value: `${(orig.accuracy * 100).toFixed(1)}%`, good: orig.accuracy >= 0.75 },
      { type: "metric", label: "F1 Score (Before)", value: `${(orig.f1_score * 100).toFixed(1)}%`, good: orig.f1_score >= 0.70 },
      { type: "metric", label: "ROC AUC (Before)", value: `${(orig.roc_auc * 100).toFixed(1)}%`, good: orig.roc_auc >= 0.80 },
      { type: "metric", label: "Accuracy (After)", value: `${(fair.accuracy * 100).toFixed(1)}%`, good: fair.accuracy >= 0.70 },
      { type: "metric", label: "F1 Score (After)", value: `${(fair.f1_score * 100).toFixed(1)}%`, good: fair.f1_score >= 0.70 }
    ]);

    writeSection(3, "Fairness Metrics", [
      { type: "bullet", t: `Demographic Parity Difference: ${bias.demographic_parity_difference} — ${Math.abs(bias.demographic_parity_difference) < 0.05 ? "acceptable" : "shows a fairness gap"}` },
      { type: "bullet", t: `Demographic Parity Ratio: ${bias.demographic_parity_ratio} — ${bias.demographic_parity_ratio >= 0.80 ? "passes the 80% rule" : "fails the 80% rule"}` },
      { type: "bullet", t: `Equalized Odds Difference: ${bias.equalized_odds_difference} — ${Math.abs(bias.equalized_odds_difference) < 0.10 ? "error rates are similar" : "error rates differ across groups"}` },
      { type: "bullet", t: `Post-mitigation DPD: ${fair.demographic_parity_difference}` },
      { type: "bullet", t: `Post-mitigation DPR: ${fair.demographic_parity_ratio}` },
      { type: "bullet", t: `Post-mitigation Bias Severity: ${fair.bias_severity}` }
    ]);

    const groupItems = Object.entries(bias.group_selection_rates || {}).map(([group, rate]) => ({ type: "bullet", t: `Group ${group}: positive outcome rate ${(rate * 100).toFixed(1)}%` }));
    writeSection(4, "Group-Level Impact", [{ type: "text", t: `The model's outcomes were compared across groups under the sensitive attribute "${sensitiveColUsed}".` }, ...groupItems]);

    const accDrop = ((orig.accuracy - fair.accuracy) * 100).toFixed(1);
    writeSection(5, "Before vs After Mitigation", [
      { type: "bullet", t: `Accuracy changed from ${(orig.accuracy * 100).toFixed(1)}% to ${(fair.accuracy * 100).toFixed(1)}%` },
      { type: "bullet", t: `Fairness severity changed from ${bias.bias_severity} to ${fair.bias_severity}` },
      { type: "bullet", t: `Accuracy trade-off: ${accDrop}%` },
      { type: "text", t: parseFloat(accDrop) > 20 ? "The model lost noticeable accuracy because it was previously relying on unfair patterns." : "The mitigation improved fairness with a manageable effect on accuracy." }
    ]);

    if (shap && shap.status === "success" && shap.shap_feature_importance && shap.shap_feature_importance.length > 0) {
      const topShap = shap.shap_feature_importance.slice(0, 6);
      const sensitiveIsTop = topShap.some(f => f.feature.toLowerCase().includes(sensitiveColUsed.toLowerCase()) || sensitiveColUsed.toLowerCase().includes(f.feature.toLowerCase()));
      writeSection(6, "Root Cause Analysis (SHAP Feature Importance)", [
        { type: "text", t: "The following features had the strongest influence on model decisions:" },
        ...topShap.map((f, i) => ({ type: "bullet", t: `${i + 1}. ${f.feature} — SHAP importance ${f.shap_value}` })),
        { type: "text", t: sensitiveIsTop ? `The sensitive attribute [${sensitiveColUsed}] is among the top features. The model is using this directly - this is the primary cause of bias.` : `The sensitive attribute [${sensitiveColUsed}] is not the top feature, but the top features above may be proxies for it.` }
      ]);
    } else {
      writeSection(6, "Root Cause Analysis (SHAP Feature Importance)", [
        { type: "text", t: "SHAP data was not available for this run." },
        { type: "bullet", t: "Sensitive attribute used: " + sensitiveColUsed },
        { type: "bullet", t: "Re-run analysis to generate SHAP scores for detailed root cause analysis." }
      ]);
    }

    const aiDpd = Math.abs(bias.demographic_parity_difference);
    const aiDpr = bias.demographic_parity_ratio;
    const aiSteps = [];
    if (aiDpd >= 0.05 || aiDpr < 0.80) aiSteps.push("Balance the dataset — ensure both groups have similar proportions of positive and negative outcomes.");
    if (parseFloat(accDrop) > 20) aiSteps.push("The dataset itself is biased. Use the Download Corrected Dataset button to generate a merit-based version.");
    aiSteps.push("Try the Reweighting mitigation method — it preserves accuracy better than the Reductions method.");
    aiSteps.push(`Set target goals: DPD < 0.05 and DPR > 0.80 for the "${document.getElementById("target-col").value}" column.`);
    aiSteps.push("Re-run the full analysis after making data corrections to verify improvement.");
    writeSection(7, "Action Plan", [...aiSteps.map((s, i) => ({ type: "bullet", t: `Step ${i + 1}: ${s}` }))]);

    const pageCount = doc.internal.getNumberOfPages();
    for (let p = 1; p <= pageCount; p++) {
      doc.setPage(p);
      doc.setFillColor(245, 246, 250);
      doc.rect(0, 285, pageW, 12, "F");
      text("FairGuard AI — Bias Detection Platform", margin, 292, { size: 8, color: [123, 130, 153] });
      text(`Page ${p} of ${pageCount}`, pageW - margin, 292, { size: 8, color: [123, 130, 153], align: "right" });
    }

    const baseName = uploadedFileName.replace(/\.[^.]+$/, '');
    doc.save(`${baseName}_FairGuard_Report.pdf`);

  } catch (err) {
    console.error("PDF error:", err);
    showAlert("PDF generation failed: " + err.message);
  }

  btn.disabled = false;
  btn.innerHTML = "📄 Download Detailed PDF Report";
}

// ── RESET ──────────────────────────────────────────────────────────────────
function resetAll() {
  sessionId = null;
  pipelineData = null;
  columnInfo = {};
  uploadedFileText = "";
  uploadedFileName = "";
  sensitiveColUsed = "";
  scanResults = [];
  worstSensitiveCol = "";
  lastResultData = null;

  document.getElementById("upload-status").style.display = "none";
  document.getElementById("dataset-preview-card").style.display = "none";
  document.getElementById("fixed-dataset-card").style.display = "none";
  document.getElementById("fixed-dataset-status").innerHTML = "";
  document.getElementById("scan-results-table-wrap").style.display = "none";
  document.getElementById("history-panel").style.display = "none";
  document.getElementById("fileInput").value = "";

  const sampleWrap = document.getElementById("sample-preview-wrap");
  if (sampleWrap) sampleWrap.style.display = "none";
  const heatmapCard = document.getElementById("correlation-heatmap-card");
  if (heatmapCard) heatmapCard.style.display = "none";

  // close about panel if open
  const aboutPanel = document.getElementById("about-panel");
  if (aboutPanel) aboutPanel.style.display = "none";

  goToSection("upload");
}

// ── AUTH ───────────────────────────────────────────────────────────────────
function logout() {
  resetAll?.();
  localStorage.removeItem("fg_token");
  localStorage.removeItem("fg_user_id");
  localStorage.removeItem("fg_user");
  sessionStorage.removeItem("fg_user_id");
  window.location.href = "/";
}

function startOnboardingTour() {
  if (typeof FairGuardTour !== "undefined") {
    FairGuardTour.start(true);
  }
}

function getTourKey() {
  const userId = localStorage.getItem("fg_user_id") || "guest";
  return `fairguard_tour_v2_${userId}`;
}

document.addEventListener("DOMContentLoaded", () => {
  // Tour is now handled by tour.js FairGuardTour.autoStart()
});

// ── INIT ───────────────────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", function () {
  const token = localStorage.getItem("fg_token");
  const user = JSON.parse(localStorage.getItem("fg_user") || "null");

  if (!token) {
    window.location.href = "/";
    return;
  }

  if (user) {
    document.getElementById("nav-username").textContent = user.name.split(" ")[0];
    document.getElementById("nav-avatar").textContent = user.name.charAt(0).toUpperCase();
  }

  fetch("/auth/me", {
    headers: { "Authorization": "Bearer " + token }
  })
    .then(r => { if (!r.ok) logout(); })
    .catch(() => { });

  // close about panel on Escape key
  document.addEventListener("keydown", e => {
    if (e.key === "Escape") {
      const aboutPanel = document.getElementById("about-panel");
      if (aboutPanel && aboutPanel.style.display === "block") closeAbout();
    }
  });

  initDragDrop();
  renderHistory();
});