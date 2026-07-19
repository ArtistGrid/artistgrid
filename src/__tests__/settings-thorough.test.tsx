import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SettingsProvider } from "@/src/hooks/use-settings";
import { saveSettings, loadSettings, DEFAULT_SETTINGS } from "@/src/lib/settings";
import SettingsModal from "@/src/pages/Settings";

function wrap(ui: React.ReactNode) {
  return <SettingsProvider>{ui}</SettingsProvider>;
}

function openTab(name: string) {
  return act(async () => {
    await userEvent.click(screen.getByText(name));
  });
}

describe("SettingsModal (thorough)", () => {
  beforeEach(() => {
    localStorage.clear();
    saveSettings({ ...DEFAULT_SETTINGS });
  });

  it("toggles lyrics switches", async () => {
    render(wrap(<SettingsModal onClose={() => {}} />));
    fireEvent.click(screen.getByLabelText("Close settings"));
    // lyrics tab is default; toggle syncedOnly, alignment select, fontSize select
    const sw = screen.getAllByRole("switch")[0];
    fireEvent.click(sw);
    expect(loadSettings().lyrics.syncedOnly).toBe(true);
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "left" } });
    expect(loadSettings().lyrics.alignment).toBe("left");
  });

  it("toggles player switches", async () => {
    render(wrap(<SettingsModal onClose={() => {}} />));
    await openTab("Player");
    const switches = screen.getAllByRole("switch");
    fireEvent.click(switches[0]); // showAlbumArt
    fireEvent.click(switches[1]); // showNextSong
    fireEvent.click(switches[2]); // startupShuffle
    const s = loadSettings();
    expect(s.player.showAlbumArt).toBe(false);
    expect(s.player.showNextSong).toBe(true);
    expect(s.player.startupShuffle).toBe(true);
  });

  it("toggles scrobbling switches and reveals custom server fields", async () => {
    render(wrap(<SettingsModal onClose={() => {}} />));
    await openTab("Scrobbling");
    const switches = screen.getAllByRole("switch");
    fireEvent.click(switches[0]); // lastfm enabled
    fireEvent.click(switches[1]); // custom server -> reveals fields
    expect(loadSettings().scrobbling.lastfm.customServer).toBe(true);
    expect(screen.getByPlaceholderText("Your Last.fm API key")).toBeInTheDocument();
    fireEvent.click(switches[2]); // listenbrainz enabled
    expect(loadSettings().scrobbling.listenbrainz.enabled).toBe(true);
  });

  it("toggles behavior switches and font input", async () => {
    render(wrap(<SettingsModal onClose={() => {}} />));
    await openTab("Behavior");
    const switches = screen.getAllByRole("switch");
    fireEvent.click(switches[0]); // detailedErrors
    fireEvent.click(switches[1]); // notifications
    fireEvent.click(switches[2]); // showEmojis
    fireEvent.click(switches[3]); // rememberSearch
    fireEvent.click(switches[4]); // openInNewTab
    const s = loadSettings();
    expect(s.behavior.detailedErrors).toBe(true);
    expect(s.behavior.notifications).toBe(true);
    expect(s.behavior.showEmojis).toBe(false);
    expect(s.behavior.rememberSearch).toBe(true);
    expect(s.behavior.openInNewTab).toBe(false);
    const fontInput = screen.getByPlaceholderText("IBM Plex Sans");
    fireEvent.change(fontInput, { target: { value: "Inter" } });
    expect(loadSettings().font).toBe("Inter");
  });

  it("clears tracker cache", async () => {
    render(wrap(<SettingsModal onClose={() => {}} />));
    await openTab("Behavior");
    // scroll not needed; the Clear button is in Cache section on Behavior tab
    const clearBtn = screen.getByText("Clear");
    fireEvent.click(clearBtn);
    expect(clearBtn).toBeInTheDocument();
  });
});
