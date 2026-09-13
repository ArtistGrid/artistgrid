import { describe, it, expect } from "vitest";
import Fuse from "fuse.js";
import type { Era, TALeak } from "@/src/types";
import {
  flattenErasForSearch,
  searchTracks,
  FUSE_TRACK_OPTIONS,
  type TrackFuseConstructor,
} from "@/src/lib/track-search";
describe("track-search", () => {
  const t1: TALeak = { name: "Can U Be", extra: "feat. Travis Scott", notes: "Leaked in 2024" };
  const t2: TALeak = { name: "Flashing Lights", extra: "feat. Dwele", description: "Graduation single" };
  const t3: TALeak = { name: "Alien", notes: "God's Country era track" };
  const t4: TALeak = { name: "Heartbreaker", info: "Unreleased snippet" };
  const mockEras: Record<string, Era> = {
    era1: {
      name: "Graduation",
      data: {
        Singles: [t2],
      },
    },
    era2: {
      name: "Yandhi",
      data: {
        Unreleased: [t1, t3],
        Snippets: [t4],
      },
    },
    eraEmpty: {
      name: "Empty Era",
      data: {},
    },
  };
  it("flattens eras into searchable items correctly", () => {
    const items = flattenErasForSearch(mockEras);
    expect(items).toHaveLength(4);
    const canUBe = items.find((i) => i.name === "Can U Be");
    expect(canUBe).toBeDefined();
    expect(canUBe?.extra).toBe("feat. Travis Scott");
    expect(canUBe?.description).toBe("Leaked in 2024");
    expect(canUBe?.eraKey).toBe("era2");
    expect(canUBe?.category).toBe("Unreleased");
  });
  it("handles empty or missing data in flattenErasForSearch", () => {
    expect(flattenErasForSearch({})).toEqual([]);
    expect(flattenErasForSearch({ era1: { name: "test" } as Era })).toEqual([]);
  });
  it("returns empty set when query is empty or whitespace", () => {
    const items = flattenErasForSearch(mockEras);
    expect(searchTracks(items, "").size).toBe(0);
    expect(searchTracks(items, "   ").size).toBe(0);
  });
  it("supports substring matching without Fuse", () => {
    const items = flattenErasForSearch(mockEras);
    const results = searchTracks(items, "flashing");
    expect(results.has(t2)).toBe(true);
    expect(results.size).toBe(1);
    const singleChar = searchTracks(items, "a");
    expect(singleChar.has(t1)).toBe(true);
    expect(singleChar.has(t2)).toBe(true);
    expect(singleChar.has(t3)).toBe(true);
  });
  it("matches against extra and description fields with substring fallback", () => {
    const items = flattenErasForSearch(mockEras);
    const byExtra = searchTracks(items, "travis");
    expect(byExtra.has(t1)).toBe(true);
    const byDesc = searchTracks(items, "graduation single");
    expect(byDesc.has(t2)).toBe(true);
  });
  it("performs fuzzy matching with Fuse.js (typo tolerance)", () => {
    const items = flattenErasForSearch(mockEras);
    const FuseClass = Fuse as unknown as TrackFuseConstructor;
    const fuseInstance = new FuseClass(items, FUSE_TRACK_OPTIONS);
    const typoResults = searchTracks(items, "cann u be", fuseInstance);
    expect(typoResults.has(t1)).toBe(true);
    const typoResults2 = searchTracks(items, "flahsng", fuseInstance);
    expect(typoResults2.has(t2)).toBe(true);
    const typoResults3 = searchTracks(items, "heartbreker", fuseInstance);
    expect(typoResults3.has(t4)).toBe(true);
  });
  it("combines fuzzy and exact substring matches", () => {
    const items = flattenErasForSearch(mockEras);
    const FuseClass = Fuse as unknown as TrackFuseConstructor;
    const fuseInstance = new FuseClass(items, FUSE_TRACK_OPTIONS);
    const exact = searchTracks(items, "Alien", fuseInstance);
    expect(exact.has(t3)).toBe(true);
    const oneChar = searchTracks(items, "h", fuseInstance);
    expect(oneChar.has(t2)).toBe(true);
    expect(oneChar.has(t4)).toBe(true);
  });
});
