// dashboard/src/components/StatusBar.jsx

import { useEffect, useState } from "react";
import { shortenPath } from "../lib/eventToNode";
import { formatDuration } from "../lib/timeFormat";
import { STATUS_COLOR } from "../lib/statusColors";
import { deriveStats, deriveSessionSummary } from "../lib/stats";
import { deriveChangedFiles } from "../lib/changedFiles";
import { buildReportMarkdown, downloadTextFile } from "../lib/exportReport";
import { HTTP_BASE } from "../lib/config";
import { Download, HelpCircle } from "./icons";
import { useI18n } from "../i18n/I18nContext";
import LanguageSwitcher from "./LanguageSwitcher";
import ApprovalModeSelector from "./ApprovalModeSelector";
import SetupHooksCard from "./SetupHooksCard";
import ServerSwitcher from "./ServerSwitcher";
import RecentSessionsList from "./RecentSessionsList";
import HelpGuide from "./HelpGuide";
// Version from the dashboard's own package.json (not a separate hardcoded
// value that's easy to let go stale) -- Vite supports importing JSON
// directly, and this is the SAME file `npm run dashboard` uses to resolve
// dependencies, so it's automatically accurate.
import { version as appVersion } from "../../package.json";

const CONNECTION_LABEL_KEY = {
  idle: "statusBar.connection.idle",
  connecting: "statusBar.connection.connecting",
  open: "statusBar.connection.open",
  closed: "statusBar.connection.closed",
  error: "statusBar.connection.error",
};

const CONNECTION_COLOR = {
  idle: STATUS_COLOR.info,
  connecting: STATUS_COLOR.running,
  open: STATUS_COLOR.success,
  closed: STATUS_COLOR.error,
  error: STATUS_COLOR.error,
};

