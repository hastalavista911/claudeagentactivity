// server/hooks-setup.js
//
// Automates the README's "Path 2" step (register hooks/emit-event.js and
// hooks/request-permission.js in ~/.claude/settings.json) -- previously the
// user had to open that file & edit the JSON by hand. This Agent Server
// runs locally with full filesystem access, so it can write that file
// itself via an endpoint (see server.js GET/POST /setup/*), the user just
// clicks a button in the dashboard (see dashboard/src/components/SetupHooksCard.jsx).
//
// Safety principles kept here:
//  - NEVER delete/overwrite any other hook the user already has -- only add
//    the entries we need, checking first that they aren't already there
//    (idempotent).
//  - Back up settings.json BEFORE rewriting it (if the file already exists)
//    -- this is Claude Code's GLOBAL config, not our own project file.
//  - The project path is resolved automatically from this file's location
//    (__dirname), the user never types a manual path at all.

const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const PROJECT_ROOT = path.resolve(__dirname, "..");

function hookCommand(scriptRelPath, ...args) {
  const abs = path.join(PROJECT_ROOT, scriptRelPath);
  // Quote the path -- defensive in case some segment of the user's folder
  // has a space in it (e.g. "OneDrive - Company Name"), even though that's
  // unlikely to happen exactly in this project itself.
  return `node "${abs}"${args.length ? " " + args.join(" ") : ""}`;
}

// Mirrors hooks/settings.example.json exactly -- if that example file
// changes, this list MUST be kept in sync (there's no mechanism to read it
// automatically from that .json, it's deliberately kept as static data here
// so it's easy to diff & clear what it contains).
const REQUIRED_HOOKS = [
  { event: "SessionStart", matcher: null, command: hookCommand("hooks/emit-event.js", "session-start") },
  { event: "UserPromptSubmit", matcher: null, command: hookCommand("hooks/emit-event.js", "thinking") },
  { event: "PreToolUse", matcher: "Edit|Write", command: hookCommand("hooks/emit-event.js", "pre-edit") },
  { event: "PreToolUse", matcher: "Edit|Write", command: hookCommand("hooks/request-permission.js") },
  { event: "PreToolUse", matcher: "Read", command: hookCommand("hooks/emit-event.js", "file-read") },
  { event: "PreToolUse", matcher: "Bash", command: hookCommand("hooks/emit-event.js", "terminal-start") },
  { event: "PreToolUse", matcher: "Bash", command: hookCommand("hooks/request-permission.js") },
  // The PowerShell tool is SEPARATE from Bash in Claude Code (two different
  // tool_names) -- the "Bash" matcher doesn't automatically cover PowerShell
  // calls, so without its own entry here, Command Approval & Activity Flow
  // would silently NEVER get recorded at all for PowerShell commands (gap
  // found & confirmed 2026-09-03 by checking a real settings.json). The hook
  // scripts themselves (emit-event.js, request-permission.js) are ALREADY
  // generic -- they read `tool_input.command`/`tool_name` as-is from the
  // payload, and that field has the exact same shape on the PowerShell tool,
  // so no new script is needed, just registering it under this extra matcher.
  { event: "PreToolUse", matcher: "PowerShell", command: hookCommand("hooks/emit-event.js", "terminal-start") },
  { event: "PreToolUse", matcher: "PowerShell", command: hookCommand("hooks/request-permission.js") },
  { event: "PostToolUse", matcher: "Edit|Write", command: hookCommand("hooks/emit-event.js", "post-edit") },
  { event: "PostToolUse", matcher: "Bash", command: hookCommand("hooks/emit-event.js", "terminal-complete") },
  { event: "PostToolUse", matcher: "PowerShell", command: hookCommand("hooks/emit-event.js", "terminal-complete") },
  { event: "Stop", matcher: null, command: hookCommand("hooks/emit-event.js", "complete") },
  { event: "Notification", matcher: null, command: hookCommand("hooks/emit-event.js", "notification") },
];

function settingsPath() {
  return path.join(os.homedir(), ".claude", "settings.json");
}

function readSettings() {
  const p = settingsPath();
  if (!fs.existsSync(p)) return {};
  try {
    return JSON.parse(fs.readFileSync(p, "utf8"));
  } catch (err) {
    throw new Error(`~/.claude/settings.json ada tapi bukan JSON valid: ${err.message}`);
  }
}

