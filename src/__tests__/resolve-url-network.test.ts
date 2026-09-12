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
  it("resolves exoshare using first file id", async () => {
    mockFetch({
      id: "6ro0Jx6vhCOmGHO",
      files: [
        { id: "b096076a-6b0f-4581-8799-ed508440f085", name: "song.mp3" },
        { id: "second-file-id", name: "cover.jpg" },
      ],
    });
    const r = await resolvePlayableUrl("https://exoshare.org/share/6ro0Jx6vhCOmGHO");
    expect(r).toBe(
      "https://fuck-unvaulted.artistgrid.cx/exo/6ro0Jx6vhCOmGHO/files/b096076a-6b0f-4581-8799-ed508440f085"
    );
  });
  it("returns null for exoshare if fetch fails or files are empty", async () => {
    mockFetch(null, false);
    const r1 = await resolvePlayableUrl("https://exoshare.org/share/6ro0Jx6vhCOmGHO");
    expect(r1).toBeNull();

    mockFetch({ id: "6ro0Jx6vhCOmGHO", files: [] });
    const r2 = await resolvePlayableUrl("https://exoshare.org/share/6ro0Jx6vhCOmGHO");
    expect(r2).toBeNull();
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
