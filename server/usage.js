// server/usage.js
//
// Read model & token usage DIRECTLY from the local Claude Code transcript
// file (~/.claude/projects/<project>/<session_id>.jsonl) -- this file is
// ALREADY written by Claude Code itself for its own purposes, we just read
// it back. NO extra LLM/API call happens at all (see the principle in
// architecture-design.md sections 2 & 4.4).
//
// JSONL schema confirmed from a real transcript file (not an
// assumption/from docs): each line is one event, has a `timestamp` field
// (ISO string) at the top level; the only lines relevant to usage are
// `type === "assistant"`, which have `message.model` (string) and
// `message.usage.{input_tokens,output_tokens,
// cache_creation_input_tokens,cache_read_input_tokens}`.
//
// IMPORTANT NOTE (do not delete): the "last 5 hours" number here is ONLY
// from THIS ONE project/session's transcript -- NOT the real Claude account
// rate-limit quota (that's enforced by Claude's servers, outside the reach
// of our local data). If the user runs Claude Code in another project at
// the same time, that eats into the same account quota but is NOT counted
// here. Never label this as a "limit" or "quota remaining" -- that's a
// claim we can't prove.
//
// INCREMENTAL CACHE (added 2026-09-03): the dashboard polls this endpoint
// every 4 seconds (see USAGE_POLL_MS in useAgentStore.js) FOR AS LONG AS the
// session is being watched -- without a cache, every poll re-reads +
// re-parses the entire file from byte zero. A long session's transcript can
// easily reach tens of MB (found directly: this very session was 67MB/22k
// lines when this problem was reported) -- reading the whole thing again
// every 4 seconds keeps getting heavier as the session grows longer, and
// blocks Node's single thread, delaying other requests too. The cache here
// is per transcriptPath (in-memory, lost on server restart -- same pattern
// as SessionStore, see session-store.js), storing the byte position ALREADY
// read + the parsing results up to that point -- the next call only reads
// the part of the file that's NEW since then, not from the start again.
const fs = require("node:fs");

const FIVE_HOURS_MS = 5 * 60 * 60 * 1000;

function emptyTotals() {
  return { input_tokens: 0, output_tokens: 0, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 };
}

function addUsage(totals, usage) {
  totals.input_tokens += usage.input_tokens ?? 0;
  totals.output_tokens += usage.output_tokens ?? 0;
  totals.cache_creation_input_tokens += usage.cache_creation_input_tokens ?? 0;
  totals.cache_read_input_tokens += usage.cache_read_input_tokens ?? 0;
}

// transcriptPath -> { bytesRead, model, messageCount, totals, lastMessageUsage, entries }
// `entries`: {ts, usage} per assistant message -- needs history PER MESSAGE
// (not just a cumulative total) so last5h can be recomputed correctly every
// time it's called (the window keeps shifting as time passes, even with no
// new lines at all -- a message that used to be "within the last 5 hours"
// can later fall "out of the window"). The size is reasonable -- only
// type:"assistant" lines that have usage, far fewer than the total JSONL
// line count (7 thousand-ish out of 22 thousand lines in this session's
// example), not every transcript line.
const cache = new Map();

function normalizeUsage(usage) {
  return {
    input_tokens: usage.input_tokens ?? 0,
    output_tokens: usage.output_tokens ?? 0,
    cache_creation_input_tokens: usage.cache_creation_input_tokens ?? 0,
    cache_read_input_tokens: usage.cache_read_input_tokens ?? 0,
  };
}

function processLine(lineStr, cached) {
  if (!lineStr.trim()) return;
  let entry;
  try {
    entry = JSON.parse(lineStr);
  } catch {
    return; // corrupt/incomplete line -- skip it, don't fail the whole thing
  }
  if (entry.type !== "assistant") return;
  const usage = entry.message?.usage;
  if (!usage) return;

  const normalized = normalizeUsage(usage);
  cached.messageCount++;
  cached.model = entry.message?.model ?? cached.model;
  addUsage(cached.totals, normalized);
  cached.lastMessageUsage = normalized; // keeps getting overwritten -- whatever's left at the end is the last one

  const ts = entry.timestamp ? Date.parse(entry.timestamp) : NaN;
  if (!Number.isNaN(ts)) cached.entries.push({ ts, usage: normalized });
}

