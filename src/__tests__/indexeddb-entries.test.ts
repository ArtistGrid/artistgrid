import { describe, it, expect, beforeEach } from "vitest";
import "fake-indexeddb/auto";
import { idbGet, idbSet, idbDelete, idbEntries } from "@/src/lib/indexeddb-cache";
describe("IndexedDB entry enumeration and deletion", () => {
  beforeEach(async () => {
    await idbDelete("tc:a");
    await idbDelete("tc:b");
    await idbDelete("other:c");
  });
  it("idbEntries returns only keys with the given prefix, stripped", async () => {
    await idbSet("tc:a", { v: 1 });
    await idbSet("tc:b", { v: 2 });
    await idbSet("other:c", { v: 3 });
    const entries = await idbEntries<{
      v: number;
    }>("tc:");
    const map = new Map(entries);
    expect(map.get("a")).toEqual({ v: 1 });
    expect(map.get("b")).toEqual({ v: 2 });
    expect(map.has("other:c")).toBe(false);
    expect(entries).toHaveLength(2);
  });
  it("idbEntries returns empty array for unknown prefix", async () => {
    const entries = await idbEntries<unknown>("missing-prefix:");
    expect(entries).toEqual([]);
  });
  it("idbDelete removes a stored record", async () => {
    await idbSet("tc:gone", { v: 9 });
    expect(await idbGet("tc:gone")).toEqual({ v: 9 });
    await idbDelete("tc:gone");
    expect(await idbGet("tc:gone")).toBeNull();
  });
  it("idbDelete is a no-op for missing keys", async () => {
    await expect(idbDelete("never-existed")).resolves.toBeUndefined();
  });
});
