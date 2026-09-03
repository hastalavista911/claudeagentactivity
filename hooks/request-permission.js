// hooks/request-permission.js
//
// A PreToolUse hook SEPARATE from emit-event.js -- this is what lets the
// dashboard GENUINELY approve/deny a tool call (Option B, agreed on
// 2026-08-31), not just a read-only notification like emit-event.js's
// "notification" case.
//
// How it works: asks the Agent Server (server/permission-store.js) for a
// decision, which holds this HTTP connection open until the dashboard
// clicks Approve/Deny or it times out. The result is printed to stdout as a
// `hookSpecificOutput` JSON -- that's Claude Code's official format for a
// PreToolUse hook to give a permissionDecision ("allow"/"deny"/"ask")
// WITHOUT showing its own built-in permission prompt.
//
// IMPORTANT -- so a session the user did NOT deliberately activate doesn't
// become slow:
//   1. First check GET /approval-gate/:session_id -- this is an OPT-IN mode
//      per session that the user picks themselves via the selector in the
//      dashboard: "off" (default for every session, see server.js
//      `approvalGateSessions`), "manual" (pause, needs Allow/Deny), or
//      "auto" (allow immediately, never pauses, but still recorded as an
//      event so there's a visible trail). If "off" (or the Agent Server
//      isn't running at all), exit IMMEDIATELY without waiting for anything
//      (implicit "ask" fallback -- Claude Code runs as usual, the normal
//      permission prompt still appears).
//   2. If the mode is "manual" or "auto", only then POST to
//      /permission-requests and wait for its answer (the server itself
//      decides whether to pause or reply immediately based on that mode --
//      this hook itself doesn't need to know the difference).
//   3. Whatever happens (network error, an odd server response, etc.), this
//      hook NEVER exits with a code other than 0 -- any error is enough to
//      mean "ask", Claude Code can still proceed via the normal permission
//      prompt. Deliberately fail-open to Claude Code's NORMAL behavior, not
//      fail-closed (blocking).
//
// STATUS: the `tool_name`/`tool_input` fields in the PreToolUse payload are
// already used without issue by emit-event.js (pre-edit/terminal-start) --
// the only thing used HERE specifically is `tool_name` itself (not just
// tool_input), not separately verified via EMIT_EVENT_DEBUG but should be
// consistent (it's the same stdin payload, just a different field being read).

const AGENT_SERVER_URL = process.env.AGENT_SERVER_URL || "http://localhost:4000";
// A bit longer than the server's own timeout (20 seconds) -- gives some
// network buffer, so this hook doesn't cut off before the server has a
// chance to reply "ask".
const FETCH_TIMEOUT_MS = 25_000;

let inputData = "";
process.stdin.on("data", (chunk) => (inputData += chunk));
process.stdin.on("end", async () => {
  try {
    const hookPayload = JSON.parse(inputData || "{}");
    await run(hookPayload);
  } catch {
    // Silently fall back to "ask" -- see the fail-open note above.
  }
  process.exit(0);
});

async function fetchWithTimeout(url, options, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

function printDecision(decision, reason) {
  // "ask" is deliberately printed explicitly (not left blank) -- clearer
  // intent for anyone reading logs/debug output later.
  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: "PreToolUse",
        permissionDecision: decision,
        ...(reason ? { permissionDecisionReason: reason } : {}),
      },
    })
  );
}

async function run(hookPayload) {
  const sessionId = hookPayload.session_id;
  const toolName = hookPayload.tool_name;
  if (!sessionId || !toolName) return; // incomplete payload -- silently fall back to "ask"

  // Step 1: don't bother if this session wasn't explicitly toggled on by
  // the user in the dashboard -- this is what prevents EVERY edit/command
  // in EVERY project from becoming 20 seconds slower just because some
  // dashboard happens to be connected (the dashboard could be watching a
  // completely different session).
  let gate;
  try {
    const res = await fetchWithTimeout(`${AGENT_SERVER_URL}/approval-gate/${encodeURIComponent(sessionId)}`, {}, 2000);
    gate = await res.json();
  } catch {
    return; // Agent Server is down/unreachable -- fall back to "ask", fast
  }
  if (!gate?.mode || gate.mode === "off") return; // this session isn't toggled on -- fall back to "ask", fast

  // Step 2: this session is toggled to "manual" or "auto" -- only now ask
  // for a real decision. The server itself decides whether to pause or
  // reply immediately (see server.js /permission-requests) based on that
  // mode -- this hook just waits for whatever the answer is, it doesn't
  // need to know the difference.
  let data;
  try {
    const res = await fetchWithTimeout(
      `${AGENT_SERVER_URL}/permission-requests`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_id: sessionId,
          tool_name: toolName,
          tool_input: hookPayload.tool_input ?? {},
          cwd: hookPayload.cwd,
        }),
      },
      FETCH_TIMEOUT_MS
    );
    data = await res.json();
  } catch {
    return; // network dropped mid-flight, or our own fetch timed out -- fall back to "ask"
  }

  if (data.decision === "allow") {
    printDecision("allow", "Disetujui lewat dashboard AI Agent Activity Visualizer");
  } else if (data.decision === "deny") {
    printDecision("deny", "Ditolak lewat dashboard AI Agent Activity Visualizer");
  } else {
    printDecision("ask");
  }
}
