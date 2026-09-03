// dashboard/src/components/OverviewPanel.jsx
//
// Left panel: the "current activity" card, stat tiles, session summary. All
// purely derived from the event array already in the store + optional
// usage (token/model) data.

import { deriveStats, deriveSessionSummary } from "../lib/stats";
import { deriveChangedFiles } from "../lib/changedFiles";
import { formatDuration, formatTokens } from "../lib/timeFormat";
import { shortenPath } from "../lib/eventToNode";
import { StatIcons, CheckCircle2, XCircle } from "./icons";
import { useI18n } from "../i18n/I18nContext";

function StatTile({ icon: Icon, label, value }) {
  return (
    <div className="stat-tile">
      <Icon size={16} className="stat-tile__icon" strokeWidth={1.75} />
      <div>
        <div className="stat-tile__value">{value}</div>
        <div className="stat-tile__label">{label}</div>
      </div>
    </div>
  );
}

// The end-of-session card -- only shown once the session has GENUINELY
// finished (there's an agent.complete event). Not an estimate/made up,
// purely a summary of numbers already computed elsewhere (stats,
// changedFiles, totalTokens).
function SessionSummaryCard({ summary, toolCalls, filesChanged, totalTokens }) {
  const { t } = useI18n();
  if (!summary) return null;
  const success = summary.outcome === "success";
  const OutcomeIcon = success ? CheckCircle2 : XCircle;
  const finishedTime = new Date(summary.finishedAt).toLocaleTimeString(undefined, { hour12: false });

  return (
    <div className="session-summary">
      <div className="session-summary__header">
        <span>{t("overview.summary.title")}</span>
        <span className="session-summary__badge">{t("overview.summary.badge")}</span>
      </div>
      <div className="session-summary__row">
        <span>{t("overview.summary.duration")}</span>
        <span>{formatDuration(summary.durationMs)}</span>
      </div>
      <div className="session-summary__row">
        <span>{t("overview.summary.toolCalls")}</span>
        <span>{toolCalls}</span>
      </div>
      <div className="session-summary__row">
        <span>{t("overview.summary.filesChanged")}</span>
        <span>{filesChanged}</span>
      </div>
      <div className="session-summary__row">
        <span>{t("overview.summary.tokensUsed")}</span>
        <span>{formatTokens(totalTokens)}</span>
      </div>
      <div className="session-summary__row">
        <span>{t("overview.summary.outcome")}</span>
        <span className={`session-summary__outcome session-summary__outcome--${success ? "success" : "error"}`}>
          <OutcomeIcon size={13} strokeWidth={2} /> {success ? t("overview.summary.success") : summary.outcome}
        </span>
      </div>
      <div className="session-summary__finished">{t("overview.summary.finishedAt", { time: finishedTime })}</div>
    </div>
  );
}

function last5hTotal(usage) {
  if (!usage?.last5h) return null;
  const u = usage.last5h.usage;
  return u.input_tokens + u.output_tokens + u.cache_creation_input_tokens + u.cache_read_input_tokens;
}

export default function OverviewPanel({ events, usage }) {
  const { t } = useI18n();
  const stats = deriveStats(events);
  const changedFiles = deriveChangedFiles(events);
  const sessionSummary = deriveSessionSummary(events);
  const totalTokens = usage
    ? usage.usage.input_tokens +
      usage.usage.output_tokens +
      usage.usage.cache_creation_input_tokens +
      usage.usage.cache_read_input_tokens
    : null;

  return (
    <section className="panel panel--overview">
      <h2 className="panel__title">{t("overview.title")}</h2>

      <div className="stat-grid">
        <StatTile icon={StatIcons.thinking} label={t("overview.stat.thinking")} value={stats.thinking} />
        <StatTile icon={StatIcons.files} label={t("overview.stat.files")} value={stats.filesTouchedCount} />
        <StatTile icon={StatIcons.toolCalls} label={t("overview.stat.toolCalls")} value={stats.toolCalls} />
        <StatTile
          icon={StatIcons.tests}
          label={t("overview.stat.tests")}
          value={stats.tests ? `${stats.tests.pass}/${stats.tests.total}` : t("common.dash")}
        />
        <StatTile icon={StatIcons.tokens} label={t("overview.stat.tokens")} value={formatTokens(totalTokens)} />
        <StatTile
          icon={StatIcons.model}
          label={t("overview.stat.model")}
          value={usage?.model?.replace("claude-", "") ?? t("common.dash")}
        />
      </div>

      <div className="panel__subtitle">{t("overview.tokenUsage.title")}</div>
      {usage?.last5h ? (
        <div className="usage-5h">
          <div className="usage-5h__value">{formatTokens(last5hTotal(usage))} tokens</div>
        </div>
      ) : (
        <div className="panel__empty">{usage ? t("overview.tokenUsage.empty") : t("overview.waiting")}</div>
      )}

      <SessionSummaryCard
        summary={sessionSummary}
        toolCalls={stats.toolCalls}
        filesChanged={changedFiles.length}
        totalTokens={totalTokens}
      />
    </section>
  );
}
