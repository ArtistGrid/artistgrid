import "fake-indexeddb/auto";
import { describe, it, expect } from "vitest";
import { idbGet, idbSet } from "@/src/lib/indexeddb-cache";

describe("indexeddb-cache", () => {
  it("sets and gets a value", async () => {
    await idbSet("k", { a: 1 });
    const v = await idbGet<{ a: number }>("k");
    expect(v).toEqual({ a: 1 });
  });

  it("returns null for missing key", async () => {
    expect(await idbGet("missing")).toBeNull();
  });
});
