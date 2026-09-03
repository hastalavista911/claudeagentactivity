// dashboard/src/lib/notifications.js
//
// Find an agent.notification event that's still "pending" -- used for the
// warning banner at the top of the dashboard (components/NotificationBanner.jsx).
//
// DELIBERATELY just a read-only mirror ("Option A", see the 2026-08-28
// discussion): the dashboard never joins in approving/rejecting anything,
// it just lets you know a request is waiting to be answered in your
// terminal/VS Code. Since Claude Code has no hook that says "this
// notification has been resolved," we treat a notification as no longer
// relevant as soon as ANY other event comes after it (meaning the agent has
// moved on) -- that's why it's only checked if it's the VERY LAST event.
export function findPendingNotification(events) {
  if (events.length === 0) return null;
  const last = events[events.length - 1];
  return last.type === "agent.notification" ? last : null;
}
