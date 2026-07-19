import "fake-indexeddb/auto";
import { describe, it, expect, beforeEach } from "vitest";
import { idbGet, idbSet, idbDelete, idbClear } from "@/src/lib/indexeddb-cache";

describe("indexeddb-cache", () => {
  beforeEach(async () => {
    await idbClear();
  });

  it("sets and gets a value", async () => {
    await idbSet("k", { a: 1 });
    const v = await idbGet<{ a: number }>("k");
    expect(v).toEqual({ a: 1 });
  });

  it("returns null for missing key", async () => {
    expect(await idbGet("missing")).toBeNull();
  });

  it("deletes a value", async () => {
    await idbSet("k", 1);
    await idbDelete("k");
    expect(await idbGet("k")).toBeNull();
  });

  it("clears all", async () => {
    await idbSet("a", 1);
    await idbSet("b", 2);
    await idbClear();
    expect(await idbGet("a")).toBeNull();
    expect(await idbGet("b")).toBeNull();
  });
});
