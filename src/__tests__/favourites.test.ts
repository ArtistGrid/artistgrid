import { describe, it, expect, beforeEach } from "vitest";
import {
  getFavourites,
  isFavourited,
  toggleFavourite,
  clearFavourites,
  getFavouritedTracks,
  toggleEraFavourite,
  isEraFavourited,
} from "@/src/lib/favourites";
import type { Era, TALeak } from "@/src/types";

const TRACKER_ID = "test-tracker";

const TRACK_1 = { url: "https://example.com/1", name: "Song A" } as TALeak;
const TRACK_2 = { url: "https://example.com/2", name: "Song B" } as TALeak;
const TRACK_3 = { url: "https://example.com/3", name: "Song C" } as TALeak;

const TRACKER_DATA = {
  eras: {
    era1: {
      name: "Era 1",
      data: {
        "https://example.com": [TRACK_1, TRACK_2],
      },
    } as Era,
    era2: {
      name: "Era 2",
      data: {
        "https://example.com": [TRACK_3],
      },
    } as Era,
  },
};

describe("favourites", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe("getFavourites", () => {
    it("returns empty array for unknown tracker", () => {
      expect(getFavourites(TRACKER_ID)).toEqual([]);
    });

    it("returns empty array for corrupted localStorage data", () => {
      localStorage.setItem("artistgrid-favourites_test-tracker", "not-json");
      expect(getFavourites(TRACKER_ID)).toEqual([]);
    });

    it("returns empty array for non-array JSON", () => {
      localStorage.setItem(
        "artistgrid-favourites_test-tracker",
        JSON.stringify("not-an-array")
      );
      expect(getFavourites(TRACKER_ID)).toEqual([]);
    });

    it("returns saved favourites", () => {
      const favs = ["https://example.com/1", "https://example.com/2"];
      localStorage.setItem(
        "artistgrid-favourites_test-tracker",
        JSON.stringify(favs)
      );
      expect(getFavourites(TRACKER_ID)).toEqual(favs);
    });
  });

  describe("isFavourited", () => {
    it("returns false when no favourites exist", () => {
      expect(isFavourited(TRACKER_ID, "https://example.com/1")).toBe(false);
    });

    it("returns true when url is favourited", () => {
      localStorage.setItem(
        "artistgrid-favourites_test-tracker",
        JSON.stringify(["https://example.com/1"])
      );
      expect(isFavourited(TRACKER_ID, "https://example.com/1")).toBe(true);
    });

    it("returns false for different url", () => {
      localStorage.setItem(
        "artistgrid-favourites_test-tracker",
        JSON.stringify(["https://example.com/1"])
      );
      expect(isFavourited(TRACKER_ID, "https://example.com/2")).toBe(false);
    });
  });

  describe("toggleFavourite", () => {
    it("adds url to empty favourites", () => {
      const added = toggleFavourite(TRACKER_ID, "https://example.com/1");
      expect(added).toBe(true);
      expect(getFavourites(TRACKER_ID)).toEqual(["https://example.com/1"]);
    });

    it("removes url from existing favourites", () => {
      toggleFavourite(TRACKER_ID, "https://example.com/1");
      const added = toggleFavourite(TRACKER_ID, "https://example.com/1");
      expect(added).toBe(false);
      expect(getFavourites(TRACKER_ID)).toEqual([]);
    });

    it("preserves order when toggling", () => {
      toggleFavourite(TRACKER_ID, "https://example.com/1");
      toggleFavourite(TRACKER_ID, "https://example.com/2");
      toggleFavourite(TRACKER_ID, "https://example.com/3");
      toggleFavourite(TRACKER_ID, "https://example.com/2");
      expect(getFavourites(TRACKER_ID)).toEqual([
        "https://example.com/1",
        "https://example.com/3",
      ]);
    });
  });

  describe("clearFavourites", () => {
    it("removes all favourites for a tracker", () => {
      toggleFavourite(TRACKER_ID, "https://example.com/1");
      toggleFavourite(TRACKER_ID, "https://example.com/2");
      clearFavourites(TRACKER_ID);
      expect(getFavourites(TRACKER_ID)).toEqual([]);
    });

    it("does not affect other trackers", () => {
      toggleFavourite(TRACKER_ID, "https://example.com/1");
      toggleFavourite("other-tracker", "https://example.com/2");
      clearFavourites(TRACKER_ID);
      expect(getFavourites(TRACKER_ID)).toEqual([]);
      expect(getFavourites("other-tracker")).toEqual([
        "https://example.com/2",
      ]);
    });
  });

  describe("getFavouritedTracks", () => {
    it("returns empty array for empty favourites", () => {
      expect(getFavouritedTracks(TRACKER_DATA, [])).toEqual([]);
    });

    it("returns tracks in chronological era/track order regardless of favourites order", () => {
      const favs = [
        "https://example.com/3",
        "https://example.com/1",
      ];
      const result = getFavouritedTracks(TRACKER_DATA, favs);
      expect(result).toHaveLength(2);
      expect(result[0].track).toBe(TRACK_1);
      expect(result[1].track).toBe(TRACK_3);
    });

    it("skips urls not found in data", () => {
      const favs = [
        "https://example.com/1",
        "https://nonexistent.com/99",
      ];
      const result = getFavouritedTracks(TRACKER_DATA, favs);
      expect(result).toHaveLength(1);
      expect(result[0].track).toBe(TRACK_1);
    });

    it("returns tracks in era order, not user-click order", () => {
      const favs = [
        "https://example.com/2",
        "https://example.com/1",
        "https://example.com/3",
      ];
      const result = getFavouritedTracks(TRACKER_DATA, favs);
      expect(result.map((r) => r.track)).toEqual([TRACK_1, TRACK_2, TRACK_3]);
    });

    it("handles eras with no data", () => {
      const dataWithEmptyEra = {
        eras: {
          empty: { name: "Empty" } as Era,
          full: TRACKER_DATA.eras.era1,
        },
      };
      const favs = ["https://example.com/1"];
      const result = getFavouritedTracks(dataWithEmptyEra, favs);
      expect(result).toHaveLength(1);
      expect(result[0].track).toBe(TRACK_1);
    });

    it("handles eras with non-array tracks", () => {
      const dataWithNonArray = {
        eras: {
          broken: {
            name: "Broken",
            data: {
              "https://example.com": "not-an-array" as unknown as TALeak[],
            },
          } as Era,
        },
      };
      const favs = ["https://example.com/1"];
      const result = getFavouritedTracks(dataWithNonArray, favs);
      expect(result).toEqual([]);
    });
  });

  describe("toggleEraFavourite", () => {
    it("adds all era tracks to favourites", () => {
      const added = toggleEraFavourite(TRACKER_ID, TRACKER_DATA.eras.era1);
      expect(added).toBe(true);
      const favs = getFavourites(TRACKER_ID);
      expect(favs).toContain("https://example.com/1");
      expect(favs).toContain("https://example.com/2");
      expect(favs).toHaveLength(2);
    });

    it("removes all era tracks when already fully favourited", () => {
      toggleFavourite(TRACKER_ID, "https://example.com/1");
      toggleFavourite(TRACKER_ID, "https://example.com/2");
      const added = toggleEraFavourite(TRACKER_ID, TRACKER_DATA.eras.era1);
      expect(added).toBe(false);
      expect(getFavourites(TRACKER_ID)).toEqual([]);
    });

    it("adds missing tracks when partially favourited", () => {
      toggleFavourite(TRACKER_ID, "https://example.com/1");
      const added = toggleEraFavourite(TRACKER_ID, TRACKER_DATA.eras.era1);
      expect(added).toBe(true);
      const favs = getFavourites(TRACKER_ID);
      expect(favs).toContain("https://example.com/1");
      expect(favs).toContain("https://example.com/2");
    });

    it("returns false for era with no tracks", () => {
      const emptyEra = { name: "Empty" } as Era;
      const added = toggleEraFavourite(TRACKER_ID, emptyEra);
      expect(added).toBe(false);
    });
  });

  describe("isEraFavourited", () => {
    it("returns false when no tracks are favourited", () => {
      expect(isEraFavourited(TRACKER_ID, TRACKER_DATA.eras.era1)).toBe(false);
    });

    it("returns true when all tracks are favourited", () => {
      toggleFavourite(TRACKER_ID, "https://example.com/1");
      toggleFavourite(TRACKER_ID, "https://example.com/2");
      expect(isEraFavourited(TRACKER_ID, TRACKER_DATA.eras.era1)).toBe(true);
    });

    it("returns false when only some tracks are favourited", () => {
      toggleFavourite(TRACKER_ID, "https://example.com/1");
      expect(isEraFavourited(TRACKER_ID, TRACKER_DATA.eras.era1)).toBe(false);
    });

    it("returns false for era with no tracks", () => {
      const emptyEra = { name: "Empty" } as Era;
      expect(isEraFavourited(TRACKER_ID, emptyEra)).toBe(false);
    });
  });
});
