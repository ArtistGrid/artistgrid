import { describe, it, expect } from "vitest";
import { formatBytes } from "@/src/lib/download-utils";
import { formatRelativeTime } from "@/src/lib/view-utils";
describe("formatBytes", () => {
  it("formats bytes and kilobytes", () => {
    expect(formatBytes(0)).toBe("0 B");
    expect(formatBytes(512)).toBe("512 B");
    expect(formatBytes(1024)).toBe("1.0 KB");
    expect(formatBytes(1536)).toBe("1.5 KB");
  });
  it("scales up to MB and GB", () => {
    expect(formatBytes(1024 * 1024)).toBe("1.0 MB");
    expect(formatBytes(12.3 * 1024 * 1024)).toBe("12.3 MB");
    expect(formatBytes(3.5 * 1024 * 1024 * 1024)).toBe("3.5 GB");
  });
  it("handles invalid input", () => {
    expect(formatBytes(-5)).toBe("0 B");
    expect(formatBytes(Number.NaN)).toBe("0 B");
  });
});
describe("formatRelativeTime", () => {
  const secondsAgo = (s: number) => new Date(Date.now() - s * 1000).toISOString();
  it("returns empty string for invalid dates", () => {
    expect(formatRelativeTime("garbage")).toBe("");
  });
  it("handles recent, minutes, hours and days", () => {
    expect(formatRelativeTime(secondsAgo(10))).toBe("just now");
    expect(formatRelativeTime(secondsAgo(120))).toBe("2m ago");
    expect(formatRelativeTime(secondsAgo(3600))).toBe("1h ago");
    expect(formatRelativeTime(secondsAgo(3 * 86400))).toBe("3d ago");
  });
  it("shows months and years", () => {
    expect(formatRelativeTime(secondsAgo(45 * 86400))).toBe("1mo ago");
    expect(formatRelativeTime(secondsAgo(400 * 86400))).toBe("1y ago");
    expect(formatRelativeTime(secondsAgo(730 * 86400))).toBe("2y ago");
  });
  it("uses future tense for dates ahead of now", () => {
    const future = new Date(Date.now() + 3 * 86400 * 1000).toISOString();
    expect(formatRelativeTime(future)).toBe("3d from now");
    const soon = new Date(Date.now() + 30 * 1000).toISOString();
    expect(formatRelativeTime(soon)).toBe("just now");
  });
});
