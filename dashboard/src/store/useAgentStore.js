// dashboard/src/store/useAgentStore.js
//
// The single source of state on the dashboard side. The dashboard is a
// CONSUMER of the Agent Server (design principle section 2) -- this store
// is never the source of truth, it only mirrors what the server sends over
// WebSocket + REST backfill.
//
// IMPORTANT: there's no "follow the last active session_id" mode anymore
// (the server is never trusted to guess the correct session_id -- that's
// the user's decision). The dashboard does NOT process/display anything
// until the user explicitly enters a session_id via watchSession(). This is
// also what prevents cross-contamination if more than one session happens
// to be active at the same time (e.g. mock-agent + a real Claude Code hook).
//
// Flow for watching one session:
//  1. watchSession(id) -> reset the timeline, mark selectedSessionId, start backfill.
//  2. Backfill: GET /sessions/:id (REST) -> fills in the full history, doesn't wait for WebSocket.
//  3. Live events over WebSocket WHILE backfill is running are buffered
//     first, then merged in after backfill finishes -- so no event gets
//     lost or duplicated.
//  4. After that, ONLY events whose session_id matches selectedSessionId
//     are processed -- every broadcast from another session is ignored entirely.
//  5. The WebSocket auto-reconnects with simple backoff if the connection drops.

import { create } from "zustand";
import { reduceState } from "../lib/reduceState";
import { HTTP_BASE, WS_URL } from "../lib/config";

const MAX_BACKOFF_MS = 10_000;
const STORAGE_KEY = "agentVisualizer.watchedSessionId";
const USAGE_POLL_MS = 4_000;

// localStorage might not be available/might throw (private browsing,
// storage disabled by the browser, etc.) -- that shouldn't be allowed to
// error out the dashboard, it just means "the session isn't remembered,"
// not something fatal.
function safeGetStoredSessionId() {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}
function safeSetStoredSessionId(id) {
  try {
    localStorage.setItem(STORAGE_KEY, id);
  } catch {
    // ignore
  }
}
function safeClearStoredSessionId() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

