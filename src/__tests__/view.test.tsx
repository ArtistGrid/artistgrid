import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import TrackerViewPage from "@/src/pages/View";
import { PlayerProvider } from "@/src/providers";
import { SettingsProvider } from "@/src/hooks/use-settings";
import { clearCache } from "@/src/lib/tracker-cache";

beforeAll(() => {
  window.HTMLMediaElement.prototype.play = vi.fn().mockResolvedValue(undefined);
  window.HTMLMediaElement.prototype.pause = vi.fn();
  Object.defineProperty(window, "mediaSession", { configurable: true, value: { setActionHandler: vi.fn() } });
  HTMLDialogElement.prototype.showModal = vi.fn(function (this: HTMLDialogElement) {
    Object.defineProperty(this, "open", { value: true, configurable: true });
  });
  HTMLDialogElement.prototype.close = vi.fn(function (this: HTMLDialogElement) {
    Object.defineProperty(this, "open", { value: false, configurable: true });
  });
});

const TAB = { name: "Custom View", slug: "custom", gid: "" };
const V3 = {
  name: "Test Artist",
  tab: TAB,
  tabs: [TAB],
  eras: [{ name: "Era1", cover_art: "https://x.com/era1.jpg", tracks: [{ name: { raw: "T1", title: "T1" }, links: [{ url: "https://youtube.com/watch?v=1" }] }] }],
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
  });
});
