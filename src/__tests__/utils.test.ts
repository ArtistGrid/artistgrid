import { describe, it, expect, beforeEach } from "vitest";
import { cn, TRIPLE_BOOL_YES } from "../../lib/utils";

describe("cn", () => {
  it("merges class names", () => {
    expect(cn("foo", "bar")).toBe("foo bar");
  });

  it("resolves tailwind conflicts", () => {
    expect(cn("px-2 py-1", "px-4")).toBe("py-1 px-4");
  });

  it("handles falsy values", () => {
    expect(cn("foo", false, null, undefined, "")).toBe("foo");
  });

  it("returns empty string for no args", () => {
    expect(cn()).toBe("");
  });
});

describe("TRIPLE_BOOL_YES", () => {
  it("equals 1", () => {
    expect(TRIPLE_BOOL_YES).toBe(1);
  });
});
