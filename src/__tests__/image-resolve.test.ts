import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { extractIbbId, syncImageUrl, resolveImageUrl, toWsrvUrl } from "@/src/lib/image-resolve";

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

  it("syncImageUrl wraps ibb images with wsrv.nl", () => {
    expect(syncImageUrl("https://ibb.co/abc123")).toBe("https://wsrv.nl/?url=https://i.ibb.co/abc123/image.jpg");
    expect(syncImageUrl("https://i.ibb.co/abc123/image.jpg")).toBe("https://wsrv.nl/?url=https://i.ibb.co/abc123/image.jpg");
    expect(syncImageUrl("https://i.ibb.co/abc123/full.png")).toBe("https://wsrv.nl/?url=https://i.ibb.co/abc123/full.png");
    expect(syncImageUrl("https://wsrv.nl/?url=https://i.ibb.co/abc123/full.png")).toBe(
      "https://wsrv.nl/?url=https://i.ibb.co/abc123/full.png"
    );
  });

  it("syncImageUrl handles imgur, raw images and google", () => {
    expect(syncImageUrl("https://imgur.com/xyz789")).toBe("https://i.imgur.com/xyz789.jpg");
    expect(syncImageUrl("https://x.com/a.png")).toBe("https://x.com/a.png");
    expect(syncImageUrl("https://example.com/b.mp4")).toBeNull();
  });

  it("resolveImageUrl uses the oembed endpoint for ibb urls and routes via wsrv.nl", async () => {
    const result = await resolveImageUrl("https://ibb.co/abc123");
    expect(result).toBe("https://wsrv.nl/?url=https://i.ibb.co/abc123/full.png");
    const call = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(call[0]).toContain("ibb.artistgrid.cx/abc123/oembed.json");
  });

  it("resolveImageUrl falls back to i.ibb.co via wsrv.nl when the oembed fetch fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("network");
      })
    );
    const result = await resolveImageUrl("https://ibb.co/def456");
    expect(result).toBe("https://wsrv.nl/?url=https://i.ibb.co/def456/image.jpg");
  });

  it("resolveImageUrl returns raw images without fetching", async () => {
    const result = await resolveImageUrl("https://x.com/a.png");
    expect(result).toBe("https://x.com/a.png");
    expect((globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls.length).toBe(0);
  });

  it("toWsrvUrl does not double wrap wsrv urls", () => {
    expect(toWsrvUrl("https://wsrv.nl/?url=https://i.ibb.co/x.jpg")).toBe("https://wsrv.nl/?url=https://i.ibb.co/x.jpg");
    expect(toWsrvUrl("https://i.ibb.co/x.jpg")).toBe("https://wsrv.nl/?url=https://i.ibb.co/x.jpg");
  });
});
