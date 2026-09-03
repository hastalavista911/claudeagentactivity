// dashboard/src/components/LanguageSwitcher.jsx
//
// A dropdown to pick the dashboard's language -- placed in StatusBar so
// it's always visible/easy to find (not hidden in a settings menu). The
// choice is stored per-browser via I18nContext (localStorage),
// independently per device -- nothing gets shared/synced to another device.
//
// The native <select> is kept as-is (the most accessible & easiest to use
// with a keyboard/on mobile), but its browser-default appearance is set to
// "appearance: none" via CSS so a standard-OS white panel doesn't pop up in
// the middle of the dark dashboard -- a custom icon + chevron are laid over
// it, see .language-switcher* in App.css.

import { useI18n } from "../i18n/I18nContext";
import { Languages, ChevronDown } from "./icons";

export default function LanguageSwitcher() {
  const { locale, setLocale, locales, t } = useI18n();

  return (
    <div className="language-switcher" title={t("statusBar.language.label")}>
      <Languages size={13} strokeWidth={2} className="language-switcher__icon" />
      <select
        className="language-switcher__select"
        value={locale}
        onChange={(e) => setLocale(e.target.value)}
        aria-label={t("statusBar.language.label")}
      >
        {locales.map((l) => (
          <option key={l.code} value={l.code}>
            {l.label}
          </option>
        ))}
      </select>
      <ChevronDown size={12} strokeWidth={2} className="language-switcher__chevron" />
    </div>
  );
}
