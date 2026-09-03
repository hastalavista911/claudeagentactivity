// dashboard/src/components/TerminalLogPanel.jsx
//
// Two modes, toggled by "Debug mode" (default OFF, local state to this
// panel only -- purely a display preference, not data that needs to sync
// anywhere):
//  - OFF (default, for a partner who doesn't need to know internal
//    details): a short summary -- tool name, file/command, status.
//  - ON (for debugging): the raw JSON event as-is, including fields the
//    concise version doesn't show -- this is the most accurate way to
//    track down a problem if a hook payload changes/looks odd.

import { useState } from "react";
import { describeEvent, labelFor, shortenPath } from "../lib/eventToNode";
import { useI18n } from "../i18n/I18nContext";

function findRelevantTerminalEvent(events, selected) {
  if (selected?.type === "terminal.start" || selected?.type === "terminal.complete") return selected;
  for (let i = events.length - 1; i >= 0; i--) {
    if (events[i].type === "terminal.complete") return events[i];
  }
  return null;
}

function ConciseView({ event }) {
  const { t } = useI18n();
  const info = describeEvent(event);
  const payload = event.payload ?? {};
  return (
    <div className="terminal-concise">
      <div className="terminal-concise__row">
        <span className="terminal-concise__label">{t("terminal.concise.tool")}</span>
        <span>{labelFor(t, info)}</span>
      </div>
      {payload.command ? (
        <div className="terminal-concise__row">
          <span className="terminal-concise__label">{t("terminal.concise.command")}</span>
          <code>{payload.command}</code>
        </div>
      ) : null}
      {payload.file ? (
        <div className="terminal-concise__row">
          <span className="terminal-concise__label">{t("terminal.concise.file")}</span>
          <code>{shortenPath(payload.file, 50)}</code>
        </div>
      ) : null}
      <div className="terminal-concise__row">
        <span className="terminal-concise__label">{t("terminal.concise.status")}</span>
        <span className={`terminal-concise__status terminal-concise__status--${info.variant}`}>
          {info.variant === "error"
            ? t("terminal.concise.statusError")
            : info.variant === "success"
              ? t("terminal.concise.statusSuccess")
              : t("terminal.concise.statusRunning")}
        </span>
      </div>
    </div>
  );
}

export default function TerminalLogPanel({ events, selectedEvent }) {
  const { t } = useI18n();
  const [debugMode, setDebugMode] = useState(false);
  const event = findRelevantTerminalEvent(events, selectedEvent);

  return (
    <section className="panel panel--terminal">
      <div className="panel__header">
        <h2 className="panel__title">{t("terminal.title")}</h2>
        <label className="debug-toggle" title={t("terminal.debugTooltip")}>
          <input type="checkbox" checked={debugMode} onChange={(e) => setDebugMode(e.target.checked)} />
          <span className="debug-toggle__slider" />
          <span className="debug-toggle__label">{t("terminal.debugMode")}</span>
        </label>
      </div>

      {!event ? (
        <div className="panel__empty">{t("terminal.empty")}</div>
      ) : debugMode ? (
        <pre className="terminal-log">{JSON.stringify(event, null, 2)}</pre>
      ) : (
        <ConciseView event={event} />
      )}
    </section>
  );
}
