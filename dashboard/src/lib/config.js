// dashboard/src/lib/config.js
//
// Priority order for the Agent Server base URL (highest to lowest):
//   1. VITE_AGENT_SERVER_HTTP/_WS  -- a build-time env var, if deliberately
//      set (e.g. for a specific deployment), that's an explicit decision,
//      never silently overridden by a runtime setting.
//   2. Runtime override from ServerSwitcher.jsx (localStorage) -- the user
//      changes it via the dashboard UI (the Server button in StatusBar),
//      WITHOUT needing to restart Vite/rebuild. Just needs a TAB reload
//      (not a dev-server restart), see setServerOverride() below.
//   3. `window.location.hostname` -- the most common fallback, following
//      whatever host was used to open this page (localhost OR a LAN IP),
//      assuming the Agent Server & dashboard run on the SAME machine (see
//      the README Quick Start), just a different port (4000 vs 5173). This
//      is what makes the dashboard automatically "correct" when opened from
//      another device on the LAN WITHOUT any setup -- see the 2026-09-02 discussion.

const OVERRIDE_KEY = "agent-server-host-override";

function safeGetOverride() {
  try {
    return localStorage.getItem(OVERRIDE_KEY);
  } catch {
    return null;
  }
}

// `host` can be "192.168.1.50", "192.168.1.50:4000", or a full URL
// "http://192.168.1.50:4000" -- accepted as-is from the user's input (see
// ServerSwitcher.jsx), cleaned up here into just "host:port" (or a plain
// "host", with the default port 4000 added when it's actually used below).
export function setServerOverride(host) {
  const trimmed = host.trim().replace(/^https?:\/\//, "").replace(/^wss?:\/\//, "").replace(/\/$/, "");
  try {
    if (trimmed) localStorage.setItem(OVERRIDE_KEY, trimmed);
    else localStorage.removeItem(OVERRIDE_KEY);
  } catch {
    // localStorage isn't available -- ignore it, not fatal (see the same
    // pattern in useAgentStore.js for session_id).
  }
}

export function clearServerOverride() {
  try {
    localStorage.removeItem(OVERRIDE_KEY);
  } catch {
    // ignore
  }
}

export function getServerOverrideRaw() {
  return safeGetOverride();
}

// SWITCH_NOTICE_KEY: sessionStorage (NOT localStorage) -- written just
// BEFORE the reload when the user switches servers (see ServerSwitcher.jsx),
// read ONCE by ServerSwitchNotice.jsx after the reload to show a
// confirmation banner ("Connected to server: X ..."), then removed
// immediately. Deliberately sessionStorage (not localStorage) so that if
// the tab is closed and reopened later, a stale confirmation banner does
// NOT show up again -- this is purely a ONE-SHOT notice for the transition
// that just happened, not a permanent status (see
// getServerOverrideRaw()/isServerOverrideActive() for that).
const SWITCH_NOTICE_KEY = "agent-server-switch-notice";

export function markServerSwitchNotice(newHostLabel) {
  try {
    sessionStorage.setItem(SWITCH_NOTICE_KEY, newHostLabel);
  } catch {
    // ignore
  }
}

// Called ONCE when the notice component mounts -- consumes (reads + deletes)
// it at the same time, so it doesn't show again if the component
// re-mounts/re-renders.
export function consumeServerSwitchNotice() {
  try {
    const value = sessionStorage.getItem(SWITCH_NOTICE_KEY);
    if (value != null) sessionStorage.removeItem(SWITCH_NOTICE_KEY);
    return value;
  } catch {
    return null;
  }
}

const DEFAULT_HOST = typeof window !== "undefined" ? window.location.hostname : "localhost";

// Used in two places: (1) computing this module's HTTP_BASE/WS_URL on load,
// (2) ServerSwitcher.jsx to CHECK a new host (via /health) BEFORE saving +
// reloading -- see handleApply() there. Factored out of the module-scope
// computation below so both genuinely use the exact same normalization
// logic (so what's validated never differs from what's actually used).
function resolveHttpBase(rawOverride) {
  const overrideHost = rawOverride ? (rawOverride.includes(":") ? rawOverride : `${rawOverride}:4000`) : null;
  return overrideHost ? `http://${overrideHost}` : `http://${DEFAULT_HOST}:4000`;
}

// Builds a candidate HTTP base from the popover's raw input (not
// necessarily saved yet -- used to validate via /health before committing
// it to localStorage).
export function previewHttpBase(rawInput) {
  const trimmed = (rawInput ?? "").trim().replace(/^https?:\/\//, "").replace(/^wss?:\/\//, "").replace(/\/$/, "");
  return resolveHttpBase(trimmed || null);
}

const override = safeGetOverride();

export const HTTP_BASE = import.meta.env.VITE_AGENT_SERVER_HTTP || resolveHttpBase(override);
export const WS_URL = (import.meta.env.VITE_AGENT_SERVER_WS || resolveHttpBase(override).replace(/^http/, "ws"));
