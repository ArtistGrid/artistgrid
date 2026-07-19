import { describe, it, expect, beforeEach, vi } from "vitest";
import { proxyImageUrl } from "@/src/lib/image-proxy";
import { loadSettings, saveSettings, DEFAULT_SETTINGS } from "@/src/lib/settings";

describe("proxyImageUrl", () => {
  beforeEach(() => {
    localStorage.clear();
    saveSettings({ ...DEFAULT_SETTINGS, behavior: { ...DEFAULT_SETTINGS.behavior, useImageProxy: false } });
  });

  it("returns url unchanged when proxy disabled", () => {
    expect(proxyImageUrl("https://x.com/a.png")).toBe("https://x.com/a.png");
  });

  it("prefixes proxy base when enabled", () => {
    saveSettings({ ...DEFAULT_SETTINGS, behavior: { ...DEFAULT_SETTINGS.behavior, useImageProxy: true } });
    const out = proxyImageUrl("https://x.com/a.png");
    expect(out).toBe("https://i.edideaur.works/?url=" + encodeURIComponent("https://x.com/a.png"));
  });
});
