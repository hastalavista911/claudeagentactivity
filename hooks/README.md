# hooks/ — ACTIVE globally (all projects)

The files in this folder were built per sections 4.2–4.3 of
`architecture-design.md`, and are **already active** via
`~/.claude/settings.json` (user-level, no longer project-level) — so **every**
Claude Code session on this machine, in any project, automatically sends
events to the Agent Server (`localhost:4000`). Validated end-to-end with a
real Claude Code session on 2026-08-27: all 8 event types (`session-start`,
`thinking`, `pre-edit`, `post-edit`, `file-read`, `terminal-start`,
`terminal-complete`, `complete`) arrived with a field structure that matched
`mapToEvent()` 100%.

**IMPORTANT:** `agentwork/.claude/settings.json` (project-level)
**deliberately** no longer has hooks — removed on 2026-08-27 to avoid
double-firing against the global hooks (Claude Code likely merges project +
global config rather than overriding it, so two identical hook configs
active at once means every event gets sent twice). If you ever want to
disable the global hooks but keep them active for just this project, restore
the contents of `hooks/settings.example.json` into `.claude/settings.json`
AND remove/detach the hooks from `~/.claude/settings.json` — never enable
both at the same time.

If you switch Claude Code versions, re-run the JSON structure check below
before trusting the existing mapping again.

## Contents

- `emit-event.js` — the generic script invoked by every Claude Code hook.
  Reads JSON from stdin, maps it to our event schema, POSTs it to the Agent
  Server (`http://localhost:4000/events` by default, overridable via the
  `AGENT_SERVER_URL` env var).
- `settings.example.json` — an example `.claude/settings.json` config that
  registers `emit-event.js` against the `SessionStart`, `UserPromptSubmit`,
  `PreToolUse`, `PostToolUse`, `Stop`, and `Notification` hooks.

## Two things added on 2026-08-28 — status notes

- **Agent Thoughts**: `pre-edit`/`terminal-start` events now include
  `payload.agent_thought`, read straight from Claude Code's own text in the
  local transcript (see `extractAgentThought()`) — never a fresh LLM call.
  Often empty, and that's expected: it's only populated when Claude happened
  to write something right before that tool call.
- **`notification` case (Notification hook)**: registered and mapped, but
  **not yet verified** against a real permission-request payload (unlike
  every other hook here, which was checked via `EMIT_EVENT_DEBUG` on
  2026-08-27). If you hit a real permission prompt, turn on
  `EMIT_EVENT_DEBUG=1`, compare `hooks/debug.log` against the `notification`
  case in `emit-event.js`, and adjust the field mapping if it doesn't match.
  This hook is deliberately a **read-only mirror** — the dashboard never
  approves/denies anything; the decision still happens in your terminal/VS
  Code exactly as before.

## If an already-running session's session_id still shows empty in the dashboard

**Update 2026-08-27, corrected:** it was initially assumed hooks only load
once at session start, and that a session already running before
`.claude/settings.json` changed would never start sending events without a
restart. That turned out to be **wrong** — proven twice in the same day: two
different sessions (both already running long before the hooks were
installed/changed) eventually started sending events on their own without a
restart. So Claude Code apparently **re-reads the hook config mid-session**
at some point (the exact trigger is unclear — possibly after a few more
conversation turns, or some time interval).

In practice: if `session_id` still shows empty in the dashboard, **wait a
few more conversation turns** in that session, then check again — you don't
have to restart the session immediately. Restarting is still the
fastest/most reliable option if you don't want to wait.

## Reinstalling / after moving this project's folder

1. Make sure the Agent Server is running at `localhost:4000`
   (`npm run server`).
