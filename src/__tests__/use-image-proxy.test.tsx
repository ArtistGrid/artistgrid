import { describe, it, expect } from "vitest";
import { renderHook } from "@testing-library/react";
import { SettingsProvider } from "@/src/hooks/use-settings";
import { useImageProxy } from "@/src/hooks/use-image-proxy";
import { saveSettings, DEFAULT_SETTINGS } from "@/src/lib/settings";

describe("useImageProxy", () => {
  it("returns url unchanged when proxy disabled", () => {
    localStorage.clear();
    saveSettings({ ...DEFAULT_SETTINGS, behavior: { ...DEFAULT_SETTINGS.behavior, useImageProxy: false } });
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <SettingsProvider>{children}</SettingsProvider>
    );
    const { result } = renderHook(() => useImageProxy(), { wrapper });
    expect(result.current.proxyImageUrl("https://x.com/a.png")).toBe("https://x.com/a.png");
  });

  it("proxies url when enabled", () => {
    localStorage.clear();
    saveSettings({ ...DEFAULT_SETTINGS, behavior: { ...DEFAULT_SETTINGS.behavior, useImageProxy: true } });
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <SettingsProvider>{children}</SettingsProvider>
    );
    const { result } = renderHook(() => useImageProxy(), { wrapper });
    expect(result.current.proxyImageUrl("https://x.com/a.png")).toBe(
      "https://i.edideaur.works/?url=" + encodeURIComponent("https://x.com/a.png")
    );
  });

  it("builds a srcSet with jxl/webp/original", () => {
    localStorage.clear();
    saveSettings({ ...DEFAULT_SETTINGS, behavior: { ...DEFAULT_SETTINGS.behavior, useImageProxy: true } });
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <SettingsProvider>{children}</SettingsProvider>
    );
    const { result } = renderHook(() => useImageProxy(), { wrapper });
    const set = result.current.proxyImageSrcSet("https://x.com/a.png");
    expect(set.webp).toContain("output=webp");
    expect(set.jxl).toContain("output=jxl");
    expect(set.original).not.toContain("output=");
  });
});
