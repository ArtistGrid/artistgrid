import { describe, it, expect, beforeEach } from "vitest";
import "fake-indexeddb/auto";
import { idbGet, idbSet, idbDelete, idbClear } from "../lib/indexeddb-cache";

describe("IndexedDB cache", () => {
  beforeEach(async () => {
    await idbClear();
  });

  it("returns null for missing key", async () => {
    const result = await idbGet("nonexistent");
    expect(result).toBeNull();
  });

  it("stores and retrieves data", async () => {
    await idbSet("key1", { foo: "bar" });
    const result = await idbGet<{ foo: string }>("key1");
    expect(result).toEqual({ foo: "bar" });
  });

  it("overwrites existing data", async () => {
    await idbSet("key2", "first");
    await idbSet("key2", "second");
    const result = await idbGet<string>("key2");
    expect(result).toBe("second");
  });

  it("deletes data", async () => {
    await idbSet("key3", "value");
    await idbDelete("key3");
    const result = await idbGet("key3");
    expect(result).toBeNull();
  });

  it("clears all data", async () => {
    await idbSet("a", 1);
    await idbSet("b", 2);
    await idbClear();
    expect(await idbGet("a")).toBeNull();
    expect(await idbGet("b")).toBeNull();
  });

  it("stores complex objects", async () => {
    const data = {
      eras: [
        { name: "Era 1", tracks: [{ name: "Track 1" }] },
      ],
      resolvedUrls: { "https://example.com": "https://cached.com" },
    };
    await idbSet("complex", data);
    const result = await idbGet<typeof data>("complex");
    expect(result).toEqual(data);
  });

  it("handles multiple independent keys", async () => {
    await idbSet("tracker-1", { id: "t1" });
    await idbSet("tracker-2", { id: "t2" });
    expect(await idbGet("tracker-1")).toEqual({ id: "t1" });
    expect(await idbGet("tracker-2")).toEqual({ id: "t2" });
  });

  it("handles deleting non-existent key without error", async () => {
    await expect(idbDelete("ghost")).resolves.toBeUndefined();
  });

  it("clear does not affect uninserted keys", async () => {
    await idbSet("exists", true);
    await idbClear();
    expect(await idbGet("exists")).toBeNull();
  });
});
