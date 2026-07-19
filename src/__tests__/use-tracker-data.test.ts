import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useTrackerData } from "@/src/hooks/use-tracker-data";
import { clearCache } from "@/src/lib/tracker-cache";

function mockFetchOnce(body: unknown, ok = true) {
  globalThis.fetch = vi.fn().mockResolvedValue({
    ok,
    status: ok ? 200 : 500,
    json: async () => body,
    clone: () => ({
      ok,
      status: ok ? 200 : 500,
      text: async () => JSON.stringify(body),
    }),
  }) as unknown as typeof fetch;
}

const TAB = { name: "Custom View", slug: "custom", gid: "" };
const V3_ERAS = {
  name: "Artist",
  tab: TAB,
  tabs: [TAB],
  eras: [{ name: "Era1", cover_art: "https://x.com/era1.jpg", tracks: [{ name: { raw: "T1", title: "T1" }, links: [{ url: "https://youtube.com/watch?v=1" }] }] }],
  era_dates: [],
  credits: "",
};

const V3_FLAT = {
  name: "Artist",
  tab: TAB,
  tabs: [TAB],
  tracks: [{ name: { raw: "T1", title: "T1" }, links: [{ url: "https://youtube.com/watch?v=1" }] }],
  era_dates: [],
  credits: "",
};

const V3_NONETWORK = {
  name: "A",
  tab: TAB,
  tabs: [TAB],
  eras: [{ name: "E", tracks: [{ name: { raw: "T", title: "T" }, links: [{ url: "https://files.example.com/a.mp3" }] }] }],
  era_dates: [],
  credits: "",
};

describe("useTrackerData", () => {
  beforeEach(() => {
    localStorage.clear();
    clearCache();
    clearCache(undefined);
  });

  it("loads era-based tracker data from API", async () => {
    mockFetchOnce(V3_ERAS);
    const setExpandedEras = vi.fn();
    const { result } = renderHook(() => useTrackerData(setExpandedEras));
    await act(async () => {
      await result.current.loadTrackerData("abc123");
    });
    await waitFor(() => expect(result.current.status).toBe("success"));
    expect(result.current.data?.name).toBe("Artist");
    expect(result.current.currentTab).toBe("Custom View");
  });

  it("loads flat tracker data from API", async () => {
    mockFetchOnce(V3_FLAT);
    const { result } = renderHook(() => useTrackerData(vi.fn()));
    await act(async () => {
      await result.current.loadTrackerData("abc123");
    });
    await waitFor(() => expect(result.current.status).toBe("success"));
    expect(result.current.data?.isFlat).toBe(true);
  });

  it("falls back when API errors on main load", async () => {
    mockFetchOnce({}, false);
    const { result } = renderHook(() => useTrackerData(vi.fn()));
    await act(async () => {
      await result.current.loadTrackerData("abc123");
    });
    await waitFor(() => expect(result.current.status).toBe("fallback"));
  });

  it("sets tab error when tab API fails", async () => {
    mockFetchOnce(V3_ERAS);
    const { result } = renderHook(() => useTrackerData(vi.fn()));
    await act(async () => {
      await result.current.loadTrackerData("abc123");
    });
    await waitFor(() => expect(result.current.status).toBe("success"));
    mockFetchOnce({}, false);
    await act(async () => {
      await result.current.loadTrackerData("abc123", "SomeTab");
    });
    await waitFor(() => expect(result.current.tabError).toBe(true));
  });

  it("returns early for virtual tabs", async () => {
    const setExpandedEras = vi.fn();
    const { result } = renderHook(() => useTrackerData(setExpandedEras));
    await act(async () => {
      await result.current.loadTrackerData("abc123", "Favourites");
    });
    expect(result.current.currentTab).toBe("Favourites");
    expect(result.current.status).toBe("idle");
  });

  it("resolves urls for non-network sources", async () => {
    mockFetchOnce(V3_NONETWORK);
    const { result } = renderHook(() => useTrackerData(vi.fn()));
    await act(async () => {
      await result.current.loadTrackerData("abc123");
    });
    await waitFor(() => expect(result.current.status).toBe("success"));
  });
});
