// dashboard/src/components/AppPreloader.jsx
//
// A brief overlay shown FROM MOUNT until resumeLastSession() finishes (see
// store.initializing in useAgentStore.js) -- ONLY relevant if there's a
// session_id stored in localStorage that's being resumed automatically
// (connect WS + backfill + recompute the graph layout, all happening at
// once on refresh). If there's no stored session_id at all, this overlay
// is almost never seen (initializing goes straight to false).
//
// Deliberately NOT a gate on rendering App (App still mounts & runs its
// connect/resume effect as usual) -- this is just a visual layer ON TOP OF
// it, so the user doesn't land on buttons that LOOK ready to click while
// heavy work is still happening in the background (user report 2026-09-03:
// clicking the Server button felt delayed after a refresh).

import { useEffect, useRef, useState } from "react";
import { useAgentStore } from "../store/useAgentStore";
import { useI18n } from "../i18n/I18nContext";

// How long the "catch-up" animation takes from the current position to the
// latest checkpoint (0/33/67/100) -- see the note below on why this is JS, not CSS.
const CATCH_UP_MS = 450;

export default function AppPreloader() {
  const { t } = useI18n();
  // The REAL target (0/33/67/100), not guessed -- goes up each time one of
  // the 3 resume steps (backfill, syncApprovalGate, fetchUsage) genuinely
  // finishes (see resumeLastSession() in useAgentStore.js).
  const target = useAgentStore((s) => s.initializingProgress);

  // The value ACTUALLY displayed (bar + number) -- animated via
  // requestAnimationFrame from the current position toward `target` every
  // time target changes. DELIBERATELY not a CSS transition: CSS can only
  // animate the bar, it can't animate a text NUMBER, so the number always
  // ended up visibly jumping ahead of the bar (user report 2026-09-03, 2
  // CSS attempts failed to fix this). With one single JS value used by both
  // the bar & the number, they're GUARANTEED to always match every frame,
  // and the motion flows (instead of jumping 0->33->67->100) because
  // requestAnimationFrame catches up gradually, rather than snapping straight to the target.
  const [display, setDisplay] = useState(0);
  const displayRef = useRef(0);
  const rafRef = useRef(null);

  useEffect(() => {
    const startValue = displayRef.current;
    const startTime = performance.now();
    if (rafRef.current) cancelAnimationFrame(rafRef.current);

    function step(now) {
      const elapsed = now - startTime;
      // Clamped on BOTH ends (0 AND 1) -- previously just `Math.min(1, ...)`,
      // the upper bound only. If `elapsed` ever went negative (e.g. the
      // effect gets called again very quickly -- React StrictMode
      // deliberately mounts->cleans up->mounts an effect twice in dev
      // mode), progressRatio would go negative too, and the easing formula
      // would blow it up into an extreme number (a real occurrence:
      // "-1154%", user report 2026-09-03). This clamp + the final value
      // clamp below are a double safety net, so REGARDLESS of the timing
      // cause, the display can never end up outside 0-100%.
      const progressRatio = Math.max(0, Math.min(1, elapsed / CATCH_UP_MS));
      const eased = 1 - (1 - progressRatio) * (1 - progressRatio); // ease-out, slows down approaching the target
      const value = Math.max(0, Math.min(100, startValue + (target - startValue) * eased));
      displayRef.current = value;
      setDisplay(value);
      if (progressRatio < 1) rafRef.current = requestAnimationFrame(step);
    }
    rafRef.current = requestAnimationFrame(step);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [target]);

  const shownPercent = Math.round(display);

  return (
    <div className="app-preloader" role="progressbar" aria-valuenow={shownPercent} aria-valuemin={0} aria-valuemax={100}>
      <div className="app-preloader__bar-row">
        <div className="app-preloader__bar-track">
          <div className="app-preloader__bar-fill" style={{ width: `${display}%` }} />
        </div>
        <span className="app-preloader__percent">{shownPercent}%</span>
      </div>
      <div className="app-preloader__text">{t("appPreloader.text")}</div>
    </div>
  );
}
