// dashboard/src/i18n/I18nContext.jsx
//
// The dashboard's language context -- the user's choice is stored in
// localStorage (per device/browser, same as sessionId in
// useAgentStore.js), so NOTHING is hardcoded to one language for everyone.
// Default: the browser's language if recognized (id/en), otherwise falls
// back to DEFAULT_LOCALE ("id").

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { translations, LOCALES, DEFAULT_LOCALE } from "./translations";

const STORAGE_KEY = "agentwork.locale";

function detectInitialLocale() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved && translations[saved]) return saved;
  } catch {
    // localStorage might not be available (e.g. strict private mode) --
    // ignore it, use the browser detection/default below.
  }
  const browserLang = (navigator.language || "").slice(0, 2).toLowerCase();
  if (translations[browserLang]) return browserLang;
  return DEFAULT_LOCALE;
}

function interpolate(str, vars) {
  if (!vars) return str;
  return str.replace(/\{\{(\w+)\}\}/g, (match, key) => (key in vars ? String(vars[key]) : match));
}

const I18nContext = createContext(null);

export function I18nProvider({ children }) {
  const [locale, setLocaleState] = useState(detectInitialLocale);

  const setLocale = useCallback((next) => {
    if (!translations[next]) return;
    setLocaleState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Not fatal -- the choice just doesn't persist across reloads in this browser.
    }
  }, []);

  const t = useCallback(
    (key, vars) => {
      const dict = translations[locale] ?? translations[DEFAULT_LOCALE];
      const str = dict[key] ?? translations[DEFAULT_LOCALE][key] ?? key;
      return interpolate(str, vars);
    },
    [locale]
  );

  const value = useMemo(() => ({ locale, setLocale, t, locales: LOCALES }), [locale, setLocale, t]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

// Main hook used in components: const { t } = useI18n();
export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n() dipanggil di luar <I18nProvider>");
  return ctx;
}
