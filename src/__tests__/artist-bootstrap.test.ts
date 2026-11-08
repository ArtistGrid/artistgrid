import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchArtistsCsv } from "../lib/artists";

const page = window as Window & { __artistgridArtistsResponse?: Promise<Response> };
afterEach(() => {
  delete page.__artistgridArtistsResponse;
  vi.unstubAllGlobals();
});

describe("artist directory preload", () => {
  it("reuses the initial page download once and fetches fresh data on later requests", async () => {
    page.__artistgridArtistsResponse = Promise.resolve(new Response("name,url\nArtist,artist.example.net"));
    const fetch = vi.fn(async () => new Response("name,url\nNew,new.example.net"));
    vi.stubGlobal("fetch", fetch);
    expect(await fetchArtistsCsv(new AbortController().signal)).toContain("artist.example.net");
    expect(fetch).not.toHaveBeenCalled();
    expect(await fetchArtistsCsv(new AbortController().signal)).toContain("new.example.net");
    expect(fetch).toHaveBeenCalledOnce();
  });
  it("does not consume a preload for an already-cancelled lookup", async () => {
    const preloaded = Promise.resolve(new Response("name,url\nArtist,artist.example.net"));
    page.__artistgridArtistsResponse = preloaded;
    const controller = new AbortController();
    controller.abort();
    await expect(fetchArtistsCsv(controller.signal)).rejects.toThrow();
    expect(page.__artistgridArtistsResponse).toBe(preloaded);
  });
});
