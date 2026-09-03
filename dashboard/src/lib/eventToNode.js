// dashboard/src/lib/eventToNode.js
//
// Maps one event (schema per architecture-design.md sections 4.1/5) into
// display info: category (canvas lane), status variant (color), icon, and a
// short label.
//
// The label is NOT returned as a finished string -- this lib is pure (it
// doesn't know which language is active) -- instead it returns a
// `labelKey` (dot-path into i18n/translations.js) + an optional
// `labelSuffix` (the non-text part, e.g. "(+3/-1)"). The consumer (a React
// component) calls labelFor(t, info) to get the finished text. The
// fallback case (`rawLabel`) is used for a raw event.type that genuinely
// has no translation (an unrecognized event type).

const CATEGORY_BY_PREFIX = [
  ["agent.", "agent"],
  ["file.", "file"],
  ["terminal.", "terminal"],
  ["chat.", "chat"],
];

export function categoryOf(type) {
  const found = CATEGORY_BY_PREFIX.find(([prefix]) => type.startsWith(prefix));
  return found ? found[1] : "other";
}

export function shortenPath(filePath, maxLen = 42) {
  if (!filePath) return "";
  const normalized = filePath.replace(/\\/g, "/");
  if (normalized.length <= maxLen) return normalized;
  const parts = normalized.split("/");
  const base = parts.pop();
  return `…/${base}`.length < maxLen ? `…/${base}` : `…${normalized.slice(-maxLen)}`;
}

export function describeEvent(event) {
  const category = categoryOf(event.type);
  const payload = event.payload ?? {};

  switch (event.type) {
    case "agent.start":
      return { category, variant: "info", labelKey: "event.agentStart", detail: "" };
    case "agent.thinking":
      return { category, variant: "running", labelKey: "event.thinking", detail: "" };
    case "agent.complete":
      return {
        category,
        variant: payload.status === "success" ? "success" : "error",
        labelKey: "event.complete",
        detail: payload.status ?? "",
      };
    case "agent.error":
      return { category, variant: "error", labelKey: "event.error", detail: payload.message ?? "" };
    case "agent.notification":
      // A read-only mirror of Claude Code's Notification hook -- see
      // components/NotificationBanner.jsx for its banner. Not an
      // approve/reject request, just an "Claude Code needs your attention" info.
      return { category, variant: "info", labelKey: "event.notification", detail: payload.message ?? "" };
    case "chat.message":
      // A message from a chat started directly in the dashboard
      // (server/chat.js) -- the full content is shown in ChatPanel, here it
      // just needs a short label.
      return {
        category,
        variant: "info",
        labelKey: payload.role === "user" ? "event.userMessage" : "event.assistantReply",
        detail: (payload.text ?? "").slice(0, 60),
      };
    case "file.read":
      return { category, variant: "info", labelKey: "event.read", detail: shortenPath(payload.file) };
    case "file.edit": {
      const running = payload.status === "running";
      const diffLabel =
        !running && (payload.lines_added != null || payload.lines_removed != null)
          ? ` (+${payload.lines_added ?? 0}/-${payload.lines_removed ?? 0})`
          : "";
      return {
        category,
        variant: running ? "running" : "success",
        labelKey: running ? "event.editing" : "event.edited",
        labelSuffix: diffLabel,
        detail: shortenPath(payload.file),
      };
    }
    case "terminal.start":
      return {
        category,
        variant: "running",
        labelKey: "event.run",
        detail: payload.description || payload.command || "",
      };
    case "terminal.output":
      return { category, variant: "info", labelKey: "event.output", detail: payload.line ?? "" };
    case "permission.auto": {
      // Recorded by the server (permission-store.js emitAutoApprovedEvent)
      // every time "Auto" mode lets a tool call through WITHOUT pausing --
      // purely a read-only trail, not a control like
      // permission.requested/resolved (which are deliberately NOT part of
      // the events array, see useAgentStore.js). `auto: true` is used by
      // components (ActivityNode/EventListView/DetailsPanel) to show a
      // small "AUTO" badge next to the label.
      const detail = payload.tool_input?.command || payload.tool_input?.file_path || "";
      return {
        category: "other",
        variant: "success",
        labelKey: "event.autoApproved",
        labelSuffix: `: ${payload.tool_name ?? ""}`,
        detail: typeof detail === "string" ? shortenPath(detail, 60) : "",
        auto: true,
      };
    }
    case "permission.decided": {
      // Recorded by the server (permission-store.js emitDecisionEvent)
      // every time Manual mode finishes deciding -- either the user clicked
      // Allow/Deny in the dashboard OR the timeout ran out ("ask", treated
      // as a deny). Before this, a manual decision NEVER became an event
      // (it just passed through the permission.resolved WS message then
      // vanished) -- now it's visible in the trail just like
      // permission.auto, consumed by AlertsTab (see InsightsPanel.jsx).
      const detail = payload.tool_input?.command || payload.tool_input?.file_path || "";
      const allowed = payload.decision === "allow";
      return {
        category: "other",
        variant: allowed ? "success" : "error",
        labelKey: allowed ? "event.decidedAllow" : "event.decidedDeny",
        labelSuffix: `: ${payload.tool_name ?? ""}`,
        detail: typeof detail === "string" ? shortenPath(detail, 60) : "",
      };
    }
    case "terminal.complete": {
      // Three possible payload shapes:
      //  - mock-agent: {exit_code}
      //  - an older hook (before it was enriched): {output}
      //  - the current hook: {stdout, stderr, duration_ms, interrupted}
      const hasExitCode = payload.exit_code !== undefined;
      const hasStderr = typeof payload.stderr === "string" && payload.stderr.trim().length > 0;
      const failed = hasExitCode ? payload.exit_code !== 0 : hasStderr;
      const text = payload.stdout ?? payload.output ?? "";
      return {
        category,
        variant: hasExitCode || hasStderr ? (failed ? "error" : "success") : "info",
        labelKey: "event.terminalDone",
        detail: hasExitCode ? `exit code ${payload.exit_code}` : text.slice(0, 60),
      };
    }
    default:
      return { category: "other", variant: "info", rawLabel: event.type, detail: "" };
  }
}