export const useAgentStore = create((set, get) => ({
  connectionStatus: "idle", // idle | connecting | open | closed | error
  sessionId: null,
  status: null,
  activeFile: null,
  events: [],
  lastError: null,

  // null = no session selected yet -- the dashboard is idle, not processing
  // any broadcasts. Only gets filled via watchSession() (a manual input from the user).
  selectedSessionId: null,

  // true from mount UNTIL resumeLastSession() finishes deciding its fate --
  // EITHER there's a stored session_id (wait for its backfill to finish) OR
  // there isn't one at all (immediately false, nothing to wait for).
  // DIFFERENT from _backfilling (internal, REUSED every time any session is
  // switched) -- this one only matters for the ONE-TIME window at startup,
  // used by App.jsx for a brief preloader so buttons don't look "ready"
  // while heavy work (WS connect + backfill + recomputing the graph layout)
  // is still happening in the background (user report 2026-09-03 about
  // clicking Server feeling delayed after a refresh). DELIBERATELY only
  // once at startup -- a later manual watchSession() (switching sessions,
  // starting a new chat) does NOT trigger this again, because the form/UI
  // for that already has its own feedback (the "Watching..." state).
  initializing: true,

  // 0-100 -- the share of the 3 resume steps that have GENUINELY finished
  // (backfill, syncApprovalGate, fetchUsage; see resumeLastSession()), not
  // a guessed animation. Used by AppPreloader.jsx for the real progress bar
  // width, not an indeterminate bar that just moves back and forth with no
  // meaning (correction from the user, 2026-09-03 -- they wanted an honest
  // 0-100% progress that follows the real process).
  initializingProgress: 0,

  // Index of the event currently selected by the user in the list/graph --
  // for the Details panel. null = nothing selected yet (the UI shows the
  // last action by default).
  selectedEventIndex: null,

  // Model + token usage from GET /usage/:id (reads the local transcript,
  // not an LLM call -- see server/usage.js). null = not available yet/not available.
  usage: null,

  // An approve/deny request currently waiting for an answer (Option B,
  // server/permission-store.js). null = nothing pending. Only ever one at a
  // time -- Claude Code waits on ONE tool call per turn, so this is enough.
  pendingPermission: null,

  // A chat STARTED from the dashboard itself (server/chat.js) -- different
  // from watchSession(), which only WATCHES a session running elsewhere.
  // chatCwd is remembered on the client so sendChatMessage() knows where to
  // resume without the user re-entering it -- falls back to events[0].cwd
  // (the server also stores cwd on every event) if this state is empty
  // (e.g. after a page refresh).
  chatCwd: null,
  chatStreamingText: "", // text currently being streamed (not yet a finished chat.message)
  chatBusy: false, // true from sending a message until the next agent.complete
  chatError: null,

  // `enableApprovalGate`: the user's intent BEFORE the real session_id is
  // known (chosen in the "Start New Chat" form -- see ChatPanel.jsx, just
  // an on/off checkbox meaning "manual" mode when checked -- choosing
  // "auto" directly from the start form is deliberately not offered, so
  // that the most permissive mode is always an explicit decision made
  // AFTER a real session exists, not a form default). The regular Command
  // Approval mode selector (in StatusBar) can't be used for this: it
  // immediately targets whatever session_id is currently being watched AT
  // THE MOMENT it's clicked, but the REAL session_id for a new chat session
  // is only known AFTER the server replies -- so if the user picked a mode
  // beforehand, it would end up set on the typed-in placeholder session_id,
  // not the one actually used. So this intent is "carried" via this
  // argument, and only applied AFTER watchSession() switches the target.
  async startChat(cwd, prompt, enableApprovalGate = false) {
    const trimmedCwd = cwd.trim();
    const trimmedPrompt = prompt.trim();
    if (!trimmedCwd || !trimmedPrompt) return;
    set({ chatBusy: true, chatError: null });
    try {
      const res = await fetch(`${HTTP_BASE}/chat/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cwd: trimmedCwd, prompt: trimmedPrompt }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "gagal memulai chat");
      // watchSession() resets chatCwd/chatBusy to their defaults -- set them
      // AGAIN afterward so the correct values for this new chat win out.
      get().watchSession(data.session_id);
      set({ chatCwd: trimmedCwd, chatBusy: true });
      if (enableApprovalGate) get().setApprovalGateMode("manual"); // the session_id is correct now
    } catch (err) {
      set({ chatBusy: false, chatError: err.message });
    }
  },

  async sendChatMessage(prompt) {
    const state = get();
    const sessionId = state.selectedSessionId;
    // Prefer the cwd from THIS session's own events (the server also stores
    // cwd on every event) -- chatCwd is only a fallback if events is still
    // empty (startChat() just happened, backfill hasn't run yet). If this
    // order were reversed, a stale chatCwd from a PREVIOUS chat could get
    // used for the session CURRENTLY being watched (e.g. the user switched
    // to watch a different session via a manual watchSession()).
    const cwd = state.events[0]?.cwd || state.chatCwd;
    const trimmedPrompt = prompt.trim();
    if (!sessionId || !cwd || !trimmedPrompt) return;
    set({ chatBusy: true, chatError: null });
    try {
      const res = await fetch(`${HTTP_BASE}/chat/${encodeURIComponent(sessionId)}/message`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cwd, prompt: trimmedPrompt }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "gagal mengirim pesan");
    } catch (err) {
      set({ chatBusy: false, chatError: err.message });
    }
  },

  // Command Approval mode for the session CURRENTLY being watched -- opt-in
  // per session, stored on the SERVER (not just the dashboard) so the hook
  // (which knows nothing about the dashboard) can check quickly before
  // waiting for anything. "off" (default, the server also defaults every
  // session to "off" -- see server.js) | "manual" (pause, needs
  // Allow/Deny) | "auto" (immediately allowed, never pauses, but still
  // recorded as a "permission.auto" event).
  approvalGateMode: "off",

  async setApprovalGateMode(mode) {
    const sessionId = get().selectedSessionId;
    if (!sessionId) return;
    const previous = get().approvalGateMode;
    set({ approvalGateMode: mode }); // optimistic
    try {
      const res = await fetch(`${HTTP_BASE}/approval-gate/${encodeURIComponent(sessionId)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode }),
      });
      const data = await res.json();
      // If the user already switched sessions while this request was in
      // flight, don't overwrite the CURRENTLY watched session's mode with
      // the old session's result.
      if (get().selectedSessionId === sessionId) set({ approvalGateMode: data.mode ?? "off" });
    } catch {
      // Failed to send -- revert to the previous mode, don't let the UI
      // lie about the mode having changed when the server knows nothing about it.
      if (get().selectedSessionId === sessionId) set({ approvalGateMode: previous });
    }
  },

  async decidePermission(id, decision) {
    // Optimistic: dismiss the card as soon as it's clicked, don't wait for
    // the round-trip. The "permission.resolved" broadcast from the server
    // (also triggered by this request) is just an extra confirmation --
    // it's fine if it arrives later/twice.
    set((state) => (state.pendingPermission?.id === id ? { pendingPermission: null } : {}));
    try {
      await fetch(`${HTTP_BASE}/permission-requests/${encodeURIComponent(id)}/decide`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision }),
      });
    } catch {
      // Ignore -- if sending fails, the hook will fall back to its own timeout ("ask").
    }
  },

  selectEvent(index) {
    set({ selectedEventIndex: index });
  },

  // internal, not meant to be read by components
  _ws: null,
  _backfilling: false,
  _buffer: [],
  _retryDelay: 1000,
  _retryTimer: null,
  _usagePollTimer: null,

  connect() {
    if (get()._ws) return; // already connected / connecting
    openSocket(set, get);
  },

  // Called once when App mounts -- resumes watching the session_id the user
  // last picked (stored in localStorage), so a page refresh doesn't lose
  // the session selection. Doesn't guess a NEW session_id from any server
  // -- only remembers the user's own previous explicit choice.
  async resumeLastSession() {
    const saved = safeGetStoredSessionId();
    if (!saved) {
      set({ initializing: false, initializingProgress: 100 }); // nothing to wait for -- ready right away
      return;
    }
    set({ initializingProgress: 0 });
    // 3 steps that are DEFINITELY KNOWN (not guessed) -- each one finishing
    // (success OR failure, both count as "finished") adds a real 1/3 of
    // progress, not an indeterminate animation that just moves back and
    // forth with no meaning (correction from the user, 2026-09-03: they
    // wanted an honest 0-100% progress that follows the real process, not a
    // vague spinner/bar).
    const TOTAL_STEPS = 3;
    let doneSteps = 0;
    function markStepDone() {
      doneSteps += 1;
      set({ initializingProgress: Math.round((doneSteps / TOTAL_STEPS) * 100) });
    }

    // watchSession() resets state + runs backfill/usage-polling/approval-
    // gate/pending-permission as usual -- its backfillPromise is returned
    // SPECIFICALLY so it can be awaited here (see the note on
    // watchSession()), instead of being called again, so there aren't 2
    // backfill() calls racing to write `events` (one could overwrite a live
    // event that just arrived over WS while the other is still in flight).
    const backfillPromise = get().watchSession(saved);
    // Command Approval (syncApprovalGate) & token/model (fetchUsage) are
    // CALLED AGAIN here separately -- unlike backfill(), both are safe to
    // duplicate (they just overwrite a single field with the same value,
    // there's no history that could get clobbered). fetchUsage was
    // originally deliberately NOT awaited (considered "just statistics") --
    // corrected by the user on 2026-09-03: their original request was
    // "once the preloader is done, ALL features are ready," not just
    // whatever I personally judged important. So everything that changed
    // in the before/after preloader screenshot (Command Approval, model,
    // token) is now awaited together.
    await Promise.allSettled([
      backfillPromise.finally(markStepDone),
      syncApprovalGate(saved, set, get).finally(markStepDone),
      fetchUsage(saved, set, get).finally(markStepDone),
    ]);
    if (get().selectedSessionId === saved) set({ initializing: false, initializingProgress: 100 });
  },

  disconnect() {
    const { _ws, _retryTimer } = get();
    if (_retryTimer) clearTimeout(_retryTimer);
    if (_ws) _ws.close();
    stopUsagePolling(get);
    set({ _ws: null, connectionStatus: "closed" });
  },

  // The one and only way the dashboard starts showing anything: the user
  // explicitly enters a session_id. The timeline is reset then refilled
  // from that session's history via a REST backfill -- never depends on
  // the server's "latest" version at all.
  watchSession(rawSessionId) {
    const sessionId = String(rawSessionId ?? "").trim();
    if (!sessionId) return undefined;
    // NO LONGER persisted to localStorage here -- a garbage/mistyped
    // session_id used to get "remembered" as soon as it was typed, so a
    // browser refresh would go right back to the same session_id that
    // never resolved either (see the user's question about this). Now it's
    // only saved in backfill() AFTER it's proven the session genuinely has
    // events, see the note there.
    set({
      selectedSessionId: sessionId,
      sessionId: null,
      status: null,
      activeFile: null,
      events: [],
      lastError: null,
      selectedEventIndex: null,
      usage: null,
      pendingPermission: null,
      approvalGateMode: "off",
      // chatCwd/chatBusy are RESET here too (not just in stopWatching) --
      // startChat() deliberately sets both of them AGAIN AFTER calling
      // watchSession(), so this reset doesn't overwrite the new chat's
      // values. If the caller is a manual watchSession() (switching to
      // watch a different session), this is also what prevents a stale
      // chatCwd/chatBusy from a previous chat from lingering.
      chatCwd: null,
      chatStreamingText: "",
      chatBusy: false,
      chatError: null,
      _backfilling: true,
      _buffer: [],
    });
    stopUsagePolling(get);
    // Returned (not just fire-and-forget) SPECIFICALLY so resumeLastSession()
    // can `await` this at mount, without calling backfill() twice (which
    // could race and clobber `events` -- see the note in resumeLastSession()).
    // Other callers (StartChatForm, RecentSessionsList, ServerSwitcher, etc.)
    // are unaffected, none of them use the return value.
    const backfillPromise = backfill(sessionId, set, get);
    startUsagePolling(sessionId, set, get);
    syncApprovalGate(sessionId, set, get);
    syncPendingPermission(sessionId, set, get);
    return backfillPromise;
  },

  // Stop watching -- go back to an empty screen until the user enters a session_id again.
  stopWatching() {
    safeClearStoredSessionId();
    stopUsagePolling(get);
    set({
      selectedSessionId: null,
      sessionId: null,
      status: null,
      activeFile: null,
      events: [],
      selectedEventIndex: null,
      usage: null,
      pendingPermission: null,
      approvalGateMode: "off",
      chatCwd: null,
      chatStreamingText: "",
      chatBusy: false,
      chatError: null,
      _backfilling: false,
      _buffer: [],
      _usagePollTimer: null,
    });
  },
}));

