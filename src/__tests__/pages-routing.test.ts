// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { spawn, type ChildProcess } from "node:child_process";
import { copyFile, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "../..");
let directory: string;
let server: ChildProcess;
let origin: string;
let logs = "";

const outboundFixtures = `
const csv = 'name,url\\nKanye West,yetracker.net\\nFlat Artist,flat.example.net\\nMissing Artist,missing.example.net\\nOutage Artist,outage.example.net\\nSlow Artist,slow.example.net\\nLil Uzi Vert,1zqqdIds1iwnx4lh29iF1IlraeuqfGhxH9qLNlWOnryo';
globalThis.fetch = async (input, options = {}) => {
  const url = typeof input === 'string' ? input : input.url;
  if (url === 'https://artists.artistgrid.cx/artists.csv') return new Response(csv);
  if (!url.startsWith('https://trackerapi.artistgrid.cx/sh/')) throw new Error('Unexpected outbound URL: ' + url);
  const pathname = new URL(url).pathname;
  if (pathname.includes('missing.example.net')) return new Response('Missing', { status: 404 });
  if (pathname.includes('outage.example.net')) return new Response('Outage', { status: 503 });
  if (pathname.includes('slow.example.net')) return new Promise(() => {});
  const track = { name: { title: 'Hurricane', raw: 'Hurricane' } };
  const flat = pathname.includes('flat.example.net');
  const uzi = pathname.includes('1zqqdIds1iwnx4lh29iF1IlraeuqfGhxH9qLNlWOnryo');
  const slug = pathname.includes('/tab/') ? decodeURIComponent(pathname.split('/tab/')[1]) : 'main';
  return new Response(JSON.stringify({ name: uzi ? 'Updated Incorrect Artist Tracker' : flat ? 'Flat Artist' : 'Kanye West', tab: { name: slug, slug, gid: '1' }, tabs: [{ name: 'Unreleased', slug: 'main', gid: '1' }, { name: 'Recent', slug: 'recent', gid: '2' }, { name: 'Art', slug: 'art.json', gid: '3' }], eras: flat ? [] : [{ name: 'Donda', tracks: [track] }], ...(flat ? { tracks: [track] } : {}) }), { headers: { 'Content-Type': 'application/json' } });
};
`;

async function stopServer() {
  if (!server?.pid || server.exitCode !== null || server.signalCode !== null) return;
  const exited = new Promise<void>((resolve) => server.once("exit", () => resolve()));
  const signal = (value: NodeJS.Signals) => {
    try {
      if (process.platform === "win32") server.kill(value);
      else process.kill(-server.pid!, value);
    } catch {}
  };
  signal("SIGTERM");
  const force = setTimeout(() => signal("SIGKILL"), 5000);
  try {
    await exited;
  } finally {
    clearTimeout(force);
  }
}

