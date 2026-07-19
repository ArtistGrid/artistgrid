import { describe, it, expect } from "vitest";
import { renderHook, act, render, screen } from "@testing-library/react";
import { SettingsProvider, useSettings } from "@/src/hooks/use-settings";
import { saveSettings, DEFAULT_SETTINGS } from "@/src/lib/settings";

describe("useSettings", () => {
  it("throws outside provider", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => renderHook(() => useSettings())).toThrow();
    spy.mockRestore();
  });

  it("loads settings and updates a section", () => {
    localStorage.clear();
    saveSettings({ ...DEFAULT_SETTINGS, behavior: { ...DEFAULT_SETTINGS.behavior, useImageProxy: false } });
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <SettingsProvider>{children}</SettingsProvider>
    );
    const { result } = renderHook(() => useSettings(), { wrapper });
    expect(result.current.settings.behavior.useImageProxy).toBe(false);

    act(() => result.current.update("behavior", "useImageProxy", true));
    expect(result.current.settings.behavior.useImageProxy).toBe(true);
  });

  it("persists updates to localStorage", () => {
    localStorage.clear();
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <SettingsProvider>{children}</SettingsProvider>
    );
    const { result } = renderHook(() => useSettings(), { wrapper });
    act(() => result.current.update("player", "miniPlayer", false));
    const saved = JSON.parse(localStorage.getItem("artistgrid-settings:v1")!);
    expect(saved.player.miniPlayer).toBe(false);
  });

  it("allows consuming settings via component", () => {
    localStorage.clear();
    render(
      <SettingsProvider>
        <Consumer />
      </SettingsProvider>
    );
    expect(screen.getByText("IBM Plex Sans")).toBeInTheDocument();
  });
});

function Consumer() {
  const { settings } = useSettings();
  return <span>{settings.font}</span>;
}
