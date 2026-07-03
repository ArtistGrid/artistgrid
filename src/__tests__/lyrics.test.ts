import { describe, it, expect } from "vitest";
import { parseSyncedLyrics, findCurrentLineIndex } from "../lib/lyrics";

describe("parseSyncedLyrics", () => {
  it("parses standard LRC format", () => {
    const lrc = "[00:01.00]Line one\n[00:02.50]Line two\n[00:03.75]Line three";
    const lines = parseSyncedLyrics(lrc);
    expect(lines).toHaveLength(3);
    expect(lines[0]).toEqual({ text: "Line one", startTime: 1000 });
    expect(lines[1]).toEqual({ text: "Line two", startTime: 2500 });
    expect(lines[2]).toEqual({ text: "Line three", startTime: 3750 });
  });

  it("handles 3-digit ms", () => {
    const lrc = "[01:30.123]Hello";
    const lines = parseSyncedLyrics(lrc);
    expect(lines[0].startTime).toBe(90123);
  });

  it("skips empty lines", () => {
    const lrc = "[00:01.00]Line\n[00:02.00]\n[00:03.00]Another";
    const lines = parseSyncedLyrics(lrc);
    expect(lines).toHaveLength(2);
  });

  it("returns empty array for no matches", () => {
    expect(parseSyncedLyrics("no timestamps here")).toEqual([]);
  });

  it("handles multi-digit minutes", () => {
    const lrc = "[12:34.56]Long song";
    const lines = parseSyncedLyrics(lrc);
    expect(lines[0].startTime).toBe(754560);
  });
});

describe("findCurrentLineIndex", () => {
  const lines = [
    { text: "First", startTime: 0 },
    { text: "Second", startTime: 5000 },
    { text: "Third", startTime: 10000 },
    { text: "Fourth", startTime: 15000 },
  ];

  it("returns 0 for time before first line", () => {
    expect(findCurrentLineIndex(lines, -100)).toBe(0);
  });

  it("returns correct index at exact line start", () => {
    expect(findCurrentLineIndex(lines, 5000)).toBe(1);
  });

  it("returns correct index between lines", () => {
    expect(findCurrentLineIndex(lines, 7500)).toBe(1);
  });

  it("returns last index for time after all lines", () => {
    expect(findCurrentLineIndex(lines, 99999)).toBe(3);
  });

  it("returns 0 for empty array", () => {
    expect(findCurrentLineIndex([], 5000)).toBe(0);
  });
});
