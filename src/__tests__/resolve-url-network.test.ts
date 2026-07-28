import { describe, it, expect, vi, beforeEach } from "vitest";
import { resolvePlayableUrl, getTrackSource, isNetworkSource } from "@/src/lib/resolve-url";

function mockFetch(body: unknown, ok = true) {
  globalThis.fetch = vi.fn().mockResolvedValue({
    ok,
    status: ok ? 200 : 500,
    json: async () => body,
  }) as unknown as typeof fetch;
}

describe("resolvePlayableUrl network sources", () => {
  beforeEach(() => localStorage.clear());

  it("resolves imgur non-image", async () => {
    mockFetch({ mediaType: "video/mp4", cdnUrl: "https://i.imgur.com/a.mp4" });
    const r = await resolvePlayableUrl("https://imgur.gg/aBcDeF");
    expect(r).toBe("https://i.imgur.com/a.mp4");
  });

  it("returns null for imgur image", async () => {
    mockFetch({ mediaType: "image/png", cdnUrl: "https://i.imgur.com/a.png" });
    const r = await resolvePlayableUrl("https://imgur.gg/aBcDeF");
    expect(r).toBeNull();
  });

  it("resolves soundcloud restream", async () => {
    const r = await resolvePlayableUrl("https://soundcloud.com/artist/track-name");
    expect(r).toBe("https://sc.monochrome.tf/_/restream/artist/track-name");
  });

  it("resolves googledrive", async () => {
    const r = await resolvePlayableUrl("https://drive.google.com/file/d/ABC123def/view");
    expect(r).toBe("https://fuck-unvaulted.artistgrid.cx/gd/ABC123def");
  });

  it("returns null for unknown source", async () => {
    const r = await resolvePlayableUrl("https://example.com/foo");
    expect(r).toBeNull();
  });
});

describe("getTrackSource / isNetworkSource", () => {
  it("classifies sources", () => {
    expect(getTrackSource("https://pillows.su/f/x")).toBe("pillows");
    expect(getTrackSource("https://imgur.gg/x")).toBe("imgur");
    expect(getTrackSource("https://youtube.com/watch?v=x")).toBe("youtube");
  });
  it("identifies network sources", () => {
    expect(isNetworkSource("imgur")).toBe(true);
    expect(isNetworkSource("youtube")).toBe(false);
    expect(isNetworkSource("pillows")).toBe(false);
  });
});
