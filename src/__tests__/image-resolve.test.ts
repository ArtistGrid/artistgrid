import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { extractIbbId, syncImageUrl, resolveImageUrl } from "@/src/lib/image-resolve";

describe("image-resolve", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: true, json: async () => ({ url: "https://i.ibb.co/abc123/full.png" }) }))
    );
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("extracts the ibb id from various urls", () => {
    expect(extractIbbId("https://ibb.co/abc123")).toBe("abc123");
    expect(extractIbbId("https://i.ibb.co/abc123/image.jpg")).toBe("abc123");
    expect(extractIbbId("https://example.com/x")).toBeNull();
  });

  it("syncImageUrl gives the i.ibb.co fallback for ibb", () => {
    expect(syncImageUrl("https://ibb.co/abc123")).toBe("https://i.ibb.co/abc123/image.jpg");
  });

  it("syncImageUrl handles imgur, raw images and google", () => {
    expect(syncImageUrl("https://imgur.com/xyz789")).toBe("https://i.imgur.com/xyz789.jpg");
    expect(syncImageUrl("https://x.com/a.png")).toBe("https://x.com/a.png");
    expect(syncImageUrl("https://example.com/b.mp4")).toBeNull();
  });

  it("resolveImageUrl uses the oembed endpoint for ibb urls", async () => {
    const result = await resolveImageUrl("https://ibb.co/abc123");
    expect(result).toBe("https://i.ibb.co/abc123/full.png");
    const call = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(call[0]).toContain("ibb.artistgrid.cx/abc123/oembed.json");
  });

  it("resolveImageUrl falls back to i.ibb.co when the oembed fetch fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("network");
      })
    );
    const result = await resolveImageUrl("https://ibb.co/def456");
    expect(result).toBe("https://i.ibb.co/def456/image.jpg");
  });

  it("resolveImageUrl returns raw images without fetching", async () => {
    const result = await resolveImageUrl("https://x.com/a.png");
    expect(result).toBe("https://x.com/a.png");
    expect((globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls.length).toBe(0);
  });
});
