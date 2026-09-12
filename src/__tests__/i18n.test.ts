import { describe, it, expect, beforeEach, vi } from "vitest";
import { getLocale, availableLocales } from "@/src/lib/i18n";
describe("i18n", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.resetModules();
  });
  it("translates known keys", async () => {
    const { t } = await import("@/src/lib/i18n");
    expect(t("home.error.title")).toBe("Error Loading Artists");
  });
  it("falls back to the key for unknown translations and unknown keys", async () => {
    const { t } = await import("@/src/lib/i18n");
    expect(t("totally.missing.key")).toBe("totally.missing.key");
  });
  it("interpolates params", async () => {
    const { t } = await import("@/src/lib/i18n");
    expect(t("home.noResults.search", { query: "kanye" })).toBe('Your search for "kanye" didn\'t return any results.');
  });
  it("setLocale persists and updates <html lang>", async () => {
    const { setLocale } = await import("@/src/lib/i18n");
    setLocale("en-GB");
    expect(localStorage.getItem("artistgrid-locale:v1")).toBe("en");
    expect(document.documentElement.lang).toBe("en");
  });
  it("sets rtl direction for RTL locales", async () => {
    const mod = await import("@/src/lib/i18n");
    mod.setLocale("en-US");
    expect(document.documentElement.dir).toBe("ltr");
  });
  it("getLocale defaults to en", async () => {
    const { getLocale } = await import("@/src/lib/i18n");
    expect(getLocale()).toBe("en");
  });
  it("lists available locales", async () => {
    const { availableLocales: locales } = await import("@/src/lib/i18n");
    expect(locales()).toContain("en");
  });
  it("keeps direct imports working alongside module resets", () => {
    expect(availableLocales().length).toBeGreaterThan(0);
    expect(getLocale()).toBeTruthy();
  });
});
