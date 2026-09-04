// hooks/emit-event.js
//
// Generic script invoked by Claude Code via hooks (see architecture-design.md
// section 4.3 and the example config in hooks/settings.example.json).
//
// STATUS: ACTIVE for this project via .claude/settings.json (see project root).
// Already validated against a real Claude Code session -- every event type
// (session-start, thinking, pre-edit, post-edit, file-read, terminal-start,
// terminal-complete, complete, ask-question, answer-question) has had its
// structure checked (the last two via a real AskUserQuestion call,
// 2026-09-04, the rest via EMIT_EVENT_DEBUG=1 mode) and matches
// mapToEvent() below. If Claude Code's version changes, redo that check
// before trusting it again.
//
// EXCEPT "notification" (the case below) -- that one has NEVER been
// verified against a real permission-request scenario, see the comment in
// its own case.
//
// Job: read JSON from stdin (sent automatically by Claude Code), map it to
// our event format, send it to the Agent Server via an HTTP POST (not a
// direct WebSocket -- the reasoning is explained in doc section 4.3: a hook
// is a one-shot shell process).
//
// IMPORTANT (sections 4.4 & 8): no call to Claude/another LLM is allowed
// here, and event history here is never sent back as a prompt to Claude Code.

const AGENT_SERVER_URL = process.env.AGENT_SERVER_URL || "http://localhost:4000/events";

// Used for "Agent Thoughts" -- reads back text Claude Code ITSELF already
// wrote to the local transcript, rather than asking another LLM to
// summarize (not allowed, see architecture-design.md sections 4.4 & 8).
// Same module as the server's session-store.js, so it's shared via a
// relative require -- not duplicated.
const { deriveTranscriptPath } = require("../server/transcript-path");

// Set EMIT_EVENT_DEBUG=1 in .claude/settings.json (per-hook env) or in the
// shell before running Claude Code, to write each hook's raw JSON payload
// to hooks/debug.log -- used once during initial integration (doc section 7
// step 5) to confirm the mapping in mapToEvent() matches the real structure,
// then can be turned off again.
const DEBUG = process.env.EMIT_EVENT_DEBUG === "1";
const path = require("node:path");
const fs = require("node:fs");
const DEBUG_LOG_PATH = path.join(__dirname, "debug.log");

const eventTypeArg = process.argv[2]; // "pre-edit", "post-edit", "terminal-start", etc.

let inputData = "";
process.stdin.on("data", (chunk) => (inputData += chunk));
process.stdin.on("end", async () => {
  try {
    const hookPayload = JSON.parse(inputData || "{}");
    if (DEBUG) {
      fs.appendFileSync(
        DEBUG_LOG_PATH,
        `[${new Date().toISOString()}] hook=${eventTypeArg} raw=${JSON.stringify(hookPayload)}\n`
      );
    }
    const event = mapToEvent(eventTypeArg, hookPayload);
    await sendToAgentServer(event);
  } catch (err) {
    // Never block Claude Code just because the hook failed -- just log to stderr.
    console.error("[emit-event] gagal mengirim event:", err.message);
  }
  process.exit(0); // exit code 0 = doesn't block Claude Code
});

// Compute a diff summary from tool_response.structuredPatch (a REAL field
// from Claude Code, already confirmed via EMIT_EVENT_DEBUG in hooks/README.md
// -- not data we generate ourselves). Used for the Details panel + line
// highlighting in the VS Code extension.
function diffStats(structuredPatch) {
  if (!Array.isArray(structuredPatch) || structuredPatch.length === 0) return null;
  let added = 0;
  let removed = 0;
  for (const hunk of structuredPatch) {
    for (const line of hunk.lines ?? []) {
      if (line.startsWith("+")) added++;
      else if (line.startsWith("-")) removed++;
    }
  }
  const first = structuredPatch[0];
  const last = structuredPatch[structuredPatch.length - 1];
  return {
    hunks: structuredPatch,
    added,
    removed,
    // Approximate range of changed lines, for editor highlighting -- not
    // perfectly precise if there are several hunks far apart, but good
    // enough for a general highlight.
    line_start: first.newStart,
    line_end: last.newStart + Math.max(last.newLines - 1, 0),
  };
}

