// dashboard/src/lib/stats.js
//
// Derives summary numbers (the stat tiles in the Agent Overview panel)
// purely from the existing event array -- no new data is fetched.

export function deriveStats(events) {
  let thinking = 0;
  let toolCalls = 0; // terminal.start
  const filesTouched = new Set();
  let testPass = 0;
  let testFail = 0;
  let hasTestSignal = false;

  for (const event of events) {
    const payload = event.payload ?? {};
    switch (event.type) {
      case "agent.thinking":
        thinking++;
        break;
      case "terminal.start":
        toolCalls++;
        break;
      case "file.edit":
      case "file.read":
        if (payload.file) filesTouched.add(payload.file);
        break;
      case "terminal.output": {
        // Light heuristic: many test runners (mock-agent, phpunit, jest,
        // pytest) use ✓/✗ symbols or PASS/FAIL words per line. Not a
        // guaranteed-accurate match for every runner -- that's why it's
        // flagged as "hasTestSignal" so the UI can show "—" when there's
        // genuinely no signal at all, instead of a misleading "0/0".
        const line = payload.line ?? "";
        if (/^\s*(✓|✔|PASS)/i.test(line)) {
          testPass++;
          hasTestSignal = true;
        } else if (/^\s*(✗|✘|FAIL)/i.test(line)) {
          testFail++;
          hasTestSignal = true;
        }
        break;
      }
      default:
        break;
    }
  }

  return {
    thinking,
    toolCalls,
    filesTouchedCount: filesTouched.size,
    tests: hasTestSignal ? { pass: testPass, fail: testFail, total: testPass + testFail } : null,
  };
}

// End-of-session summary -- only shown once the session has GENUINELY
// finished (there's an agent.complete event), never estimated/made up.
// null if it hasn't.
export function deriveSessionSummary(events) {
  if (events.length === 0) return null;
  const completeEvent = events.find((e) => e.type === "agent.complete");
  if (!completeEvent) return null;
  const first = events[0];
  return {
    durationMs: completeEvent.timestamp - first.timestamp,
    finishedAt: completeEvent.timestamp,
    outcome: completeEvent.payload?.status ?? "unknown",
  };
}

// i18n key per activity kind -- used by OverviewPanel (CurrentActivityCard) &
// ChatPanel ("thinking" indicator) to stay consistent, one single source of
// truth. Translated at the render point via t(ACTIVITY_LABEL_KEY[kind]) --
// this lib itself doesn't know which language is active, it's pure data mapping.
export const ACTIVITY_LABEL_KEY = {
  editing: "activity.editing",
  terminal: "activity.terminal",
  thinking: "activity.thinking",
};

// true for as long as this turn has NOT been definitively closed (a Stop
// hook -> agent.complete, or agent.error) -- the only DEFINITE signal we
// have about "is Claude Code still mid-turn". Used by findCurrentActivity()
// below and FlowCanvas.jsx (to decide whether the last node in the graph
// needs to pulse, not just a node whose variant is "running").
export function isTurnOpen(events) {
  if (events.length === 0) return false;
  const last = events[events.length - 1];
  return last.type !== "agent.complete" && last.type !== "agent.error";
}

// Finds the action that's currently "running" (with no matching
// "done"/complete yet) -- used by the "Current Activity" card & ChatPanel's
// typing indicator. Null if the TURN has genuinely finished (see isTurnOpen).
//
// IMPORTANT: if the turn is still open but there's no SPECIFIC action
// clearly still running (e.g. the last event was "Terminal Done"/"Edited"),
// this STILL returns {kind:"thinking", ...} as a fallback -- not null. This
// isn't a misread, it's an honest hook limitation: Claude Code often thinks
// for a fair while BETWEEN one tool call and the next, and there's NO hook
// event for "thinking mid-turn" (Notification/UserPromptSubmit only fire
// once at the start) -- so if the turn hasn't closed yet, we assume "most
// likely still thinking" rather than silently showing Idle when Claude Code
// is clearly still working (see also Claude Code's own status panel, e.g.
// "Schlepping...").
export function findCurrentActivity(events) {
  if (!isTurnOpen(events)) return null;
  const last = events[events.length - 1];

  for (let i = events.length - 1; i >= 0; i--) {
    const event = events[i];
    const payload = event.payload ?? {};
    if (event.type === "file.edit" && payload.status === "running") {
      return { kind: "editing", file: payload.file, since: event.timestamp };
    }
    if (event.type === "terminal.start") {
      // Check whether a terminal.complete already came AFTER this event --
      // if not, this command is still "running".
      const hasCompleted = events.slice(i + 1).some((e) => e.type === "terminal.complete");
      if (!hasCompleted) return { kind: "terminal", command: payload.command, since: event.timestamp };
    }
    // Hit a PREVIOUS turn's boundary (a resumed/multi-turn session, e.g. a
    // follow-up chat) -- stop searching here, don't mistake an action from
    // an old turn as still running in the CURRENT active turn. The current
    // turn is already confirmed still open (checked via isTurnOpen above),
    // so fall through to the thinking fallback.
    if (event.type === "agent.complete" || event.type === "agent.error") break;
  }

  return { kind: "thinking", since: last.timestamp };
}
