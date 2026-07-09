import { describe, it, expect } from "vitest";
import { toTTML } from "../lib/lyrics";
import { stripEmojis } from "../../lib/utils";
import type { LyricsData } from "../lib/lyrics";

describe("toTTML", () => {
  it("converts synced lyrics to TTML with timings", () => {
    const data: LyricsData = {
      plainLyrics: null,
      syncedLyrics: [
        { text: "First", startTime: 1000 },
        { text: "Second", startTime: 5000 },
      ],
      instrumental: false,
      trackName: "T",
      artistName: "A",
      albumName: "",
      duration: 9,
    };
    const ttml = toTTML(data);
    expect(ttml).toContain('<?xml version="1.0"');
    expect(ttml).toContain('<p begin="00:00:01.000" end="00:00:05.000">First</p>');
    expect(ttml).toContain('<p begin="00:00:05.000" end="00:00:09.000">Second</p>');
  });

  it("converts plain lyrics to unsynced TTML (zero timings)", () => {
    const data: LyricsData = {
      plainLyrics: "Line one\nLine two",
      syncedLyrics: null,
      instrumental: false,
      trackName: "T",
      artistName: "A",
      albumName: "",
      duration: 0,
    };
    const ttml = toTTML(data);
    expect(ttml).toContain('<p begin="00:00:00.000" end="00:00:00.000">Line one</p>');
    expect(ttml).toContain('<p begin="00:00:00.000" end="00:00:00.000">Line two</p>');
  });

  it("escapes XML special characters", () => {
    const data: LyricsData = {
      plainLyrics: "Rock & Roll <3",
      syncedLyrics: null,
      instrumental: false,
      trackName: "T",
      artistName: "A",
      albumName: "",
      duration: 0,
    };
    const ttml = toTTML(data);
    expect(ttml).toContain("Rock &amp; Roll &lt;3");
  });
});

describe("stripEmojis", () => {
  it("removes emojis and collapses whitespace", () => {
    expect(stripEmojis("🎵 My Song 🔥")).toBe("My Song");
  });
  it("keeps text without emojis", () => {
    expect(stripEmojis("Just a title")).toBe("Just a title");
  });
});