// Claude Code sends `transcript_path` in EVERY hook's payload (not just
// SessionStart) per its official docs -- but if it turns out to be missing
// (an older version, or the field is empty), fall back to the same derive
// formula the server uses (see server/transcript-path.js).
function resolveTranscriptPath(hookPayload) {
  return hookPayload.transcript_path || deriveTranscriptPath(hookPayload.cwd, hookPayload.session_id);
}

// Reads only the last few KB of the transcript file -- not the whole file.
// This hook is SYNCHRONOUS and blocks Claude Code until this process exits,
// so it has to stay fast even once the transcript has millions of lines
// (a 12k+ message session has been seen).
function readTranscriptTail(transcriptPath, maxBytes = 16 * 1024) {
  const stat = fs.statSync(transcriptPath);
  const start = Math.max(0, stat.size - maxBytes);
  const length = stat.size - start;
  const fd = fs.openSync(transcriptPath, "r");
  try {
    const buffer = Buffer.alloc(length);
    fs.readSync(fd, buffer, 0, length, start);
    return buffer.toString("utf8");
  } finally {
    fs.closeSync(fd);
  }
}

// "Agent Thoughts": grabs the text (or `thinking` block) Claude Code ITSELF
// already wrote right before this tool call -- not a fresh LLM summary,
// purely reading back what's already there. Best-effort heuristic: the LAST
// "assistant" entry in the transcript at the moment this hook fires most
// likely (not guaranteed) contains the tool_use about to run. If one
// assistant turn calls several tools at once, the same text will show up
// again for each tool call in that turn -- that's expected. Can also be
// empty (null) if Claude genuinely wrote nothing before this tool call --
// don't force it to always have content.
function extractAgentThought(transcriptPath) {
  if (!transcriptPath) return null;
  try {
    if (!fs.existsSync(transcriptPath)) return null;
    const tail = readTranscriptTail(transcriptPath);
    const lines = tail.split("\n").filter((l) => l.trim());
    // The first line in this tail chunk is likely cut off mid-way (we
    // started reading from some arbitrary offset near the end of the file)
    // -- skip it.
    for (let i = lines.length - 1; i >= 1; i--) {
      let entry;
      try {
        entry = JSON.parse(lines[i]);
      } catch {
        continue;
      }
      if (entry.type !== "assistant") continue;
      const blocks = entry.message?.content;
      if (!Array.isArray(blocks)) return null;
      const text = blocks
        .map((b) => (b.type === "text" ? b.text : b.type === "thinking" ? b.thinking : null))
        .filter((t) => typeof t === "string" && t.trim())
        .join(" ")
        .trim();
      return text ? text.slice(0, 400) : null;
    }
    return null;
  } catch {
    return null; // don't let this "nice to have" feature take down the main hook
  }
}

