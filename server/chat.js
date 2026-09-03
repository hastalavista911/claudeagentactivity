// server/chat.js
//
// Chat sessions STARTED from the dashboard itself -- different from sessions
// watched via hooks (Claude Code running in VS Code/terminal). Here the
// Agent Server ITSELF runs Claude Code via @anthropic-ai/claude-agent-sdk,
// so the dashboard can send real prompts, not just watch passively.
//
// EMPIRICALLY VERIFIED FACTS (2026-08-31, not assumed from docs):
//  - The SDK's query() uses the SAME Claude Code login (Pro/Max) -- no
//    separate ANTHROPIC_API_KEY needed, no new billing path.
//  - Its transcript is saved in the NORMAL location
//    (~/.claude/projects/<cwd>/<id>.jsonl) -- fully compatible with the
//    existing server/transcript-path.js & usage.js.
//  - The SDK's `canUseTool` callback CANNOT be used to gate every tool call
//    -- it's only invoked for things Claude Code itself considers
//    "dangerous" (permissionMode "default"), a safe command like `echo`
//    never reaches it. INSTEAD: a PROGRAMMATIC PreToolUse hook
//    (options.hooks) -- this fires for EVERY tool call without exception,
//    already tested directly (both allow & deny work, confirmed via Claude
//    Code's own response: "The command was blocked by a hook").
//  - settingSources: [] is used so this project's GLOBAL hooks
//    (emit-event.js, request-permission.js in ~/.claude/settings.json)
//    don't also fire twice -- telemetry here is built DIRECTLY from the SDK
//    stream, not via a shell hook.

const { query } = require("@anthropic-ai/claude-agent-sdk");
const { deriveTranscriptPath } = require("./transcript-path");
const { emitAutoApprovedEvent, emitDecisionEvent } = require("./permission-store");

const PERMISSION_TIMEOUT_MS = 20_000;

// Extract plain text from an array of content blocks (text/thinking only --
// tool_use is handled separately as file.edit/terminal.start events).
function extractText(blocks) {
  if (!Array.isArray(blocks)) return "";
  return blocks
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("")
    .trim();
}

function findToolUseBlocks(blocks) {
  if (!Array.isArray(blocks)) return [];
  return blocks.filter((b) => b.type === "tool_use");
}

// Map one tool_use (from an "assistant" message) to our event -- best
// effort, only handles Bash/Edit/Write/Read, which are the ones known to be
// used. Other tools (Grep, WebFetch, etc.) are deliberately skipped from
// Activity Flow to avoid noise -- the chat message text itself is still
// recorded in full.
function mapToolUseToEvent(base, block) {
  const input = block.input ?? {};
  switch (block.name) {
    case "Bash":
      return { ...base, type: "terminal.start", payload: { command: input.command, description: input.description } };
    case "Edit":
    case "Write":
      return { ...base, type: "file.edit", payload: { file: input.file_path, status: "running" } };
    case "Read":
      return { ...base, type: "file.read", payload: { file: input.file_path } };
    default:
      return null;
  }
}

// Map a tool_result (from a "user" message, paired with the tool_use above)
// to our "done"/"complete" event. `toolName` is recalled from tool_use_id ->
// the tool name seen earlier (passed in via `pendingToolNames`).
function mapToolResultToEvent(base, block, toolName, toolUseResult) {
  if (toolName === "Bash") {
    return {
      ...base,
      type: "terminal.complete",
      payload: {
        stdout: toolUseResult?.stdout ?? (typeof block.content === "string" ? block.content : ""),
        stderr: toolUseResult?.stderr ?? "",
        interrupted: toolUseResult?.interrupted ?? false,
      },
    };
  }
  if (toolName === "Edit" || toolName === "Write") {
    return { ...base, type: "file.edit", payload: { file: toolUseResult?.filePath, status: "done" } };
  }
  return null;
}

