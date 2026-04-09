// ══════════════════════════════════════════════════════════════════════════════
// FAIRGUARD AI — SMART ONBOARDING TOUR SYSTEM
// ══════════════════════════════════════════════════════════════════════════════

const FairGuardTour = (() => {

  // ── Tour Steps Definition ──────────────────────────────────────────────────
  const TOUR_STEPS = [
    {
      section: null,
      targetId: null,
      isWelcome: true,
      emoji: "🛡️",
      title: "Welcome to FairGuard AI!",
      body: `<p>This tool finds and fixes <strong>hidden bias in your AI datasets</strong>.</p>
             <p style="margin-top:10px;">For example — if an AI model rejects someone for a job because of <em>gender, caste, or race</em>, FairGuard detects it.</p>
             <p style="margin-top:10px;">Let's take a quick tour! 🚀</p>`,
    },
    {
      section: null,
      targetId: "uploadZone",
      emoji: "📂",
      title: "Step 1 — Upload Your Dataset",
      body: `<p>Upload your <strong>CSV, Excel, or JSON file</strong> here.</p>
             <p style="margin-top:8px;">A dataset is data stored in rows and columns — like a list of employees, loan applications, etc.</p>
             <p style="margin-top:8px;color:var(--tour-hint);">💡 You can also drag and drop your file directly.</p>`,
      position: "bottom",
    },
    {
      section: null,
      targetId: null,
      emoji: "🔎",
      title: "Dataset Preview",
      body: `<p>After uploading, a <strong>summary of your data</strong> will appear.</p>
             <ul style="margin-top:8px;padding-left:16px;">
               <li><strong>Rows</strong> = how many records/people</li>
               <li><strong>Columns</strong> = how many fields (age, salary, etc.)</li>
               <li><strong>Missing Values</strong> = how much data is empty</li>
               <li><strong>Sensitive Columns</strong> = columns like race, gender that may cause bias</li>
             </ul>`,
      position: "bottom",
    },
    {
      section: null,
      targetId: null,
      emoji: "🎯",
      title: "What is the Target Column?",
      body: `<p>The <strong>Target Column</strong> is what the AI is trying to predict.</p>
             <p style="margin-top:8px;">Example: <code>hired</code> (got the job or not), <code>approved</code> (loan approved or not).</p>
             <p style="margin-top:8px;">⚠️ It must contain only <strong>0 or 1</strong> — 0 means No, 1 means Yes.</p>`,
      position: "bottom",
    },
    {
      section: null,
      targetId: null,
      emoji: "📋",
      title: "Columns to Scan",
      body: `<p>FairGuard will <strong>check these columns for bias</strong>.</p>
             <p style="margin-top:8px;">🔴 <strong>Sensitive</strong> = columns that may cause bias (e.g. race, gender)</p>
             <p style="margin-top:6px;">🔵 <strong>Binary</strong> = columns with only 2 values</p>
             <p style="margin-top:8px;">All columns are selected by default — you can uncheck any you want to skip.</p>`,
      position: "top",
    },
    {
      section: null,
      targetId: null,
      emoji: "🔧",
      title: "Bias Mitigation Method",
      body: `<p><strong>Mitigation Method</strong> = how FairGuard fixes the bias.</p>
             <ul style="margin-top:8px;padding-left:16px;">
               <li><strong>Reweighting</strong> — best option, keeps accuracy high ✅</li>
               <li><strong>Reductions</strong> — applies fairness constraints during training</li>
               <li><strong>Post-processing</strong> — fixes results after the model runs</li>
             </ul>`,
      position: "top",
    },
    {
      section: null,
      targetId: null,
      emoji: "📊",
      title: "Bias Scan Results",
      body: `<p>After scanning, each column gets a <strong>bias level</strong>.</p>
             <ul style="margin-top:8px;padding-left:16px;">
               <li>🔴 <strong>CRITICAL / HIGH</strong> = very biased — fix immediately</li>
               <li>🟡 <strong>MODERATE</strong> = some bias — needs attention</li>
               <li>🟢 <strong>LOW</strong> = fair — no action needed</li>
             </ul>
             <p style="margin-top:8px;"><strong>DPD</strong> = gap in approval rates between groups (closer to 0 = better)</p>
             <p style="margin-top:4px;"><strong>DPR</strong> = fairness ratio — should be above 0.80</p>`,
      position: "bottom",
    },
    {
      section: null,
      targetId: null,
      emoji: "🚨",
      title: "Bias Severity Badge",
      body: `<p>This badge tells you how serious the bias is in your model:</p>
             <ul style="margin-top:8px;padding-left:16px;">
               <li>🔴 <strong>CRITICAL</strong> = very serious, take action now</li>
               <li>🟠 <strong>HIGH</strong> = major issue</li>
               <li>🟡 <strong>MODERATE</strong> = some problem</li>
               <li>🟢 <strong>LOW</strong> = mostly fair</li>
             </ul>`,
      position: "bottom",
    },
    {
      section: null,
      targetId: null,
      emoji: "🤖",
      title: "Model Performance Metrics",
      body: `<p>This shows <strong>how accurate</strong> the AI model is:</p>
             <ul style="margin-top:8px;padding-left:16px;">
               <li><strong>Accuracy</strong> = correct answers out of 100 (75%+ is good)</li>
               <li><strong>Reliability (F1)</strong> = balance between precision and recall (70%+ is good)</li>
               <li><strong>Distinction Ability (AUC)</strong> = how well it separates Yes vs No</li>
             </ul>`,
      position: "bottom",
    },
    {
      section: null,
      targetId: null,
      emoji: "⚖️",
      title: "Fairness Metrics — Is the AI Fair?",
      body: `<p>This is the most important section:</p>
             <ul style="margin-top:8px;padding-left:16px;">
               <li><strong>Outcome Gap (DPD)</strong> = how differently groups are treated — closer to 0 is fair</li>
               <li><strong>Fairness Ratio (DPR)</strong> = what the disadvantaged group receives — 80%+ is the legal standard</li>
               <li><strong>Error Fairness (EOD)</strong> = whether mistakes are equal across all groups</li>
             </ul>`,
      position: "top",
    },
    {
      section: null,
      targetId: null,
      emoji: "🧠",
      title: "SHAP — X-Ray of the AI's Thinking",
      body: `<p><strong>SHAP</strong> shows which column the AI <strong>relies on the most</strong>.</p>
             <p style="margin-top:8px;">If a sensitive column like <em>race</em> or <em>gender</em> is at the top — that is the root cause of the bias.</p>
             <p style="margin-top:8px;color:var(--tour-hint);">💡 Longer bar = more influence that column has on decisions.</p>`,
      position: "top",
    },
    {
      section: null,
      targetId: null,
      emoji: "📥",
      title: "Download Corrected Dataset",
      body: `<p>Download a <strong>bias-free corrected dataset</strong> from here.</p>
             <p style="margin-top:8px;">The new dataset recalculates the target column (e.g. <em>hired</em>) based on <strong>merit only</strong> — not on caste, gender, or race.</p>
             <p style="margin-top:8px;color:var(--tour-hint);">💡 Upload it again and re-run to verify the bias has reduced.</p>`,
      position: "top",
    },
    {
      section: null,
      targetId: null,
      isFinal: true,
      emoji: "🎉",
      title: "Tour Complete! You're all set!",
      body: `<p>Congratulations! You've completed the FairGuard AI tour.</p>
             <p style="margin-top:10px;">You can now:</p>
             <ul style="margin-top:6px;padding-left:16px;">
               <li>✅ Upload your dataset</li>
               <li>✅ Detect bias across columns</li>
               <li>✅ Understand the results</li>
               <li>✅ Download a fair corrected dataset</li>
             </ul>
             <p style="margin-top:10px;">Press <strong>"❓ Tour"</strong> in the navbar anytime to replay this tour.</p>`,
    },
  ];

  // ── State ─────────────────────────────────────────────────────────────────
  let currentStep = 0;
  let overlay = null;
  let card = null;
  let isActive = false;

  // ── Tour Key (per user) ───────────────────────────────────────────────────
  function getTourKey() {
    const userId = localStorage.getItem("fg_user_id") || "guest";
    return `fairguard_tour_v2_${userId}`;
  }

  function isTourDone() {
    return localStorage.getItem(getTourKey()) === "done";
  }

  function markTourDone() {
    localStorage.setItem(getTourKey(), "done");
  }

  // ── DOM Helpers ───────────────────────────────────────────────────────────
  function getVisibleSteps() {
    return TOUR_STEPS.filter(step => {
      if (step.skipIfHidden && step.targetId) {
        const el = document.getElementById(step.targetId);
        if (!el || el.offsetParent === null || el.style.display === "none") return false;
      }
      return true;
    });
  }

  function highlightElement(targetId) {
    document.querySelectorAll(".tour-highlight").forEach(el => el.classList.remove("tour-highlight"));
    if (!targetId) return null;
    const el = document.getElementById(targetId);
    if (el) {
      el.classList.add("tour-highlight");
      el.scrollIntoView({ behavior: "smooth", block: "center" });
    }
    return el;
  }

  function getCardPosition(targetEl, preferredPos) {
    if (!targetEl) return { top: "50%", left: "50%", transform: "translate(-50%, -50%)" };

    const rect = targetEl.getBoundingClientRect();
    const cardW = 380;
    const cardH = 280;
    const margin = 20;
    const scrollY = window.scrollY;

    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;
    const spaceRight = window.innerWidth - rect.right;
    const spaceLeft = rect.left;

    let pos = preferredPos || "bottom";

    if (pos === "bottom" && spaceBelow < cardH + margin) pos = "top";
    if (pos === "top" && spaceAbove < cardH + margin) pos = "bottom";
    if (pos === "right" && spaceRight < cardW + margin) pos = "left";
    if (pos === "left" && spaceLeft < cardW + margin) pos = "right";

    let top, left;
    switch (pos) {
      case "bottom":
        top = rect.bottom + scrollY + margin;
        left = Math.min(Math.max(rect.left + rect.width / 2 - cardW / 2, margin), window.innerWidth - cardW - margin);
        break;
      case "top":
        top = rect.top + scrollY - cardH - margin;
        left = Math.min(Math.max(rect.left + rect.width / 2 - cardW / 2, margin), window.innerWidth - cardW - margin);
        break;
      case "right":
        top = rect.top + scrollY + rect.height / 2 - cardH / 2;
        left = rect.right + margin;
        break;
      case "left":
        top = rect.top + scrollY + rect.height / 2 - cardH / 2;
        left = rect.left - cardW - margin;
        break;
      default:
        top = rect.bottom + scrollY + margin;
        left = rect.left;
    }

    return { top: `${top}px`, left: `${left}px`, transform: "none" };
  }

  // ── Render Tour Card ───────────────────────────────────────────────────────
  function renderStep(stepIndex) {
    const visibleSteps = getVisibleSteps();
    if (stepIndex >= visibleSteps.length) {
      endTour(true);
      return;
    }

    const step = visibleSteps[stepIndex];
    const total = visibleSteps.length;
    const isFirst = stepIndex === 0;
    const isLast = stepIndex === total - 1;

    const targetEl = highlightElement(step.targetId);
    renderStepCard(step, stepIndex, total, isFirst, isLast, targetEl);
  }

  function renderStepCard(step, stepIndex, total, isFirst, isLast, targetEl) {
    const pos = (step.isWelcome || step.isFinal || !step.targetId)
      ? { top: "50%", left: "50%", transform: "translate(-50%, -50%)" }
      : getCardPosition(targetEl, step.position);

    const progressPct = Math.round(((stepIndex + 1) / total) * 100);

    card.style.top = pos.top;
    card.style.left = pos.left;
    card.style.transform = pos.transform;

    card.innerHTML = `
      <div class="tour-card-inner">
        <div class="tour-card-header">
          <span class="tour-emoji">${step.emoji}</span>
          <div class="tour-step-counter">${stepIndex + 1} / ${total}</div>
          <button class="tour-close-btn" onclick="FairGuardTour.end()">✕</button>
        </div>
        <h3 class="tour-card-title">${step.title}</h3>
        <div class="tour-card-body">${step.body}</div>
        <div class="tour-progress-bar-wrap">
          <div class="tour-progress-bar" style="width:${progressPct}%"></div>
        </div>
        <div class="tour-card-footer">
          <button class="tour-btn tour-btn-skip" onclick="FairGuardTour.end()">
            Skip Tour
          </button>
          <div class="tour-nav-btns">
            ${!isFirst ? `<button class="tour-btn tour-btn-prev" onclick="FairGuardTour.prev()">← Back</button>` : ""}
            <button class="tour-btn tour-btn-next" onclick="FairGuardTour.next()">
              ${isLast ? "🎉 Finish!" : "Next →"}
            </button>
          </div>
        </div>
      </div>
      ${(step.targetId && !step.isWelcome && !step.isFinal) ? '<div class="tour-arrow"></div>' : ''}
    `;

    card.style.opacity = "0";
    card.style.transform = (pos.transform || "none") + " scale(0.92)";
    requestAnimationFrame(() => {
      card.style.transition = "opacity 0.25s ease, transform 0.25s cubic-bezier(.34,1.56,.64,1)";
      card.style.opacity = "1";
      card.style.transform = pos.transform || "none";
    });
  }

  // ── Create Overlay & Card DOM ─────────────────────────────────────────────
  function createTourDOM() {
    destroyTourDOM();

    overlay = document.createElement("div");
    overlay.id = "tour-overlay";
    overlay.className = "tour-overlay";
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) end();
    });

    card = document.createElement("div");
    card.id = "tour-card";
    card.className = "tour-card";

    document.body.appendChild(overlay);
    document.body.appendChild(card);

    injectTourStyles();
  }

  function destroyTourDOM() {
    document.getElementById("tour-overlay")?.remove();
    document.getElementById("tour-card")?.remove();
    document.getElementById("tour-styles")?.remove();
    document.querySelectorAll(".tour-highlight").forEach(el => el.classList.remove("tour-highlight"));
  }

  // ── Tour CSS ──────────────────────────────────────────────────────────────
  function injectTourStyles() {
    if (document.getElementById("tour-styles")) return;
    const style = document.createElement("style");
    style.id = "tour-styles";
    style.textContent = `
      :root {
        --tour-bg: #0f1225;
        --tour-card: #1a1d35;
        --tour-border: rgba(79,110,247,0.4);
        --tour-accent: #4f6ef7;
        --tour-accent2: #00b894;
        --tour-text: #e2e8f0;
        --tour-muted: #7b8299;
        --tour-hint: #94a3b8;
        --tour-danger: #f05a7e;
        --tour-highlight-glow: rgba(79,110,247,0.5);
      }

      .tour-overlay {
        position: fixed;
        inset: 0;
        background: rgba(5, 7, 20, 0.72);
        backdrop-filter: blur(3px);
        z-index: 9998;
        animation: tourFadeIn 0.3s ease;
      }

      @keyframes tourFadeIn {
        from { opacity: 0; }
        to { opacity: 1; }
      }

      .tour-highlight {
        position: relative;
        z-index: 9999 !important;
        border-radius: 12px;
        box-shadow:
          0 0 0 4px var(--tour-accent),
          0 0 0 8px rgba(79,110,247,0.25),
          0 0 40px var(--tour-highlight-glow) !important;
        outline: none;
        transition: box-shadow 0.3s ease;
      }

      .tour-card {
        position: fixed;
        z-index: 10000;
        width: 380px;
        max-width: calc(100vw - 32px);
        background: var(--tour-card);
        border: 1px solid var(--tour-border);
        border-radius: 18px;
        box-shadow:
          0 20px 60px rgba(0,0,0,0.6),
          0 0 0 1px rgba(255,255,255,0.04),
          inset 0 1px 0 rgba(255,255,255,0.07);
        padding: 0;
        pointer-events: all;
        overflow: hidden;
      }

      .tour-card-inner {
        padding: 22px 24px 20px;
        position: relative;
      }

      .tour-card-header {
        display: flex;
        align-items: center;
        gap: 10px;
        margin-bottom: 12px;
      }

      .tour-emoji {
        font-size: 26px;
        flex-shrink: 0;
        filter: drop-shadow(0 2px 6px rgba(79,110,247,0.4));
      }

      .tour-step-counter {
        font-size: 11px;
        font-weight: 700;
        color: var(--tour-accent);
        background: rgba(79,110,247,0.15);
        border: 1px solid rgba(79,110,247,0.3);
        padding: 3px 10px;
        border-radius: 20px;
        letter-spacing: 0.5px;
        margin-left: auto;
      }

      .tour-close-btn {
        background: rgba(255,255,255,0.06);
        border: 1px solid rgba(255,255,255,0.1);
        color: var(--tour-muted);
        width: 28px;
        height: 28px;
        border-radius: 50%;
        font-size: 14px;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all 0.2s;
        padding: 0;
        flex-shrink: 0;
      }
      .tour-close-btn:hover {
        background: rgba(240,90,126,0.2);
        border-color: rgba(240,90,126,0.4);
        color: var(--tour-danger);
      }

      .tour-card-title {
        font-size: 16px;
        font-weight: 800;
        color: var(--tour-text);
        margin: 0 0 10px;
        line-height: 1.35;
        letter-spacing: -0.3px;
      }

      .tour-card-body {
        font-size: 13.5px;
        color: var(--tour-muted);
        line-height: 1.65;
        margin-bottom: 16px;
      }

      .tour-card-body p { margin: 0; }
      .tour-card-body ul { margin: 4px 0; }
      .tour-card-body li { margin-bottom: 3px; }
      .tour-card-body strong { color: var(--tour-text); }
      .tour-card-body em { color: var(--tour-accent); font-style: normal; font-weight: 600; }
      .tour-card-body code {
        background: rgba(79,110,247,0.15);
        color: var(--tour-accent);
        padding: 1px 6px;
        border-radius: 4px;
        font-size: 12px;
        font-family: 'Courier New', monospace;
      }

      .tour-progress-bar-wrap {
        height: 4px;
        background: rgba(255,255,255,0.08);
        border-radius: 10px;
        overflow: hidden;
        margin-bottom: 16px;
      }

      .tour-progress-bar {
        height: 100%;
        background: linear-gradient(90deg, var(--tour-accent), var(--tour-accent2));
        border-radius: 10px;
        transition: width 0.4s cubic-bezier(0.4, 0, 0.2, 1);
      }

      .tour-card-footer {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 10px;
      }

      .tour-nav-btns {
        display: flex;
        gap: 8px;
      }

      .tour-btn {
        padding: 8px 18px;
        border-radius: 10px;
        font-size: 13px;
        font-weight: 700;
        cursor: pointer;
        border: none;
        transition: all 0.2s;
        letter-spacing: 0.2px;
      }

      .tour-btn-skip {
        background: transparent;
        color: var(--tour-muted);
        border: 1px solid rgba(255,255,255,0.1);
        padding: 8px 14px;
        font-size: 12px;
      }
      .tour-btn-skip:hover {
        color: var(--tour-danger);
        border-color: rgba(240,90,126,0.3);
        background: rgba(240,90,126,0.08);
      }

      .tour-btn-prev {
        background: rgba(255,255,255,0.07);
        color: var(--tour-text);
        border: 1px solid rgba(255,255,255,0.12);
      }
      .tour-btn-prev:hover {
        background: rgba(255,255,255,0.12);
      }

      .tour-btn-next {
        background: linear-gradient(135deg, var(--tour-accent), #6d88ff);
        color: #fff;
        box-shadow: 0 4px 15px rgba(79,110,247,0.35);
      }
      .tour-btn-next:hover {
        transform: translateY(-1px);
        box-shadow: 0 6px 20px rgba(79,110,247,0.5);
      }
      .tour-btn-next:active {
        transform: translateY(0);
      }

      @keyframes tourPulse {
        0%, 100% { box-shadow: 0 0 0 4px var(--tour-accent), 0 0 0 8px rgba(79,110,247,0.25), 0 0 40px var(--tour-highlight-glow); }
        50% { box-shadow: 0 0 0 4px var(--tour-accent), 0 0 0 12px rgba(79,110,247,0.15), 0 0 50px var(--tour-highlight-glow); }
      }
      .tour-highlight { animation: tourPulse 2s ease-in-out infinite; }

      @media (max-width: 480px) {
        .tour-card {
          width: calc(100vw - 24px);
          left: 12px !important;
          transform: none !important;
        }
      }
    `;
    document.head.appendChild(style);
  }

  // ── Keyboard Nav ──────────────────────────────────────────────────────────
  function handleKeydown(e) {
    if (!isActive) return;
    if (e.key === "ArrowRight" || e.key === "Enter") next();
    if (e.key === "ArrowLeft") prev();
    if (e.key === "Escape") end();
  }

  // ── Public API ────────────────────────────────────────────────────────────
  function start(force = false) {
    if (isActive) return;
    if (!force && isTourDone()) return;

    currentStep = 0;
    isActive = true;

    createTourDOM();
    document.addEventListener("keydown", handleKeydown);
    renderStep(currentStep);
  }

  function next() {
    const visibleSteps = getVisibleSteps();
    if (currentStep < visibleSteps.length - 1) {
      currentStep++;
      renderStep(currentStep);
    } else {
      endTour(true);
    }
  }

  function prev() {
    if (currentStep > 0) {
      currentStep--;
      renderStep(currentStep);
    }
  }

  function end() {
    endTour(false);
  }

  function endTour(completed) {
    isActive = false;
    if (completed) markTourDone();

    if (overlay) {
      overlay.style.transition = "opacity 0.25s ease";
      overlay.style.opacity = "0";
    }
    if (card) {
      card.style.transition = "opacity 0.25s ease, transform 0.25s ease";
      card.style.opacity = "0";
      card.style.transform = (card.style.transform || "") + " scale(0.94)";
    }

    setTimeout(() => {
      destroyTourDOM();
      document.removeEventListener("keydown", handleKeydown);
    }, 280);
  }

  function autoStart() {
    const token = localStorage.getItem("fg_token");
    if (!token) return;
    if (isTourDone()) return;
    setTimeout(() => start(false), 1000);
  }

  return { start, next, prev, end, autoStart };
})();

// ── Wire up to DOMContentLoaded ───────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
  FairGuardTour.autoStart();
});