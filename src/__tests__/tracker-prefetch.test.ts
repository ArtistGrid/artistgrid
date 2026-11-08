import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
type EarlyRequest = { url: string; response: Promise<Response>; controller: AbortController };
const page = window as Window & { __artistgridTrackerRequest?: EarlyRequest };
const endpoint = "/sh/1AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA/";
const url = "https://trackerapi.artistgrid.cx" + endpoint;

beforeEach(() => vi.resetModules());
afterEach(() => {
  delete page.__artistgridTrackerRequest;
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("early tracker request", () => {
  it("consumes the initial download without sending the same request again", async () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    page.__artistgridTrackerRequest = {
      url,
      response: Promise.resolve(new Response('{"eras":[]}')),
      controller: new AbortController(),
    };
    const { fetchWithFallback } = await import("../lib/api");
    expect(await (await fetchWithFallback(endpoint)).json()).toEqual({ eras: [] });
    expect(fetch).not.toHaveBeenCalled();
    expect(page.__artistgridTrackerRequest).toBeUndefined();
  });

  it("uses the ordinary fetch for a different tab", async () => {
    const fetch = vi.fn(async () => new Response('{"eras":[]}'));
    vi.stubGlobal("fetch", fetch);
    page.__artistgridTrackerRequest = {
      url,
      response: Promise.resolve(new Response('{"eras":[]}')),
      controller: new AbortController(),
    };
    const { fetchWithFallback } = await import("../lib/api");
    await fetchWithFallback(endpoint + "tab/recent");
    expect(fetch).toHaveBeenCalledOnce();
  });

  it("cancels the early request when its loader is cancelled", async () => {
    const earlyController = new AbortController();
    const response = new Promise<Response>((_, reject) =>
      earlyController.signal.addEventListener("abort", () => reject(earlyController.signal.reason))
    );
    page.__artistgridTrackerRequest = { url, response, controller: earlyController };
    const { fetchWithFallback } = await import("../lib/api");
    const loader = new AbortController();
    const pending = fetchWithFallback(endpoint, { signal: loader.signal });
    loader.abort();
    await expect(pending).rejects.toThrow();
    expect(earlyController.signal.aborted).toBe(true);
  });

  it("leaves the preload available if a loader is already cancelled", async () => {
    const early = { url, response: Promise.resolve(new Response('{"eras":[]}')), controller: new AbortController() };
    page.__artistgridTrackerRequest = early;
    const { fetchWithFallback } = await import("../lib/api");
    const loader = new AbortController();
    loader.abort();
    await expect(fetchWithFallback(endpoint, { signal: loader.signal })).rejects.toThrow();
    expect(page.__artistgridTrackerRequest).toBe(early);
  });

  it("retries an early network failure through the ordinary request", async () => {
    const rejected = Promise.reject<Response>(new Error("early network failure"));
    rejected.catch(() => {});
    page.__artistgridTrackerRequest = { url, response: rejected, controller: new AbortController() };
    const fetch = vi.fn(async () => new Response('{"eras":[]}'));
    vi.stubGlobal("fetch", fetch);
    const { fetchWithFallback } = await import("../lib/api");
    expect(await (await fetchWithFallback(endpoint)).json()).toEqual({ eras: [] });
    expect(fetch).toHaveBeenCalledOnce();
  });

  it("stops an unused download when cached tracker data is available", async () => {
    const early = { url, response: Promise.resolve(new Response('{"eras":[]}')), controller: new AbortController() };
    page.__artistgridTrackerRequest = early;
    const { discardTrackerPrefetch } = await import("../lib/api");
    discardTrackerPrefetch("1AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA");
    expect(early.controller.signal.aborted).toBe(true);
    expect(page.__artistgridTrackerRequest).toBeUndefined();
  });
});