// Checks whether `command` is ALREADY registered in one event's hooks array
// (in ANY entry within that array, regardless of its matcher) -- flatten
// first then check, so a command that happens to already be there (e.g.
// from a previous install, or the user set it up manually) doesn't get
// registered twice.
//
// SCOPED per (event, matcher) -- NOT just per event. request-permission.js
// is used under TWO different matchers (Edit|Write and Bash) with the EXACT
// SAME command string (no distinguishing argument) -- if we only checked
// "is it already registered somewhere in this event," once it got
// registered under Edit|Write, the Bash pass would think it's "already
// registered too" and get skipped, even though that's a SEPARATE entry
// Claude Code reads independently per matcher (a real bug that was hit &
// caught via isolated testing before this was ever used against a real
// settings.json).
// An EXACT string comparison isn't enough either -- proven directly when
// this was tried against a REAL settings.json: hooks that had already been
// installed manually before this feature existed were written as
// `node C:/path/emit-event.js` (forward slash, no quotes), while
// hookCommand() here generates `node "C:\path\..."` (backslash, quoted) --
// FUNCTIONALLY IDENTICAL (Windows shells accept both), but a different
// string, so comparing them as-is would wrongly conclude "not installed"
// and register it TWICE -- each hook then firing twice (duplicate events,
// a race between duplicate permission requests). Normalizing slashes &
// stripping quotes before comparing avoids that.
function normalizeCommand(cmd) {
  return cmd.replace(/"/g, "").replace(/\\/g, "/").trim().toLowerCase();
}

function isCommandRegisteredForMatcher(hooksForEvent, matcher, command) {
  const entry = hooksForEvent.find((e) => (e.matcher ?? null) === matcher);
  if (!entry) return false;
  const target = normalizeCommand(command);
  return (entry.hooks ?? []).some((h) => normalizeCommand(h.command) === target);
}

// Adds ONE command to the entry whose matcher is an EXACT match, if one
// already exists (to keep the file compact), or creates a new entry if
// there's no entry with that matcher yet. NEVER modifies any other command
// already present in that entry -- only appends to its `hooks` array.
function registerCommand(hooksForEvent, matcher, command) {
  const idx = hooksForEvent.findIndex((entry) => (entry.matcher ?? null) === matcher);
  if (idx !== -1) {
    const updated = hooksForEvent.slice();
    updated[idx] = { ...updated[idx], hooks: [...(updated[idx].hooks ?? []), { type: "command", command }] };
    return updated;
  }
  const newEntry = matcher != null ? { matcher, hooks: [{ type: "command", command }] } : { hooks: [{ type: "command", command }] };
  return [...hooksForEvent, newEntry];
}

// Per-hook status (used by the dashboard to show "X/Y hooks installed" +
// an Install button if incomplete) -- NEVER writes anything, purely reads.
function getHooksStatus() {
  const settings = readSettings();
  const hooks = settings.hooks ?? {};
  const items = REQUIRED_HOOKS.map((req) => ({
    ...req,
    installed: isCommandRegisteredForMatcher(hooks[req.event] ?? [], req.matcher, req.command),
  }));
  return {
    settingsPath: settingsPath(),
    settingsExists: fs.existsSync(settingsPath()),
    installed: items.every((i) => i.installed),
    items,
  };
}

// Writes only the hooks that AREN'T already there (idempotent -- safe to
// call repeatedly, a second call onward won't add anything more once
// everything's already complete).
function installHooks() {
  const p = settingsPath();
  const settings = readSettings();
  if (!settings.hooks) settings.hooks = {};

  let addedCount = 0;
  for (const req of REQUIRED_HOOKS) {
    const arr = settings.hooks[req.event] ?? [];
    if (isCommandRegisteredForMatcher(arr, req.matcher, req.command)) continue;
    settings.hooks[req.event] = registerCommand(arr, req.matcher, req.command);
    addedCount++;
  }

  if (addedCount > 0) {
    const dir = path.dirname(p);
    fs.mkdirSync(dir, { recursive: true });
    // Backup BEFORE overwriting -- this is Claude Code's global config, not our own file.
    if (fs.existsSync(p)) {
      fs.copyFileSync(p, `${p}.backup-${Date.now()}`);
    }
    fs.writeFileSync(p, JSON.stringify(settings, null, 2) + "\n", "utf8");
  }

  return { settingsPath: p, addedCount, status: getHooksStatus() };
}

module.exports = { getHooksStatus, installHooks, settingsPath, REQUIRED_HOOKS };
