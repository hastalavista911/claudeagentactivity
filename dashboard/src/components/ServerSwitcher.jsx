// dashboard/src/components/ServerSwitcher.jsx
//
// Change which Agent Server is targeted WITHOUT restarting Vite -- stored
// in localStorage (lib/config.js setServerOverride()), applied via a TAB
// RELOAD (not a dev-server restart, that keeps running in the background)
// once saved. Useful for a "device A watches a session on device B"
// scenario without device B needing to run its own dashboard -- see the
// 2026-09-02 discussion.
//
// A simple popover, opened via the Server button in StatusBar (same
// pattern as LanguageSwitcher, but this needs free-form input + a save
// button, so it's not a <select>).

import { useEffect, useRef, useState } from "react";
import { HTTP_BASE, getServerOverrideRaw, setServerOverride, clearServerOverride, markServerSwitchNotice, previewHttpBase } from "../lib/config";
import { Server, Info } from "./icons";
import { useI18n } from "../i18n/I18nContext";

const CHECK_TIMEOUT_MS = 4000;

export default function ServerSwitcher() {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState(getServerOverrideRaw() ?? "");
  const [checking, setChecking] = useState(false);
  const [checkError, setCheckError] = useState(null);
  const rootRef = useRef(null);

  // Click outside the popover OR press Escape -- standard behavior for any
  // popover, without this the only way to close it would be clicking the
  // toggle button again, which is less natural than other dropdowns.
  useEffect(() => {
    if (!open) return;
    function handlePointerDown(e) {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false);
    }
    function handleKeyDown(e) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  // Before COMMITTING (localStorage + reload), try /health against the
  // candidate host first -- without this, a mistyped host (e.g. the
  // server's real port 4000 typed as 8000) would just get saved+reloaded,
  // and the dashboard would get stuck at "Disconnected -- retrying..."
  // permanently with no explanation, the only way out being to reopen this
  // popover and guess (user report 2026-09-03). This is purely a pre-check
  // for UX -- the server can still become unreachable LATER (crashed,
  // network dropped) even after passing this check; that's already handled
  // by the existing "Disconnected -- retrying..." state.
  async function handleApply(e) {
    e.preventDefault();
    const trimmed = input.trim();
    setCheckError(null);
    setChecking(true);
    try {
      const candidate = previewHttpBase(trimmed);
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), CHECK_TIMEOUT_MS);
      try {
        const res = await fetch(`${candidate}/health`, { signal: controller.signal });
        if (!res.ok) throw new Error(String(res.status));
      } finally {
        clearTimeout(timer);
      }
    } catch {
      setChecking(false);
      setCheckError(t("serverSwitcher.checkFailed", { host: previewHttpBase(trimmed) }));
      return;
    }
    setChecking(false);
    setServerOverride(trimmed);
    // Write the notice BEFORE reloading -- ServerSwitchNotice.jsx reads
    // this right after the new page finishes loading, to show a
    // confirmation banner ("Connected to server: X") + a reminder that the
    // session_id might need to be re-entered (see the 2026-09-02 discussion
    // about the confusion after switching servers).
    markServerSwitchNotice(trimmed);
    window.location.reload();
  }

  function handleReset() {
    clearServerOverride();
    markServerSwitchNotice(t("serverSwitcher.defaultLabel"));
    window.location.reload();
  }

  // A PERMANENT indicator (not just a one-shot notice) for when connected
  // to a NON-default server -- a different color when custom (answers "am
  // I still on the right server?" minutes/hours later, not just right
  // after switching).
  const isCustom = Boolean(getServerOverrideRaw());

  // The host itself is written DIRECTLY on the toggle button (not just a
  // plain icon) -- previously the popover had to be opened first just to
  // see "Current server: ...", even though that's reasonable info to want
  // to check at a glance without clicking (user report 2026-09-03, see the
  // screenshot pointing at an empty spot in the status bar as the right
  // place for it). The "http://" prefix is dropped -- on a screen this
  // narrow it just eats space without adding information.
  const hostLabel = HTTP_BASE.replace(/^https?:\/\//, "");

  return (
    <div className="server-switcher" ref={rootRef}>
      <button
        type="button"
        className={`server-switcher__toggle${isCustom ? " server-switcher__toggle--custom" : ""}`}
        onClick={() => setOpen((v) => !v)}
        title={t("serverSwitcher.tooltip", { current: HTTP_BASE })}
      >
        <Server size={13} strokeWidth={2} />
        <span className="server-switcher__host-label">{hostLabel}</span>
      </button>
      {open ? (
        <form className="server-switcher__popover" onSubmit={handleApply}>
          {/* Added so this popover feels DIFFERENT from other everyday
              features (not just a regular setting) -- the 2026-09-03
              conversation showed the user was briefly confused about what
              this feature is for, then accidentally typed a DIFFERENT
              project's host (not the Agent Server) in here. This callout
              isn't a new validation (that's already handled by the
              /health check in handleApply) -- it's purely a visual "read
              this before using it" marker for someone opening this popover
              for the first time. */}
          <div className="server-switcher__advanced-badge">
            <Info size={12} strokeWidth={2} />
            <div>
              <div className="server-switcher__advanced-badge-title">{t("serverSwitcher.advancedTitle")}</div>
              <div className="server-switcher__advanced-badge-text">{t("serverSwitcher.advancedHint")}</div>
            </div>
          </div>
          <div className="server-switcher__current">
            {t("serverSwitcher.current")} <code>{HTTP_BASE}</code>
          </div>
          <label className="server-switcher__label">{t("serverSwitcher.label")}</label>
          <input
            type="text"
            className="server-switcher__input"
            placeholder={t("serverSwitcher.placeholder")}
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              if (checkError) setCheckError(null);
            }}
            autoFocus
          />
          <p className="server-switcher__hint">{t("serverSwitcher.hint")}</p>
          {checkError ? <p className="server-switcher__error">{checkError}</p> : null}
          <div className="server-switcher__actions">
            <button type="submit" className="server-switcher__button server-switcher__button--primary" disabled={!input.trim() || checking}>
              {checking ? t("serverSwitcher.checking") : t("serverSwitcher.apply")}
            </button>
            <button type="button" className="server-switcher__button" onClick={handleReset} disabled={checking}>
              {t("serverSwitcher.reset")}
            </button>
          </div>
        </form>
      ) : null}
    </div>
  );
}
