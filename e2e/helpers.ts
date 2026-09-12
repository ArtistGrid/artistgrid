import { type Page } from "@playwright/test";

export const TRACKER_ID = "abc123def456ghi789jklmno";

const ARTISTS_CSV = `name,url,image
Kanye West,https://docs.google.com/spreadsheets/d/${TRACKER_ID}/edit,
Drake,https://docs.google.com/spreadsheets/d/def456ghi789jklmnoabc123/edit,
Playboi Carti,https://docs.google.com/spreadsheets/d/carti111222333444555666/edit,`;

const PLACEHOLDER_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="300"><rect width="300" height="300" fill="#333"/><circle cx="150" cy="150" r="80" fill="#666"/></svg>`;

function v3Payload() {
  return {
    name: "Kanye West",
    tab: { name: "Main", slug: "main", gid: "0" },
    tabs: [{ name: "Main", slug: "main", gid: "0" }],
    eras: [
      {
        name: "Donda",
        color: "#111111",
        tracks: [
          {
            name: { raw: "Hurricane", title: "Hurricane" },
            quality: "320",
            type: "Song",
            leak_date: "2021-07-22",
            links: [{ url: "https://pillows.su/f/deadbeefdeadbeefdeadbeef", text: "mp3" }],
          },
          {
            name: { raw: "Jail", title: "Jail" },
            quality: "FLAC",
            type: "Song",
            leak_date: "2021-08-29",
            links: [{ url: "https://pillows.su/f/cafebabecafebabecafebabe", text: "flac" }],
          },
          {
            name: { raw: "Off The Grid", title: "Off The Grid" },
            quality: "320",
            type: "Song",
            leak_date: "2021-07-15",
            links: [{ url: "https://pillows.su/f/0123456789abcdef01234567", text: "mp3" }],
          },
        ],
      },
    ],
    era_dates: [],
    credits: "tester",
    discord: [],
    last_updated: Math.floor(Date.now() / 1000) - 3600,
  };
}

export async function mockSite(page: Page): Promise<void> {
  await page.route("**/artists.artistgrid.cx/artists.csv", (route) =>
    route.fulfill({ status: 200, contentType: "text/csv", body: ARTISTS_CSV })
  );
  await page.route("**/trackerapi.artistgrid.cx/**", (route) => {
    const url = new URL(route.request().url());
    if (url.pathname.startsWith(`/sh/${TRACKER_ID}`)) {
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(v3Payload()) });
    }
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ name: "?", tab: { name: "T", slug: "t", gid: "" }, tabs: [], era_dates: [] }),
    });
  });
  await page.route("**/121124.edideaur.works/**", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: '{"count":42}' })
  );
  await page.route("**/ibb.artistgrid.cx/**", (route) => {
    const parts = route.request().url().split("/").filter(Boolean);
    const id = parts[parts.length - 2] ?? "x";
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ url: `https://i.ibb.co/${id}/full.png` }),
    });
  });
  await page.route("**://assets.artistgrid.cx/**", (route) =>
    route.fulfill({ status: 200, contentType: "image/svg+xml", body: PLACEHOLDER_SVG })
  );
  await page.route("**://wsrv.nl/**", (route) =>
    route.fulfill({ status: 200, contentType: "image/svg+xml", body: PLACEHOLDER_SVG })
  );
}

export async function dismissAnnouncement(page: Page): Promise<void> {
  await page.addInitScript(() => {
    window.localStorage.setItem("artistGridMessageHash", "v2:e2e-test");
  });
}

export async function waitForImages(page: Page): Promise<void> {
  await page.evaluate(() =>
    Promise.all(
      Array.from(document.images).map((img) =>
        img.complete
          ? Promise.resolve()
          : new Promise<void>((res) => {
              img.addEventListener("load", () => res(), { once: true });
              img.addEventListener("error", () => res(), { once: true });
            })
      )
    )
  );
}
