// dashboard/src/lib/timeFormat.js

export function formatDuration(ms) {
  if (ms == null || ms < 0) return "—";
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  // A long-running session (>=1 hour) used to show as "207:13" -- a
  // two-digit "minutes" value that actually runs into the hundreds, so it
  // read like MM:SS when it was really a total minute count. Once past 1
  // hour, switch to H:MM:SS so the units are clear; below 1 hour it stays
  // plain MM:SS as before.
  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export function formatElapsedShort(ms) {
  if (ms == null || ms < 0) return "—";
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

// Time-only (HH:MM:SS) is enough for a session that happens within the same
// day -- but it's ambiguous once a session/history crosses midnight or gets
// reopened the next day (09:30:13 -- today or yesterday?). These two
// helpers add the date WITHOUT cluttering the display: formatDateShort()
// for a compact inline form ("Aug 31"), formatDateTime() for a full
// tooltip/detail form ("Aug 31 09:30:13").
export function formatDateShort(ts) {
  if (!ts) return "";
  return new Date(ts).toLocaleDateString(undefined, { day: "2-digit", month: "short" });
}

export function formatDateTime(ts) {
  if (!ts) return "";
  const d = new Date(ts);
  const date = d.toLocaleDateString(undefined, { day: "2-digit", month: "short" });
  const time = d.toLocaleTimeString(undefined, { hour12: false });
  return `${date} ${time}`;
}

// Used by the compact list/node-graph rows -- the date is only added IF the
// event ISN'T from today (the most common case: a session running/just
// finished today, a date would just add clutter with no extra info). Once a
// session/history is reopened the next day (or later), the time alone
// becomes ambiguous -- that's when the date shows up.
export function formatTimeMaybeDate(ts) {
  if (!ts) return "";
  const d = new Date(ts);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  const time = d.toLocaleTimeString(undefined, { hour12: false });
  if (isToday) return time;
  const date = d.toLocaleDateString(undefined, { day: "2-digit", month: "short" });
  return `${date} ${time}`;
}

export function formatTokens(n) {
  if (n == null) return "—";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}
