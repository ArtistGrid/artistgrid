import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Link, MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { ShTrackerView } from "@/src/App";
import TrackerViewPage from "@/src/pages/View";
import { PlayerProvider } from "@/src/providers";
import { SettingsProvider } from "@/src/hooks/use-settings";
import { clearCache } from "@/src/lib/tracker-cache";
import { ARTISTS_CSV, LOCAL_STORAGE_KEYS } from "@/src/lib/home-constants";
import { getFavourites } from "@/src/lib/favourites";
import { Layout } from "@/src/components/layout";
import { saveCustomViews } from "@/src/lib/custom-views";
import { getCacheAsync } from "@/src/lib/tracker-cache";
import { Toaster } from "@/components/ui/toaster";
const clipboardWrite = vi.fn().mockResolvedValue(undefined);
beforeAll(() => {
  window.HTMLMediaElement.prototype.play = vi.fn().mockResolvedValue(undefined);
  window.HTMLMediaElement.prototype.pause = vi.fn();
  Object.defineProperty(window, "mediaSession", { configurable: true, value: { setActionHandler: vi.fn() } });
  Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: clipboardWrite } });
  HTMLDialogElement.prototype.showModal = vi.fn(function (this: HTMLDialogElement) {
    Object.defineProperty(this, "open", { value: true, configurable: true });
  });
  HTMLDialogElement.prototype.close = vi.fn(function (this: HTMLDialogElement) {
    Object.defineProperty(this, "open", { value: false, configurable: true });
  });
});

const DIRECTORY =
  "name,url\nKanye West,yetracker.net\nFrank Ocean,franktracker.net\nAC/DC,acdctracker.net\nmk.gee,mkgeetracker.net\nKanye West,kwalt.example.net\nKanye West,kwalt2.example.net";
const MAIN_TAB = { name: "Main", slug: "main", gid: "1" };
const RECENT_TAB = { name: "Recent", slug: "recent", gid: "2" };
const TRACK_URL = "https://pillows.su/f/deadbeefdeadbeefdeadbeef";
function trackerResponse(url: string) {
  const frank = url.includes("franktracker.net");
  const wrongFrank = frank && url.includes("/gid/2");
  const recent = url.includes(frank ? "/gid/22" : "/gid/2") || url.includes("/tab/recent");
  const mainTab = frank ? { ...MAIN_TAB, gid: "11" } : MAIN_TAB;
  const recentTab = frank ? { ...RECENT_TAB, gid: "22" } : RECENT_TAB;
  let eraName = "Era1";
  if (wrongFrank) eraName = "Wrong Frank tab";
  else if (frank) eraName = recent ? "Frank Recent Era" : "Frank Era";
  else if (url.includes("kwalt2")) eraName = "Alternate Era";
  else if (recent) eraName = "Recent Era";
  return new Response(
    JSON.stringify({
      ...V3,
      name: "API Tracker Title",
      tab: recent ? recentTab : mainTab,
      tabs: [mainTab, recentTab],
      eras: [
        {
          ...V3.eras[0],
          name: eraName,
          tracks: [{ ...V3.eras[0].tracks[0], links: [{ url: TRACK_URL }] }],
        },
      ],
    }),
    { headers: { "Content-Type": "application/json" } }
  );
}
function mockDirectoryFetch() {
  const fetch = vi.fn(async (url: string) => (url === ARTISTS_CSV ? new Response(DIRECTORY) : trackerResponse(url)));
  globalThis.fetch = fetch as unknown as typeof globalThis.fetch;
  return fetch;
}
function RouteLocation() {
  const location = useLocation();
  return (
    <>
      <output data-testid="route-location">{location.pathname + location.search}</output>
      <Link to="/sh/frankocean/">Open Frank tracker</Link>
      <Link to="/sh/frankocean/recent/">Open Frank recent</Link>
      <Link to="/">Leave tracker</Link>
    </>
  );
}
function routedView(path: string) {
  return (
    <MemoryRouter initialEntries={[path]}>
      <SettingsProvider>
        <PlayerProvider>
          <Routes>
            <Route element={<Layout />}>
              <Route path="/sh/:trackerId/:tabSlug?" element={<ShTrackerView />} />
              <Route path="/view" element={<TrackerViewPage />} />
              <Route path="/" element={<h1>Home test</h1>} />
            </Route>
          </Routes>
          <RouteLocation />
          <Toaster />
        </PlayerProvider>
      </SettingsProvider>
    </MemoryRouter>
  );
}

