import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const CSV = "name,url\nKanye West,yetracker.net\nFrank Ocean,franktracker.net";
const PAYLOAD = {
  name: "API tracker title",
  tab: { name: "Recent", slug: "recent", gid: "2" },
  eras: [{ name: "Donda", description: "An era", tracks: [{ name: { title: "Hurricane", raw: "Hurricane" } }] }],
};
const DIRECTORY_URL = "https://artists.artistgrid.cx/artists.csv";
const API_PREFIX = "https://trackerapi.artistgrid.cx/sh/";
const ARGS = {
  trackerParam: "kanyewest",
  tabParam: "",
  artistQuery: "",
  requestUrl: "https://artistgrid.cx/sh/kanyewest/",
};

function structuredData(document: Document) {
  return JSON.parse(document.querySelector('script[type="application/ld+json"]')!.textContent!)["@graph"] as {
    "@type": string;
    [key: string]: any;
  }[];
}
function upstream(
  api: (url: string, options: RequestInit) => Response | Promise<Response>,
  directory: () => Response | Promise<Response> = () => new Response(CSV)
) {
  const fetch = vi.fn((url: string, options: RequestInit) => {
    if (url === DIRECTORY_URL) return Promise.resolve(directory());
    if (url.startsWith(API_PREFIX)) return Promise.resolve(api(url, options));
    throw new Error(`Unexpected outbound URL: ${url}`);
  });
  vi.stubGlobal("fetch", fetch);
  return fetch;
}

