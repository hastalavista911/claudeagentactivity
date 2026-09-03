// dashboard/src/components/SetupHooksCard.jsx
//
// Automates the README's "Path 2" (actually connect to Claude Code) --
// previously the user had to open ~/.claude/settings.json & edit the JSON
// by hand themselves. This card is just a thin UI on top of
// server/hooks-setup.js: checks status (GET /setup/hooks-status), then one
// button to install whatever's missing (POST /setup/install-hooks). Placed
// in the session-picker form area (StatusBar.jsx) -- the most relevant
// spot for "don't know how to get started yet."
//
// DELIBERATELY does NOT auto-recheck every X seconds (unlike
// GitPanel/etc., which poll) -- the hooks status in ~/.claude/settings.json
// only changes if the USER themselves changes it (either via this button
// or manually), there's no other external process that could silently
// change it.

import { useEffect, useState } from "react";
import { HTTP_BASE } from "../lib/config";
import { CheckCircle2, Info } from "./icons";
import { useI18n } from "../i18n/I18nContext";

export default function SetupHooksCard() {
  const { t } = useI18n();
  const [status, setStatus] = useState(null); // null = still loading
  const [installing, setInstalling] = useState(false);
  const [error, setError] = useState(null);
  const [justInstalled, setJustInstalled] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch(`${HTTP_BASE}/setup/hooks-status`)
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled) setStatus(data);
      })
      .catch(() => {
        // Agent Server isn't up yet/network dropped -- ignore, this card is
        // purely an optional bonus, not something that has to succeed in showing up.
        if (!cancelled) setStatus(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleInstall() {
    setInstalling(true);
    setError(null);
    try {
      const res = await fetch(`${HTTP_BASE}/setup/install-hooks`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "gagal pasang hooks");
      setStatus(data.status);
      setJustInstalled(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setInstalling(false);
    }
  }

  // Hasn't been read yet (server down, or the first fetch is still in
  // flight) -- stay silent, no spinner for something that's purely a bonus/optional.
  if (!status) return null;

  if (status.installed) {
    return (
      <div className="setup-hooks setup-hooks--ok">
        <CheckCircle2 size={12} strokeWidth={2} />
        {justInstalled ? t("setup.hooks.justInstalled") : t("setup.hooks.installed")}
      </div>
    );
  }

  const doneCount = status.items.filter((i) => i.installed).length;

  return (
    <div className="setup-hooks">
      <span className="setup-hooks__status">
        <Info size={12} strokeWidth={2} />
        {t("setup.hooks.missing", { done: doneCount, total: status.items.length })}
      </span>
      <button type="button" className="setup-hooks__button" onClick={handleInstall} disabled={installing}>
        {installing ? t("setup.hooks.installing") : t("setup.hooks.installButton")}
      </button>
      {error ? <span className="setup-hooks__error">{error}</span> : null}
    </div>
  );
}
