import { describe, it, expect } from "vitest";
import { hashString, getImageFilename, extractTrackerId, artistsEqual, getCleanArtistName } from "../lib/artist-utils";

describe("hashString", () => {
  it("returns a string hash", () => {
    expect(typeof hashString("test")).toBe("string");
  });

  it("returns consistent results", () => {
    expect(hashString("hello")).toBe(hashString("hello"));
  });

  it("returns different results for different inputs", () => {
    expect(hashString("foo")).not.toBe(hashString("bar"));
  });
});

describe("getImageFilename", () => {
  it("lowercases and strips non-alphanumeric", () => {
    expect(getImageFilename("Artist Name!")).toBe("artistname.webp");
  });

  it("preserves numbers", () => {
    expect(getImageFilename("Artist123")).toBe("artist123.webp");
  });
});

describe("extractTrackerId", () => {
  it("extracts from Google Sheets URL", () => {
    const url = "https://docs.google.com/spreadsheets/d/abcdefghijklmnopqrstuvwxyz123456/edit";
    expect(extractTrackerId(url)).toBe("abcdefghijklmnopqrstuvwxyz123456");
  });

  it("extracts from published URL", () => {
    const url = "https://docs.google.com/spreadsheets/d/e/2PACX-xyz123/pubhtml";
    expect(extractTrackerId(url)).toBe("2PACX-xyz123");
  });

  it("returns special IDs directly", () => {
    expect(extractTrackerId("yetracker.net")).toBe("yetracker.net");
    expect(extractTrackerId("https://yetracker.net")).toBe("yetracker.net");
    expect(extractTrackerId("franktracker.net")).toBe("franktracker.net");
  });

  it("returns null for invalid input", () => {
    expect(extractTrackerId("not a url")).toBeNull();
  });

  it("handles bare tracker IDs of any length", () => {
    expect(extractTrackerId("1WkJIdOQZ45qh87XJx8V7vPkEAf4DdV1v")).toBe("1WkJIdOQZ45qh87XJx8V7vPkEAf4DdV1v");
  });

  it("handles bare 44-char tracker IDs", () => {
    const id = "abcdefghijklmnopqrstuvwxyz12345678901234";
    expect(extractTrackerId(id)).toBe(id);
  });

  it("handles bare IDs of any length", () => {
    expect(extractTrackerId("shortid")).toBe("shortid");
    expect(extractTrackerId("a")).toBe("a");
  });

  it("handles domain-like tracker IDs", () => {
    expect(extractTrackerId("example.com")).toBe("example.com");
  });
});

describe("artistsEqual", () => {
  it("returns true for identical arrays", () => {
    const a = [{ name: "A", url: "url1" }, { name: "B", url: "url2" }];
    const b = [{ name: "A", url: "url1" }, { name: "B", url: "url2" }];
    expect(artistsEqual(a as any, b as any)).toBe(true);
  });

  it("returns false for different lengths", () => {
    const a = [{ name: "A", url: "url1" }];
    const b = [{ name: "A", url: "url1" }, { name: "B", url: "url2" }];
    expect(artistsEqual(a as any, b as any)).toBe(false);
  });

  it("returns false for different names", () => {
    const a = [{ name: "A", url: "url1" }];
    const b = [{ name: "B", url: "url1" }];
    expect(artistsEqual(a as any, b as any)).toBe(false);
  });

  it("returns false for different urls", () => {
    const a = [{ name: "A", url: "url1" }];
    const b = [{ name: "A", url: "url2" }];
    expect(artistsEqual(a as any, b as any)).toBe(false);
  });
});

describe("getCleanArtistName", () => {
  it("removes [Alt] suffix", () => {
    expect(getCleanArtistName("Artist Name [Alt]")).toBe("Artist Name");
  });

  it("removes [Alt #2] suffix", () => {
    expect(getCleanArtistName("Artist Name [Alt #2]")).toBe("Artist Name");
  });

  it("trims whitespace", () => {
    expect(getCleanArtistName("  Artist  ")).toBe("Artist");
  });

  it("returns unchanged name without alt suffix", () => {
    expect(getCleanArtistName("Normal Artist")).toBe("Normal Artist");
  });
});
