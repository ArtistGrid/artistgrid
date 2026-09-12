import { describe, it, expect } from "vitest";
import { getFileExtension } from "@/src/components/download-manager";
describe("getFileExtension", () => {
  it("prefers the content type when provided", () => {
    expect(getFileExtension("https://x.com/file", "audio/mpeg")).toBe("mp3");
    expect(getFileExtension("https://x.com/file.mp3", "audio/mp4")).toBe("m4a");
  });
  it("maps opus content types to .opus", () => {
    expect(getFileExtension("https://x.com/f", "audio/ogg; codecs=opus")).toBe("opus");
    expect(getFileExtension("https://x.com/f", "audio/ogg")).toBe("ogg");
  });
  it("reads the extension from the URL pathname", () => {
    expect(getFileExtension("https://x.com/song.flac?token=abc")).toBe("flac");
    expect(getFileExtension("https://x.com/path/to/track.WAV")).toBe("wav");
    expect(getFileExtension("https://x.com/a/b.m4a")).toBe("m4a");
  });
  it("does not match substrings in the middle of the path", () => {
    expect(getFileExtension("https://x.com/mp3files/song.bin", "application/octet-stream")).toBe("mp3");
  });
  it("falls back to mp3 for unknown extensions and bare URLs", () => {
    expect(getFileExtension("https://x.com/song.xyz")).toBe("mp3");
    expect(getFileExtension("not a url at all")).toBe("mp3");
  });
});