beforeAll(async () => {
  directory = await mkdtemp(path.join(tmpdir(), "artistgrid-pages-test-"));
  const assets = path.join(directory, "assets");
  const functions = path.join(directory, "functions");
  await mkdir(assets);
  await mkdir(path.join(functions, "sh"), { recursive: true });
  await copyFile(path.join(root, "public/_routes.json"), path.join(assets, "_routes.json"));
  await writeFile(path.join(assets, "index.html"), '<!DOCTYPE html><div id="root">STATIC SPA</div>');
  await writeFile(path.join(assets, "asset.js"), "window.fixture = true;");
  for (const filename of ["index.js", "donate.js", "sitemap.xml.js", "sh/[[catchall]].js", "view.js"]) {
    const source = path.join(root, "functions", filename).replace(/\\/g, "/");
    await writeFile(
      path.join(functions, filename),
      `import { onRequest as handler } from ${JSON.stringify(source)};\n${outboundFixtures}\nexport const onRequest = handler;`
    );
  }
  // The marker makes Worker invocation observable without changing production handlers or routing rules.
  await writeFile(
    path.join(functions, "_middleware.js"),
    `export async function onRequest(context) { const response = await context.next(); const result = new Response(response.body, response); result.headers.set('X-Test-Function-Invoked', '1'); return result; }`
  );
  await writeFile(
    path.join(directory, "package.json"),
    JSON.stringify({ name: "artistgrid-pages-test", type: "module" })
  );

  await new Promise<void>((resolve, reject) => {
    const build = spawn(
      process.execPath,
      [
        path.join(root, "node_modules/wrangler/bin/wrangler.js"),
        "pages",
        "functions",
        "build",
        "--outdir",
        path.join(assets, "_worker.js"),
      ],
      {
        cwd: directory,
        env: { ...process.env, CI: "1", WRANGLER_SEND_METRICS: "false" },
        stdio: ["ignore", "pipe", "pipe"],
      }
    );
    build.stdout.on("data", (chunk: Buffer) => (logs += chunk.toString()));
    build.stderr.on("data", (chunk: Buffer) => (logs += chunk.toString()));
    build.once("error", reject);
    build.once("exit", (code) => (code === 0 ? resolve() : reject(new Error(`Functions build failed:\n${logs}`))));
  });

  server = spawn(
    process.execPath,
    [
      path.join(root, "node_modules/wrangler/bin/wrangler.js"),
      "pages",
      "dev",
      assets,
      "--port",
      "0",
      "--ip",
      "127.0.0.1",
      "--inspector-port",
      "0",
      "--kv",
      "SEO_CACHE",
      "--compatibility-date",
      "2026-11-01",
    ],
    {
      cwd: directory,
      detached: process.platform !== "win32",
      env: { ...process.env, CI: "1", WRANGLER_SEND_METRICS: "false", CLOUDFLARE_SEND_METRICS: "false" },
      stdio: ["ignore", "pipe", "pipe"],
    }
  );
  try {
    origin = await new Promise<string>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error(`Pages server did not start:\n${logs}`)), 60000);
      const read = (chunk: Buffer) => {
        logs = (logs + chunk.toString()).slice(-64000);
        const match = logs.match(/Ready on (http:\/\/127\.0\.0\.1:\d+)/);
        if (match) {
          clearTimeout(timeout);
          resolve(match[1]);
        }
      };
      server.stdout!.on("data", read);
      server.stderr!.on("data", read);
      server.once("error", (error) => {
        clearTimeout(timeout);
        reject(error);
      });
      server.once("exit", () => {
        clearTimeout(timeout);
        reject(new Error(`Pages server exited:\n${logs}`));
      });
    });
  } catch (error) {
    await stopServer();
    throw error;
  }
}, 65000);

afterAll(async () => {
  await stopServer();
  if (directory) await rm(directory, { recursive: true, force: true });
}, 10000);

const get = (pathname: string, agent = "Googlebot/2.1") =>
  fetch(origin + pathname, { headers: { "User-Agent": agent }, redirect: "manual" });

