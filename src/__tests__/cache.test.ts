import { describe, it, expect, beforeEach, vi } from "vitest";
import { getCachedData, isCacheExpired, setCachedData } from "../lib/cache";

describe("getCachedData", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("returns null for missing key", () => {
    expect(getCachedData("nonexistent")).toBeNull();
  });

  it("returns parsed data for valid key", () => {
    const data = { data: { foo: "bar" }, timestamp: Date.now() };
    localStorage.setItem("test-key", JSON.stringify(data));
    expect(getCachedData("test-key")).toEqual(data);
  });

  it("returns null for invalid JSON", () => {
    localStorage.setItem("bad-key", "not-json");
    expect(getCachedData("bad-key")).toBeNull();
  });
});

describe("isCacheExpired", () => {
  it("returns true for null cache", () => {
    expect(isCacheExpired(null, 1000)).toBe(true);
  });

  it("returns true for expired cache", () => {
    const cache = { data: "test", timestamp: Date.now() - 2000 };
    expect(isCacheExpired(cache, 1000)).toBe(true);
  });

  it("returns false for fresh cache", () => {
    const cache = { data: "test", timestamp: Date.now() };
    expect(isCacheExpired(cache, 1000)).toBe(false);
  });
});

describe("setCachedData", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("stores data with timestamp", () => {
    setCachedData("key1", { value: 42 });
    const stored = JSON.parse(localStorage.getItem("key1")!);
    expect(stored.data).toEqual({ value: 42 });
    expect(stored.timestamp).toBeTypeOf("number");
  });

  it("overwrites existing data", () => {
    setCachedData("key2", "first");
    setCachedData("key2", "second");
    const stored = JSON.parse(localStorage.getItem("key2")!);
    expect(stored.data).toBe("second");
  });
});