// Light polling so token usage feels "alive" -- the Claude Code transcript
// keeps getting written outside the control of our WebSocket events (e.g.
// while the model is still "thinking" for a long stretch with no tool call
// at all, no event passes over WS at all, but the transcript keeps growing).
// Polling the REST /usage/:id endpoint is lightweight (reads a local file,
// not an LLM call) so it's the simplest way to keep this counter from
// feeling "stuck" between events.
function startUsagePolling(sessionId, set, get) {
  const timer = setInterval(() => {
    if (get().selectedSessionId !== sessionId) {
      stopUsagePolling(get);
      return;
    }
    fetchUsage(sessionId, set, get);
  }, USAGE_POLL_MS);
  set({ _usagePollTimer: timer });
}

function stopUsagePolling(get) {
  const timer = get()._usagePollTimer;
  if (timer) clearInterval(timer);
}

function openSocket(set, get) {
  set({ connectionStatus: "connecting" });
  const ws = new WebSocket(WS_URL);
  set({ _ws: ws });

  // Identity guard: React StrictMode (dev) runs App.jsx's connect/disconnect
  // effect twice on mount (mount -> cleanup -> mount again). Closing a
  // WebSocket via .close() isn't instant -- there's a brief window where
  // the OLD socket can still receive a 'message' event from the server
  // before it's truly gone. Without this guard, the old & new socket could
  // both process the exact same broadcast, so every event would end up
  // duplicated on the timeline. Check "is this socket still the one active
  // in the store" before processing anything.
  const isCurrent = () => get()._ws === ws;

  ws.addEventListener("open", () => {
    if (!isCurrent()) return;
    set({ connectionStatus: "open", lastError: null, _retryDelay: 1000 });
  });

  ws.addEventListener("message", (ev) => {
    if (!isCurrent()) return;
    let msg;
    try {
      msg = JSON.parse(ev.data);
    } catch {
      return;
    }
    handleMessage(msg, set, get);
  });

  ws.addEventListener("close", () => {
    if (!isCurrent()) return; // this socket was deliberately replaced, not genuinely disconnected
    scheduleReconnect(set, get);
  });
  ws.addEventListener("error", () => {
    if (!isCurrent()) return;
    set({ connectionStatus: "error" });
  });
}