// Builds the PROGRAMMATIC PreToolUse hook, wired to the SAME permissionStore
// used by hooks/request-permission.js -- the difference is there's no HTTP
// round-trip needed at all here (it's already the same Node process).
//
// `getSessionId` is called EVERY time this hook fires (not once up front) --
// this hook is registered BEFORE system/init arrives (the session_id isn't
// known yet at that point), but the first tool call always happens AFTER
// system/init, so it's read live via closure, not a value frozen at the start.
function makePreToolUseHook({ getSessionId, getCwd, approvalGateSessions, permissionStore, broadcast, sessionStore }) {
  return async function preToolUseHook(input) {
    const sessionId = getSessionId();
    const mode = approvalGateSessions.get(sessionId) ?? "off";

    if (mode === "off") {
      // Toggle OFF -- per the 2026-08-31 decision: auto-deny, NOT
      // auto-allow. Different from a session watched via a hook (which has
      // a terminal-prompt fallback) -- a dashboard chat session has NO
      // other fallback at all, so silently allowing would be dangerous; it
      // has to be explicitly turned on first.
      return {
        hookSpecificOutput: {
          hookEventName: "PreToolUse",
          permissionDecision: "deny",
          permissionDecisionReason: "Command Approval belum dinyalakan untuk sesi chat ini di dashboard.",
        },
      };
    }

    if (mode === "auto") {
      // Auto mode: NEVER pauses -- still recorded as a "permission.auto"
      // event (an "AUTO" badge in Activity Flow) so there's a visible
      // trail, rather than silently passing through unrecorded.
      emitAutoApprovedEvent({
        sessionStore,
        broadcast,
        sessionId,
        cwd: getCwd(),
        toolName: input.tool_name,
        toolInput: input.tool_input,
      });
      return {
        hookSpecificOutput: {
          hookEventName: "PreToolUse",
          permissionDecision: "allow",
          permissionDecisionReason: "Auto-approved (mode Auto) oleh AI Agent Activity Visualizer",
        },
      };
    }

    // "manual" mode -- the same full flow as before: pause, wait for
    // Allow/Deny from the dashboard or a timeout.
    const { id, promise } = permissionStore.request(
      sessionId,
      input.tool_name,
      input.tool_input ?? {},
      PERMISSION_TIMEOUT_MS,
      (entry, decision) => {
        broadcast({ type: "permission.resolved", session_id: entry.sessionId, payload: { id: entry.id, decision } });
        emitDecisionEvent({ sessionStore, broadcast, sessionId: entry.sessionId, cwd: getCwd(), toolName: entry.toolName, toolInput: entry.toolInput, decision });
      }
    );
    broadcast({
      type: "permission.requested",
      session_id: sessionId,
      payload: { id, tool_name: input.tool_name, tool_input: input.tool_input ?? {}, timeout_ms: PERMISSION_TIMEOUT_MS },
    });

    const decision = await promise; // "allow" | "deny" | "ask" (timeout)
    // "ask" has NO meaning here (there's no terminal prompt for a headless
    // session like this) -- treat it the same as deny, don't silently pass through.
    const finalDecision = decision === "allow" ? "allow" : "deny";
    return {
      hookSpecificOutput: {
        hookEventName: "PreToolUse",
        permissionDecision: finalDecision,
        permissionDecisionReason:
          finalDecision === "allow"
            ? "Disetujui lewat dashboard AI Agent Activity Visualizer"
            : "Ditolak atau timeout (20 detik) dari dashboard AI Agent Activity Visualizer",
      },
    };
  };
}