function mapToEvent(kind, hookPayload) {
  const base = {
    session_id: hookPayload.session_id,
    timestamp: Date.now(),
    // cwd is present on EVERY hook payload (not just SessionStart) -- sent
    // on every event so the server can derive transcript_path retroactively
    // (see server/transcript-path.js), instead of only depending on the
    // agent.start event that only happens once at the start of a session.
    cwd: hookPayload.cwd,
  };
  switch (kind) {
    case "session-start":
      // transcript_path is used by the server (session-store.js) to read
      // model & token usage directly from the local Claude Code transcript
      // file -- not an LLM call.
      return { ...base, type: "agent.start", payload: { transcript_path: hookPayload.transcript_path } };
    case "thinking":
      return { ...base, type: "agent.thinking" };
    case "pre-edit":
      return {
        ...base,
        type: "file.edit",
        payload: {
          file: hookPayload.tool_input?.file_path,
          status: "running",
          agent_thought: extractAgentThought(resolveTranscriptPath(hookPayload)),
        },
      };
    case "post-edit": {
      const diff = diffStats(hookPayload.tool_response?.structuredPatch);
      return {
        ...base,
        type: "file.edit",
        payload: {
          file: hookPayload.tool_input?.file_path,
          status: "done",
          duration_ms: hookPayload.duration_ms,
          ...(diff
            ? { diff: diff.hunks, lines_added: diff.added, lines_removed: diff.removed, line_start: diff.line_start, line_end: diff.line_end }
            : {}),
        },
      };
    }
    case "file-read":
      return { ...base, type: "file.read", payload: { file: hookPayload.tool_input?.file_path } };
    case "terminal-start":
      return {
        ...base,
        type: "terminal.start",
        payload: {
          command: hookPayload.tool_input?.command,
          description: hookPayload.tool_input?.description,
          agent_thought: extractAgentThought(resolveTranscriptPath(hookPayload)),
        },
      };
    case "terminal-complete":
      return {
        ...base,
        type: "terminal.complete",
        payload: {
          // FULL output (used to be truncated to .slice(0,60) on the
          // dashboard side) -- truncating for a short display is now the
          // UI's job, not the hook's.
          stdout: hookPayload.tool_response?.stdout ?? "",
          stderr: hookPayload.tool_response?.stderr ?? "",
          duration_ms: hookPayload.duration_ms,
          // NOTE: the real PostToolUse:Bash payload does NOT have an
          // explicit exit_code field (already checked via EMIT_EVENT_DEBUG)
          // -- only mock-agent sends exit_code. `interrupted`, which IS
          // present in the real payload, doesn't mean failure, just that
          // the user canceled it.
          interrupted: hookPayload.tool_response?.interrupted ?? false,
        },
      };
    case "complete":
      return { ...base, type: "agent.complete", payload: { status: "success" } };
    case "ask-question":
      // Read-only visibility for AskUserQuestion (user request 2026-09-04)
      // -- confirmed against a REAL call the same day (not just the tool's
      // documented schema): tool_input really does carry
      // { questions: [{ question, header, options: [{label, ...}] }] }.
      // Deliberately no request-permission.js entry for this matcher at
      // all -- see the note in server/hooks-setup.js for why Command
      // Approval must never touch this.
      return {
        ...base,
        type: "agent.question",
        payload: {
          status: "asked",
          questions: (hookPayload.tool_input?.questions ?? []).map((q) => ({
            header: q.header ?? null,
            question: q.question ?? null,
            options: (q.options ?? []).map((o) => o.label).filter(Boolean),
          })),
        },
      };
    case "answer-question":
      // Also confirmed against the same real call -- tool_response really
      // does carry `answers` keyed by the exact question text (matches
      // "questions" above 1:1), value = the selected option's label.
      return {
        ...base,
        type: "agent.question",
        payload: {
          status: "answered",
          answers: hookPayload.tool_response?.answers ?? null,
        },
      };
    case "notification":
      // NOT YET verified via EMIT_EVENT_DEBUG against a real
      // permission-request scenario (unlike the other hooks in this file,
      // checked 2026-08-27) -- `message` is the field name Claude Code's
      // docs describe for the Notification hook, but its real payload has
      // never actually been seen in this project. Next time a real
      // permission request happens, turn on EMIT_EVENT_DEBUG=1 and compare
      // hooks/debug.log against this mapping.
      //
      // DELIBERATELY just a read-only mirror (see the project README's
      // "Option A") -- the dashboard NEVER approves/rejects anything from
      // here. The permission decision itself always stays entirely in
      // Claude Code's terminal/VS Code, as usual.
      return { ...base, type: "agent.notification", payload: { message: hookPayload.message ?? null } };
    default:
      return { ...base, type: "unknown", payload: { raw: hookPayload } };
  }
}

async function sendToAgentServer(event) {
  const res = await fetch(AGENT_SERVER_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(event),
  });
  if (!res.ok) {
    console.error(`[emit-event] Agent Server responded ${res.status} for ${event.type}`);
  }
}

// Exposed for unit tests (e.g. _test-emit-mapping.js) -- doesn't affect
// behavior when run by Claude Code as a hook (invoked as a script, not required).
module.exports = { mapToEvent, diffStats };
