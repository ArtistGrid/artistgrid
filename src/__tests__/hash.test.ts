import { describe, it, expect } from "vitest";
import { fastHash } from "@/src/lib/hash";
describe("fastHash", () => {
  it("returns 16 lowercase hex chars", async () => {
    const hash = await fastHash("hello");
    expect(hash).toMatch(/^[0-9a-f]{16}$/);
  });
  it("is consistent for the same input", async () => {
    expect(await fastHash('{"a":1}')).toBe(await fastHash('{"a":1}'));
  });
  it("differs for different inputs", async () => {
    expect(await fastHash('{"a":1}')).not.toBe(await fastHash('{"a":2}'));
  });
});
