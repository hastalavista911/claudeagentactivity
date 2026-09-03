// server/permission-store.js
//
// A SYNCHRONOUS bridge between the PreToolUse hook (which waits for a
// decision) and the dashboard (which provides the decision via an
// Approve/Deny click). The server holds that hook's HTTP connection OPEN
// (not answered right away) until one of two things happens:
//   1. The dashboard answers via POST /permission-requests/:id/decide ->
//      decision = "allow" or "deny".
//   2. The timeout runs out -> decision = "ask", NOT a silent
//      auto-approve/auto-deny. "ask" means Claude Code falls back to its
//      own built-in permission prompt in the terminal/VS Code -- the
//      dashboard becomes an OPTIONAL shortcut, not the only way to answer.
//      See hooks/request-permission.js.

const crypto = require("node:crypto");

class PermissionStore {
  constructor() {
    this.pending = new Map(); // id -> entry
  }

  // `onSettled(entry, decision)` is called EXACTLY ONCE whenever this
  // request finishes (answered by the dashboard OR timed out) -- used by
  // server.js to broadcast a "permission.resolved" WS message so the
  // dashboard knows when to dismiss its approval card (including when
  // several dashboard tabs are open at once, all of them get updated).
  request(sessionId, toolName, toolInput, timeoutMs, onSettled) {
    const id = crypto.randomUUID();
    const entry = { id, sessionId, toolName, toolInput, timeoutMs, createdAt: Date.now(), timer: null };

    const promise = new Promise((resolve) => {
      let settled = false;
      const settle = (decision) => {
        if (settled) return; // already decided via the other path (race between timeout and decide())
        settled = true;
        clearTimeout(entry.timer);
        this.pending.delete(id);
        resolve(decision);
        onSettled?.(entry, decision);
      };
      entry.timer = setTimeout(() => settle("ask"), timeoutMs);
      entry._settle = settle;
      this.pending.set(id, entry);
    });

    return { id, promise };
  }

  // true if it succeeded (the request was still pending when called), false
  // if the id doesn't exist / already finished (e.g. it already timed out).
  decide(id, decision) {
    const entry = this.pending.get(id);
    if (!entry) return false;
    entry._settle(decision);
    return true;
  }

  // Used by the dashboard after a refresh/reconnect to restore a still-
  // pending approval card -- the client's React state is lost on every
  // refresh, but the request itself (and its timer) stays alive here on the
  // server until it's answered/times out. In practice there's at most one
  // per session (Claude Code waits on one tool call per turn), so the first
  // matching entry is enough.
  getPendingForSession(sessionId) {
    for (const entry of this.pending.values()) {
      if (entry.sessionId === sessionId) return entry;
    }
    return null;
  }
}

// Called from TWO places (server.js /permission-requests for sessions
// watched via a hook, and chat.js for SDK chat sessions) whenever "auto"
// mode lets a tool call through WITHOUT pausing. Doesn't change anything in
// PermissionStore itself -- this purely adds a SINGLE ordinary domain event
// (`permission.auto`) to SessionStore, through the EXACT same path as any
// other event (file.edit, terminal.start, etc.) -- so it still shows up in
// Activity Flow/Details with an "AUTO" badge (see lib/eventToNode.js in the
// dashboard), rather than passing through completely unrecorded.
function emitAutoApprovedEvent({ sessionStore, broadcast, sessionId, cwd, toolName, toolInput }) {
  const event = {
    session_id: sessionId,
    timestamp: Date.now(),
    cwd: cwd ?? null,
    type: "permission.auto",
    payload: { tool_name: toolName, tool_input: toolInput ?? {} },
  };
  sessionStore.addEvent(sessionId, event);
  broadcast(event);
}

// Same pattern as emitAutoApprovedEvent, but for Manual mode -- called from
// the `onSettled` callback in server.js & chat.js, which ALREADY fires for
// BOTH cases (dashboard clicks Allow/Deny, OR the timeout runs out ->
// "ask"), so this one place catches all of them. Before this, a manual
// decision NEVER became an event -- it just passed through the
// "permission.resolved" WS message the dashboard uses to close the approval
// card, then vanished without a trace in Activity Flow. Now it's recorded
// as "permission.decided" (an Alerts/notification panel badge).
function emitDecisionEvent({ sessionStore, broadcast, sessionId, cwd, toolName, toolInput, decision }) {
  const event = {
    session_id: sessionId,
    timestamp: Date.now(),
    cwd: cwd ?? null,
    type: "permission.decided",
    payload: { tool_name: toolName, tool_input: toolInput ?? {}, decision },
  };
  sessionStore.addEvent(sessionId, event);
  broadcast(event);
}

module.exports = { PermissionStore, emitAutoApprovedEvent, emitDecisionEvent };