function scheduleReconnect(set, get) {
  set({ connectionStatus: "closed", _ws: null });
  const delay = Math.min(get()._retryDelay, MAX_BACKOFF_MS);
  const timer = setTimeout(() => {
    set({ _retryDelay: Math.min(delay * 2, MAX_BACKOFF_MS) });
    openSocket(set, get);
  }, delay);
  set({ _retryTimer: timer });
}

function handleMessage(msg, set, get) {
  const { selectedSessionId } = get();

  // No session selected by the user yet -- don't process anything. This is
  // what keeps the dashboard from "guessing" a session_id on its own from
  // a server broadcast.
  if (!selectedSessionId) return;
  if (msg.session_id && msg.session_id !== selectedSessionId) return; // not the session being watched

  // Option B control messages -- NOT domain events, don't add them to the
  // `events` array (they skip the backfill buffer/appendEvent).
  if (msg.type === "permission.requested") {
    set({
      pendingPermission: {
        id: msg.payload.id,
        toolName: msg.payload.tool_name,
        toolInput: msg.payload.tool_input,
        timeoutMs: msg.payload.timeout_ms,
        requestedAt: Date.now(),
      },
    });
    return;
  }
  if (msg.type === "permission.resolved") {
    // Only clear it if the ID matches what's currently shown -- if it was
    // already clicked earlier in this tab (id is already null), or this is
    // a confirmation for a DIFFERENT, already-past request, don't touch anything.
    set((state) => (state.pendingPermission?.id === msg.payload?.id ? { pendingPermission: null } : {}));
    return;
  }

  // Chat text currently being streamed (server/chat.js chat.delta) --
  // EPHEMERAL, not a permanent event (doesn't go into the `events` array).
  // Keeps getting appended until the final chat.message arrives (see
  // appendEvent -- that's what clears it).
  if (msg.type === "chat.delta") {
    set((state) => ({ chatStreamingText: state.chatStreamingText + (msg.payload?.text ?? "") }));
    return;
  }

  if (msg.type === "state.snapshot") {
    set({
      status: msg.payload?.status ?? null,
      activeFile: msg.payload?.activeFile ?? null,
      _backfilling: true,
      _buffer: [],
    });
    backfill(selectedSessionId, set, get);
    return;
  }

  // A raw event from SessionStore (broadcast as-is by the server, see section 6).
  if (get()._backfilling) {
    set({ _buffer: [...get()._buffer, msg] });
    return;
  }
  appendEvent(msg, set, get);
}

