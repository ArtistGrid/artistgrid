import { describe, it, expect, beforeEach } from "vitest";
import { loadSettings, saveSettings, DEFAULT_SETTINGS } from "../lib/settings";

describe("loadSettings", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("returns defaults when nothing stored", () => {
    const settings = loadSettings();
    expect(settings).toEqual(DEFAULT_SETTINGS);
  });

  it("merges stored settings with defaults", () => {
    const partial = JSON.stringify({
      lyrics: { syncedOnly: true },
    });
    localStorage.setItem("artistgrid-settings", partial);
    const settings = loadSettings();
    expect(settings.lyrics.syncedOnly).toBe(true);
    expect(settings.lyrics.alignment).toBe(DEFAULT_SETTINGS.lyrics.alignment);
    expect(settings.downloads).toEqual(DEFAULT_SETTINGS.downloads);
  });

  it("returns defaults for invalid JSON", () => {
    localStorage.setItem("artistgrid-settings", "bad-json");
    expect(loadSettings()).toEqual(DEFAULT_SETTINGS);
  });
});

describe("saveSettings", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("persists settings to localStorage", () => {
    const settings = { ...DEFAULT_SETTINGS, lyrics: { ...DEFAULT_SETTINGS.lyrics, syncedOnly: true } };
    saveSettings(settings);
    const stored = JSON.parse(localStorage.getItem("artistgrid-settings")!);
    expect(stored.lyrics.syncedOnly).toBe(true);
  });
});

describe("DEFAULT_SETTINGS", () => {
  it("has expected structure", () => {
    expect(DEFAULT_SETTINGS).toHaveProperty("lyrics");
    expect(DEFAULT_SETTINGS).toHaveProperty("downloads");
    expect(DEFAULT_SETTINGS).toHaveProperty("player");
    expect(DEFAULT_SETTINGS).toHaveProperty("behavior");
  });

  it("has reasonable defaults", () => {
    expect(DEFAULT_SETTINGS.player.startupShuffle).toBe(false);
    expect(DEFAULT_SETTINGS.behavior.openInNewTab).toBe(true);
    expect(DEFAULT_SETTINGS.downloads.embedMetadata).toBe(false);
  });
});
