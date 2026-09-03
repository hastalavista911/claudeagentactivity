// dashboard/src/components/ActivityNode.jsx
//
// A custom React Flow node for one agent event. Purely presentational --
// all the event -> display mapping logic lives in lib/eventToNode.js.

import { Handle, Position } from "@xyflow/react";
import { CategoryIcon } from "./icons";
import { STATUS_COLOR } from "../lib/statusColors";
import { labelFor } from "../lib/eventToNode";
import { useI18n } from "../i18n/I18nContext";
import { formatTimeMaybeDate, formatDateTime } from "../lib/timeFormat";

export default function ActivityNode({ data }) {
  const { t } = useI18n();
  const color = STATUS_COLOR[data.variant] ?? STATUS_COLOR.info;
  // Pulsing MUST be restricted to the LAST node (`isCurrent`) only --
  // describeEvent() marks the "running" variant purely from that event's
  // own payload (e.g. file.edit status:"running"), with no idea whether a
  // LATER event has already finished/superseded it. Without this
  // isCurrent condition, an old history node that happened to have a
  // "running" status at the time (e.g. an "Editing..." that finished long
  // ago, but isn't the last node) would pulse FOREVER, looking like it's
  // still being processed when it's really just history -- a bug that was
  // reported by the user. `stillWorking` (computed in FlowCanvas.jsx from
  // isTurnOpen()) is already only ever true for the last node too, but
  // it's written explicitly here so the rule is clear and doesn't depend
  // on an assumption made somewhere else.
  const pulsing = data.isCurrent && (data.variant === "running" || data.stillWorking);

  const classes = ["activity-node"];
  if (pulsing) classes.push("activity-node--pulsing");
  if (data.isSelected) classes.push("activity-node--selected");

  // The full tooltip (date + time, plus a detail if there is one) -- the
  // inline header row stays compact (time only, the date only shows up if
  // it's not today), but the full info is always available on hover.
  const tooltip = [formatDateTime(data.timestamp), data.detail].filter(Boolean).join(" — ");

  return (
    <div className={classes.join(" ")} style={{ borderColor: color }} title={tooltip}>
      {/* Left/Right handle positions match the dagre LR-direction layout
          (lib/layout.js). If a TB direction toggle is ever added, these
          need to become Top/Bottom too. */}
      <Handle type="target" position={Position.Left} style={{ opacity: 0 }} />
      <div className="activity-node__header">
        <CategoryIcon category={data.category} size={13} className="activity-node__icon" style={{ color }} />
        <span className="activity-node__label">{labelFor(t, data)}</span>
        {data.auto ? <span className="badge-auto">{t("event.autoBadge")}</span> : null}
        <span className="activity-node__time">{formatTimeMaybeDate(data.timestamp)}</span>
      </div>
      {data.detail ? <div className="activity-node__detail">{data.detail}</div> : null}
      {data.stillWorking ? (
        <div className="activity-node__working">
          <span className="pulse-dot" /> {t("activityFlow.stillWorking")}
        </div>
      ) : null}
      {data.isSelected ? <span className="activity-node__selected-badge">{t("activityFlow.selected")}</span> : null}
      {data.isCurrent ? <span className="activity-node__current-badge">{t("activityFlow.current")}</span> : null}
      <Handle type="source" position={Position.Right} style={{ opacity: 0 }} />
    </div>
  );
}
