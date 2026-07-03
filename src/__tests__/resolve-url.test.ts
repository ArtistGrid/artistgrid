import { describe, it, expect } from "vitest";
import { getTrackSource, isNetworkSource, normalizePillowsUrl } from "../lib/resolve-url";

describe("normalizePillowsUrl", () => {
  it("converts pillowcase.su to pillows.su", () => {
    expect(normalizePillowsUrl("https://pillowcase.su/f/abc")).toBe("https://pillows.su/f/abc");
  });

  it("leaves pillows.su unchanged", () => {
    expect(normalizePillowsUrl("https://pillows.su/f/abc")).toBe("https://pillows.su/f/abc");
  });

  it("leaves other URLs unchanged", () => {
    expect(normalizePillowsUrl("https://example.com")).toBe("https://example.com");
  });
});

describe("getTrackSource", () => {
  it("identifies pillows URLs", () => {
    expect(getTrackSource("https://pillows.su/f/abc123")).toBe("pillows");
  });

  it("identifies pillowcase.su URLs (normalized)", () => {
    expect(getTrackSource("https://pillowcase.su/f/abc123")).toBe("pillows");
  });

  it("identifies youtube URLs", () => {
    expect(getTrackSource("https://www.youtube.com/watch?v=abc")).toBe("youtube");
  });

  it("identifies youtu.be URLs", () => {
    expect(getTrackSource("https://youtu.be/abc")).toBe("youtube");
  });

  it("identifies krakenfiles URLs", () => {
    expect(getTrackSource("https://krakenfiles.com/view/abc123")).toBe("krakenfiles");
  });

  it("identifies pixeldrain URLs", () => {
    expect(getTrackSource("https://pixeldrain.com/d/abc123")).toBe("pixeldrain");
  });

  it("identifies imgur URLs", () => {
    expect(getTrackSource("https://imgur.gg/f/abc123")).toBe("imgur");
  });

  it("identifies soundcloud URLs", () => {
    expect(getTrackSource("https://soundcloud.com/artist/track")).toBe("soundcloud");
  });

  it("identifies qobuz URLs", () => {
    expect(getTrackSource("https://open.qobuz.com/track/12345")).toBe("qobuz");
  });

  it("identifies froste URLs", () => {
    expect(getTrackSource("https://music.froste.lol/song/abc")).toBe("froste");
  });

  it("identifies juicewrldapi URLs", () => {
    expect(getTrackSource("https://juicewrldapi.com/juicewrld/something")).toBe("juicewrldapi");
  });

  it("identifies yetracker URLs", () => {
    expect(getTrackSource("https://files.yetracker.org/f/abc123")).toBe("yetracker");
  });

  it("returns unknown for unrecognized URLs", () => {
    expect(getTrackSource("https://example.com/file.mp3")).toBe("unknown");
  });
});

describe("isNetworkSource", () => {
  it("returns true for network sources", () => {
    expect(isNetworkSource("krakenfiles")).toBe(true);
    expect(isNetworkSource("imgur")).toBe(true);
    expect(isNetworkSource("qobuz")).toBe(true);
    expect(isNetworkSource("pixeldrain")).toBe(true);
  });

  it("returns false for non-network sources", () => {
    expect(isNetworkSource("pillows")).toBe(false);
    expect(isNetworkSource("youtube")).toBe(false);
    expect(isNetworkSource("soundcloud")).toBe(false);
    expect(isNetworkSource("unknown")).toBe(false);
  });
});
