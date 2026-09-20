import { describe, it, expect, beforeEach } from "vitest";
import fc from "fast-check";
import { formatBytes, getFileExtension } from "@/src/lib/download-utils";
import { importFavourites, getFavourites } from "@/src/lib/favourites";
const AUDIO_EXTENSIONS = ["mp3", "m4a", "ogg", "wav", "flac", "opus", "aac", "weba", "webm"] as const;
const httpUrl = fc.string({ maxLength: 8 }).map((s) => `https://host/${s}`);
const AUDIO_SET = new Set<string>(AUDIO_EXTENSIONS);
describe("formatBytes", () => {
  it("returns a unit-bearing string for any non-negative integer byte count", () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 10 ** 15 }), (bytes) => {
        expect(formatBytes(bytes)).toMatch(/^\d+(\.\d+)? (B|KB|MB|GB|TB)$/);
      })
    );
  });
  it("treats negative and non-finite input as zero", () => {
    expect(formatBytes(-5)).toBe("0 B");
    expect(formatBytes(Number.NaN)).toBe("0 B");
    expect(formatBytes(0)).toBe("0 B");
  });
});
describe("getFileExtension", () => {
  it("recognises known audio extensions", () => {
    fc.assert(
      fc.property(fc.constantFrom(...AUDIO_EXTENSIONS), (ext) => {
        expect(getFileExtension(`https://host/track.${ext}`)).toBe(ext);
      })
    );
  });
  it("falls back to mp3 for unknown extensions", () => {
    expect(getFileExtension("https://host/track.xyz")).toBe("mp3");
    expect(getFileExtension("https://host/track")).toBe("mp3");
  });
  it("only honours extensions present in the audio set", () => {
    fc.assert(
      fc.property(fc.string(), (ext) => {
        const result = getFileExtension(`https://host/track.${ext}`);
        if (AUDIO_SET.has(ext.toLowerCase())) {
          expect(result).toBe(ext.toLowerCase());
        } else {
          expect(result).toBe("mp3");
        }
      })
    );
  });
});
describe("importFavourites", () => {
  beforeEach(() => {
    localStorage.clear();
  });
  it("counts every distinct url when merging into empty storage", () => {
    fc.assert(
      fc.property(fc.dictionary(fc.string({ minLength: 1 }), fc.array(httpUrl)), (trackers) => {
        localStorage.clear();
        const expected = Object.values(trackers).reduce((acc, urls) => acc + new Set(urls).size, 0);
        const added = importFavourites({ trackers }, "merge");
        expect(added).toBe(expected);
        for (const [id, urls] of Object.entries(trackers)) {
          const stored = getFavourites(id);
          for (const u of new Set(urls)) expect(stored).toContain(u);
        }
      })
    );
  });
  it("replaces existing lists and counts every url", () => {
    fc.assert(
      fc.property(fc.dictionary(fc.string({ minLength: 1 }), fc.array(httpUrl)), (trackers) => {
        localStorage.clear();
        const expected = Object.values(trackers).reduce((acc, urls) => acc + urls.length, 0);
        const added = importFavourites({ trackers }, "replace");
        expect(added).toBe(expected);
      })
    );
  });
});
