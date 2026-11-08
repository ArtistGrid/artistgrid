export function parseTrackerPath(pathname: string): { trackerParam: string; tabSlug: string } | null {
  const match = pathname.match(/^\/sh\/([^/]+)(?:\/([^/]+))?\/?$/);
  if (!match) return null;
  return { trackerParam: decodeURIComponent(match[1]), tabSlug: decodeURIComponent(match[2] || "") };
}

export function parseTrackerLink(
  input: string,
  origin = "https://artistgrid.cx"
): { trackerParam: string; tabSlug: string; href: string } | null {
  if (!/^https?:\/\//i.test(input) && !/^\/(?:sh|view)(?:\/|\?|$)/.test(input)) return null;
  const url = new URL(input, origin);
  if (url.origin !== origin && !["artistgrid.cx", "www.artistgrid.cx"].includes(url.hostname)) return null;
  const route = parseTrackerPath(url.pathname);
  if (route) return { ...route, href: url.pathname + url.search };
  if (/^\/view\/?$/.test(url.pathname) && url.searchParams.get("id")) {
    return { trackerParam: url.searchParams.get("id")!, tabSlug: "", href: url.pathname + url.search };
  }
  throw new Error("Invalid ArtistGrid tracker link");
}

export function trackerPath(trackerParam: string, tabSlug = ""): string {
  return `/sh/${encodeURIComponent(trackerParam)}${tabSlug ? `/${encodeURIComponent(tabSlug)}` : ""}`;
}