export default function StatusBar({
  connectionStatus,
  sessionId,
  status,
  activeFile,
  eventCount,
  events,
  usage,
  selectedSessionId,
  onWatchSession,
  onStopWatching,
  approvalGateMode,
  onSetApprovalGateMode,
}) {
  const { t } = useI18n();
  const [inputValue, setInputValue] = useState("");
  const [, forceTick] = useState(0);
  const [helpOpen, setHelpOpen] = useState(false);

  // A chat session started DIRECTLY from the dashboard (server/chat.js) has
  // NO terminal fallback -- meaning "Off" mode behaves differently
  // (auto-deny, not "runs normally") compared to a session watched via a
  // regular hook. chat.message is only ever emitted by server/chat.js, so
  // its presence in events is a reliable enough signal to tell these two
  // session types apart.
  const isChatSession = events?.some((e) => e.type === "chat.message") ?? false;

  // Running duration (first event -> last event, or -> now if
  // "completed"/"error" hasn't been recorded yet) -- refreshed every second
  // so it feels alive.
  useEffect(() => {
    const timer = setInterval(() => forceTick((n) => n + 1), 1000);
    return () => clearInterval(timer);
  }, []);

  const duration =
    events && events.length > 0
      ? (status === "completed" ? events[events.length - 1].timestamp : Date.now()) - events[0].timestamp
      : null;
  // The input only needs to show if no session is selected yet, OR the user
  // deliberately clicked "Switch session". Once watching, hide the input so
  // the session_id isn't shown twice (in the badge & in the input box) and
  // there's no idle "Watch this session" button sitting there.
  const [isEditing, setIsEditing] = useState(!selectedSessionId);

  // selectedSessionId can get filled in LATER via resumeLastSession()
  // (called in App.jsx's useEffect, after the first render) -- the
  // isEditing initial state above is already stuck at "true" at that point
  // (selectedSessionId was still null at initialization). Sync it as soon
  // as a session is successfully resumed, so the input form doesn't stay
  // stuck open even though a session from localStorage is already being
  // watched automatically.
  useEffect(() => {
    if (selectedSessionId) setIsEditing(false);
  }, [selectedSessionId]);

  // Backfill (see useAgentStore.js) has FINISHED (no longer running --
  // the public `sessionId` only gets filled AFTER the request completes,
  // unlike `selectedSessionId` which fills in immediately once the user
  // submits) AND the result is empty -- meaning the typed session_id never
  // sent a single event. Don't proceed to the "Watching ..." + Switch
  // session/Stop watching/Command Approval view as if it succeeded -- go
  // back to the form so the user knows & can fix it right away.
  const sessionNotFound = Boolean(selectedSessionId) && sessionId === selectedSessionId && (!events || events.length === 0);

  // As soon as it's known to have failed, refill the input box with the
  // session_id that just failed (not empty) -- so the user sees exactly
  // what they typed and can just edit it, rather than starting from zero again.
  useEffect(() => {
    if (sessionNotFound) setInputValue((v) => v || selectedSessionId);
  }, [sessionNotFound, selectedSessionId]);

  function handleSubmit(e) {
    e.preventDefault();
    const trimmed = inputValue.trim();
    if (!trimmed) return;
    onWatchSession(trimmed);
    setInputValue("");
    setIsEditing(false);
  }

  // "Switch session" -- prefills the input box with the session_id
  // CURRENTLY being watched (not empty) so the user can see/edit from
  // there, instead of starting from zero every time they just want a small
  // change or clicked by mistake.
  function handleStartChangeSession() {
    setInputValue(selectedSessionId ?? "");
    setIsEditing(true);
  }

  function handleStop() {
    onStopWatching();
    setInputValue("");
    setIsEditing(true);
  }

  function handleCancelEdit() {
    setInputValue("");
    setIsEditing(false);
  }

  // "Watch latest session" -- cuts down manual session_id copy-pasting (the
  // server already knows the LATEST session that sent an event, via GET
  // /health's `latestSessionId`, see server.js). STILL needs an explicit
  // click (not silent auto-watching) -- the "the dashboard never guesses a
  // session" design (see the README) is deliberately kept, so it's safe to
  // use even with several Claude Code sessions running at once; this is
  // just a shortcut that fills the box, not automatic guessing.
  const [latestHint, setLatestHint] = useState(null);

  async function handleWatchLatest() {
    setLatestHint(null);
    try {
      const res = await fetch(`${HTTP_BASE}/health`);
      const data = await res.json();
      if (!data.latestSessionId) {
        setLatestHint(t("statusBar.picker.noLatestSession"));
        return;
      }
      onWatchSession(data.latestSessionId);
      setInputValue("");
      setIsEditing(false);
    } catch {
      setLatestHint(t("statusBar.picker.noLatestSession"));
    }
  }

  // Clicking a row in RecentSessionsList -- same as submitting the manual
  // form (onWatchSession + close edit mode), just with the session_id
  // coming from the list instead of being typed.
  function handleSelectRecentSession(sessionId) {
    onWatchSession(sessionId);
    setInputValue("");
    setIsEditing(false);
  }

  const showInput = isEditing || !selectedSessionId || sessionNotFound;

  // Export Report: rebuilt from data already in the store (events + usage),
  // no new request/LLM call -- see lib/exportReport.js.
  function handleExportReport() {
    if (!events || events.length === 0) return;
    const stats = deriveStats(events);
    const changedFiles = deriveChangedFiles(events);
    const summary = deriveSessionSummary(events);
    const totalTokens = usage
      ? usage.usage.input_tokens +
        usage.usage.output_tokens +
        usage.usage.cache_creation_input_tokens +
        usage.usage.cache_read_input_tokens
      : null;
    const markdown = buildReportMarkdown({ sessionId, events, stats, changedFiles, totalTokens, summary });
    downloadTextFile(`agent-session-report-${sessionId ?? "unknown"}.md`, markdown);
  }

  return (
    <div>
      {/* Reorganized into 2 stacked rows by information type (previously ONE
          long flex row of ~12 mixed items that only wrapped organically,
          producing an unpredictable/messy line-break order at narrow
          widths -- user report 2026-09-03, screenshot showed items broken
          up mid-group with an oddly empty row). A 3-row version (brand /
          live status / context each on their own line) was tried first,
          but it made the whole header noticeably taller -- reverted back
          to 2 rows (user report 2026-09-03: "terlalu tinggi"), file/model
          folded back into the same row as the live status items instead of
          getting a dedicated row:
            1. brand + global app-level controls (title, language, help)
            2. session status + context (connection/session/status/
               duration/event count/file/model) + actions (server, export)
          Items within a row sit right next to each other (NOT pushed to
          the row's far right edge) -- an earlier version used a flex
          spacer to shove controls all the way to the right, which left a
          large empty gap in the middle on wide screens and made the bar
          look stretched/too wide (user report 2026-09-03). */}
      <header className="status-bar">
        <div className="status-bar__row status-bar__row--top">
          <div className="status-bar__title">{t("common.appTitle")}</div>
          <ServerSwitcher />
          <LanguageSwitcher />
          <span className="status-bar__version">v{appVersion}</span>
          <button
            type="button"
            className="status-bar__help"
            onClick={() => setHelpOpen(true)}
            title={t("statusBar.help.tooltip")}
            aria-label={t("statusBar.help.tooltip")}
          >
            <HelpCircle size={13} strokeWidth={2} /> {t("statusBar.help.label")}
          </button>
        </div>

        <div className="status-bar__row status-bar__row--live">
          <div className="status-bar__item">
            <span className="status-dot" style={{ backgroundColor: CONNECTION_COLOR[connectionStatus] }} />
            {CONNECTION_LABEL_KEY[connectionStatus] ? t(CONNECTION_LABEL_KEY[connectionStatus]) : connectionStatus}
          </div>

          <div className="status-bar__item">
            session: <code>{sessionId ? sessionId.slice(0, 8) : t("common.dash")}</code>
          </div>

          <div className="status-bar__item">
            status: <span className="status-badge">{status ?? t("common.dash")}</span>
          </div>

          <div className="status-bar__item">duration: {formatDuration(duration)}</div>

          <div className="status-bar__item">{eventCount} event</div>

          <div className="status-bar__item" title={activeFile ?? ""}>
            file: <code>{activeFile ? shortenPath(activeFile, 28) : t("common.dash")}</code>
          </div>

          <div className="status-bar__item">model: {usage?.model?.replace("claude-", "") ?? t("common.dash")}</div>

          {events && events.length > 0 && (
            <button type="button" className="status-bar__export" onClick={handleExportReport}>
              <Download size={13} strokeWidth={2} /> {t("statusBar.exportReport")}
            </button>
          )}
        </div>
      </header>

      <div className="session-picker">
        {!showInput ? (
          <>
            <span className="session-picker__mode">
              {t("statusBar.picker.watching")} <code title={selectedSessionId}>{selectedSessionId.slice(0, 12)}…</code>
            </span>
            <button type="button" className="session-picker__button" onClick={handleStartChangeSession}>
              {t("statusBar.picker.changeSession")}
            </button>
            <button type="button" className="session-picker__button" onClick={handleStop}>
              {t("statusBar.picker.stopWatching")}
            </button>

            <ApprovalModeSelector mode={approvalGateMode} onChange={onSetApprovalGateMode} isChatSession={isChatSession} />
          </>
        ) : (
          // Wrapped in one column wrapper -- .session-picker itself is a
          // flex ROW (for the "Watching..." state, which is just one row of
          // buttons), but this form state now has 3 rows (form, optional
          // hint, setup hooks card) that need to stack VERTICALLY, not end
          // up as 3 flex items lined up horizontally in the same row.
          <div className="session-picker__form-wrap">
            <form className="session-picker__form" onSubmit={handleSubmit}>
              <span className={`session-picker__mode${sessionNotFound ? " session-picker__mode--error" : ""}`}>
                {sessionNotFound
                  ? t("statusBar.picker.notFound")
                  : selectedSessionId
                    ? t("statusBar.picker.switchTo")
                    : t("statusBar.picker.noSession")}
              </span>
              <input
                className="session-picker__input"
                type="text"
                placeholder={t("statusBar.picker.placeholder")}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                autoFocus
              />
              <button type="submit" className="session-picker__button" disabled={!inputValue.trim()}>
                {t("statusBar.picker.watchButton")}
              </button>
              <button type="button" className="session-picker__button" onClick={handleWatchLatest}>
                {t("statusBar.picker.watchLatest")}
              </button>
              {/* Cancel only makes sense if there's a VALID session to go
                  back to -- when sessionNotFound, selectedSessionId is
                  still filled (with the failed session_id itself), so the
                  old condition (`selectedSessionId &&`) would show a
                  useless Cancel (going back to the exact same failed
                  view). */}
              {selectedSessionId && !sessionNotFound && (
                <button type="button" className="session-picker__button" onClick={handleCancelEdit}>
                  {t("statusBar.picker.cancel")}
                </button>
              )}
            </form>
            {latestHint ? <div className="session-picker__hint">{latestHint}</div> : null}
            <RecentSessionsList onSelect={handleSelectRecentSession} />
            <SetupHooksCard />
          </div>
        )}
      </div>

      {helpOpen ? <HelpGuide onClose={() => setHelpOpen(false)} /> : null}
    </div>
  );
}