// Pulls whatever mode the server ACTUALLY holds -- rather than assuming
// it's always "off". If the tab is refreshed (same session_id, remembered
// via localStorage) while the server hasn't restarted, the mode should
// still show as manual/auto if that's genuinely still the case on the
// server, not silently revert to off.
async function syncApprovalGate(sessionId, set, get) {
  try {
    const res = await fetch(`${HTTP_BASE}/approval-gate/${encodeURIComponent(sessionId)}`);
    if (!res.ok) return;
    const data = await res.json();
    if (get().selectedSessionId === sessionId) set({ approvalGateMode: data.mode ?? "off" });
  } catch {
    // Ignore -- stays default false, not fatal.
  }
}

// Restores an approval card that's still pending on the server -- called
// every time watchSession() runs (including via resumeLastSession() after
// a page refresh, which resets pendingPermission to null before this has a
// chance to fill it back in). requestedAt is TAKEN FROM THE SERVER (not a
// local Date.now()) so the countdown continues at the real elapsed time,
// instead of resetting back to full.
async function syncPendingPermission(sessionId, set, get) {
  try {
    const res = await fetch(`${HTTP_BASE}/permission-requests/pending/${encodeURIComponent(sessionId)}`);
    if (!res.ok) return;
    const data = await res.json();
    if (get().selectedSessionId !== sessionId) return; // already switched sessions while the fetch was in flight
    if (!data.pending) return; // genuinely nothing pending -- leave it null
    set({
      pendingPermission: {
        id: data.pending.id,
        toolName: data.pending.tool_name,
        toolInput: data.pending.tool_input,
        timeoutMs: data.pending.timeout_ms,
        requestedAt: data.pending.requested_at,
      },
    });
  } catch {
    // Ignore -- if it fails, the approval card just doesn't get restored
    // automatically; the hook keeps working as usual on the server side
    // regardless (falls back to the "ask" timeout if it's never answered).
  }
}

