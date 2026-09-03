// dashboard/src/components/DetailsPanel.jsx
//
// Right panel: details for one selected event (click in the list/graph,
// defaults to the last event). Its content differs per event type -- a
// field with no data (e.g. "Reason" for a file.edit, "Related Files") is
// deliberately NOT shown rather than made up.

import { describeEvent, labelFor, shortenPath } from "../lib/eventToNode";
import { formatElapsedShort, formatDateTime } from "../lib/timeFormat";
import { categorizeCommand } from "../lib/commandCategory";
import { CategoryIcon } from "./icons";
import { useI18n } from "../i18n/I18nContext";

function DiffPreview({ hunks }) {
  if (!hunks || hunks.length === 0) return null;
  return (
    <div className="diff-preview">
      {hunks.map((hunk, i) => (
        <div key={i} className="diff-preview__hunk">
          <div className="diff-preview__hunk-header">
            @@ -{hunk.oldStart},{hunk.oldLines} +{hunk.newStart},{hunk.newLines} @@
          </div>
          {hunk.lines.map((line, j) => {
            const kind = line.startsWith("+") ? "add" : line.startsWith("-") ? "remove" : "ctx";
            return (
              <div key={j} className={`diff-preview__line diff-preview__line--${kind}`}>
                {line}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

function Field({ label, children }) {
  if (children == null || children === "") return null;
  return (
    <div className="details-field">
      <div className="details-field__label">{label}</div>
      <div className="details-field__value">{children}</div>
    </div>
  );
}

function vscodeFileUri(filePath, line) {
  if (!filePath) return null;
  const normalized = filePath.replace(/\\/g, "/");
  const withColon = normalized.match(/^[a-zA-Z]:\//) ? `/${normalized}` : `/${normalized}`;
  return `vscode://file${withColon}${line ? `:${line}` : ""}`;
}

export default function DetailsPanel({ event, isCurrent }) {
  const { t } = useI18n();

  if (!event) {
    return (
      <section className="panel panel--details">
        <h2 className="panel__title">{t("details.title")}</h2>
        <div className="panel__empty">{t("details.empty")}</div>
      </section>
    );
  }

  const info = describeEvent(event);
  const payload = event.payload ?? {};
  // Date + time, not just time -- time alone is ambiguous once a
  // session/history crosses midnight or gets reopened the next day.
  const time = formatDateTime(event.timestamp);

  return (
    <section className="panel panel--details">
      <div className="panel__header">
        <h2 className="panel__title">{t("details.title")}</h2>
        <CategoryIcon category={info.category} size={15} className="panel__header-icon" />
      </div>

      <div className={`details-headline details-headline--${info.variant}`}>
        <span>
          {labelFor(t, info)}{" "}
          {info.auto ? <span className="badge-auto">{t("event.autoBadge")}</span> : null}
          {isCurrent ? <span className="event-list__current-badge">{t("activityFlow.current")}</span> : null}
        </span>
        <span className="details-headline__time">{time}</span>
      </div>

      <Field label={t("details.field.file")}>{payload.file ? shortenPath(payload.file, 60) : null}</Field>
      <Field label={t("details.field.command")}>{payload.command}</Field>
      <Field label={t("details.field.category")}>
        {payload.command && categorizeCommand(payload.command) ? (
          <span className={`category-badge category-badge--${categorizeCommand(payload.command).key}`}>
            {categorizeCommand(payload.command).label}
          </span>
        ) : null}
      </Field>
      <Field label={t("details.field.reason")}>{payload.description}</Field>
      <Field label={t("details.field.message")}>{payload.message}</Field>
      <Field label={t("details.field.status")}>{payload.status?.toUpperCase()}</Field>
      <Field label={t("details.field.duration")}>
        {payload.duration_ms != null ? formatElapsedShort(payload.duration_ms) : null}
      </Field>
      <Field label={t("details.field.lines")}>
        {payload.line_start ? `${payload.line_start}–${payload.line_end ?? payload.line_start}` : null}
      </Field>
      <Field label={t("details.field.changes")}>
        {payload.lines_added != null || payload.lines_removed != null ? (
          <>
            <span className="details-changes details-changes--add">+{payload.lines_added ?? 0}</span>{" "}
            <span className="details-changes details-changes--remove">-{payload.lines_removed ?? 0}</span>
          </>
        ) : null}
      </Field>

      {/* agent_thought = Claude Code's own text from the local transcript
          (see extractAgentThought() in hooks/emit-event.js), NOT a fresh
          LLM summary. A best-effort heuristic -- often empty, that's expected. */}
      {payload.agent_thought ? (
        <>
          <div className="panel__subtitle">{t("details.agentThoughts")}</div>
          <div className="agent-thought">{payload.agent_thought}</div>
        </>
      ) : null}

      {payload.diff ? (
        <>
          <div className="panel__subtitle">{t("details.diffPreview")}</div>
          <DiffPreview hunks={payload.diff} />
        </>
      ) : null}

      {(payload.stdout || payload.stderr) && (
        <>
          <div className="panel__subtitle">{t("details.output")}</div>
          <pre className="details-output">{payload.stdout || payload.stderr}</pre>
        </>
      )}

      {payload.file ? (
        <a
          className="details-open-vscode"
          href={vscodeFileUri(payload.file, payload.line_start)}
          title={t("details.openInVSCodeTitle")}
        >
          {t("details.openInVSCode")}
        </a>
      ) : null}
    </section>
  );
}
