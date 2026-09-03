// dashboard/src/components/RecentSessionsList.jsx
//
// A list of session_ids the currently targeted server has EVER seen (GET
// /sessions, see server/session-store.js listSessions()) -- the answer to
// "can I get a session_id just from the server/host?" (2026-09-02
// discussion): the user does NOT need to already know/copy a session_id
// from somewhere else, just pick one from the list once they know the
// host. Placed in the session-picker form area (StatusBar.jsx) -- same as
// SetupHooksCard, only relevant while NOT watching any session yet/while
// switching sessions.
//
// DELIBERATELY still requires an EXPLICIT click to start watching (not
// auto-watching as soon as the list appears) -- consistent with the "the
// dashboard never guesses a session" principle held since the start of
// this project.

import { useEffect, useState } from "react";
import { HTTP_BASE } from "../lib/config";
import { shortenPath } from "../lib/eventToNode";
import { formatTimeMaybeDate } from "../lib/timeFormat";
import { Trash2 } from "./icons";
import { useI18n } from "../i18n/I18nContext";

// The session's event data size (from sizeBytes, see session-store.js
// listSessions()) -- purely informational, the answer to "how big is this
// session on the server?" (user question 2026-09-03). 1 decimal place is
// enough for a quick comparison between sessions, no need for byte precision.
function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function RecentSessionsList({ onSelect, currentSessionId, onClearCurrent }) {
  const { t } = useI18n();
  const [sessions, setSessions] = useState(null); // null = still loading
  const [error, setError] = useState(false);
  // The session_id currently being asked "are you sure you want to
  // delete?" -- only ONE row at a time, clicking delete on another row
  // automatically swaps it (not stacking several confirmations at once).
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`${HTTP_BASE}/sessions?limit=15`)
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled) setSessions(data.sessions ?? []);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // "Clear this session" (user request 2026-09-03) -- DELETE /sessions/:id,
  // drops it from SessionStore on the server (memory only, the real Claude
  // Code transcript on disk is never touched at all -- see the note in
  // session-store.js). On success -> also drop it from the local list,
  // without needing to refetch everything.
  async function handleDelete(sessionId) {
    setDeletingId(sessionId);
    try {
      await fetch(`${HTTP_BASE}/sessions/${encodeURIComponent(sessionId)}`, { method: "DELETE" });
      setSessions((prev) => (prev ? prev.filter((s) => s.session_id !== sessionId) : prev));
      // Clearing the session CURRENTLY being watched has no visible effect
      // otherwise -- the dashboard's own panels (Overview/Activity Flow/
      // etc.) are driven by client-side state already streamed in, not
      // re-fetched from the server after a delete, and a still-live
      // session just gets silently recreated on its next event anyway
      // (see the deleteSession() note in session-store.js). Confirmed
      // report 2026-09-03: "setelah saya confirm clear session, saya tidak
      // melihat perubahan apa yang terjadi" -- turned out to be exactly
      // this case. Stop watching it too, so the action visibly does
      // something: the user is dropped back to the session picker.
      if (sessionId === currentSessionId) onClearCurrent?.();
    } catch {
      // Ignore -- if it fails, the row just stays in the list (not removed
      // from the view), the user can try again. Not a critical action that
      // needs an explicit error message.
    } finally {
      setDeletingId(null);
      setConfirmDeleteId(null);
    }
  }

  // Still loading (nothing known yet) OR the server is down/unreachable --
  // stay silent, not something worth making a fuss about for this optional
  // shortcut (the manual input box is still the primary path, and the main
  // connection status is already shown separately in the status bar).
  if (error || !sessions) return null;

  // DIFFERENT from the case above: here the server IS alive & answered
  // successfully, it just genuinely has never had any session_id at all --
  // without this explicit message, the component would just silently not
  // appear, looking exactly the same as "hasn't finished loading yet"/an
  // error, even though it's a different condition (already checked,
  // genuinely empty).
  if (sessions.length === 0) {
    return <div className="recent-sessions recent-sessions--empty">{t("recentSessions.empty")}</div>;
  }

  return (
    <div className="recent-sessions">
      <div className="recent-sessions__title">{t("recentSessions.title")}</div>
      <div className="recent-sessions__list">
        {sessions.map((s) => {
          const isConfirming = confirmDeleteId === s.session_id;
          const isCurrent = s.session_id === currentSessionId;
          return (
            <div key={s.session_id} className="recent-sessions__row">
              {/* This whole row used to be ONE <button> -- now split into
                  two separate buttons (watch + delete) because HTML
                  doesn't allow nested <button>s. */}
              <button
                type="button"
                className="recent-sessions__row-main"
                onClick={() => onSelect(s.session_id)}
                disabled={isConfirming}
              >
                <code className="recent-sessions__id" title={s.session_id}>
                  {s.session_id.slice(0, 16)}…
                </code>
                {isConfirming ? (
                  <span className="recent-sessions__confirm-text">
                    {t(isCurrent ? "recentSessions.confirmDeleteCurrent" : "recentSessions.confirmDelete")}
                  </span>
                ) : (
                  <span className="recent-sessions__meta">
                    {/* Marks the row that's the SAME session_id the user is
                        already watching -- clearing it stops watching too
                        (see onClearCurrent above), the badge sets that
                        expectation upfront instead of surprising them. */}
                    {isCurrent ? <span className="recent-sessions__watching-badge">{t("recentSessions.watchingBadge")}</span> : null}
                    {s.eventCount} {t("recentSessions.events")}
                    {typeof s.sizeBytes === "number" ? ` · ${formatSize(s.sizeBytes)}` : ""}
                    {s.cwd ? ` · ${shortenPath(s.cwd, 26)}` : ""}
                    {s.lastEventAt ? ` · ${formatTimeMaybeDate(s.lastEventAt)}` : ""}
                  </span>
                )}
              </button>

              {isConfirming ? (
                <span className="recent-sessions__confirm-actions">
                  <button
                    type="button"
                    className="recent-sessions__confirm-btn recent-sessions__confirm-btn--danger"
                    onClick={() => handleDelete(s.session_id)}
                    disabled={deletingId === s.session_id}
                  >
                    {t("recentSessions.confirmDeleteYes")}
                  </button>
                  <button
                    type="button"
                    className="recent-sessions__confirm-btn"
                    onClick={() => setConfirmDeleteId(null)}
                    disabled={deletingId === s.session_id}
                  >
                    {t("recentSessions.confirmDeleteCancel")}
                  </button>
                </span>
              ) : (
                <button
                  type="button"
                  className="recent-sessions__delete"
                  title={t("recentSessions.clearTooltip")}
                  aria-label={t("recentSessions.clearTooltip")}
                  onClick={() => setConfirmDeleteId(s.session_id)}
                >
                  {/* The icon is hidden on desktop (text only) via CSS,
                      shown again specifically on tablet/mobile -- see the
                      1024px media query in App.css. */}
                  <Trash2 className="recent-sessions__delete-icon" size={13} strokeWidth={2} />
                  <span className="recent-sessions__delete-label">{t("recentSessions.clearLabel")}</span>
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
