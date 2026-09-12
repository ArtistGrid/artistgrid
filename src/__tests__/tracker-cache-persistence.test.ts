import { describe, it, expect, vi, beforeEach } from "vitest";
import "fake-indexeddb/auto";
import { idbGet } from "@/src/lib/indexeddb-cache";
async function waitForFlush(key: string, timeoutMs = 2000): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (await idbGet(key)) return;
    await new Promise((r) => setTimeout(r, 10));
  }
  throw new Error(`IDB record "${key}" was never flushed`);
}
describe("tracker-cache IDB persistence", () => {
  beforeEach(async () => {
    vi.resetModules();
    const mod = await import("@/src/lib/tracker-cache");
    mod.clearCache();
    await new Promise((r) => setTimeout(r, 30));
  });
  it("restores an entry written by a previous session", async () => {
    const first = await import("@/src/lib/tracker-cache");
    const response = { name: "Artist", tabs: [], current_tab: "Tab", eras: {} };
    first.setCache("persist-artist-1", response as never, { u1: "r1" });
    await waitForFlush("tc:persist-artist-1");
    vi.resetModules();
    const second = await import("@/src/lib/tracker-cache");
    const restored = await second.getCacheAsync("persist-artist-1");
    expect(restored).not.toBeNull();
    expect(restored!.data.name).toBe("Artist");
    expect(restored!.resolvedUrls).toEqual({ u1: "r1" });
    expect(second.getCache("persist-artist-1")).not.toBeNull();
  });
  it("does not restore expired entries", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      const first = await import("@/src/lib/tracker-cache");
      const response = { name: "Old", tabs: [], current_tab: "Tab", eras: {} };
      first.setCache("stale-tracker-2", response as never, {});
      await vi.advanceTimersByTimeAsync(50);
      await vi.advanceTimersByTimeAsync(1000 * 60 * 11);
      vi.resetModules();
      const second = await import("@/src/lib/tracker-cache");
      const promise = second.getCacheAsync("stale-tracker-2");
      await vi.advanceTimersByTimeAsync(100);
      expect(await promise).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });
  it("keeps per-tab scoping across sessions", async () => {
    const first = await import("@/src/lib/tracker-cache");
    const response = { name: "A", tabs: [], current_tab: "T", eras: {} };
    first.setCache("multi", response as never, {}, "tabX");
    await waitForFlush("tc:multi/tabX");
    vi.resetModules();
    const second = await import("@/src/lib/tracker-cache");
    expect(await second.getCacheAsync("multi")).toBeNull();
    const restored = await second.getCacheAsync("multi", "tabX");
    expect(restored).not.toBeNull();
    expect(restored!.data.name).toBe("A");
  });
});
