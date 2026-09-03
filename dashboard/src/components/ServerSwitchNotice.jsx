// dashboard/src/components/ServerSwitchNotice.jsx
//
// A SHOWS-ONCE banner that appears right after a reload from ServerSwitcher
// (see lib/config.js consumeServerSwitchNotice()) -- closes 2 confusion
// gaps that came up in the 2026-09-02 discussion:
//   1. "Did the switch actually work?" -- an explicit confirmation of what
//      the new host is, instead of just silently trusting that reload = success.
//   2. "Why does my old session_id now say 'not found'?" -- warned UP FRONT
//      (rather than waiting for the user to be confused seeing an error
//      first) that session_id is per-server specific, so it may need to be re-entered.
//
// Auto-dismisses itself after a few seconds (no close button needed for a
// notice that's purely informational and one-shot).

import { useEffect, useState } from "react";
import { consumeServerSwitchNotice } from "../lib/config";
import { Server } from "./icons";
import { useI18n } from "../i18n/I18nContext";

const AUTO_HIDE_MS = 10_000;

export default function ServerSwitchNotice() {
  const { t } = useI18n();
  const [host, setHost] = useState(null);

  useEffect(() => {
    const value = consumeServerSwitchNotice();
    if (!value) return;
    setHost(value);
    const timer = setTimeout(() => setHost(null), AUTO_HIDE_MS);
    return () => clearTimeout(timer);
  }, []);

  if (!host) return null;

  return (
    <div className="server-switch-notice" role="status">
      <Server size={14} className="server-switch-notice__icon" strokeWidth={2} />
      <span className="server-switch-notice__text">{t("serverSwitcher.connected", { host })}</span>
      <span className="server-switch-notice__hint">{t("serverSwitcher.connectedHint")}</span>
    </div>
  );
}