// Turns describeEvent()'s returned info into a finished label string --
// called at the render point (a React component, which has access to t()).
export function labelFor(t, info) {
  if (info.labelKey) return t(info.labelKey) + (info.labelSuffix ?? "");
  return info.rawLabel ?? "";
}

// The filter chips above the Activity Flow list -- purely a re-classification
// of events already in hand, no new request. "Complete"/"Error" are mapped
// from the variant (color) already used throughout the dashboard, for consistency.
export const ACTIVITY_FILTERS = [
  { key: "all", labelKey: "activityFlow.filter.all" },
  { key: "thinking", labelKey: "activityFlow.filter.thinking" },
  { key: "run", labelKey: "activityFlow.filter.run" },
  { key: "complete", labelKey: "activityFlow.filter.complete" },
  { key: "error", labelKey: "activityFlow.filter.error" },
];

export function matchesFilter(event, filterKey) {
  if (!filterKey || filterKey === "all") return true;
  switch (filterKey) {
    case "thinking":
      return event.type === "agent.thinking";
    case "run":
      return event.type === "terminal.start" || event.type === "terminal.complete";
    case "complete":
      return describeEvent(event).variant === "success";
    case "error":
      return describeEvent(event).variant === "error";
    default:
      return true;
  }
}

// `t` is needed here because search matches against the LABEL TEXT shown to
// the user (already translated), not its internal key -- so the user can
// search using words in whichever language is currently active in the UI.
export function matchesSearch(event, query, t) {
  if (!query) return true;
  const info = describeEvent(event);
  const haystack = `${labelFor(t, info)} ${info.detail}`.toLowerCase();
  return haystack.includes(query.trim().toLowerCase());
}
