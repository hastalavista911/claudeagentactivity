// server/server.js
//
// Minimal Agent Server — part 2 of the implementation sequence (arch doc section 7).
//   - POST /events         -> receive JSON event, store in SessionStore, broadcast to all WS clients
//   - WebSocket (ws://.../) -> on client connect, send state.snapshot first, then stream events in realtime
//
// No LLM calls happen here at all (see the principle in doc sections 2 & 4.4).

const http = require("http");
const express = require("express");
const { WebSocketServer } = require("ws");
const { SessionStore } = require("./session-store");
const { readFileSafe, buildTree } = require("./fs-utils");
const { readUsage } = require("./usage");
const { readGitStatus } = require("./git-status");
const { PermissionStore, emitAutoApprovedEvent, emitDecisionEvent } = require("./permission-store");
const { runChatTurn } = require("./chat");
const { getStatus, getDiff, getLog, getCommitFiles, getCommitFileDiff } = require("./git-info");
const { getHooksStatus, installHooks } = require("./hooks-setup");

const PORT = process.env.PORT || 4000;
// How long the PreToolUse hook waits for a decision from the dashboard before
// falling back to "ask" (Claude Code's built-in permission prompt) -- see
// server/permission-store.js.
const PERMISSION_TIMEOUT_MS = 20_000;

const app = express();

// The dashboard (Vite dev server, different port) and the VS Code extension
// hit these REST endpoints from a different origin -- this is a local server
// for trusted consumers, so CORS is left permissive (not a public API).
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});

app.use(express.json());

const sessionStore = new SessionStore();

// The session that most recently received an event -- used to decide which
// snapshot to send to a client that just connected over WebSocket (MVP:
// focused on one active session at a time, matching the mock-agent scenario
// in section 5).
let latestSessionId = null;

const permissionStore = new PermissionStore();

// Sessions whose Command Approval was DELIBERATELY turned on by the user via
// the mode selector in the dashboard (default "off" -- opt-in per session,
// not automatically on just because a dashboard connected). Map sessionId ->
// "manual" | "auto" (no entry = "off"). hooks/request-permission.js checks
// here first before waiting for any decision at all.
//   - "manual": EVERY tool call pauses, needs Allow/Deny from the dashboard.
//   - "auto": never pauses -- immediately allowed, but still recorded as a
//     "permission.auto" event (an "AUTO" badge in Activity Flow) so there's
//     a visible trail, not silently passing through unrecorded.
const approvalGateSessions = new Map();

const server = http.createServer(app);
const wss = new WebSocketServer({ server });

function broadcast(message) {
  const data = JSON.stringify(message);
  for (const client of wss.clients) {
    if (client.readyState === client.OPEN) {
      client.send(data);
    }
  }
}

app.post("/events", (req, res) => {
  const event = req.body;

  if (!event || !event.session_id || !event.type) {
    return res.status(400).json({ error: "event harus punya session_id dan type" });
  }

  latestSessionId = event.session_id;

  const snapshot = sessionStore.addEvent(event.session_id, event);
  console.log(`[event] session=${event.session_id} type=${event.type}`, event.payload ?? {});

  // Broadcast the raw event to every subscribed client (dashboard, VS Code ext, etc.)
  broadcast(event);

  res.sendStatus(200);
});

// List of EVERY session_id this server has ever seen (newest first) -- used
// by the dashboard to render the picker (see SessionPicker.jsx) so the user
// only needs to know the server's host, not already have/copy the session_id
// from somewhere else (see the 2026-09-02 discussion).
app.get("/sessions", (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 30, 100);
  res.json({ sessions: sessionStore.listSessions().slice(0, limit) });
});

// Helper endpoint for manual debugging via curl (not part of the core spec,
// but handy for quick verification without needing to open a WebSocket).
app.get("/sessions/:id", (req, res) => {
  const { id } = req.params;
  if (!sessionStore.hasSession(id)) {
    return res.status(404).json({ error: "session tidak ditemukan" });
  }
  res.json({
    session_id: id,
    snapshot: sessionStore.getSnapshot(id),
    events: sessionStore.getEvents(id),
  });
});

