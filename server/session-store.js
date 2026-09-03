// server/session-store.js
//
// In-memory session store, per architecture-design.md section 6.
// Single source of truth for agent state — the dashboard & VS Code extension
// are pure consumers, never holding their own state.

const { deriveTranscriptPath } = require("./transcript-path");

class SessionStore {
  constructor() {
    this.sessions = new Map(); // session_id -> { events: [], currentState: {} }
  }

  addEvent(sessionId, event) {
    if (!this.sessions.has(sessionId)) {
      this.sessions.set(sessionId, { events: [], currentState: {}, transcriptPath: null });
    }
    const session = this.sessions.get(sessionId);
    session.events.push(event);
    session.currentState = this.reduceState(session.currentState, event);

    // Way #1 (preferred, when available): explicit transcript_path from the
    // agent.start event (see mapToEvent("session-start") in emit-event.js).
    if (event.type === "agent.start" && event.payload?.transcript_path) {
      session.transcriptPath = event.payload.transcript_path;
    }
    // Way #2 (fallback, retroactive): derive it from `cwd`, which is sent on
    // EVERY event (not just agent.start) -- so it still gets filled in even
    // if the session had already been running before hooks/emit-event.js was
    // sent a transcript_path (see server/transcript-path.js for how that
    // encoding pattern works).
    if (!session.transcriptPath && event.cwd) {
      session.transcriptPath = deriveTranscriptPath(event.cwd, sessionId);
    }

    return session.currentState;
  }

  getTranscriptPath(sessionId) {
    return this.sessions.get(sessionId)?.transcriptPath ?? null;
  }

  reduceState(state, event) {
    switch (event.type) {
      case "file.edit":
        return { ...state, activeFile: event.payload.file, status: event.payload.status };
      case "agent.thinking":
        return { ...state, status: "thinking" };
      case "agent.complete":
        return { ...state, status: "completed" };
      default:
        return state;
    }
  }

  getSnapshot(sessionId) {
    return this.sessions.get(sessionId)?.currentState ?? null;
  }

  getEvents(sessionId) {
    return this.sessions.get(sessionId)?.events ?? [];
  }

  hasSession(sessionId) {
    return this.sessions.has(sessionId);
  }

  // Drop a session from memory ("Clear this session" in
  // RecentSessionsList.jsx, user request 2026-09-03) -- purely clears this
  // server's in-memory cache, NOT the real Claude Code transcript on disk
  // (that's never touched at all). If the same hooks are still actively
  // sending events for this session_id (e.g. the session is still running),
  // addEvent() will automatically recreate its entry as soon as the next
  // event arrives -- "clear" here is consistent with the rest of
  // SessionStore's nature (in-memory, one-shot), not a permanent deletion
  // while the session is still alive.
  deleteSession(sessionId) {
    return this.sessions.delete(sessionId);
  }

  // Summary of EVERY session_id this server has ever seen (newest first) --
  // used by the dashboard to render its session list (see GET /sessions in
  // server.js, dashboard SessionPicker.jsx) so the user doesn't need to
  // ALREADY KNOW/copy a session_id from somewhere else first, just the
  // host/server, then pick from the list. In-memory only (lost if the Agent
  // Server restarts), same as the rest of this SessionStore.
  listSessions() {
    const result = [];
    for (const [sessionId, session] of this.sessions.entries()) {
      const lastEvent = session.events[session.events.length - 1];
      result.push({
        session_id: sessionId,
        eventCount: session.events.length,
        // This session's event data size in memory, in bytes -- recomputed
        // via JSON.stringify() every time this endpoint is called, NOT
        // incrementally cached like usage.js -- this endpoint is only
        // called ONCE per RecentSessionsList.jsx mount (not tight polling),
        // so this recompute cost is fine, no need for usage.js-grade
        // optimization (see the note there). Buffer.byteLength (not just
        // string .length) so it's accurate with multi-byte characters
        // (e.g. non-ASCII paths/messages).
        sizeBytes: Buffer.byteLength(JSON.stringify(session.events), "utf8"),
        lastEventAt: lastEvent?.timestamp ?? null,
        status: session.currentState?.status ?? null,
        cwd: lastEvent?.cwd ?? null,
      });
    }
    result.sort((a, b) => (b.lastEventAt ?? 0) - (a.lastEventAt ?? 0));
    return result;
  }
}

module.exports = { SessionStore };
