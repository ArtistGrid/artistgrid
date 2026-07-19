import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { SettingsProvider } from "@/src/hooks/use-settings";
import { saveSettings, loadSettings, DEFAULT_SETTINGS } from "@/src/lib/settings";
import SettingsModal from "@/src/pages/Settings";

function wrap(ui: React.ReactNode) {
  return <SettingsProvider>{ui}</SettingsProvider>;
}

describe("SettingsModal", () => {
  beforeEach(() => {
    localStorage.clear();
    saveSettings({ ...DEFAULT_SETTINGS });
  });

  it("renders settings title and tabs", () => {
    render(wrap(<SettingsModal onClose={() => {}} />));
    expect(screen.getByText("Settings")).toBeInTheDocument();
    expect(screen.getAllByText("Lyrics").length).toBeGreaterThan(0);
    expect(screen.getByText("Player")).toBeInTheDocument();
    expect(screen.getByText("Scrobbling")).toBeInTheDocument();
    expect(screen.getByText("Behavior")).toBeInTheDocument();
  });

  it("closes when close button clicked", () => {
    const onClose = vi.fn();
    render(wrap(<SettingsModal onClose={onClose} />));
    fireEvent.click(screen.getAllByLabelText("Close settings")[0]);
    expect(onClose).toHaveBeenCalled();
  });

  it("toggles synced lyrics switch and persists", () => {
    render(wrap(<SettingsModal onClose={() => {}} />));
    const sw = screen.getByRole("switch");
    expect(sw).not.toBeChecked();
    fireEvent.click(sw);
    expect(loadSettings().lyrics.syncedOnly).toBe(true);
  });
});
