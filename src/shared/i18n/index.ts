/**
 * i18next runtime — FR is the hard default (AUTH-05); the browser language
 * detector is only a hint for a *previously stored explicit choice*, never
 * for guessing from `navigator.language`/cookies/`<html lang>`. That's why
 * `detection.order` below is restricted to `localStorage`: with nothing
 * stored, `detect()` returns nothing and `fallbackLng: 'fr'` wins. Once a
 * user calls `useLocale().setLocale(...)`, i18next's own `changeLanguage`
 * flow calls the detector's `cacheUserLanguage`, persisting the explicit
 * choice under `lookupLocalStorage` so it survives reload and outranks the
 * default on every subsequent boot.
 *
 * v4 CLDR plurals (`_one`/`_other` JSON key suffixes, `Intl.PluralRules`
 * under the hood) are used from the start — see fr/common.json's
 * `vehicleCount_one`/`vehicleCount_other` — never hand-rolled `count === 1`
 * ternaries (01-RESEARCH.md "Don't Hand-Roll"). No `compatibilityJSON` is
 * set (removed in i18next v24+) and no `i18next-icu` plugin is added (no
 * gendered/nested-select copy exists in this phase's copy inventory).
 */
import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import fr from "./fr/common.json";
import en from "./en/common.json";

export const LOCALE_STORAGE_KEY = "wheelio-locale";

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: { fr: { common: fr }, en: { common: en } },
    fallbackLng: "fr", // FR is the hard default per AUTH-05
    ns: ["common"],
    defaultNS: "common",
    interpolation: { escapeValue: false }, // React already escapes
    detection: {
      // Only ever consult a PREVIOUSLY, EXPLICITLY stored choice — never
      // navigator/cookie/querystring/htmlTag. Nothing stored => detect()
      // yields nothing => fallbackLng 'fr' applies (the hard default).
      order: ["localStorage"],
      caches: ["localStorage"],
      lookupLocalStorage: LOCALE_STORAGE_KEY,
    },
  });

export default i18n;
