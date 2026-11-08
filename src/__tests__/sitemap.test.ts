import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { webcrypto } from "node:crypto";
import { buildSitemap, onRequest, SITEMAP_CACHE_KEY, SITEMAP_MAX_AGE } from "../../functions/sitemap.xml.js";

const CSV =
  "name,url,links_work\nKanye West,yetracker.net,1\nDuplicate,https://yetracker.net/,1\nFrank Ocean,franktracker.net,1\nUnavailable,missing.example.net,0\nBad,javascript:alert(1),1";
function cache() {
  const values = new Map<string, string>();
  return {
    values,
    get: vi.fn(async (key: string) => (values.has(key) ? JSON.parse(values.get(key)!) : null)),
    put: vi.fn(async (key: string, value: string) => {
      values.set(key, value);
    }),
  };
}
function context(kv: ReturnType<typeof cache> | undefined, headers = {}, method = "GET") {
  return { request: new Request("https://artistgrid.cx/sitemap.xml", { headers, method }), env: { SEO_CACHE: kv } };
}
function source(csv = CSV) {
  const fetch = vi.fn(async () => new Response(csv));
  vi.stubGlobal("fetch", fetch);
  return fetch;
}
beforeEach(() => vi.stubGlobal("crypto", webcrypto));
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("daily KV sitemap", () => {
  it("builds valid XML with canonical, deduplicated artist URLs and public pages", async () => {
    const kv = cache();
    const fetch = source();
    const response = await onRequest(context(kv));
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toContain("application/xml");
    expect(response.headers.get("X-Sitemap-Cache")).toBe("MISS");
    const xml = await response.text();
    const document = new DOMParser().parseFromString(xml, "application/xml");
    expect(document.querySelector("parsererror")).toBeNull();
    expect([...document.querySelectorAll("loc")].map((node) => node.textContent)).toEqual([
      "https://artistgrid.cx/",
      "https://artistgrid.cx/donate",
      "https://artistgrid.cx/sh/franktracker.net/",
      "https://artistgrid.cx/sh/yetracker.net/",
    ]);
    expect(xml).not.toMatch(/www\.artistgrid|missing\.example|javascript:|<lastmod>|\/main\/|\/view\?/);
    expect(fetch).toHaveBeenCalledOnce();
    expect(kv.put).toHaveBeenCalledWith(SITEMAP_CACHE_KEY, expect.any(String), { expirationTtl: 604800 });
  });

  it("serves KV hits for a day without fetching CSV again", async () => {
    const kv = cache();
    const fetch = source();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-07T12:00:00Z"));
    const first = await (await onRequest(context(kv))).text();
    vi.setSystemTime(Date.now() + SITEMAP_MAX_AGE * 1000 - 1);
    const hit = await onRequest(context(kv));
    expect(hit.headers.get("X-Sitemap-Cache")).toBe("HIT");
    expect(await hit.text()).toBe(first);
    expect(fetch).toHaveBeenCalledOnce();
  });

  it("refreshes expired content and adopts additions from CSV", async () => {
    const kv = cache();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-07T12:00:00Z"));
    const fetch = source();
    const first = await onRequest(context(kv));
    vi.setSystemTime(Date.now() + SITEMAP_MAX_AGE * 1000);
    fetch.mockImplementation(async () => new Response(CSV + "\nNew Artist,new.example.net,1"));
    const refreshed = await onRequest(context(kv));
    expect(refreshed.headers.get("X-Sitemap-Cache")).toBe("MISS");
    expect(await refreshed.text()).toContain("https://artistgrid.cx/sh/new.example.net/");
    expect(refreshed.headers.get("ETag")).not.toBe(first.headers.get("ETag"));
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it.each(["offline", "empty", "malformed"])("retains the last good XML during a %s refresh", async (failure) => {
    const kv = cache();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-07T12:00:00Z"));
    const fetch = source();
    const original = await (await onRequest(context(kv))).text();
    vi.setSystemTime(Date.now() + SITEMAP_MAX_AGE * 1000);
    fetch.mockImplementation(async () => {
      if (failure === "offline") throw new Error("offline");
      return new Response(failure === "empty" ? "name,url\n" : 'name,url\n"broken');
    });
    const response = await onRequest(context(kv));
    expect(response.status).toBe(200);
    expect(response.headers.get("X-Sitemap-Cache")).toBe("STALE");
    expect(await response.text()).toBe(original);
    expect(kv.put).toHaveBeenCalledOnce();
  });

  it("does not mistake an entirely unavailable catalog for an empty CSV response", async () => {
    const kv = cache();
    source("name,url,links_work\nGone Artist,gone.example.net,0");
    const response = await onRequest(context(kv));
    expect(response.status).toBe(200);
    expect(await response.text()).not.toContain("gone.example.net");
  });

  it("includes artist URLs when the source has no availability column", async () => {
    source("name,url\nArtist,artist.example.net");
    expect(await (await onRequest(context(cache()))).text()).toContain("https://artistgrid.cx/sh/artist.example.net/");
  });

  it("supports HEAD and conditional GET without unnecessary cache writes", async () => {
    const kv = cache();
    const fetch = source();
    const first = await onRequest(context(kv));
    const head = await onRequest(context(kv, {}, "HEAD"));
    expect(await head.text()).toBe("");
    expect(head.headers.get("ETag")).toBe(first.headers.get("ETag"));
    const unchanged = await onRequest(context(kv, { "If-None-Match": `W/${first.headers.get("ETag")}` }));
    expect(unchanged.status).toBe(304);
    expect(await unchanged.text()).toBe("");
    expect(fetch).toHaveBeenCalledOnce();
    expect(kv.put).toHaveBeenCalledOnce();
  });

  it("returns a retryable failure when no valid cache or source exists", async () => {
    source("not a CSV");
    const response = await onRequest(context(cache()));
    expect(response.status).toBe(503);
    expect(response.headers.get("Retry-After")).toBe("60");
    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });

  it("fails cleanly for a missing binding and rejects writes to the endpoint", async () => {
    const fetch = source();
    expect((await onRequest(context(undefined))).status).toBe(503);
    const response = await onRequest(context(cache(), {}, "POST"));
    expect(response.status).toBe(405);
    expect(response.headers.get("Allow")).toBe("GET, HEAD");
    expect(fetch).not.toHaveBeenCalled();
  });

  it("does not emit entries for malformed or injected directory URLs", () => {
    expect(buildSitemap([{ url: "</loc><script>bad</script>" }, { url: "/sh/%FF/" }])).not.toContain("<script>");
  });
});