describe("Pages tracker routing", () => {
  beforeEach(() => vi.resetModules());
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("serves the SPA shell to a browser without fetching the directory or tracker API", async () => {
    const { onRequest } = await import("../../functions/sh/[[catchall]].js");
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    const assets = vi.fn().mockResolvedValue(new Response('<div id="root"></div>'));
    const response = await onRequest({
      request: new Request("https://artistgrid.cx/sh/kanyewest/", { headers: { "User-Agent": "Mozilla/5.0" } }),
      params: { catchall: ["kanyewest"] },
      env: { ASSETS: { fetch: assets } },
    });
    expect(response.status).toBe(200);
    expect(response.headers.get("Location")).toBeNull();
    expect(response.headers.get("Cache-Control")).toContain("no-store");
    expect(response.headers.get("Vary")).toContain("User-Agent");
    expect(await response.text()).toContain('id="root"');
    expect(new URL(assets.mock.calls[0][0].url).pathname).toBe("/");
    expect(fetch).not.toHaveBeenCalled();
  });

  it("uses the same closest-name match for bots and renders a tab without redirecting", async () => {
    const { onRequest } = await import("../../functions/sh/[[catchall]].js");
    const fetch = upstream(() => new Response(JSON.stringify(PAYLOAD)));
    const response = await onRequest({
      request: new Request("https://artistgrid.cx/sh/kanyewset/recent/", { headers: { "User-Agent": "Googlebot" } }),
      params: { catchall: ["kanyewset", "recent"] },
      env: { ASSETS: { fetch: vi.fn() } },
    });
    expect(response.status).toBe(200);
    expect(response.headers.get("Location")).toBeNull();
    expect(fetch).toHaveBeenCalledWith(
      "https://trackerapi.artistgrid.cx/sh/yetracker.net/tab/recent",
      expect.any(Object)
    );
    const html = await response.text();
    expect(html).toContain("<h1>Kanye West Tracker (Recent)</h1>");
    expect(html).toContain("<li>Hurricane</li>");
    const document = new DOMParser().parseFromString(html, "text/html");
    expect(document.querySelector('meta[property="og:image"]')?.getAttribute("content")).toBe(
      "https://assets.artistgrid.cx/webp/kanyewest.webp"
    );
    expect(document.querySelector('meta[name="twitter:image"]')?.getAttribute("content")).toBe(
      "https://assets.artistgrid.cx/webp/kanyewest.webp"
    );
    expect(response.headers.get("Cache-Control")).toContain("no-store");
    expect(response.headers.get("Vary")).toContain("User-Agent");
  });

  it("keeps external track names inert inside HTML and JSON-LD", async () => {
    const { handleBotTrackerRequest } = await import("../../functions/_bot-renderer.js");
    const title = '</script><script>alert("x")</script>';
    upstream(
      () => new Response(JSON.stringify({ ...PAYLOAD, eras: [{ name: "Era", tracks: [{ name: { title } }] }] }))
    );
    const response = await handleBotTrackerRequest({
      trackerParam: "yetracker.net",
      tabParam: "",
      artistQuery: "",
      requestUrl: "https://artistgrid.cx/sh/yetracker.net/",
    });
    const html = await response.text();
    expect(html).not.toContain(title);
    expect(html).toContain("&lt;/script&gt;");
    const json = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)?.[1];
    expect(JSON.parse(json!)["@graph"][1].track[0].name).toBe(title);
  });

  it("links the tracker tabs and artist directory using canonical URLs", async () => {
    const { handleBotTrackerRequest } = await import("../../functions/_bot-renderer.js");
    upstream(
      () =>
        new Response(
          JSON.stringify({
            ...PAYLOAD,
            tabs: [
              { name: "💿 Unreleased", slug: "main" },
              { name: "🆕 Recent", slug: "recent" },
              { name: "📻 Released", slug: "released" },
              { name: "Duplicate Recent", slug: "recent" },
            ],
          })
        )
    );
    const document = new DOMParser().parseFromString(
      await (await handleBotTrackerRequest({ ...ARGS, tabParam: "recent" })).text(),
      "text/html"
    );
    const links = [...document.querySelectorAll('nav[aria-label="Tracker tabs"] a')];
    expect(links.map((link) => link.getAttribute("href"))).toEqual([
      "https://artistgrid.cx/sh/yetracker.net/",
      "https://artistgrid.cx/sh/yetracker.net/recent/",
      "https://artistgrid.cx/sh/yetracker.net/released/",
    ]);
    expect(document.querySelector('nav[aria-label="Breadcrumb"] a')?.getAttribute("href")).toBe(
      "https://artistgrid.cx/"
    );
    expect(document.querySelector('nav[aria-label="Tracker tabs"] a[aria-current="page"]')?.textContent).toBe("Recent");
    expect(document.querySelector('nav[aria-label="More artist trackers"] a')?.getAttribute("href")).toBe(
      "https://artistgrid.cx/sh/franktracker.net/"
    );
    expect(document.querySelector("footer a")?.getAttribute("href")).toBe("https://yetracker.net/");
  });

  it.each(["", "main"])("consolidates the default-tab URL %s", async (tabParam) => {
    const { handleBotTrackerRequest } = await import("../../functions/_bot-renderer.js");
    upstream(() => new Response(JSON.stringify({ ...PAYLOAD, tab: { name: "💿 Unreleased", slug: "main" } })));
    const document = new DOMParser().parseFromString(
      await (await handleBotTrackerRequest({ ...ARGS, tabParam })).text(),
      "text/html"
    );
    expect(document.querySelector('link[rel="canonical"]')?.getAttribute("href")).toBe(
      "https://artistgrid.cx/sh/yetracker.net/"
    );
    expect(structuredData(document).find((node) => node["@type"] === "BreadcrumbList")!.itemListElement).toHaveLength(
      2
    );
  });

  it("uses the API's canonical tab slug and unique released metadata", async () => {
    const { handleBotTrackerRequest } = await import("../../functions/_bot-renderer.js");
    upstream(() => new Response(JSON.stringify({ ...PAYLOAD, tab: { name: "📻 Released", slug: "released" } })));
    const document = new DOMParser().parseFromString(
      await (await handleBotTrackerRequest({ ...ARGS, tabParam: "released-alias" })).text(),
      "text/html"
    );
    const pageUrl = "https://artistgrid.cx/sh/yetracker.net/released/";
    expect(document.title).toBe("Kanye West Released Tracker | ArtistGrid");
    expect(document.querySelectorAll("h1")).toHaveLength(1);
    expect(document.querySelector("h1")?.textContent).toBe("Kanye West Tracker (Released)");
    expect(document.querySelector('meta[name="description"]')?.getAttribute("content")).toContain(
      "released tracker: 1 track across 1 era"
    );
    expect(document.querySelector('meta[name="description"]')?.getAttribute("content")).not.toMatch(
      /unreleased|leaks/i
    );
    expect(document.querySelector('link[rel="canonical"]')?.getAttribute("href")).toBe(pageUrl);
    expect(document.querySelector('meta[property="og:url"]')?.getAttribute("content")).toBe(pageUrl);
    const graph = structuredData(document);
    const page = graph.find((node) => node["@type"] === "CollectionPage")!;
    expect(page.mainEntity["@id"]).toBe(graph[1]["@id"]);
    expect(page.about["@id"]).toBe(graph[0]["@id"]);
    expect(graph[1].track[0].byArtist["@id"]).toBe(graph[0]["@id"]);
    expect(graph.find((node) => node["@type"] === "BreadcrumbList")!.itemListElement).toEqual([
      { "@type": "ListItem", position: 1, name: "Home", item: "https://artistgrid.cx/" },
      { "@type": "ListItem", position: 2, name: "Kanye West Tracker", item: "https://artistgrid.cx/sh/yetracker.net/" },
      { "@type": "ListItem", position: 3, name: "Released", item: pageUrl },
    ]);
  });

  it("renders source-backed notes, dates and credits with matching structured data", async () => {
    const { handleBotTrackerRequest } = await import("../../functions/_bot-renderer.js");
    upstream(
      () =>
        new Response(
          JSON.stringify({
            ...PAYLOAD,
            last_updated: Date.parse("2026-11-06T12:30:00Z") / 1000,
            credits: "Tracker community",
            era_dates: [{ era: "Donda", date: "August 29, 2021", event: "Album released" }],
            eras: [
              {
                name: "Donda",
                timeline: "2020–2021",
                tracks: [
                  {
                    name: { title: "Hurricane" },
                    notes: "An early recording.",
                    track_length: "5:16",
                    quality: "Lossless",
                  },
                ],
              },
            ],
          })
        )
    );
    const document = new DOMParser().parseFromString(await (await handleBotTrackerRequest(ARGS)).text(), "text/html");
    expect(document.querySelector("main")?.textContent).toContain("An early recording.");
    expect(document.querySelector("main")?.textContent).toContain("Length: 5:16 · Quality: Lossless");
    expect(document.querySelector("main")?.textContent).toContain("2020–2021");
    expect(document.querySelector("details")?.textContent).toContain("August 29, 2021: Album released");
    expect(document.querySelector("footer")?.textContent).toContain("Tracker credits: Tracker community");
    expect(document.querySelector("time")?.getAttribute("datetime")).toBe("2026-11-06T12:30:00.000Z");
    const graph = structuredData(document);
    expect(graph[1].track[0]).toMatchObject({ description: "An early recording.", duration: "PT316S" });
    expect(graph.find((node) => node["@type"] === "CollectionPage")!.dateModified).toBe("2026-11-06T12:30:00.000Z");
  });

  it("keeps new metadata fields inert and ignores malformed tab and date records", async () => {
    const { handleBotTrackerRequest } = await import("../../functions/_bot-renderer.js");
    const attack = '</script><script>alert("x")</script>';
    upstream(
      () =>
        new Response(
          JSON.stringify({
            ...PAYLOAD,
            credits: attack,
            last_updated: 1e100,
            tab: { name: "Recent", slug: ".." },
            tabs: [
              null,
              { name: "Broken", slug: ".." },
              { name: "Broken", slug: "\uD800" },
              { name: attack, slug: "safe" },
            ],
            era_dates: [null, { date: {}, era: "Donda", event: attack }, { date: "2021", era: "Donda", event: attack }],
            eras: [
              {
                name: "Donda",
                timeline: attack,
                tracks: [{ name: { title: "Hurricane" }, notes: attack, quality: attack, track_length: "5:99" }],
              },
            ],
          })
        )
    );
    const response = await handleBotTrackerRequest({ ...ARGS, tabParam: "recent" });
    expect(response.status).toBe(200);
    const document = new DOMParser().parseFromString(await response.text(), "text/html");
    expect(document.querySelectorAll("script")).toHaveLength(1);
    expect(document.querySelector("script")?.getAttribute("type")).toBe("application/ld+json");
    expect(document.querySelector("time")).toBeNull();
    expect(document.querySelector('link[rel="canonical"]')?.getAttribute("href")).toBe(
      "https://artistgrid.cx/sh/yetracker.net/recent/"
    );
    expect(document.querySelector("footer")?.textContent).toContain(attack);
    expect(document.querySelector('nav[aria-label="Tracker tabs"]')?.textContent).not.toContain("Broken");
    expect(structuredData(document)[1].track[0].description).toBe(attack);
    expect(structuredData(document)[1].track[0].duration).toBeUndefined();
  });

  it("describes artwork entries as a collection instead of music recordings", async () => {
    const { handleBotTrackerRequest } = await import("../../functions/_bot-renderer.js");
    upstream(() => new Response(JSON.stringify({ ...PAYLOAD, tab: { name: "🖼️ Art", slug: "art" } })));
    const document = new DOMParser().parseFromString(
      await (await handleBotTrackerRequest({ ...ARGS, tabParam: "art" })).text(),
      "text/html"
    );
    const graph = structuredData(document);
    expect(document.querySelector('meta[name="description"]')?.getAttribute("content")).toContain("1 entry");
    expect(document.querySelector('meta[property="og:type"]')?.getAttribute("content")).toBe("website");
    expect(graph.some((node) => node["@type"] === "MusicPlaylist")).toBe(false);
    expect(graph.find((node) => node["@type"] === "ItemList")!.numberOfItems).toBe(1);
  });

  it("keeps the complete HTML tracklist while bounding JSON-LD to 100 recordings", async () => {
    const { handleBotTrackerRequest } = await import("../../functions/_bot-renderer.js");
    upstream(
      () =>
        new Response(
          JSON.stringify({
            ...PAYLOAD,
            eras: [
              {
                name: "Donda",
                tracks: Array.from({ length: 125 }, (_, index) => ({ name: { title: `Track ${index + 1}` } })),
              },
            ],
          })
        )
    );
    const document = new DOMParser().parseFromString(await (await handleBotTrackerRequest(ARGS)).text(), "text/html");
    expect(document.querySelectorAll("main .era > ul > li")).toHaveLength(125);
    expect(structuredData(document)[1].track).toHaveLength(100);
    expect(structuredData(document)[1].numTracks).toBe(125);
  });

  it.each([503, 200])("does not publish indexable schema for an unavailable or empty tracker (%s)", async (status) => {
    const { handleBotTrackerRequest } = await import("../../functions/_bot-renderer.js");
    upstream(() =>
      status === 503 ? new Response("Unavailable", { status }) : new Response(JSON.stringify({ ...PAYLOAD, eras: [] }))
    );
    const response = await handleBotTrackerRequest(ARGS);
    expect(response.status).toBe(status);
    expect(response.headers.get("X-Robots-Tag")).toContain("noindex");
    const document = new DOMParser().parseFromString(await response.text(), "text/html");
    expect(document.querySelector('meta[name="robots"]')?.getAttribute("content")).toBe("noindex, follow");
    expect(document.querySelector('script[type="application/ld+json"]')).toBeNull();
    expect(document.querySelector('link[rel="canonical"]')).toBeNull();
  });

  it.each([400, 401, 403, 404, 410, 422, 429, 503])(
    "preserves metadata and failure status for API HTTP %s",
    async (status) => {
      const { handleBotTrackerRequest } = await import("../../functions/_bot-renderer.js");
      upstream(() => new Response("Unavailable", { status }));
      const response = await handleBotTrackerRequest(ARGS);
      expect(response.status).toBe(status < 500 && status !== 429 ? 404 : 503);
      expect(response.headers.get("Cache-Control")).toContain("no-store");
      expect(response.headers.get("X-Robots-Tag")).toContain("noindex");
      const document = new DOMParser().parseFromString(await response.text(), "text/html");
      expect(document.querySelector("h1")?.textContent?.trim()).toBe("Kanye West Tracker");
      expect(document.title).toContain("Kanye West");
    }
  );

  it("retains fallback HTML after a tracker API rejection", async () => {
    const { handleBotTrackerRequest } = await import("../../functions/_bot-renderer.js");
    upstream(() => Promise.reject(new Error("offline")));
    const response = await handleBotTrackerRequest(ARGS);
    expect(response.status).toBe(503);
    expect(await response.text()).toContain("<h1>Kanye West Tracker");
  });

  it("retains metadata when the API response body stalls past the overall deadline", async () => {
    const { handleBotTrackerRequest } = await import("../../functions/_bot-renderer.js");
    vi.useFakeTimers();
    const cancel = vi.fn();
    upstream(() => new Response(new ReadableStream({ cancel })));
    const pending = handleBotTrackerRequest(ARGS);
    await vi.advanceTimersByTimeAsync(3500);
    const response = await pending;
    expect(response.status).toBe(503);
    expect(await response.text()).toContain("<h1>Kanye West Tracker");
    expect(cancel).toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("does not turn directory downtime into a false artist 404", async () => {
    const { handleBotTrackerRequest } = await import("../../functions/_bot-renderer.js");
    upstream(
      () => new Response(JSON.stringify(PAYLOAD)),
      () => new Response("Offline", { status: 503 })
    );
    const response = await handleBotTrackerRequest(ARGS);
    expect(response.status).toBe(503);
    expect(response.headers.get("X-Robots-Tag")).toContain("noindex");
    expect(await response.text()).toContain("Tracker temporarily unavailable");
  });

  it("bounds a stalled directory and still loads a direct domain within the request budget", async () => {
    const { handleBotTrackerRequest } = await import("../../functions/_bot-renderer.js");
    vi.useFakeTimers();
    upstream(
      () => new Response(JSON.stringify(PAYLOAD)),
      () => new Promise(() => {})
    );
    const pending = handleBotTrackerRequest({ ...ARGS, trackerParam: "yetracker.net", artistQuery: "Kanye West" });
    await vi.advanceTimersByTimeAsync(1500);
    const response = await pending;
    expect(response.status).toBe(200);
    expect(await response.text()).toContain("<li>Hurricane</li>");
    expect(vi.getTimerCount()).toBe(0);
  });

  it("retains old mappings on an empty refresh and adopts the recovered directory immediately", async () => {
    const { handleBotTrackerRequest } = await import("../../functions/_bot-renderer.js");
    vi.useFakeTimers();
    let csv = CSV;
    upstream(
      () => new Response(JSON.stringify(PAYLOAD)),
      () => new Response(csv)
    );
    expect((await handleBotTrackerRequest(ARGS)).status).toBe(200);
    vi.setSystemTime(Date.now() + 3600001);
    csv = "name,url\n";
    const retained = await handleBotTrackerRequest(ARGS);
    expect(retained.status).toBe(200);
    expect(await retained.text()).toContain("/sh/yetracker.net/");
    csv = "name,url\nKanye West,franktracker.net";
    const recovered = await handleBotTrackerRequest(ARGS);
    expect(recovered.status).toBe(200);
    expect(await recovered.text()).toContain("/sh/franktracker.net/");
  });

  it("renders flat songs when eras is empty", async () => {
    const { handleBotTrackerRequest } = await import("../../functions/_bot-renderer.js");
    upstream(() => new Response(JSON.stringify({ ...PAYLOAD, eras: [], tracks: PAYLOAD.eras[0].tracks })));
    const response = await handleBotTrackerRequest(ARGS);
    expect(response.status).toBe(200);
    const html = await response.text();
    expect(html).toContain("<li>Hurricane</li>");
    const json = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)![1];
    expect(JSON.parse(json)["@graph"][1].numTracks).toBe(1);
  });

  it("preserves named eras and accurate counts in flat tracker content", async () => {
    const { handleBotTrackerRequest } = await import("../../functions/_bot-renderer.js");
    upstream(
      () =>
        new Response(
          JSON.stringify({
            ...PAYLOAD,
            eras: [],
            tracks: [
              { name: { title: "Hurricane" }, era: "Donda" },
              { name: { title: "Ghost Town" }, era: "Ye" },
            ],
          })
        )
    );
    const document = new DOMParser().parseFromString(await (await handleBotTrackerRequest(ARGS)).text(), "text/html");
    expect([...document.querySelectorAll("main h2")].map((heading) => heading.textContent)).toEqual(["Donda", "Ye"]);
    expect(document.querySelector('meta[name="description"]')?.getAttribute("content")).toContain(
      "2 tracks across 2 eras"
    );
  });

  it("ignores malformed records while preserving valid titles and raw-name fallbacks", async () => {
    const { handleBotTrackerRequest } = await import("../../functions/_bot-renderer.js");
    upstream(
      () =>
        new Response(
          JSON.stringify({
            ...PAYLOAD,
            name: { invalid: true },
            eras: [
              null,
              {
                name: 123,
                description: {},
                tracks: [
                  null,
                  { name: { title: 123 } },
                  { name: { title: "", raw: "Raw title" } },
                  ...PAYLOAD.eras[0].tracks,
                ],
              },
            ],
          })
        )
    );
    const response = await handleBotTrackerRequest(ARGS);
    expect(response.status).toBe(200);
    const html = await response.text();
    expect(html).toContain("<li>Hurricane</li>");
    expect(html).toContain("<li>Raw title</li>");
    expect(html).not.toContain("[object Object]");
  });

  it.each(["not JSON", JSON.stringify({ error: "Bad response" }), JSON.stringify({ ...PAYLOAD, eras: [null] })])(
    "returns controlled failure for invalid upstream data",
    async (body) => {
      const { handleBotTrackerRequest } = await import("../../functions/_bot-renderer.js");
      upstream(() => new Response(body));
      const response = await handleBotTrackerRequest(ARGS);
      expect(response.status).toBe(502);
      expect(response.headers.get("X-Robots-Tag")).toContain("noindex");
      expect(await response.text()).toContain("Kanye West Tracker");
    }
  );

  it.each(["Mozilla/5.0", "Googlebot/2.1"])("rejects malformed paths before rendering for %s", async (agent) => {
    const { onRequest } = await import("../../functions/sh/[[catchall]].js");
    const fetch = upstream(() => new Response(JSON.stringify(PAYLOAD)));
    const env = { ASSETS: { fetch: vi.fn() } };
    const tooMany = await onRequest({
      request: new Request("https://artistgrid.cx/sh/kanyewest/recent/extra/", { headers: { "User-Agent": agent } }),
      env,
    });
    const malformed = await onRequest({
      request: new Request("https://artistgrid.cx/sh/kanyewest/%FF/", { headers: { "User-Agent": agent } }),
      env,
    });
    expect(tooMany.status).toBe(404);
    expect(malformed.status).toBe(400);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("prefers the CSV artist name over a direct ID's sheet title and query hint", async () => {
    const { handleBotTrackerRequest } = await import("../../functions/_bot-renderer.js");
    const id = "1zqqdIds1iwnx4lh29iF1IlraeuqfGhxH9qLNlWOnryo";
    upstream(
      () => new Response(JSON.stringify({ ...PAYLOAD, name: "Updated Incorrect Artist Tracker" })),
      () => new Response(`name,url\nLil Uzi Vert,${id}`)
    );
    const response = await handleBotTrackerRequest({ ...ARGS, trackerParam: id, artistQuery: "Incorrect artist" });
    expect(response.status).toBe(200);
    const document = new DOMParser().parseFromString(await response.text(), "text/html");
    expect(document.querySelector("h1")?.textContent).toBe("Lil Uzi Vert Tracker (Recent)");
    expect(document.querySelector('meta[property="og:image"]')?.getAttribute("content")).toBe(
      "https://assets.artistgrid.cx/webp/liluzivert.webp"
    );
  });

  it("cleans the sheet title for an ID absent from the CSV", async () => {
    const { handleBotTrackerRequest } = await import("../../functions/_bot-renderer.js");
    const id = "1zqqdIds1iwnx4lh29iF1IlraeuqfGhxH9qLNlWOnryo";
    upstream(() => new Response(JSON.stringify({ ...PAYLOAD, name: "Updated Lil Uzi Vert Tracker 2.0" })));
    const response = await handleBotTrackerRequest({ ...ARGS, trackerParam: id, artistQuery: "Incorrect artist" });
    expect(response.status).toBe(200);
    const document = new DOMParser().parseFromString(await response.text(), "text/html");
    expect(document.querySelector("h1")?.textContent).toBe("Lil Uzi Vert Tracker (Recent)");
    expect(document.title).toContain("Lil Uzi Vert");
    expect(document.title).not.toContain("Updated");
  });
});
