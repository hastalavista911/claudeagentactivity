// server/transcript-path.js
//
// Derive the Claude Code transcript file's location from `cwd` + `session_id`
// -- both are present on every hook payload (not just SessionStart), so this
// works retroactively for sessions that were already running before
// hooks/emit-event.js started sending this field, without needing to wait
// for a new agent.start event.
//
// The folder-encoding pattern was confirmed from real ~/.claude/projects/
// contents (NOT a guess): every ":" and path separator ("\" or "/") is
// replaced with "-".
// Real example: "c:\Users\kenpachi\Desktop\jsproject\agentwork"
//            -> "c--Users-kenpachi-Desktop-jsproject-agentwork"

const os = require("node:os");
const path = require("node:path");

function encodeProjectDir(cwd) {
  return cwd.replace(/[:\\/]/g, "-");
}

function deriveTranscriptPath(cwd, sessionId) {
  if (!cwd || !sessionId) return null;
  const projectDir = encodeProjectDir(cwd);
  return path.join(os.homedir(), ".claude", "projects", projectDir, `${sessionId}.jsonl`);
}

module.exports = { deriveTranscriptPath, encodeProjectDir };