describe("actual Pages invocation boundary", () => {
  it.each(["/asset.js"])("serves %s without a Function invocation", async (pathname) => {
    const response = await get(pathname);
    expect(response.status).toBe(200);
    expect(response.headers.get("X-Test-Function-Invoked")).toBeNull();
    expect(await response.text()).toContain("window.fixture");
  });

  it("serves the full artist directory to bots and the SPA to browsers", async () => {
    const html = await (await get("/")).text();
    expect(html).toContain("<h1>ArtistGrid</h1>");
    expect(html).toContain('href="https://artistgrid.cx/sh/yetracker.net/"');
    expect(html).toContain('href="https://artistgrid.cx/sh/flat.example.net/"');
    expect(await (await get("/", "Mozilla/5.0")).text()).toContain("STATIC SPA");
  });

  it("serves valid XML and retrieves the next request from real local KV", async () => {
    const first = await get("/sitemap.xml");
    expect(first.status).toBe(200);
    expect(first.headers.get("Content-Type")).toContain("application/xml");
    expect(first.headers.get("X-Sitemap-Cache")).toBe("MISS");
    const xml = await first.text();
    expect(xml).toContain("<urlset");
    expect(xml).toContain("<loc>https://artistgrid.cx/donate</loc>");
    expect(xml).toContain("<loc>https://artistgrid.cx/sh/yetracker.net/</loc>");
    const second = await get("/sitemap.xml", "Mozilla/5.0");
    expect(second.headers.get("X-Sitemap-Cache")).toBe("HIT");
    expect(await second.text()).toBe(xml);
  });

  it("serves source-backed donation content through the built Worker", async () => {
    const html = await (await get("/donate")).text();
    expect(html).toContain("Support ArtistGrid");
    expect(html).toContain("Donation methods");
    expect(html).toContain('<link rel="canonical" href="https://artistgrid.cx/donate">');
  });

  it.each(["/sh/kanyewest/", "/sh/kanyewest/art.json", "/view?id=kanyewest", "/view/?id=kanyewest"])(
    "renders a bot document at %s",
    async (pathname) => {
      const response = await get(pathname);
      expect(response.status).toBe(200);
      expect(response.headers.get("X-Test-Function-Invoked")).toBe("1");
      expect(response.headers.get("Location")).toBeNull();
      expect(response.headers.get("Cache-Control")).toContain("no-store");
      expect(response.headers.get("Vary")).toContain("User-Agent");
      const html = await response.text();
      expect(html).toContain("Kanye West Tracker");
      expect(html).toContain("<li>Hurricane</li>");
      expect(html).toContain('content="https://assets.artistgrid.cx/webp/kanyewest.webp"');
    }
  );

  it("serves the browser variant at the same URL without reusable bot-cache headers", async () => {
    const response = await get("/sh/kanyewest/", "Mozilla/5.0");
    expect(response.status).toBe(200);
    expect(response.headers.get("X-Test-Function-Invoked")).toBe("1");
    expect(response.headers.get("Cache-Control")).toContain("no-store");
    expect(response.headers.get("Vary")).toContain("User-Agent");
    expect(await response.text()).toContain("STATIC SPA");
  });

  it.each([
    ["/sh/kanyewest/main/", ""],
    ["/view?id=kanyewest&artist=ignored", ""],
    ["/sh/kanyewest/recent/", "recent/"],
    ["/sh/kanyewest/art.json", "art.json/"],
  ])("serves canonical navigation and connected schema at %s", async (pathname, tabPath) => {
    const response = await get(pathname);
    expect(response.status).toBe(200);
    const html = await response.text();
    const canonical = `https://artistgrid.cx/sh/yetracker.net/${tabPath}`;
    expect(html).toContain(`<link rel="canonical" href="${canonical}">`);
    expect(html).toContain('aria-label="Tracker tabs"');
    expect(html).toContain('href="https://artistgrid.cx/sh/yetracker.net/recent/"');
    const graph = JSON.parse(html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)![1])["@graph"];
    const page = graph.find((node: { "@type": string }) => node["@type"] === "CollectionPage");
    const breadcrumbs = graph.find((node: { "@type": string }) => node["@type"] === "BreadcrumbList");
    expect(page.url).toBe(canonical);
    expect(page.mainEntity["@id"]).toBe(graph[1]["@id"]);
    expect(breadcrumbs.itemListElement.at(-1).item).toBe(canonical);
    expect(response.headers.get("X-Robots-Tag")).toBe("index, follow");
  });

  it.each(["Mozilla/5.0", "Googlebot/2.1"])("rejects invalid arity and encoding for %s", async (agent) => {
    expect((await get("/sh/kanyewest/recent/extra/", agent)).status).toBe(404);
    expect((await get("/sh/kanyewest/%FF/", agent)).status).toBe(400);
  });

  it("preserves flat tracks despite an empty eras array", async () => {
    const response = await get("/sh/flat.example.net/");
    expect(response.status).toBe(200);
    expect(await response.text()).toContain("<li>Hurricane</li>");
  });

  it("uses the CSV artist on a direct Sheet ID rather than the sheet title or query hint", async () => {
    const response = await get("/sh/1zqqdIds1iwnx4lh29iF1IlraeuqfGhxH9qLNlWOnryo/?artist=Incorrect%20artist");
    expect(response.status).toBe(200);
    const html = await response.text();
    expect(html).toContain("<h1>Lil Uzi Vert Tracker (main)</h1>");
    expect(html).toContain('content="https://assets.artistgrid.cx/webp/liluzivert.webp"');
  });

  it.each([
    ["missing.example.net", 404],
    ["outage.example.net", 503],
    ["slow.example.net", 503],
  ] as const)("returns uncached failure metadata for %s", async (id, status) => {
    const response = await get(`/sh/${id}/`);
    expect(response.status).toBe(status);
    expect(response.headers.get("Cache-Control")).toContain("no-store");
    expect(response.headers.get("X-Robots-Tag")).toContain("noindex");
    expect(await response.text()).toContain("Tracker");
  });
});