// Reads ONLY the part of the file from `cached.bytesRead` to the end, then
// processes whatever COMPLETE lines are found (split manually at the byte
// level, NOT via readline -- readline decodes to a string per chunk, which
// makes precise byte-position accounting for resuming tricky if a
// multi-byte UTF-8 character gets cut at a chunk boundary; working at the
// Buffer/byte level avoids that). The last line, if not yet terminated by
// "\n", is DELIBERATELY left untouched/not counted as read -- the
// transcript might be being written to concurrently, so that line could
// still be incomplete; it gets read again from the same position on the
// next call.
function appendNewLines(transcriptPath, cached) {
  return new Promise((resolve, reject) => {
    const stream = fs.createReadStream(transcriptPath, { start: cached.bytesRead });
    let leftover = Buffer.alloc(0);
    let consumed = 0;

    stream.on("data", (chunk) => {
      leftover = leftover.length ? Buffer.concat([leftover, chunk]) : chunk;
      let newlineIdx;
      while ((newlineIdx = leftover.indexOf(0x0a)) !== -1) {
        const lineBuf = leftover.subarray(0, newlineIdx);
        leftover = leftover.subarray(newlineIdx + 1);
        consumed += lineBuf.length + 1; // +1 for the discarded "\n" byte
        processLine(lineBuf.toString("utf8"), cached);
      }
    });
    stream.on("end", () => {
      cached.bytesRead += consumed;
      resolve();
    });
    stream.on("error", reject);
  });
}

async function readUsage(transcriptPath) {
  if (!transcriptPath || !fs.existsSync(transcriptPath)) return null;

  const stat = fs.statSync(transcriptPath);
  let cached = cache.get(transcriptPath);

  // The file got SMALLER than what's already been read -- rare, but can
  // happen if a session_id happens to get reused for a new file. The old
  // cache is no longer valid, start fresh rather than getting stuck/wrong.
  if (cached && stat.size < cached.bytesRead) cached = null;

  if (!cached) {
    cached = { bytesRead: 0, model: null, messageCount: 0, totals: emptyTotals(), lastMessageUsage: null, entries: [] };
  }

  if (stat.size > cached.bytesRead) {
    await appendNewLines(transcriptPath, cached);
  }
  cache.set(transcriptPath, cached);

  // last5h is recomputed EVERY time this is called (not just when there are
  // new lines) -- the time window shifts even with no new messages at all.
  // The cost is small (scanning an in-memory array, not reading a file).
  const cutoff = Date.now() - FIVE_HOURS_MS;
  const last5h = emptyTotals();
  let last5hMessageCount = 0;
  for (const entry of cached.entries) {
    if (entry.ts >= cutoff) {
      last5hMessageCount++;
      addUsage(last5h, entry.usage);
    }
  }

  // "Context window": roughly how full Claude Code's context is RIGHT NOW --
  // different from `usage` (the cumulative total across every message in
  // the session). Taken from the 4 usage fields of the MOST RECENT
  // assistant message only (not summed across all of them), since that's
  // the closest approximation of "how many tokens are currently being
  // carried in context." This is still an ESTIMATE, not Claude's official
  // context-window number -- see the CONTEXT_WINDOW_LIMIT_ESTIMATE note in
  // the dashboard that consumes this.
  const contextUsage = cached.lastMessageUsage ? { ...cached.lastMessageUsage } : null;

  return {
    model: cached.model,
    messageCount: cached.messageCount,
    usage: { ...cached.totals },
    last5h: { messageCount: last5hMessageCount, usage: last5h },
    contextUsage,
  };
}

module.exports = { readUsage };
