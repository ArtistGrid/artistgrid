import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";

const storage = vi.hoisted(() => ({ entries: Promise.resolve([] as Array<[string, unknown]>) }));
vi.mock("@/src/lib/indexeddb-cache", () => ({
  idbEntries: () => storage.entries,
  idbSet: async () => {},
  idbDelete: async () => {},
}));

const MAIN = { name: "Main", slug: "main", gid: "1" };
const RECENT = { name: "Recent", slug: "recent", gid: "2" };
function response(name: string, era: string, tab = MAIN, tabs = [MAIN, RECENT]) {
  return new Response(JSON.stringify({ name, tab, tabs, era_dates: [], eras: [{ name: era, tracks: [] }] }));
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((finish) => (resolve = finish));
  return { promise, resolve };
}

beforeEach(() => {
  vi.resetModules();
  localStorage.clear();
  storage.entries = Promise.resolve([]);
});
afterEach(() => vi.unstubAllGlobals());

describe("tracker request ownership at cache and network boundaries", () => {
  it("never publishes a cancelled cold-cache restore while the next API response is pending", async () => {
    const restored = deferred<Array<[string, unknown]>>();
    storage.entries = restored.promise;
    const { useTrackerData } = await import("@/src/hooks/use-tracker-data");
    const next = deferred<Response>();
    vi.stubGlobal(
      "fetch",
      vi.fn(() => next.promise)
    );
    const { result } = renderHook(() => useTrackerData(vi.fn()));
    let first!: Promise<void>;
    let second!: Promise<void>;
    act(() => {
      first = result.current.loadTrackerData("yetracker.net");
    });
    act(() => {
      second = result.current.loadTrackerData("franktracker.net");
    });
    await act(async () => {
      restored.resolve([
        [
          "yetracker.net",
          {
            timestamp: Date.now(),
            resolvedUrls: {},
            data: {
              name: "Kanye West",
              current_tab: "Main",
              tabs: ["Main"],
              eras: { old: { name: "Cached Kanye era" } },
            },
          },
        ],
      ]);
      await first;
    });
    expect(result.current.data).toBeNull();
    expect(result.current.status).toBe("loading");
    await act(async () => {
      next.resolve(response("Frank Ocean", "Frank era"));
      await second;
    });
    expect(Object.values(result.current.data!.eras).map((era) => era.name)).toEqual(["Frank era"]);
  });

  it("discards the previous tracker gid map when entering another tracker's tab", async () => {
    const { useTrackerData } = await import("@/src/hooks/use-tracker-data");
    const frankRecent = { ...RECENT, gid: "90" };
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (url.includes("yetracker.net")) return response("Kanye West", "Kanye era");
        if (url.includes("/tab/recent"))
          return response("Frank Ocean", "Frank recent era", frankRecent, [MAIN, frankRecent]);
        if (url.includes("/gid/2")) return response("Frank Ocean", "Wrong Frank tab");
        return response("Frank Ocean", "Frank main era");
      })
    );
    const expand = vi.fn();
    const { result } = renderHook(() => useTrackerData(expand));
    await act(async () => {
      await result.current.loadTrackerData("yetracker.net");
    });
    await act(async () => {
      await result.current.loadTrackerData("franktracker.net", "recent");
    });
    expect(Object.values(result.current.data!.eras).map((era) => era.name)).toEqual(["Frank recent era"]);
    expect(result.current.currentTab).toBe("Recent");
  });

  it("lets background resolution complete without changing a different tracker's UI state", async () => {
    const { useTrackerData } = await import("@/src/hooks/use-tracker-data");
    const old = deferred<Response>();
    const current = deferred<Response>();
    vi.stubGlobal(
      "fetch",
      vi.fn((url: string) => {
        if (url === "https://imgur.gg/api/file/old") return old.promise;
        if (url === "https://imgur.gg/api/file/current") return current.promise;
        return Promise.resolve(response(url.includes("franktracker") ? "Frank Ocean" : "Kanye West", "Era"));
      })
    );
    const expand = vi.fn();
    const { result } = renderHook(() => useTrackerData(expand));
    await act(async () => {
      await result.current.loadTrackerData("yetracker.net");
    });
    let oldResolution!: Promise<Record<string, string | null>>;
    act(() => {
      oldResolution = result.current.resolveUrls(["https://imgur.gg/f/old"]);
    });
    await act(async () => {
      await result.current.loadTrackerData("franktracker.net");
    });
    let newResolution!: Promise<Record<string, string | null>>;
    act(() => {
      newResolution = result.current.resolveUrls(["https://imgur.gg/f/current"]);
    });
    await act(async () => {
      old.resolve(new Response(JSON.stringify({ mediaType: "audio/mpeg", cdnUrl: "https://media.example/old.mp3" })));
      await oldResolution;
    });
    expect(result.current.resolvedUrls.has("https://imgur.gg/f/old")).toBe(false);
    expect(result.current.isPreloading).toBe(true);
    expect(result.current.resolveProgress).toEqual({ current: 0, total: 1 });
    await act(async () => {
      current.resolve(
        new Response(JSON.stringify({ mediaType: "audio/mpeg", cdnUrl: "https://media.example/current.mp3" }))
      );
      await newResolution;
    });
    expect(result.current.resolvedUrls.get("https://imgur.gg/f/current")).toBe("https://media.example/current.mp3");
    expect(result.current.isPreloading).toBe(false);
  });

  it("owns cancellation for a request started outside the page loading effect", async () => {
    const { useTrackerData } = await import("@/src/hooks/use-tracker-data");
    const cache = await import("@/src/lib/tracker-cache");
    const tab = deferred<Response>();
    let signal!: AbortSignal;
    vi.stubGlobal(
      "fetch",
      vi.fn((url: string, options: RequestInit) => {
        if (url.endsWith("/gid/2")) {
          signal = options.signal!;
          return tab.promise;
        }
        return Promise.resolve(response("Kanye West", "Main era"));
      })
    );
    const expand = vi.fn();
    const { result, unmount } = renderHook(() => useTrackerData(expand));
    await act(async () => {
      await result.current.loadTrackerData("yetracker.net");
    });
    let pending!: Promise<void>;
    act(() => {
      pending = result.current.loadTrackerData("yetracker.net", "recent", "Recent");
    });
    await waitFor(() => expect(signal).toBeDefined());
    unmount();
    expect(signal.aborted).toBe(true);
    tab.resolve(response("Kanye West", "Recent era", RECENT));
    await pending;
    expect(await cache.getCacheAsync("yetracker.net", "2")).toBeNull();
  });
});
