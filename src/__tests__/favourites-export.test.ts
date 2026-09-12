import { describe, it, expect, beforeEach } from "vitest";
import { toggleFavourite, exportAllFavourites, importFavourites, getFavourites } from "@/src/lib/favourites";
describe("favourites export/import", () => {
  beforeEach(() => {
    localStorage.clear();
  });
  it("exports all trackers with favourites and skips empty ones", () => {
    toggleFavourite("tracker-a", "https://x.com/1");
    toggleFavourite("tracker-b", "https://x.com/2");
    localStorage.setItem("artistgrid-favourites_tracker-c", JSON.stringify([]));
    const data = exportAllFavourites();
    expect(data.version).toBe(1);
    expect(typeof data.exportedAt).toBe("string");
    expect(data.trackers["tracker-a"]).toEqual(["https://x.com/1"]);
    expect(data.trackers["tracker-b"]).toEqual(["https://x.com/2"]);
    expect(data.trackers["tracker-c"]).toBeUndefined();
  });
  it("imports merged favourites and counts only new URLs", () => {
    toggleFavourite("tracker-a", "https://x.com/1");
    const data = {
      version: 1,
      exportedAt: "2026-01-01T00:00:00.000Z",
      trackers: {
        "tracker-a": ["https://x.com/1", "https://x.com/9"],
        "tracker-z": ["https://y.com/1"],
      },
    };
    const added = importFavourites(data, "merge");
    expect(added).toBe(2);
    expect(getFavourites("tracker-a")).toEqual(["https://x.com/1", "https://x.com/9"]);
    expect(getFavourites("tracker-z")).toEqual(["https://y.com/1"]);
  });
  it("replace mode overwrites existing lists", () => {
    toggleFavourite("tracker-a", "https://x.com/old");
    const data = { version: 1, exportedAt: "", trackers: { "tracker-a": ["https://x.com/new"] } };
    expect(importFavourites(data, "replace")).toBe(1);
    expect(getFavourites("tracker-a")).toEqual(["https://x.com/new"]);
  });
  it("returns 0 for malformed payloads without throwing", () => {
    expect(importFavourites(null)).toBe(0);
    expect(importFavourites("nope")).toBe(0);
    expect(importFavourites({})).toBe(0);
    expect(importFavourites({ trackers: [] })).toBe(0);
    expect(importFavourites({ trackers: { t: "not-an-array" } })).toBe(0);
    expect(importFavourites({ trackers: { t: [42, null, "https://ok.com/a"] } })).toBe(1);
  });
});