describe("artist-name tracker routes", () => {
  beforeEach(() => {
    localStorage.clear();
    clearCache();
    clipboardWrite.mockClear();
  });

  it.each(["kanyewest", "kanyewset", "ye", "yetracker.net"])(
    "loads %s using the domain ID without replacing the URL",
    async (slug) => {
      const fetch = mockDirectoryFetch();
      render(routedView(`/sh/${slug}/`));
      await screen.findByRole("heading", { name: "Kanye West" });
      expect(screen.getByTestId("route-location")).toHaveTextContent(`/sh/${slug}/`);
      await waitFor(() =>
        expect(fetch).toHaveBeenCalledWith("https://trackerapi.artistgrid.cx/sh/yetracker.net/", expect.any(Object))
      );
      expect(fetch.mock.calls.some(([url]) => url.includes(`/sh/${slug}/`) && slug !== "yetracker.net")).toBe(false);
    }
  );

  it("keeps the slug across tab changes and share links, with favourites keyed by the resolved ID", async () => {
    const fetch = mockDirectoryFetch();
    render(routedView("/sh/kanyewest/"));
    await screen.findByText("Era1");
    fireEvent.click(screen.getByText("Era1"));
    await screen.findByText("T1");
    fireEvent.click(screen.getByLabelText("Add to favourites"));
    expect(getFavourites("yetracker.net")).toContain(TRACK_URL);
    expect(getFavourites("kanyewest")).toEqual([]);

    fireEvent.click(screen.getByRole("button", { name: "Recent" }));
    await screen.findByText("Recent Era");
    expect(screen.getByTestId("route-location")).toHaveTextContent("/sh/kanyewest/recent");
    expect(fetch).toHaveBeenCalledWith("https://trackerapi.artistgrid.cx/sh/yetracker.net/gid/2", expect.any(Object));
    fireEvent.click(screen.getByLabelText("Share tracker"));
    await waitFor(() => expect(clipboardWrite).toHaveBeenCalledWith(expect.stringContaining("/sh/kanyewest/recent")));

    fireEvent.click(screen.getByRole("button", { name: "Favourites" }));
    await screen.findByText("T1");
    expect(screen.getByTestId("route-location")).toHaveTextContent("/sh/kanyewest?");
    expect(screen.queryByText("No Favourites Yet")).not.toBeInTheDocument();
  });

  it("supports a direct tab URL and the legacy view query without rewriting either", async () => {
    const fetch = mockDirectoryFetch();
    const view = render(routedView("/sh/kanyewest/recent/"));
    await screen.findByText("Recent Era");
    expect(screen.getByTestId("route-location")).toHaveTextContent("/sh/kanyewest/recent/");
    expect(fetch).toHaveBeenCalledWith(
      "https://trackerapi.artistgrid.cx/sh/yetracker.net/tab/recent",
      expect.any(Object)
    );
    view.unmount();

    render(routedView("/view?id=kanyewest"));
    await screen.findByRole("heading", { name: "Kanye West" });
    expect(screen.getByTestId("route-location")).toHaveTextContent("/view?id=kanyewest");
  });

  it("loads domain URLs entered in the tracker input without carrying over the previous artist name", async () => {
    const fetch = mockDirectoryFetch();
    render(routedView("/sh/kanyewest/"));
    await screen.findByRole("heading", { name: "Kanye West" });
    fireEvent.change(screen.getByPlaceholderText("Tracker ID..."), { target: { value: "https://franktracker.net/" } });
    fireEvent.click(screen.getByRole("button", { name: "Load" }));
    await screen.findByRole("heading", { name: "Frank Ocean" });
    expect(screen.getByTestId("route-location")).toHaveTextContent("/sh/franktracker.net/");
    expect(fetch).toHaveBeenCalledWith("https://trackerapi.artistgrid.cx/sh/franktracker.net/", expect.any(Object));
  });

  it("can retry a failed name lookup using Load without navigating away", async () => {
    const fetch = vi.fn(async (url: string) => (url === ARTISTS_CSV ? new Response(DIRECTORY) : trackerResponse(url)));
    fetch.mockRejectedValueOnce(new Error("offline"));
    globalThis.fetch = fetch as unknown as typeof globalThis.fetch;
    render(routedView("/sh/kanyewest/"));
    await screen.findByText("Could not load the artist list. Please try again.");
    fireEvent.click(screen.getByRole("button", { name: "Load" }));
    await screen.findByRole("heading", { name: "Kanye West" });
    expect(screen.getByTestId("route-location")).toHaveTextContent("/sh/kanyewest/");
  });

  it("ignores a late directory lookup after navigating to another artist", async () => {
    let finish!: (value: Response) => void;
    const firstDirectory = new Promise<Response>((resolve) => (finish = resolve));
    let directoryCalls = 0;
    const fetch = vi.fn((url: string) => {
      if (url === ARTISTS_CSV)
        return ++directoryCalls === 1 ? firstDirectory : Promise.resolve(new Response(DIRECTORY));
      return Promise.resolve(trackerResponse(url));
    });
    globalThis.fetch = fetch as unknown as typeof globalThis.fetch;
    render(routedView("/sh/kanyewest/"));
    await waitFor(() => expect(directoryCalls).toBe(1));
    fireEvent.click(screen.getByText("Open Frank tracker"));
    await screen.findByRole("heading", { name: "Frank Ocean" });
    await act(async () => finish(new Response(DIRECTORY)));
    expect(screen.getByTestId("route-location")).toHaveTextContent("/sh/frankocean/");
    expect(fetch.mock.calls.some(([url]) => url.includes("/sh/yetracker.net/"))).toBe(false);
  });

  it("ignores a late tracker response after navigating to another artist", async () => {
    let finish!: (value: Response) => void;
    const firstTracker = new Promise<Response>((resolve) => (finish = resolve));
    const fetch = vi.fn((url: string) => {
      if (url === ARTISTS_CSV) return Promise.resolve(new Response(DIRECTORY));
      if (url.endsWith("/sh/yetracker.net/")) return firstTracker;
      return Promise.resolve(trackerResponse(url));
    });
    globalThis.fetch = fetch as unknown as typeof globalThis.fetch;
    render(routedView("/sh/kanyewest/"));
    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith("https://trackerapi.artistgrid.cx/sh/yetracker.net/", expect.any(Object))
    );
    fireEvent.click(screen.getByText("Open Frank tracker"));
    await screen.findByText("Frank Era");
    await act(async () => finish(trackerResponse("https://trackerapi.artistgrid.cx/sh/yetracker.net/")));
    expect(screen.getByRole("heading", { name: "Frank Ocean" })).toBeInTheDocument();
    expect(screen.queryByText("Era1")).not.toBeInTheDocument();
  });

  it("shows an unknown-name error without requesting that name from the tracker API", async () => {
    const fetch = mockDirectoryFetch();
    render(routedView("/sh/zzzzzzzz/"));
    await screen.findByText('No matching artist found for "zzzzzzzz".');
    expect(fetch.mock.calls.every(([url]) => url === ARTISTS_CSV)).toBe(true);
    expect(screen.getByTestId("route-location")).toHaveTextContent("/sh/zzzzzzzz/");
  });

  it.each([
    ["Frank Ocean", "Frank Ocean", "franktracker.net", "Frank Era"],
    ["AC/DC", "AC/DC", "acdctracker.net", "Era1"],
    ["mk.gee", "mk.gee", "mkgeetracker.net", "Era1"],
    ["Kanye West [Alt #2]", "Kanye West", "kwalt2.example.net", "Alternate Era"],
  ])("submits catalogue name %s through Load", async (input, artist, id, era) => {
    const fetch = mockDirectoryFetch();
    render(routedView("/sh/kanyewest/"));
    await screen.findByText("Era1");
    fireEvent.change(screen.getByPlaceholderText("Tracker ID..."), { target: { value: input } });
    fireEvent.click(screen.getByRole("button", { name: "Load" }));
    await screen.findByRole("heading", { name: artist });
    await screen.findByText(era);
    expect(screen.getByTestId("route-location")).toHaveTextContent(`/sh/${encodeURIComponent(input)}/`);
    expect(fetch).toHaveBeenCalledWith(`https://trackerapi.artistgrid.cx/sh/${id}/`, expect.any(Object));
  });

  it("reopens a published share URL with its artist, tab and query", async () => {
    mockDirectoryFetch();
    render(routedView("/sh/kanyewest/"));
    await screen.findByText("Era1");
    fireEvent.change(screen.getByPlaceholderText("Tracker ID..."), {
      target: { value: "https://artistgrid.cx/sh/frankocean/recent/?artist=Frank%20Ocean" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Load" }));
    await screen.findByText("Frank Recent Era");
    expect(screen.getByTestId("route-location")).toHaveTextContent("/sh/frankocean/recent/?artist=Frank%20Ocean");
  });

  it("retries an unchanged whitespace-padded route without normalizing the address", async () => {
    const fetch = vi.fn(async (url: string) => (url === ARTISTS_CSV ? new Response(DIRECTORY) : trackerResponse(url)));
    fetch.mockRejectedValueOnce(new Error("offline"));
    globalThis.fetch = fetch as unknown as typeof globalThis.fetch;
    render(routedView("/sh/%20kanyewest%20/"));
    await screen.findByText("Could not load the artist list. Please try again.");
    fireEvent.click(screen.getByRole("button", { name: "Load" }));
    await screen.findByText("Era1");
    expect(screen.getByTestId("route-location")).toHaveTextContent("/sh/%20kanyewest%20/");
  });

  it("rejects malformed Unicode input with feedback rather than throwing or navigating", async () => {
    const fetch = mockDirectoryFetch();
    render(routedView("/sh/kanyewest/"));
    await screen.findByText("Era1");
    const calls = fetch.mock.calls.length;
    fireEvent.change(screen.getByPlaceholderText("Tracker ID..."), { target: { value: "Frank\uD800Ocean" } });
    fireEvent.click(screen.getByRole("button", { name: "Load" }));
    await screen.findByText("Invalid input");
    expect(screen.getByTestId("route-location")).toHaveTextContent("/sh/kanyewest/");
    expect(fetch.mock.calls.length).toBe(calls);
  });

  it("does not reuse another artist's tab gid when navigating directly to a tab", async () => {
    mockDirectoryFetch();
    render(routedView("/sh/kanyewest/"));
    await screen.findByText("Era1");
    fireEvent.click(screen.getByText("Open Frank recent"));
    await screen.findByText("Frank Recent Era");
    expect(screen.queryByText("Wrong Frank tab")).not.toBeInTheDocument();
  });

  it("loads persisted custom views through the resolved identifier", async () => {
    saveCustomViews("yetracker.net", [{ id: "saved", name: "Saved mix", tabs: ["Main"] }]);
    mockDirectoryFetch();
    render(routedView("/sh/kanyewest/"));
    await screen.findByText("Era1");
    fireEvent.click(screen.getByRole("button", { name: "Custom" }));
    await screen.findByText("Select a Custom View");
    expect(screen.queryByText("No Custom Views")).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /Select a Custom View/ }));
    expect(await screen.findByRole("menuitem", { name: /Saved mix/ })).toBeInTheDocument();
  });

  it.each(["Favourites", "Custom"])("preserves %s against a late physical-tab response", async (tab) => {
    let finish!: (response: Response) => void;
    let pendingSignal!: AbortSignal;
    const fetch = vi.fn((url: string, options?: RequestInit) => {
      if (url === ARTISTS_CSV) return Promise.resolve(new Response(DIRECTORY));
      if (url.endsWith("/gid/2")) {
        pendingSignal = options!.signal!;
        return new Promise<Response>((resolve) => (finish = resolve));
      }
      return Promise.resolve(trackerResponse(url));
    });
    globalThis.fetch = fetch as unknown as typeof globalThis.fetch;
    render(routedView("/sh/kanyewest/"));
    await screen.findByText("Era1");
    fireEvent.click(screen.getByRole("button", { name: "Recent" }));
    await waitFor(() => expect(pendingSignal).toBeDefined());
    fireEvent.click(screen.getByRole("button", { name: tab }));
    await screen.findByText(tab === "Favourites" ? "No Favourites Yet" : "No Custom Views");
    expect(pendingSignal.aborted).toBe(true);
    await act(async () => finish(trackerResponse("https://trackerapi.artistgrid.cx/sh/yetracker.net/gid/2")));
    expect(screen.getByRole("button", { name: tab }).className).toContain("bg-white");
    expect(screen.queryByText("Recent Era")).not.toBeInTheDocument();
    expect(screen.getByTestId("route-location")).not.toHaveTextContent("/recent");
  });

  it("cancels handler-started requests on unmount without persisting the late tab", async () => {
    let finish!: (response: Response) => void;
    let pendingSignal!: AbortSignal;
    const fetch = vi.fn((url: string, options?: RequestInit) => {
      if (url === ARTISTS_CSV) return Promise.resolve(new Response(DIRECTORY));
      if (url.endsWith("/gid/2")) {
        pendingSignal = options!.signal!;
        return new Promise<Response>((resolve) => (finish = resolve));
      }
      return Promise.resolve(trackerResponse(url));
    });
    globalThis.fetch = fetch as unknown as typeof globalThis.fetch;
    render(routedView("/sh/kanyewest/"));
    await screen.findByText("Era1");
    fireEvent.click(screen.getByRole("button", { name: "Recent" }));
    await waitFor(() => expect(pendingSignal).toBeDefined());
    fireEvent.click(screen.getByText("Leave tracker"));
    await screen.findByRole("heading", { name: "Home test" });
    expect(pendingSignal.aborted).toBe(true);
    await act(async () => finish(trackerResponse("https://trackerapi.artistgrid.cx/sh/yetracker.net/gid/2")));
    expect(await getCacheAsync("yetracker.net", "2")).toBeNull();
  });

  it.each(["demos/leaks", "100%", "phase?1", "phase#1"])(
    "opens and shares encoded tab %s through the production route",
    async (slug) => {
      const encoded = { name: "Encoded", slug, gid: "3" };
      const fetch = vi.fn(async (url: string) => {
        if (url === ARTISTS_CSV) return new Response(DIRECTORY);
        const selected = url.endsWith("/gid/3") || url.endsWith(`/tab/${encodeURIComponent(slug)}`);
        return new Response(
          JSON.stringify({
            ...V3,
            tab: selected ? encoded : MAIN_TAB,
            tabs: [MAIN_TAB, encoded],
            eras: [
              {
                ...V3.eras[0],
                name: selected ? "Encoded Era" : "Era1",
                tracks: [{ ...V3.eras[0].tracks[0], links: [{ url: TRACK_URL }] }],
              },
            ],
          })
        );
      });
      globalThis.fetch = fetch as unknown as typeof globalThis.fetch;
      render(routedView("/sh/kanyewest/"));
      await screen.findByText("Era1");
      fireEvent.click(screen.getByRole("button", { name: "Encoded" }));
      await screen.findByText("Encoded Era");
      const path = `/sh/kanyewest/${encodeURIComponent(slug)}`;
      expect(screen.getByTestId("route-location")).toHaveTextContent(path);
      fireEvent.click(screen.getByLabelText("Share tracker"));
      await waitFor(() => expect(clipboardWrite).toHaveBeenCalled());
      expect(new URL(clipboardWrite.mock.calls.at(-1)![0]).pathname).toBe(path);
      clipboardWrite.mockClear();
      fireEvent.click(screen.getByText("Encoded Era"));
      await screen.findByText("T1");
      await userEvent.click(screen.getByLabelText("Track actions"));
      fireEvent.click(screen.getByRole("menuitem", { name: /Share Track/i }));
      await waitFor(() => expect(clipboardWrite).toHaveBeenCalled());
      const shared = new URL(clipboardWrite.mock.calls.at(-1)![0]);
      expect(shared.pathname).toBe(path);
      expect(shared.hash).toBe("");
      expect(shared.searchParams.get("track")).toBeTruthy();
    }
  );

  it("renders usable tracks when an unlisted tracker has an invalid API name", async () => {
    globalThis.fetch = vi.fn(async (url: string) =>
      url === ARTISTS_CSV ? new Response(DIRECTORY) : new Response(JSON.stringify({ ...V3, name: { invalid: true } }))
    ) as unknown as typeof globalThis.fetch;
    render(routedView("/sh/unlisted.example.net/"));
    await screen.findByText("Era1");
    expect(screen.getByRole("heading", { name: "Unknown Artist" })).toBeInTheDocument();
  });

  it("handles tracker 404s without clearing the directory or reloading the document", async () => {
    globalThis.fetch = vi.fn(async (url: string) =>
      url === ARTISTS_CSV ? new Response(DIRECTORY) : new Response("Missing tracker", { status: 404 })
    ) as unknown as typeof globalThis.fetch;
    render(routedView("/sh/yetracker.net/"));
    await screen.findByText(/Unable to Load Tracker/i);
    expect(localStorage.getItem(LOCAL_STORAGE_KEYS.CSV_CACHE_LOCAL)).not.toBeNull();
    expect(screen.getByTestId("route-location")).toHaveTextContent("/sh/yetracker.net/");
  });

  it.each(["", "?artist=Incorrect%20artist"])("uses CSV naming for a direct Sheet ID%s", async (query) => {
    const id = "1zqqdIds1iwnx4lh29iF1IlraeuqfGhxH9qLNlWOnryo";
    globalThis.fetch = vi.fn(async (url: string) =>
      url === ARTISTS_CSV
        ? new Response(`name,url\nLil Uzi Vert,${id}`)
        : new Response(JSON.stringify({ ...V3, name: "Updated Incorrect Artist Tracker" }))
    ) as unknown as typeof fetch;
    const path = `/sh/${id}/${query}`;
    render(routedView(path));
    await screen.findByText("Era1");
    expect(screen.getByRole("heading", { name: "Lil Uzi Vert" })).toBeInTheDocument();
    expect(document.title).toBe("Lil Uzi Vert Custom View Tracker | ArtistGrid");
    expect(screen.getByTestId("route-location")).toHaveTextContent(path);
  });

  it("uses a cleaned sheet title when the direct ID has no CSV entry", async () => {
    const id = "1zqqdIds1iwnx4lh29iF1IlraeuqfGhxH9qLNlWOnryo";
    globalThis.fetch = vi.fn(async (url: string) =>
      url === ARTISTS_CSV
        ? new Response(DIRECTORY)
        : new Response(JSON.stringify({ ...V3, name: "Updated Lil Uzi Vert Tracker 2.0" }))
    ) as unknown as typeof fetch;
    render(routedView(`/sh/${id}/?artist=Incorrect%20artist`));
    await screen.findByText("Era1");
    expect(screen.getByRole("heading", { name: "Lil Uzi Vert" })).toBeInTheDocument();
    expect(document.title).toBe("Lil Uzi Vert Custom View Tracker | ArtistGrid");
    expect(screen.getByTestId("route-location")).toHaveTextContent(`/sh/${id}/`);
  });
});
const TAB = { name: "Custom View", slug: "custom", gid: "" };
const V3 = {
  name: "Test Artist",
  tab: TAB,
  tabs: [TAB],
  eras: [
    {
      name: "Era1",
      cover_art: "https://x.com/era1.jpg",
      tracks: [{ name: { raw: "T1", title: "T1" }, links: [{ url: "https://youtube.com/watch?v=1" }] }],
    },
  ],
  era_dates: [],
  credits: "",
};
function mockFetch(body: unknown, ok = true) {
  globalThis.fetch = vi.fn().mockResolvedValue({
    ok,
    status: ok ? 200 : 500,
    json: async () => body,
    text: async () => JSON.stringify(body),
    clone: () => ({ ok, status: ok ? 200 : 500, text: async () => JSON.stringify(body) }),
  }) as unknown as typeof fetch;
}
function wrap(ui: React.ReactNode) {
  return (
    <MemoryRouter>
      <SettingsProvider>
        <PlayerProvider>{ui}</PlayerProvider>
      </SettingsProvider>
    </MemoryRouter>
  );
}
describe("TrackerViewPage", () => {
  beforeEach(() => {
    localStorage.clear();
    clearCache();
    clearCache(undefined);
    mockFetch(V3);
  });
  it("loads and renders eras", async () => {
    render(wrap(<TrackerViewPage trackerId="abc123def456ghi789jklmno" />));
    await waitFor(() => expect(screen.getByText("Era1")).toBeInTheDocument());
    expect(screen.getByText(/songs?/)).toBeInTheDocument();
  });
  it("expands an era and renders its track", async () => {
    render(wrap(<TrackerViewPage trackerId="abc123def456ghi789jklmno" />));
    await waitFor(() => expect(screen.getByText("Era1")).toBeInTheDocument());
    fireEvent.click(screen.getByText("Era1"));
    await waitFor(() => expect(screen.getByText("T1")).toBeInTheDocument());
  });
  it("shows the loading skeleton before data arrives", async () => {
    let resolveFetch: (v: unknown) => void = () => {};
    globalThis.fetch = vi.fn().mockReturnValue(
      new Promise((res) => {
        resolveFetch = res;
      })
    ) as unknown as typeof fetch;
    render(wrap(<TrackerViewPage trackerId="abc123def456ghi789jklmno" />));
    expect(screen.getByText(/Loading tracker data/i)).toBeInTheDocument();
    await act(async () => {
      resolveFetch({
        ok: true,
        status: 200,
        json: async () => V3,
        text: async () => JSON.stringify(V3),
        clone: () => ({ ok: true, status: 200, text: async () => JSON.stringify(V3) }),
      });
    });
    await waitFor(() => expect(screen.getByText("Era1")).toBeInTheDocument());
  });
  it("shows an error state when the fetch fails", async () => {
    mockFetch({ error: "boom" }, false);
    render(wrap(<TrackerViewPage trackerId="abc123def456ghi789jklmno" />));
    await waitFor(() => expect(screen.getByText(/Unable to Load Tracker/i)).toBeInTheDocument(), { timeout: 2000 });
  });
  it("filters tracks by the search query", async () => {
    render(wrap(<TrackerViewPage trackerId="abc123def456ghi789jklmno" />));
    await waitFor(() => expect(screen.getByText("Era1")).toBeInTheDocument());
    fireEvent.click(screen.getByText("Era1"));
    await waitFor(() => expect(screen.getByText("T1")).toBeInTheDocument());
    fireEvent.change(screen.getByPlaceholderText("Search tracks..."), { target: { value: "zzzznotfound" } });
    expect((screen.getByPlaceholderText("Search tracks...") as HTMLInputElement).value).toBe("zzzznotfound");
    fireEvent.change(screen.getByPlaceholderText("Search tracks..."), { target: { value: "T1" } });
    expect((screen.getByPlaceholderText("Search tracks...") as HTMLInputElement).value).toBe("T1");
    const clearBtn = screen.getByLabelText("Clear search");
    expect(clearBtn).toBeInTheDocument();
    fireEvent.click(clearBtn);
    expect((screen.getByPlaceholderText("Search tracks...") as HTMLInputElement).value).toBe("");
  });
});