// "Clear this session" in RecentSessionsList.jsx (user request 2026-09-03)
// -- drops this session's data from memory ONLY (the real Claude Code
// transcript on disk is never touched). 404 if it's already/never there --
// idempotent from the client's point of view (whether it was already clean
// or just got cleaned, the end result is the same: that session no longer
// exists on the server).
app.delete("/sessions/:id", (req, res) => {
  const { id } = req.params;
  if (!sessionStore.hasSession(id)) {
    return res.status(404).json({ error: "session tidak ditemukan" });
  }
  sessionStore.deleteSession(id);
  res.json({ ok: true });
});

app.get("/health", (req, res) => {
  res.json({ ok: true, latestSessionId, wsClients: wss.clients.size });
});

// ---- Setup wizard (automates README's "Path 2" -- install hooks without the
// user opening/editing ~/.claude/settings.json manually, see server/hooks-setup.js) ----
app.get("/setup/hooks-status", (req, res) => {
  try {
    res.json(getHooksStatus());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/setup/install-hooks", (req, res) => {
  try {
    res.json(installHooks());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Read one file's contents from disk -- for the "VS Code Preview" panel. Not
// an LLM call, just plain fs.readFile.
app.get("/files", (req, res) => {
  const filePath = req.query.path;
  if (!filePath) return res.status(400).json({ error: "query ?path= wajib diisi" });
  try {
    const content = readFileSafe(String(filePath));
    res.json({ path: filePath, content });
  } catch (err) {
    res.status(404).json({ error: err.message });
  }
});

// Directory listing -- for the "Project Files" panel.
app.get("/tree", (req, res) => {
  const dirPath = req.query.path;
  const depth = Math.min(Number(req.query.depth) || 3, 6);
  if (!dirPath) return res.status(400).json({ error: "query ?path= wajib diisi" });
  try {
    // null if this folder isn't a git repo -- buildTree() handles that (just
    // doesn't attach gitStatus to any node), not an error condition.
    const gitStatus = readGitStatus(String(dirPath));
    const tree = buildTree(String(dirPath), depth, gitStatus);
    res.json({ path: dirPath, tree });
  } catch (err) {
    res.status(404).json({ error: err.message });
  }
});

// ---- Git panel (read-only) ----
//
// ALL three endpoints below are purely READ (git status/diff/log via
// server/git-info.js) -- none of them mutate repo state. `path` query is
// required -- usually the folder of whichever file is currently active in
// the session being watched (the dashboard decides that, see GitPanel.jsx),
// its git root is found automatically from there (can be completely
// different from this Agent Server's own folder).
app.get("/git/status", (req, res) => {
  const path = req.query.path;
  if (!path) return res.status(400).json({ error: "query ?path= wajib diisi" });
  res.json(getStatus(String(path)));
});

app.get("/git/diff", (req, res) => {
  const path = req.query.path;
  const file = req.query.file;
  if (!path || !file) return res.status(400).json({ error: "query ?path= dan ?file= wajib diisi" });
  res.json(getDiff(String(path), String(file), req.query.staged === "true"));
});

app.get("/git/log", (req, res) => {
  const path = req.query.path;
  if (!path) return res.status(400).json({ error: "query ?path= wajib diisi" });
  const limit = Math.min(Number(req.query.limit) || 20, 100);
  res.json(getLog(String(path), limit));
});

// Files changed in ONE commit -- called when the user clicks a commit row in
// HistoryTab (see GitPanel.jsx) to expand its file list inline.
app.get("/git/commit-files", (req, res) => {
  const path = req.query.path;
  const hash = req.query.hash;
  if (!path || !hash) return res.status(400).json({ error: "query ?path= dan ?hash= wajib diisi" });
  res.json(getCommitFiles(String(path), String(hash)));
});

// Diff for ONE file EXACTLY as that commit created it -- different from
// /git/diff (working-tree/staged diff against HEAD). Called when the user
// clicks one of the files in HistoryTab's expanded list.
app.get("/git/commit-diff", (req, res) => {
  const path = req.query.path;
  const hash = req.query.hash;
  const file = req.query.file;
  if (!path || !hash || !file) return res.status(400).json({ error: "query ?path=, ?hash=, dan ?file= wajib diisi" });
  res.json(getCommitFileDiff(String(path), String(hash), String(file)));
});

// Model + token usage from the local Claude Code transcript -- for the Model
// badge & token/cost stats in the Agent Overview panel. transcript_path is
// stored by SessionStore from the agent.start event (see hooks/emit-event.js).
app.get("/usage/:id", async (req, res) => {
  const { id } = req.params;
  const transcriptPath = sessionStore.getTranscriptPath(id);
  if (!transcriptPath) {
    return res.status(404).json({ error: "transcript_path belum diketahui untuk sesi ini" });
  }
  try {
    const usage = await readUsage(transcriptPath);
    if (!usage) return res.status(404).json({ error: "file transcript tidak ditemukan di disk" });
    res.json({ session_id: id, ...usage });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---- Command Approval toggle (per session, opt-in from the dashboard) ----
//
// GET is called by the hook (request-permission.js) BEFORE it's willing to
// wait for anything -- must be fast. POST is called by the dashboard when
// the user changes the mode selector.
app.get("/approval-gate/:id", (req, res) => {
  res.json({ mode: approvalGateSessions.get(req.params.id) ?? "off" });
});

app.post("/approval-gate/:id", (req, res) => {
  const { mode } = req.body ?? {};
  if (mode === "manual" || mode === "auto") approvalGateSessions.set(req.params.id, mode);
  else approvalGateSessions.delete(req.params.id); // "off" (or anything unrecognized)
  console.log(`[approval-gate] session=${req.params.id} -> ${approvalGateSessions.get(req.params.id) ?? "off"}`);
  res.json({ session_id: req.params.id, mode: approvalGateSessions.get(req.params.id) ?? "off" });
});

// ---- Command Approval (Option B) ----
//
// The PreToolUse hook (hooks/request-permission.js) POSTs here and this HTTP
// connection is DELIBERATELY not answered right away -- it's held until the
// dashboard clicks Approve/Deny (via the /decide endpoint below) or it times
// out. This is what makes Claude Code genuinely "wait" for the dashboard's
// decision before proceeding/canceling the tool, not just a read-only
// notification.
app.post("/permission-requests", async (req, res) => {
  const { session_id, tool_name, tool_input, cwd } = req.body ?? {};
  if (!session_id || !tool_name) {
    return res.status(400).json({ error: "session_id dan tool_name wajib diisi" });
  }

  const mode = approvalGateSessions.get(session_id) ?? "off";

  // "auto" mode: NEVER pauses -- request-permission.js itself already
  // checks the mode via GET /approval-gate/:id before getting here, but
  // check AGAIN here too (don't just trust the hook) so this endpoint is
  // correct no matter what order it's called in. Still recorded as a
  // "permission.auto" event so it shows up in Activity Flow (an "AUTO"
  // badge), not silently passed through.
  if (mode === "auto") {
    emitAutoApprovedEvent({ sessionStore, broadcast, sessionId: session_id, cwd, toolName: tool_name, toolInput: tool_input ?? {} });
    console.log(`[permission] session=${session_id} tool=${tool_name} -- auto-approved (mode Auto)`);
    return res.json({ id: null, decision: "allow" });
  }

  const { id, promise } = permissionStore.request(
    session_id,
    tool_name,
    tool_input ?? {},
    PERMISSION_TIMEOUT_MS,
    (entry, decision) => {
      broadcast({
        type: "permission.resolved",
        session_id: entry.sessionId,
        payload: { id: entry.id, decision },
      });
      emitDecisionEvent({ sessionStore, broadcast, sessionId: entry.sessionId, cwd, toolName: entry.toolName, toolInput: entry.toolInput, decision });
    }
  );

  console.log(`[permission] session=${session_id} tool=${tool_name} id=${id} -- waiting for decision...`);

  // Tell the dashboard a NEW request is waiting -- broadcast NOW, don't wait
  // for this endpoint's HTTP response to finish (that only finishes once
  // the dashboard answers or it times out, see below).
  broadcast({
    type: "permission.requested",
    session_id,
    payload: { id, tool_name, tool_input: tool_input ?? {}, timeout_ms: PERMISSION_TIMEOUT_MS },
  });

  const decision = await promise; // <-- the core of the "synchronous" behavior: this request waits right here
  console.log(`[permission] id=${id} -> ${decision}`);
  res.json({ id, decision });
});

// Called by the dashboard right after a page refresh / reconnect -- the
// client's React state is lost on every refresh, but the request (and its
// timeout timer) stays alive in permissionStore until it's answered/times
// out. Without this, an approval card that's still pending would disappear
// from the screen even though Claude Code is genuinely still waiting on the
// hook side -- the dashboard just "forgot" it exists.
app.get("/permission-requests/pending/:sessionId", (req, res) => {
  const entry = permissionStore.getPendingForSession(req.params.sessionId);
  if (!entry) return res.json({ pending: null });
  res.json({
    pending: {
      id: entry.id,
      tool_name: entry.toolName,
      tool_input: entry.toolInput,
      timeout_ms: entry.timeoutMs,
      requested_at: entry.createdAt,
    },
  });
});

// Called by the dashboard when the user clicks Approve/Deny -- this is what
// makes the request above stop waiting (faster than the timeout).
app.post("/permission-requests/:id/decide", (req, res) => {
  const { decision } = req.body ?? {};
  if (decision !== "allow" && decision !== "deny") {
    return res.status(400).json({ error: "decision harus 'allow' atau 'deny'" });
  }
  const ok = permissionStore.decide(req.params.id, decision);
  if (!ok) {
    // Expected to happen -- e.g. two dashboard tabs both clicked, or the
    // user clicked after it already timed out. Not a server error.
    return res.status(404).json({ error: "permintaan sudah selesai atau tidak ditemukan (mungkin sudah timeout)" });
  }
  res.json({ ok: true });
});

// ---- Chat from the dashboard (the Agent Server runs Claude Code itself) ----
//
// Different from /events (which only receives broadcasts from an external
// hook), this endpoint STARTS a real Claude Code execution via
// @anthropic-ai/claude-agent-sdk (see server/chat.js). Its HTTP response only
// waits until the session_id is known (the first system/init) -- the rest of
// the turn (streamed text, tool calls, etc.) keeps running in the background
// and gets broadcast over WS, NOT waited for here (so the dashboard gets its
// session_id right away and can start rendering without waiting for the
// whole turn to finish, which can take tens of seconds).
app.post("/chat/start", async (req, res) => {
  const { cwd, prompt } = req.body ?? {};
  if (!cwd || !prompt) return res.status(400).json({ error: "cwd dan prompt wajib diisi" });

  const sessionId = await runChatTurn({
    cwd,
    prompt,
    resumeSessionId: null,
    sessionStore,
    broadcast,
    approvalGateSessions,
    permissionStore,
  });

  if (!sessionId) return res.status(500).json({ error: "gagal memulai sesi chat" });
  latestSessionId = sessionId;
  res.json({ session_id: sessionId });
});

app.post("/chat/:sessionId/message", async (req, res) => {
  const { prompt, cwd } = req.body ?? {};
  const { sessionId } = req.params;
  if (!prompt) return res.status(400).json({ error: "prompt wajib diisi" });
  if (!cwd) return res.status(400).json({ error: "cwd wajib diisi (sama seperti waktu /chat/start)" });

  const resolvedId = await runChatTurn({
    cwd,
    prompt,
    resumeSessionId: sessionId,
    sessionStore,
    broadcast,
    approvalGateSessions,
    permissionStore,
  });

  if (!resolvedId) return res.status(500).json({ error: "gagal melanjutkan sesi chat" });
  res.json({ session_id: resolvedId });
});

wss.on("connection", (client) => {
  console.log("[ws] client connected");

  const snapshot = latestSessionId ? sessionStore.getSnapshot(latestSessionId) : null;
  if (snapshot) {
    client.send(
      JSON.stringify({
        type: "state.snapshot",
        session_id: latestSessionId,
        payload: snapshot,
      })
    );
  }

  client.on("close", () => console.log("[ws] client disconnected"));
});

server.listen(PORT, () => {
  console.log(`Agent Server listening on http://localhost:${PORT}`);
  console.log(`  POST   http://localhost:${PORT}/events`);
  console.log(`  GET    http://localhost:${PORT}/sessions/:id`);
  console.log(`  WS     ws://localhost:${PORT}`);
});
