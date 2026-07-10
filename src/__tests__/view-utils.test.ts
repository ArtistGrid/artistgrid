import { describe, it, expect } from "vitest";
import { formatRelativeTime, isVideoUrl, forEachEraTrack, mergeAndCache } from "../lib/view-utils";
import type { Era, TALeak } from "../types";

describe("formatRelativeTime", () => {
  it("returns just now for very recent times", () => {
    const now = new Date().toISOString();
    expect(formatRelativeTime(now)).toBe("just now");
  });

  it("formats minutes", () => {
    const d = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    expect(formatRelativeTime(d)).toBe("5m ago");
  });

  it("formats hours", () => {
    const d = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString();
    expect(formatRelativeTime(d)).toBe("3h ago");
  });

  it("formats days", () => {
    const d = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString();
    expect(formatRelativeTime(d)).toBe("10d ago");
  });

  it("formats months", () => {
    const d = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString();
    expect(formatRelativeTime(d)).toBe("2mo ago");
  });

  it("returns empty string for invalid dates", () => {
    expect(formatRelativeTime("not-a-date")).toBe("");
  });
});

describe("isVideoUrl", () => {
  it("detects mp4", () => {
    expect(isVideoUrl("https://example.com/video.mp4")).toBe(true);
  });
  it("detects webm with query string", () => {
    expect(isVideoUrl("https://example.com/clip.webm?token=abc")).toBe(true);
  });
  it("rejects audio", () => {
    expect(isVideoUrl("https://example.com/song.mp3")).toBe(false);
  });
  it("rejects non-video paths", () => {
    expect(isVideoUrl("https://example.com/image.png")).toBe(false);
  });
});

describe("forEachEraTrack", () => {
  it("iterates over all tracks across eras", () => {
    const eras: Record<string, Era> = {
      "1": { name: "Era1", data: { Default: [{ name: "a" } as TALeak, { name: "b" } as TALeak] } },
      "2": { name: "Era2", data: { Default: [{ name: "c" } as TALeak] } },
    };
    const names: string[] = [];
    forEachEraTrack(eras, (t) => {
      names.push(t.name);
    });
    expect(names).toEqual(["a", "b", "c"]);
  });

  it("stops when callback returns false", () => {
    const eras: Record<string, Era> = {
      "1": { name: "Era1", data: { Default: [{ name: "a" } as TALeak, { name: "b" } as TALeak] } },
    };
    const names: string[] = [];
    forEachEraTrack(eras, (t) => {
      names.push(t.name);
      return false;
    });
    expect(names).toEqual(["a"]);
  });
});