async function backfill(sessionId, set, get) {
  try {
    const res = await fetch(`${HTTP_BASE}/sessions/${encodeURIComponent(sessionId)}`);
    if (res.ok) {
      const data = await res.json();
      set({
        sessionId,
        events: data.events ?? [],
        status: data.snapshot?.status ?? get().status,
        activeFile: data.snapshot?.activeFile ?? get().activeFile,
      });
    } else if (res.status === 404) {
      // The session has no events yet/at all -- not an error, just empty
      // (e.g. the user pasted a session_id that's never sent any event to
      // the server).
      set({ sessionId, events: [] });
    }
  } catch (err) {
    set({ lastError: `backfill gagal: ${err.message}` });
  } finally {
    const buffered = get()._buffer;
    set({ _backfilling: false, _buffer: [] });
    for (const event of buffered) appendEvent(event, set, get);
    fetchUsage(sessionId, set, get);

    // Only "remembered" to localStorage (for resumeLastSession() on
    // refresh) if it's PROVEN there are genuinely events -- a
    // garbage/mistyped/never-sent session_id is NOT saved, so a browser
    // refresh doesn't go right back to a session_id that fails to resolve
    // either way (see StatusBar.jsx sessionNotFound). Guarded with
    // `selectedSessionId === sessionId` -- just in case the user already
    // switched to watching a different session WHILE this request was
    // still in flight.
    if (get().selectedSessionId === sessionId) {
      if (get().events.length > 0) safeSetStoredSessionId(sessionId);
      else safeClearStoredSessionId();
    }
  }
}

function appendEvent(event, set, get) {
  const state = get();
  const nextState = reduceState({ status: state.status, activeFile: state.activeFile }, event);

  // A session that was previously proven empty via backfill() (and so NOT
  // saved, see the note there) might turn out to have just been "not
  // started yet" -- as soon as its first LIVE event genuinely arrives over
  // WS, that's proof the session_id is valid, so it's now worth
  // remembering (self-heal, rather than staying permanently rejected just
  // because it happened to be empty for a moment).
  if (event.session_id === state.selectedSessionId && state.events.length === 0) {
    safeSetStoredSessionId(state.selectedSessionId);
  }

  set({
    events: [...state.events, event],
    status: nextState.status,
    activeFile: nextState.activeFile,
    // The final chat.message arrived -> the text that was being streamed is
    // no longer relevant (it's now a permanent bubble), clear it so it
    // doesn't get duplicated.
    ...(event.type === "chat.message" ? { chatStreamingText: "" } : {}),
    // A real turn genuinely finished -- whether a chat or a normal watched observation.
    ...(event.type === "agent.complete" ? { chatBusy: false } : {}),
  });

  // Refresh token usage at turn-boundary moments -- often enough to keep
  // the Overview panel feeling alive, without fetching on every tiny event.
  if (event.type === "agent.complete" || event.type === "agent.thinking") {
    fetchUsage(event.session_id, set, get);
  }
}

async function fetchUsage(sessionId, set, get) {
  if (!sessionId || get().selectedSessionId !== sessionId) return;
  try {
    const res = await fetch(`${HTTP_BASE}/usage/${encodeURIComponent(sessionId)}`);
    if (!res.ok) return; // a 404 is expected if transcript_path hasn't been sent/doesn't exist yet -- ignore
    const data = await res.json();
    if (get().selectedSessionId !== sessionId) return; // already switched sessions while the fetch was in flight
    set({ usage: data });
  } catch {
    // Ignore -- usage is just extra info, not critical to the main timeline.
  }
}
