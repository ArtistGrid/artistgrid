import { describe, it, expect } from "vitest";
import {
  hashString,
  getImageFilename,
  getSheetViewUrl,
  extractTrackerId,
  artistsEqual,
  getCleanArtistName,
  computeDismissalHash,
  isAnnouncementDismissed,
} from "../lib/artist-utils";
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
describe("getSheetViewUrl", () => {
  it("preserves published /spreadsheets/d/e/ URLs", () => {
    const pubUrl = "https://docs.google.com/spreadsheets/d/e/2PACX-12345/pubhtml";
    expect(getSheetViewUrl(pubUrl)).toBe(pubUrl);
  });
  it("extracts sheet ID from standard Google Sheets URL and applies mode", () => {
    const url = "https://docs.google.com/spreadsheets/d/abcdefghijklmnopqrstuvwxyz123456/edit";
    expect(getSheetViewUrl(url, true)).toBe(
      "https://docs.google.com/spreadsheets/d/abcdefghijklmnopqrstuvwxyz123456/htmlview"
    );
    expect(getSheetViewUrl(url, false)).toBe(
      "https://docs.google.com/spreadsheets/d/abcdefghijklmnopqrstuvwxyz123456/edit"
    );
  });
  it("extracts sheet ID from user-partitioned Google Sheets URL", () => {
    const url = "https://docs.google.com/spreadsheets/u/1/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/edit";
    expect(getSheetViewUrl(url)).toBe(
      "https://docs.google.com/spreadsheets/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/htmlview"
    );
  });
  it("builds spreadsheet URL from bare tracker ID without dots", () => {
    expect(getSheetViewUrl("abcdefghijklmnopqrstuvwxyz123456")).toBe(
      "https://docs.google.com/spreadsheets/d/abcdefghijklmnopqrstuvwxyz123456/htmlview"
    );
  });
  it("prepends https to domain-style tracker IDs", () => {
    expect(getSheetViewUrl("tracker.example.com")).toBe("https://tracker.example.com");
    expect(getSheetViewUrl("https://tracker.example.com")).toBe("https://tracker.example.com");
  });
  it("returns original URL for non-matching input", () => {
    expect(getSheetViewUrl("")).toBe("");
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
  it("handles valid full URLs with domain hostname", () => {
    expect(extractTrackerId("https://tracker.subdomain.org/path?query=1")).toBe("tracker.subdomain.org");
  });
  it("returns null for invalid input with special chars", () => {
    expect(extractTrackerId("invalid string with spaces")).toBeNull();
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
    const a = [
      { name: "A", url: "url1" },
      { name: "B", url: "url2" },
    ];
    const b = [
      { name: "A", url: "url1" },
      { name: "B", url: "url2" },
    ];
    expect(artistsEqual(a as any, b as any)).toBe(true);
  });
  it("returns false for different lengths", () => {
    const a = [{ name: "A", url: "url1" }];
    const b = [
      { name: "A", url: "url1" },
      { name: "B", url: "url2" },
    ];
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
describe("announcement dismissal hash", () => {
  it("prefixes a 16-char hex hash with v2:", async () => {
    const hash = await computeDismissalHash("hello");
    expect(hash).toMatch(/^v2:[0-9a-f]{16}$/);
  });
  it("treats any v2: stored hash as dismissed", () => {
    expect(isAnnouncementDismissed("v2:deadbeefdeadbeef", "legacy")).toBe(true);
    expect(isAnnouncementDismissed("legacy", "legacy")).toBe(true);
    expect(isAnnouncementDismissed(null, "legacy")).toBe(false);
    expect(isAnnouncementDismissed("other", "legacy")).toBe(false);
  });
});
