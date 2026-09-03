// dashboard/src/components/NotificationBanner.jsx
//
// A read-only banner for Claude Code's Notification hook. The dashboard
// NEVER approves/rejects anything here -- the permission decision itself
// always stays entirely in your terminal/VS Code, as usual. See
// lib/notifications.js for why this is just a "mirror" (Claude Code has no
// hook to signal that a notification has been resolved, so this banner
// auto-dismisses as soon as any other event comes after it).
//
// A GAP in that "any other event after it" heuristic (user report
// 2026-09-02): if what the user responded to was a tool that doesn't match
// any hook (e.g. AskUserQuestion -- not Edit/Write/Read/Bash), or the turn
// continues without a single hook ever firing again, the LAST event stays
// that same notification even though the user HAS genuinely responded --
// the banner gets stuck "still pending" when it isn't. AUTO_HIDE_MS below
// closes that gap: the banner also dismisses itself based on TIME, not
// just waiting for a new event that might never come.

import { useEffect, useState } from "react";
import { Bell } from "./icons";
import { useI18n } from "../i18n/I18nContext";

const AUTO_HIDE_MS = 90_000;

export default function NotificationBanner({ notification }) {
  const { t } = useI18n();
  const [, forceTick] = useState(0);

  // Re-renders every few seconds WHILE a notification is active -- this is
  // what makes AUTO_HIDE_MS below actually get checked over time, not just
  // once when the notification first appears.
  useEffect(() => {
    if (!notification) return;
    const timer = setInterval(() => forceTick((n) => n + 1), 5000);
    return () => clearInterval(timer);
  }, [notification?.timestamp]);

  if (!notification) return null;
  if (Date.now() - notification.timestamp > AUTO_HIDE_MS) return null;

  const message = notification.payload?.message || t("notification.defaultMessage");

  return (
    <div className="notification-banner" role="status">
      <Bell size={14} className="notification-banner__icon" strokeWidth={2} />
      <span className="notification-banner__text">{message}</span>
      <span className="notification-banner__hint">{t("notification.hint")}</span>
    </div>
  );
}
