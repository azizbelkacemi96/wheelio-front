/**
 * useLocale — the single place components read/change the active locale.
 *
 * Wraps `i18n.changeLanguage`, which (per i18next's own `changeLanguage`
 * implementation) synchronously swaps every resolved string from the
 * already-bundled fr/en resources (no network round-trip) and calls the
 * configured `LanguageDetector`'s `cacheUserLanguage`, persisting the
 * explicit choice under `LOCALE_STORAGE_KEY` in localStorage so it survives
 * reload and outranks the FR default on every subsequent boot (see
 * shared/i18n/index.ts for the detector configuration that makes this the
 * *only* thing that can ever override the FR hard default).
 */
import { useCallback, useSyncExternalStore } from "react";
import i18n from "./index";

export type Locale = "fr" | "en";

function subscribe(onChange: () => void): () => void {
  i18n.on("languageChanged", onChange);
  return () => i18n.off("languageChanged", onChange);
}

function getSnapshot(): Locale {
  return i18n.resolvedLanguage === "en" ? "en" : "fr";
}

export interface UseLocaleResult {
  locale: Locale;
  setLocale: (locale: Locale) => Promise<void>;
}

export function useLocale(): UseLocaleResult {
  const locale = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  const setLocale = useCallback(async (next: Locale) => {
    await i18n.changeLanguage(next);
  }, []);

  return { locale, setLocale };
}