// Runs ONE turn (one new prompt from the user, whether starting a new
// session or continuing via `resumeSessionId`). Async, but NOT fully
// awaited by the caller -- its events are streamed to sessionStore+broadcast()
// AS THEY HAPPEN, not buffered until the whole thing finishes.
//
// Returns: Promise<string> session_id (resolved as soon as the first
// system/init message arrives -- the caller needs this RIGHT AWAY to tell
// the dashboard, it shouldn't have to wait for the whole turn to finish).
function runChatTurn({ cwd, prompt, resumeSessionId, sessionStore, broadcast, approvalGateSessions, permissionStore }) {
  let resolveSessionId;
  const sessionIdPromise = new Promise((r) => (resolveSessionId = r));

  (async () => {
    let sessionId = resumeSessionId ?? null;
    // tool_use_id -> tool name, to match a later tool_result back to its tool_use.
    const pendingToolNames = new Map();

    function emit(type, payload) {
      if (!sessionId) return; // session_id not known yet (no system/init yet) -- don't drop the event
      const event = { session_id: sessionId, timestamp: Date.now(), cwd, type, payload };
      sessionStore.addEvent(sessionId, event);
      broadcast(event);
    }

    // The user's prompt is shown directly as a chat message -- written once
    // the session_id is known (see system/init below), so the ordering is
    // correct from the start of the session.
    let userPromptQueued = prompt;

    try {
      const stream = query({
        prompt,
        options: {
          cwd,
          resume: resumeSessionId,
          includePartialMessages: true,
          settingSources: [], // avoid this project's GLOBAL hooks firing twice -- see the note above
          hooks: {
            PreToolUse: [
              {
                hooks: [
                  makePreToolUseHook({
                    getSessionId: () => sessionId,
                    getCwd: () => cwd,
                    approvalGateSessions,
                    permissionStore,
                    broadcast,
                    sessionStore,
                  }),
                ],
              },
            ],
          },
        },
      });

      for await (const msg of stream) {
        if (msg.type === "system" && msg.subtype === "init") {
          sessionId = msg.session_id;
          resolveSessionId(sessionId);
          if (!resumeSessionId) {
            // This session's FIRST turn -- only now does it make sense to
            // send agent.start (transcript_path etc.). A follow-up turn
            // (resume) also fires system/init, but that's not "starting a
            // new session" in meaning -- if it were also emitted as
            // agent.start, Activity Flow would look like the session
            // restarted over and over when it's really just one ongoing
            // conversation. Emit agent.thinking instead, matching what
            // UserPromptSubmit means in the hooks/emit-event.js flow.
            const transcriptPath = deriveTranscriptPath(cwd, sessionId);
            emit("agent.start", { transcript_path: transcriptPath });
          } else {
            emit("agent.thinking");
          }
          if (userPromptQueued) {
            emit("chat.message", { role: "user", text: userPromptQueued });
            userPromptQueued = null;
          }
          continue;
        }

        if (msg.type === "stream_event") {
          const delta = msg.event?.delta;
          if (delta?.type === "text_delta" && sessionId) {
            broadcast({ type: "chat.delta", session_id: sessionId, payload: { text: delta.text } });
          }
          continue;
        }

        if (msg.type === "assistant") {
          const blocks = msg.message?.content;
          const text = extractText(blocks);
          if (text) emit("chat.message", { role: "assistant", text });

          for (const block of findToolUseBlocks(blocks)) {
            pendingToolNames.set(block.id, block.name);
            const base = {};
            const event = mapToolUseToEvent(base, block);
            if (event) emit(event.type, event.payload);
            else emit("agent.thinking"); // unrecognized tool -- at least flag that the agent is working
          }
          continue;
        }

        if (msg.type === "user") {
          const blocks = msg.message?.content;
          if (!Array.isArray(blocks)) continue;
          for (const block of blocks) {
            if (block.type !== "tool_result") continue;
            const toolName = pendingToolNames.get(block.tool_use_id);
            const event = mapToolResultToEvent({}, block, toolName, msg.tool_use_result);
            if (event) emit(event.type, event.payload);
          }
          continue;
        }

        if (msg.type === "result") {
          emit("agent.complete", { status: msg.is_error ? "error" : "success" });
        }
      }
    } catch (err) {
      console.error("[chat] error:", err.message);
      if (sessionId) emit("agent.complete", { status: "error" });
      if (!sessionId) resolveSessionId(null); // failed before ever getting a session_id
    }
  })();

  return sessionIdPromise;
}

module.exports = { runChatTurn };
