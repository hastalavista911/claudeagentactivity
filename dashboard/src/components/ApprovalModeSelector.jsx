// dashboard/src/components/ApprovalModeSelector.jsx
//
// Replaces the old ON/OFF toggle -- now 3 choices (similar to Claude
// Code's own built-in "Modes": Manual/Auto, no Plan since that's not this
// dashboard's concern): Off / Manual / Auto. The server holds the source of
// truth per session (see server.js `approvalGateSessions`), this component
// is purely UI.
//
//  - Off: the dashboard doesn't get involved at all, Claude Code runs normally.
//  - Manual: EVERY file edit & command needs Allow/Deny from the dashboard.
//  - Auto: never pauses -- everything runs immediately, but every action
//    that goes through is still recorded in Activity Flow with an "AUTO"
//    badge (see lib/eventToNode.js "permission.auto") so there's still a
//    visible trail, not a "blind trust with no record" mode.

import { useEffect, useRef, useState } from "react";
import { Hand, Zap } from "./icons";
import { useI18n } from "../i18n/I18nContext";

const MODES = [
  { key: "off", Icon: null },
  { key: "manual", Icon: Hand },
  { key: "auto", Icon: Zap },
];

export default function ApprovalModeSelector({ mode, onChange, isChatSession }) {
  const { t } = useI18n();
  // Auto = every tool call runs immediately with NO pause at all --
  // different from Manual/Off, whose effect is "safe" to apply directly
  // (Manual just adds an approval pause, Off just turns this feature off).
  // Clicking Auto DELIBERATELY doesn't apply right away -- it shows a
  // confirmation first (user request 2026-09-03), so it can't get clicked
  // by accident and have every Claude Code command start running
  // automatically without the user realizing it.
  const [confirmingAuto, setConfirmingAuto] = useState(false);
  const rootRef = useRef(null);

  useEffect(() => {
    if (!confirmingAuto) return;
    function handlePointerDown(e) {
      if (rootRef.current && !rootRef.current.contains(e.target)) setConfirmingAuto(false);
    }
    function handleKeyDown(e) {
      if (e.key === "Escape") setConfirmingAuto(false);
    }
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [confirmingAuto]);

  function handleClick(key) {
    if (key === "auto" && mode !== "auto") {
      setConfirmingAuto(true);
      return;
    }
    onChange(key);
  }

  function handleConfirmAuto() {
    setConfirmingAuto(false);
    onChange("auto");
  }

  return (
    <div className="approval-mode" ref={rootRef}>
      <span className="approval-mode__label">{t("statusBar.approval.label")}</span>
      <div className="approval-mode__group">
        {MODES.map(({ key, Icon }) => {
          // "Off" means something DIFFERENT for a dashboard chat session
          // (which has no terminal fallback -- auto-deny) compared to a
          // session watched via a hook (runs normally as usual) -- see the
          // long note in StatusBar.jsx. Its tooltip differs to match, so it
          // doesn't mislead.
          const tooltipKey = key === "off" && isChatSession ? "statusBar.approval.tooltip.offChat" : `statusBar.approval.tooltip.${key}`;
          return (
            <button
              key={key}
              type="button"
              className={`approval-mode__btn approval-mode__btn--${key}${mode === key ? " approval-mode__btn--active" : ""}`}
              title={t(tooltipKey)}
              onClick={() => handleClick(key)}
            >
              {Icon ? <Icon size={12} strokeWidth={2} /> : null}
              {t(`statusBar.approval.mode.${key}`)}
            </button>
          );
        })}
      </div>

      {confirmingAuto ? (
        <div className="approval-mode__confirm">
          <div className="approval-mode__confirm-text">{t("statusBar.approval.confirmAuto.text")}</div>
          <div className="approval-mode__confirm-actions">
            <button type="button" className="approval-mode__confirm-btn approval-mode__confirm-btn--primary" onClick={handleConfirmAuto}>
              {t("statusBar.approval.confirmAuto.confirm")}
            </button>
            <button type="button" className="approval-mode__confirm-btn" onClick={() => setConfirmingAuto(false)}>
              {t("statusBar.approval.confirmAuto.cancel")}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
