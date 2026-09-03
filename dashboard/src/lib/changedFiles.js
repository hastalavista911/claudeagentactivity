// dashboard/src/lib/changedFiles.js
//
// A summary of "which files changed" over the session -- purely an
// aggregation of file.edit events already in the store
// (event.payload.status === "done"), similar to `git diff --stat`. No new
// data is requested from the server.

export function deriveChangedFiles(events) {
  const byFile = new Map();

  for (let i = 0; i < events.length; i++) {
    const event = events[i];
    if (event.type !== "file.edit") continue;
    const payload = event.payload ?? {};
    if (payload.status !== "done" || !payload.file) continue;

    const entry = byFile.get(payload.file) ?? {
      file: payload.file,
      edits: 0,
      added: 0,
      removed: 0,
      // false if an older hook/mock-agent never sent lines_added/removed at
      // all -- so the UI can show a plain "edited Nx" instead of a
      // misleading "+0/-0" (as if it was edited but nothing changed).
      hasLineStats: false,
      lastEventIndex: -1,
      lastEditedAt: null,
    };

    entry.edits += 1;
    if (typeof payload.lines_added === "number" || typeof payload.lines_removed === "number") {
      entry.added += payload.lines_added ?? 0;
      entry.removed += payload.lines_removed ?? 0;
      entry.hasLineStats = true;
    }
    entry.lastEventIndex = i;
    entry.lastEditedAt = event.timestamp;

    byFile.set(payload.file, entry);
  }

  // Most recently edited first -- usually the most relevant to look at.
  return [...byFile.values()].sort((a, b) => (b.lastEditedAt ?? 0) - (a.lastEditedAt ?? 0));
}