2. Update the path in `~/.claude/settings.json` (absolute path to
   `hooks/emit-event.js`, now pointing at this project's current location).
3. **Re-check the actual JSON structure** from the hook — don't assume the
   old mapping still holds on a different Claude Code version. Set
   `EMIT_EVENT_DEBUG=1` before running Claude Code (or temporarily change
   `const DEBUG = process.env.EMIT_EVENT_DEBUG === "1"` to `true` in
   `emit-event.js`), then ask Claude Code to edit a file & run a small
   command. Each hook's raw payload gets logged to `hooks/debug.log` —
   compare it against `mapToEvent()`, adjust as needed, then turn debug mode
   back off.

## Command Approval juga dipakai `server/chat.js` (2026-08-31)

Sesi chat yang dimulai LANGSUNG dari dashboard (lihat root README "Chat
directly from the dashboard") pakai `permissionStore` yang **sama persis**
dengan hook ini, tapi TIDAK lewat hook shell sama sekali -- disambungkan
langsung lewat hook `PreToolUse` PROGRAMATIK (`options.hooks` milik
`@anthropic-ai/claude-agent-sdk`), karena Agent Server yang menjalankan
sesinya sendiri (satu proses Node yang sama, tidak perlu HTTP round-trip).
`canUseTool` callback SDK **sengaja tidak dipakai** -- sudah dites langsung
(2026-08-31) dan ketahuan cuma dipanggil untuk hal yang Claude Code sendiri
anggap "berbahaya" (permissionMode `default`), bukan untuk semua tool call.

Beda penting dari sesi yang diamati lewat hook di bawah ini: sesi chat lewat
dashboard **tidak punya fallback prompt terminal sama sekali** -- kalau
Command Approval tidak dinyalakan (lewat checkbox saat mulai chat, atau
toggle biasa belakangan), semua tool call otomatis DITOLAK, bukan "ask".

## Command Approval (Opsi B) — `request-permission.js`, active 2026-08-31

A **separate** PreToolUse hook (registered alongside `emit-event.js` on the
`Edit|Write`, `Bash`, and `PowerShell` matchers) that lets the dashboard
genuinely approve/deny a tool call — not just observe it. See
`server/permission-store.js` and `dashboard/src/components/PermissionRequestCard.jsx`.

- **Opt-in per session, from the dashboard itself** (added 2026-08-31 after
  feedback that a global always-on gate was too broad): a toggle next to
  "Berhenti menonton" turns it on/off for the session currently being
  watched. The server tracks this per `session_id` in `approvalGateSessions`
  (default OFF for every session) — the toggle's own state lives on the
  server, not just in one browser tab, so it's still correct after a
  refresh.
- **Fail-open by design**: the hook checks `GET /approval-gate/:session_id`
  first — if that session isn't toggled on (or the Agent Server isn't
  running at all), it returns almost instantly with no opinion. Claude Code
  behaves exactly as if this hook didn't exist for every session that hasn't
  been explicitly opted in.
- When a session IS toggled on, the hook waits up to **20 seconds** for a
  decision from the dashboard. If nobody answers in time, it falls back to
  `"ask"` — Claude Code's own native permission prompt takes over, same as
  always. The dashboard is a convenience layer on top, never the only way to
  answer.
- Verified end-to-end on 2026-08-31: server logic (allow, double-click race
  safety, 20s timeout), the hook script itself (spawned as a real process,
  both allow/deny outcomes, and the unreachable-server/toggle-off fail-open
  path at ~140ms), and the dashboard UI (toggle switch, card renders,
  countdown, click resolves the waiting hook, fast-path resumes after
  toggling back off) — all via direct testing, not assumption.
- **Not yet verified**: `tool_name` field reliability across every possible
  tool/matcher combination in real day-to-day use (only Bash/Edit were
  exercised in testing). If a real tool call ever behaves unexpectedly here,
  check with `EMIT_EVENT_DEBUG=1` like any other hook.

## Command Approval 3-way mode (Off/Manual/Auto), added 2026-09-02

The on/off toggle above was replaced by a 3-way mode selector, per user
request to mirror Claude Code's own Manual/Auto permission modes. `GET
/approval-gate/:id` now returns `{mode: "off"|"manual"|"auto"}` instead of
`{enabled: boolean}`, `POST` takes `{mode}` instead of `{enabled}`, and
`approvalGateSessions` in `server.js` is a `Map<sessionId, mode>` instead of
a `Set`. "Manual" is exactly the old ON behavior (pause, wait for
Allow/Deny). "Auto" is a **pure convenience mode, chosen explicitly by the
user** (not a risk-classifier safety check) — it never pauses at all, every
tool call is allowed immediately. To keep it from being a silent black hole,
each auto-approved call is still recorded as a normal domain event
(`permission.auto`, via `permission-store.js` `emitAutoApprovedEvent()`) so
it shows up in Activity Flow/Details with a small **AUTO** badge — same
event pipeline as `file.edit`/`terminal.start`, unlike
`permission.requested`/`permission.resolved` which stay control-plane-only
and never enter the `events` array. Both `server.js` (`/permission-requests`,
for hook-observed sessions) and `chat.js`'s programmatic `PreToolUse` hook
(for dashboard-started SDK sessions) branch on the mode independently and
call the same `emitAutoApprovedEvent()` helper.

## PowerShell matcher added, 2026-09-03

Claude Code treats `Bash` and `PowerShell` as two **separate** tool names —
a matcher of `"Bash"` never matches a `PowerShell` call. Confirmed directly by
reading a real `~/.claude/settings.json` that had hooks installed for `Bash`
only: PowerShell tool calls silently bypassed BOTH `emit-event.js`
(`terminal-start`/`terminal-complete` — invisible in Activity Flow) and
`request-permission.js` (Command Approval had zero effect on them, always
fell through to Claude Code's native prompt regardless of Off/Manual/Auto).
`server/hooks-setup.js`'s `REQUIRED_HOOKS` now registers the same two hook
scripts under `PowerShell` too (`PreToolUse` × 2 + `PostToolUse` × 1,
mirroring the existing `Bash` entries exactly) — no changes needed to the
hook scripts themselves, since they already read `tool_name`/`tool_input`
generically (`tool_input.command` has the same shape on both tools).

## Rules that must never be broken (sections 4.4 & 8 of the doc)

- A hook **must never** call Claude/another LLM (e.g. to summarize an event
  into a narrative sentence) — that would add cost/quota beyond what's
  needed.
- Event history on the Agent Server is **never** sent back as a prompt to
  Claude Code.
