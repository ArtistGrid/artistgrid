import { describe, it, expect } from "vitest";
import {
  generateTrackId,
  isUrl,
  getTrackUrl,
  getTrackDescription,
  isValidTrackerId,
  encodeTrackForUrl,
  decodeTrackFromUrl,
  getSourceDisplayName,
  TRACKER_ID_LENGTH,
  SUPPORTED_SOURCES,
} from "../lib/track-utils";
import type { TALeak } from "../../src/types";

describe("generateTrackId", () => {
  it("generates a string id starting with tk", () => {
    const id = generateTrackId("https://example.com/song.mp3");
    expect(id).toMatch(/^tk/);
  });

  it("generates consistent ids for same input", () => {
    const url = "https://example.com/song.mp3";
    expect(generateTrackId(url)).toBe(generateTrackId(url));
  });

  it("generates different ids for different inputs", () => {
    expect(generateTrackId("https://a.com")).not.toBe(generateTrackId("https://b.com"));
  });
});

describe("isUrl", () => {
  it("returns true for http URLs", () => {
    expect(isUrl("http://example.com")).toBe(true);
  });

  it("returns true for https URLs", () => {
    expect(isUrl("https://example.com")).toBe(true);
  });

  it("returns false for non-URLs", () => {
    expect(isUrl("not a url")).toBe(false);
  });

  it("returns false for null/undefined", () => {
    expect(isUrl(null)).toBe(false);
    expect(isUrl(undefined)).toBe(false);
  });

  it("returns false for empty string", () => {
    expect(isUrl("")).toBe(false);
  });
});

describe("getTrackUrl", () => {
  it("returns url if it is a valid URL", () => {
    const track: TALeak = { name: "test", url: "https://example.com/song.mp3" };
    expect(getTrackUrl(track)).toBe("https://example.com/song.mp3");
  });

  it("falls back to quality if url is not a URL", () => {
    const track: TALeak = { name: "test", quality: "https://cdn.example.com/song.mp3" };
    expect(getTrackUrl(track)).toBe("https://cdn.example.com/song.mp3");
  });

  it("falls back to available_length", () => {
    const track: TALeak = { name: "test", available_length: "https://cdn.example.com/song.mp3" };
    expect(getTrackUrl(track)).toBe("https://cdn.example.com/song.mp3");
  });

  it("returns null if no valid URL found", () => {
    const track: TALeak = { name: "test" };
    expect(getTrackUrl(track)).toBeNull();
  });

  it("normalizes pillowcase.su to pillows.su", () => {
    const track: TALeak = { name: "test", url: "https://pillowcase.su/f/abc123" };
    expect(getTrackUrl(track)).toBe("https://pillows.su/f/abc123");
  });
});

describe("getTrackDescription", () => {
  it("returns description if present", () => {
    const track: TALeak = { name: "test", description: "a desc" };
    expect(getTrackDescription(track)).toBe("a desc");
  });

  it("falls back to notes", () => {
    const track: TALeak = { name: "test", notes: "some notes" };
    expect(getTrackDescription(track)).toBe("some notes");
  });

  it("falls back to info", () => {
    const track: TALeak = { name: "test", info: "some info" };
    expect(getTrackDescription(track)).toBe("some info");
  });

  it("returns null if nothing", () => {
    const track: TALeak = { name: "test" };
    expect(getTrackDescription(track)).toBeNull();
  });
});

describe("isValidTrackerId", () => {
  it("accepts valid 44-char base64url strings", () => {
    const id = "a".repeat(44);
    expect(isValidTrackerId(id)).toBe(true);
  });

  it("rejects short strings", () => {
    expect(isValidTrackerId("abc")).toBe(false);
  });

  it("rejects strings with invalid chars", () => {
    const id = "a".repeat(43) + "!";
    expect(isValidTrackerId(id)).toBe(false);
  });

  it("accepts 2PACX- prefixed ids", () => {
    expect(isValidTrackerId("2PACX-" + "a".repeat(30))).toBe(true);
  });

  it("accepts special tracker ids", () => {
    expect(isValidTrackerId("yetracker.net")).toBe(true);
    expect(isValidTrackerId("franktracker.net")).toBe(true);
    expect(isValidTrackerId("deftonestracker.net")).toBe(true);
  });

  it("rejects empty/null", () => {
    expect(isValidTrackerId("")).toBe(false);
  });
});

describe("encodeTrackForUrl / decodeTrackFromUrl", () => {
  it("round-trips a URL", () => {
    const url = "https://example.com/path?q=1&a=2";
    const encoded = encodeTrackForUrl(url);
    const decoded = decodeTrackFromUrl(encoded);
    expect(decoded).toBe(url);
  });

  it("produces url-safe base64", () => {
    const encoded = encodeTrackForUrl("https://example.com/test");
    expect(encoded).not.toMatch(/[+/=]/);
  });

  it("returns null for invalid base64", () => {
    expect(decodeTrackFromUrl("!!!invalid!!!")).toBeNull();
  });
});

describe("getSourceDisplayName", () => {
  it("returns correct names for all sources", () => {
    expect(getSourceDisplayName("pillows")).toBe("Pillows");
    expect(getSourceDisplayName("youtube")).toBe("YouTube");
    expect(getSourceDisplayName("soundcloud")).toBe("SoundCloud");
    expect(getSourceDisplayName("unknown")).toBe("Unknown");
  });
});

describe("constants", () => {
  it("TRACKER_ID_LENGTH is 44", () => {
    expect(TRACKER_ID_LENGTH).toBe(44);
  });

  it("SUPPORTED_SOURCES is non-empty", () => {
    expect(SUPPORTED_SOURCES.length).toBeGreaterThan(0);
  });
});
