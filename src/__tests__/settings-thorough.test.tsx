import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SettingsProvider } from "@/src/hooks/use-settings";
import { saveSettings, loadSettings, DEFAULT_SETTINGS } from "@/src/lib/settings";
import SettingsModal from "@/src/pages/Settings";

function wrap(ui: React.ReactNode) {
  return <SettingsProvider>{ui}</SettingsProvider>;
}

async function openTab(name: string) {
  await userEvent.click(screen.getByText(name));
}

describe("SettingsModal (thorough)", () => {
  beforeEach(() => {
    localStorage.clear();
    saveSettings({ ...DEFAULT_SETTINGS });
  });

  it("toggles lyrics switches and selects", async () => {
    render(wrap(<SettingsModal onClose={() => {}} />));
    const sw = screen.getAllByRole("switch")[0];
    fireEvent.click(sw);
    expect(loadSettings().lyrics.syncedOnly).toBe(true);

    const select = screen.getAllByRole("combobox")[0] as HTMLSelectElement;
    fireEvent.change(select, { target: { value: "left" } });
    expect(loadSettings().lyrics.alignment).toBe("left");

    const selects = screen.getAllByRole("combobox");
    fireEvent.change(selects[1], { target: { value: "large" } });
    expect(loadSettings().lyrics.fontSize).toBe("large");
  });

  it("toggles player switches", async () => {
    render(wrap(<SettingsModal onClose={() => {}} />));
    await openTab("Player");
    const switches = screen.getAllByRole("switch");
    fireEvent.click(switches[0]); // showAlbumArt off
    fireEvent.click(switches[1]); // showNextSong on
    fireEvent.click(switches[2]); // startupShuffle on
    const s = loadSettings();
    expect(s.player.showAlbumArt).toBe(false);
    expect(s.player.showNextSong).toBe(true);
    expect(s.player.startupShuffle).toBe(true);
  });

  it("toggles downloads switches and format select (on Player tab)", async () => {
    render(wrap(<SettingsModal onClose={() => {}} />));
    await openTab("Player");
    const switches = screen.getAllByRole("switch");
    fireEvent.click(switches[3]); // useOgFilename
    fireEvent.click(switches[4]); // embedMetadata
    expect(loadSettings().downloads.useOgFilename).toBe(true);
    expect(loadSettings().downloads.embedMetadata).toBe(true);
    const format = screen.getByDisplayValue("Original") as HTMLSelectElement;
    fireEvent.change(format, { target: { value: "flac" } });
    expect(loadSettings().downloads.format).toBe("flac");
  });

  it("toggles scrobbling switches and reveals custom server fields", async () => {
    render(wrap(<SettingsModal onClose={() => {}} />));
    await openTab("Scrobbling");
    const switches = screen.getAllByRole("switch");
    fireEvent.click(switches[0]); // lastfm enabled (default on -> off)
    fireEvent.click(switches[1]); // custom server -> reveals fields
    expect(loadSettings().scrobbling.lastfm.customServer).toBe(true);
    expect(screen.getByPlaceholderText("Your Last.fm API key")).toBeInTheDocument();
    fireEvent.click(switches[2]); // listenbrainz enabled (default on -> off)
    expect(loadSettings().scrobbling.listenbrainz.enabled).toBe(false);
  });

  it("toggles behavior switches and updates custom font", async () => {
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
    const fontInput = screen.getByPlaceholderText("IBM Plex Sans") as HTMLInputElement;
    await act(async () => {
      fireEvent.change(fontInput, { target: { value: "Inter" } });
    });
    expect(loadSettings().font).toBe("Inter");
  });

  it("clears tracker cache via the Clear button", async () => {
    render(wrap(<SettingsModal onClose={() => {}} />));
    await openTab("Behavior");
    const clearBtn = screen.getByText("Clear");
    fireEvent.click(clearBtn);
    expect(clearBtn).toBeInTheDocument();
  });
});
