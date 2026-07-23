/**
 * Proves the three AUTH-05 must-haves:
 *  (a) FR is the hard default when nothing is explicitly stored,
 *  (b) switching locale is instant (no network — MSW's onUnhandledRequest:
 *      'error' from src/test/setup.ts would fail this suite if i18next ever
 *      tried a backend fetch) and updates every visible string,
 *  (c) French CLDR pluralization renders the singular for count 0 AND 1.
 *
 * Module-init behavior (FR default with nothing stored, persistence across
 * a fresh boot) is tested against isolated instances via vi.resetModules()
 * + dynamic import, simulating separate page loads with different
 * localStorage states. useLocale() is tested against the app's single
 * shared i18n singleton (imported statically, like every real component
 * would use it).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import i18n from "./index";
import { useLocale } from "./useLocale";

async function freshI18n() {
  vi.resetModules();
  const mod = await import("./index");
  return mod.default;
}

describe("i18n module init (AUTH-05: FR hard default + persisted explicit choice)", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it("resolves French copy when nothing is stored — the detector never guesses from the browser", async () => {
    const freshInstance = await freshI18n();

    expect(freshInstance.resolvedLanguage).toBe("fr");
    expect(freshInstance.t("auth.loginCta")).toBe("Se connecter");
    expect(freshInstance.t("auth.signupCta")).toBe("Créer mon compte");
    expect(freshInstance.t("emptyState.heading")).toBe("Bientôt disponible");
  });

  it("persists an explicit changeLanguage('en') so a later fresh boot honours it over the FR default", async () => {
    const firstBoot = await freshI18n();
    await firstBoot.changeLanguage("en");
    expect(firstBoot.resolvedLanguage).toBe("en");

    const secondBoot = await freshI18n();
    expect(secondBoot.resolvedLanguage).toBe("en");
    expect(secondBoot.t("auth.loginCta")).toBe("Sign in");
  });
});

describe("locale switch is instant and updates every visible string", () => {
  beforeEach(async () => {
    localStorage.clear();
    await i18n.changeLanguage("fr");
  });

  afterEach(async () => {
    // Wrapped in act(): a renderHook-mounted component from the previous
    // test may still be attached when this runs (testing-library's own
    // auto-cleanup afterEach registers after this file's local afterEach),
    // and changeLanguage synchronously fires the languageChanged event that
    // re-renders it.
    await act(async () => {
      await i18n.changeLanguage("fr");
    });
    localStorage.clear();
  });

  it("switches every Phase-1 copy key from FR to EN synchronously via changeLanguage", async () => {
    expect(i18n.t("auth.loginCta")).toBe("Se connecter");
    expect(i18n.t("shell.retry")).toBe("Réessayer");
    expect(i18n.t("nav.inspections")).toBe("États des lieux");

    await i18n.changeLanguage("en");

    expect(i18n.t("auth.loginCta")).toBe("Sign in");
    expect(i18n.t("shell.retry")).toBe("Retry");
    expect(i18n.t("nav.inspections")).toBe("Inspections");
  });

  it("useLocale().setLocale swaps the resolved locale and re-renders with the new strings", async () => {
    const { result } = renderHook(() => useLocale());
    expect(result.current.locale).toBe("fr");

    await act(async () => {
      await result.current.setLocale("en");
    });

    expect(result.current.locale).toBe("en");
    expect(i18n.t("auth.loginCta")).toBe("Sign in");
  });
});

describe("French CLDR pluralization (count 0 and 1 both render the singular)", () => {
  beforeEach(async () => {
    await i18n.changeLanguage("fr");
  });

  it("renders '0 véhicule' and '1 véhicule' as singular, '2 véhicules' as plural", () => {
    expect(i18n.t("vehicleCount", { count: 0 })).toBe("0 véhicule");
    expect(i18n.t("vehicleCount", { count: 1 })).toBe("1 véhicule");
    expect(i18n.t("vehicleCount", { count: 2 })).toBe("2 véhicules");
  });

  it("renders the English _one/_other equivalents (0 and 1 singular is EN-specific here: 1 only)", async () => {
    await i18n.changeLanguage("en");
    expect(i18n.t("vehicleCount", { count: 0 })).toBe("0 vehicles");
    expect(i18n.t("vehicleCount", { count: 1 })).toBe("1 vehicle");
    expect(i18n.t("vehicleCount", { count: 2 })).toBe("2 vehicles");
  });
});
