import { describe, it, expect, beforeEach } from "vitest";
import { getCache, setCache, clearCache } from "../lib/tracker-cache";
import type { TrackerResponse } from "../types";

const response = (): TrackerResponse => ({
  name: "Artist",
  tabs: [],
  current_tab: "Tab",
  eras: {},
});

describe("tracker-cache", () => {
  beforeEach(async () => {
    clearCache();
    await new Promise((r) => setTimeout(r, 0));
  });

  it("returns null when nothing cached", () => {
    expect(getCache("abc")).toBeNull();
  });

  it("stores and retrieves an entry", () => {
    setCache("abc", response(), { "u1": "r1" });
    const entry = getCache("abc");
    expect(entry).not.toBeNull();
    expect(entry!.resolvedUrls["u1"]).toBe("r1");
  });

  it("merges resolved urls across writes", () => {
    setCache("abc", response(), { "u1": "r1" });
    setCache("abc", response(), { "u2": "r2" });
    const entry = getCache("abc");
    expect(entry!.resolvedUrls).toEqual({ u1: "r1", u2: "r2" });
  });

  it("scopes by tab", () => {
    setCache("abc", response(), {}, "tab1");
    expect(getCache("abc")).toBeNull();
    expect(getCache("abc", "tab1")).not.toBeNull();
  });

  it("clears a single tracker", () => {
    setCache("abc", response(), {});
    clearCache("abc");
    expect(getCache("abc")).toBeNull();
  });
});
