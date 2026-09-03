// dashboard/src/components/InsightsPanel.jsx
//
// Used to be an empty slot (PlaceholderPanel) in the bottom-right corner of
// the grid -- now filled with 4 small tabs, all PURELY derived from data
// already in the store (events/usage), no new request to the server:
//  - Files: files touched THIS SESSION (different from GitPanel's Status,
//    which shows the CURRENT disk state -- this is edit intent, including
//    ones that were later reverted), click -> jump to the related event in
//    Activity Flow.
//  - Cost: a $ estimate from token usage (public LIST pricing, not an
//    exact bill -- see lib/costEstimate.js).
//  - Alerts: notifications + permission decisions (auto & manual)
//    throughout the session -- previously these just flashed by in a
//    banner then disappeared.
//  - Tests: a best-effort heuristic reading a PASS/FAIL summary from
//    terminal output (lib/testSummary.js) -- fills in the TESTS stat tile,
//    which used to always show "--".
//
// The tab pattern deliberately reuses the same CSS classes as GitPanel
// (.git-tabs) to stay visually consistent, rather than building a new tab system.

import { useState } from "react";
import { Sparkles, FileText, Coins, Bell, FlaskConical, CheckCircle2, XCircle } from "./icons";
import { deriveChangedFiles } from "../lib/changedFiles";
import { shortenPath, describeEvent, labelFor } from "../lib/eventToNode";
import { formatTokens, formatTimeMaybeDate } from "../lib/timeFormat";
import { estimateCostUsd } from "../lib/costEstimate";
import { findLatestTestSummary } from "../lib/testSummary";
import { useI18n } from "../i18n/I18nContext";

function FilesTab({ events, onSelectEvent }) {
  const { t } = useI18n();
  const files = deriveChangedFiles(events);
  if (files.length === 0) return <div className="panel__empty">{t("insights.files.empty")}</div>;

  return (
    <div className="git-status-list">
      {files.map((f) => (
        <button key={f.file} type="button" className="git-status-list__row" onClick={() => onSelectEvent(f.lastEventIndex)}>
          <span className="git-status-list__path" title={f.file}>
            {shortenPath(f.file, 32)}
          </span>
          <span className="insights-files__meta">
            {f.hasLineStats ? `+${f.added}/-${f.removed}` : t("insights.files.editsCount", { count: f.edits })}
          </span>
        </button>
      ))}
    </div>
  );
}

function CostTab({ usage }) {
  const { t } = useI18n();
  if (!usage) return <div className="panel__empty">{t("insights.cost.empty")}</div>;

  const u = usage.usage;
  const cost = estimateCostUsd(u, usage.model);

  return (
    <div className="insights-cost">
      <div className="insights-cost__value">${cost < 0.01 ? cost.toFixed(4) : cost.toFixed(2)}</div>
      <div className="insights-cost__disclaimer">{t("insights.cost.disclaimer")}</div>
      <div className="insights-cost__breakdown">
        <div>
          {t("insights.cost.input")} <span>{formatTokens(u.input_tokens)}</span>
        </div>
        <div>
          {t("insights.cost.output")} <span>{formatTokens(u.output_tokens)}</span>
        </div>
        <div>
          {t("insights.cost.cacheWrite")} <span>{formatTokens(u.cache_creation_input_tokens)}</span>
        </div>
        <div>
          {t("insights.cost.cacheRead")} <span>{formatTokens(u.cache_read_input_tokens)}</span>
        </div>
      </div>
    </div>
  );
}

const ALERT_TYPES = new Set(["agent.notification", "permission.auto", "permission.decided"]);

function AlertsTab({ events }) {
  const { t } = useI18n();
  const alerts = events.filter((e) => ALERT_TYPES.has(e.type));
  if (alerts.length === 0) return <div className="panel__empty">{t("insights.alerts.empty")}</div>;

  return (
    <div className="git-log-list">
      {alerts
        .slice()
        .reverse()
        .map((e, i) => {
          const info = describeEvent(e);
          return (
            <div key={i} className="git-log-list__item">
              <div className="git-log-list__row">
                <span className={`insights-alerts__dot insights-alerts__dot--${info.variant}`} />
                <div className="git-log-list__body">
                  <div className="git-log-list__subject">{labelFor(t, info)}</div>
                  <div className="git-log-list__meta">
                    {formatTimeMaybeDate(e.timestamp)}
                    {info.detail ? ` · ${info.detail}` : ""}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
    </div>
  );
}

function TestsTab({ events }) {
  const { t } = useI18n();
  const result = findLatestTestSummary(events);
  if (!result) return <div className="panel__empty">{t("insights.tests.empty")}</div>;

  return (
    <div className="insights-tests">
      <div className="insights-tests__row insights-tests__row--pass">
        <CheckCircle2 size={14} strokeWidth={2} /> {t("insights.tests.passed", { count: result.passed })}
      </div>
      {result.failed > 0 ? (
        <div className="insights-tests__row insights-tests__row--fail">
          <XCircle size={14} strokeWidth={2} /> {t("insights.tests.failed", { count: result.failed })}
        </div>
      ) : null}
      <div className="insights-cost__disclaimer">{t("insights.tests.caption", { source: result.source })}</div>
    </div>
  );
}

export default function InsightsPanel({ events, usage, onSelectEvent }) {
  const { t } = useI18n();
  const [tab, setTab] = useState("files");

  const TABS = [
    { key: "files", label: t("insights.tab.files"), Icon: FileText },
    { key: "cost", label: t("insights.tab.cost"), Icon: Coins },
    { key: "alerts", label: t("insights.tab.alerts"), Icon: Bell },
    { key: "tests", label: t("insights.tab.tests"), Icon: FlaskConical },
  ];

  return (
    <section className="panel panel--insights">
      <div className="panel__header">
        <h2 className="panel__title">
          <Sparkles size={15} strokeWidth={2} /> {t("insights.title")}
        </h2>
      </div>

      {events.length === 0 ? (
        // Stop watching -> events gets reset to [] (see useAgentStore.js
        // stopWatching()). Without this guard, the tab bar + CostTab would
        // stay stuck showing "No token usage data yet" even though there's
        // no session at all -- giving the false impression of watching an
        // empty session, when really no session is being watched at all.
        <div className="panel__empty">{t("insights.noSession")}</div>
      ) : (
        <>
          <div className="git-tabs insights-tabs">
            {TABS.map(({ key, label, Icon }) => (
              <button
                key={key}
                type="button"
                className={`git-tabs__tab${tab === key ? " git-tabs__tab--active" : ""}`}
                onClick={() => setTab(key)}
              >
                <Icon size={12} strokeWidth={2} /> {label}
              </button>
            ))}
          </div>
          <div className="git-panel__body">
            {tab === "files" ? <FilesTab events={events} onSelectEvent={onSelectEvent} /> : null}
            {tab === "cost" ? <CostTab usage={usage} /> : null}
            {tab === "alerts" ? <AlertsTab events={events} /> : null}
            {tab === "tests" ? <TestsTab events={events} /> : null}
          </div>
        </>
      )}
    </section>
  );
}
