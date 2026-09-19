import type { Era, EraDate, TALeak, TrackerResponse } from "@/src/types";
import type { V3Response, V3Tab, V3Track } from "../v3.jsonschema";
export type { V3Response } from "../v3.jsonschema";
import { isUrl, generateTrackId } from "./track-utils";
import { clearCacheAndReload } from "./stale-reload";
import { fastHash } from "./hash";
const API_BASE = "https://trackerapi.artistgrid.cx";
const MAX_CACHED_URLS = 50;
const etagStore = new Map<string, string>();
const bodyCache = new Map<string, string>();
function rememberBody(url: string, body: string): void {
  bodyCache.set(url, body);
  if (bodyCache.size > MAX_CACHED_URLS) {
    const oldest = bodyCache.keys().next().value;
    if (oldest !== undefined) {
      bodyCache.delete(oldest);
      etagStore.delete(oldest);
    }
  }
}
export async function computeETag(body: string): Promise<string> {
  return `"${await fastHash(body)}"`;
}
export async function fetchWithFallback(endpoint: string, options?: RequestInit): Promise<Response> {
  const url = `${API_BASE}${endpoint}`;
  const res = await doFetch(url, options);
  if (res.status === 304 && !bodyCache.has(url)) {
    etagStore.delete(url);
    return doFetch(url, options);
  }
  if (res.status === 304) {
    const cached = bodyCache.get(url)!;
    return new Response(cached, {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }
  if (res.status === 404) {
    clearCacheAndReload();
  }
  if (res.ok) {
    const body = await res.clone().text();
    rememberBody(url, body);
    const compute = () =>
      computeETag(body)
        .then((etag) => etagStore.set(url, etag))
        .catch(() => {});
    if (typeof requestIdleCallback !== "undefined") {
      requestIdleCallback(compute, { timeout: 5000 });
    } else {
      setTimeout(compute, 0);
    }
  }
  return res;
}
async function doFetch(url: string, options?: RequestInit): Promise<Response> {
  const storedETag = etagStore.get(url);
  const mergedHeaders: Record<string, string> = {};
  if (options?.headers) {
    if (options.headers instanceof Headers) {
      options.headers.forEach((v, k) => {
        mergedHeaders[k] = v;
      });
    } else {
      for (const [k, v] of Object.entries(options.headers)) mergedHeaders[k] = v;
    }
  }
  if (storedETag) mergedHeaders["If-None-Match"] = storedETag;
  return fetch(url, { ...options, headers: mergedHeaders });
}
function buildTabMeta(v3: {
  name: string;
  tab: V3Tab;
  tabs: V3Tab[];
}): Pick<TrackerResponse, "tabs" | "tabSlugs" | "tabGids" | "current_tab"> {
  const tabNames = v3.tabs.map((t) => t.name);
  if (!tabNames.includes(v3.tab.name)) tabNames.unshift(v3.tab.name);
  const tabSlugs: Record<string, string> = {};
  const tabGids: Record<string, string> = {};
  for (const t of v3.tabs) {
    tabSlugs[t.name] = t.slug;
    tabGids[t.name] = t.gid;
  }
  if (!tabSlugs[v3.tab.name]) tabSlugs[v3.tab.name] = v3.tab.slug;
  if (!tabGids[v3.tab.name]) tabGids[v3.tab.name] = v3.tab.gid;
  return { tabs: tabNames, tabSlugs, tabGids, current_tab: v3.tab.name };
}
function adaptV3Track(v3Track: V3Track): TALeak {
  const links: string[] = [];
  for (const l of v3Track.links ?? []) {
    if (isUrl(l.url)) links.push(l.url);
  }
  return {
    name: v3Track.name.title || v3Track.name.raw,
    extra: v3Track.name.credits?.length ? v3Track.name.credits.join(", ") : undefined,
    notes: v3Track.notes,
    track_length: v3Track.track_length ?? undefined,
    leak_date: v3Track.leak_date ?? undefined,
    file_date: v3Track.file_date ?? undefined,
    type: v3Track.type,
    available_length: v3Track.available_length,
    quality: v3Track.quality,
    url: links[0],
    urls: links,
    image: v3Track.image,
    id: links[0] ? generateTrackId(links[0]) : generateTrackId(v3Track.name.title || v3Track.name.raw || "untitled"),
    ...(v3Track.art_used !== undefined ? { art_used: v3Track.art_used } : {}),
  };
}
export function adaptV3Response(v3: V3Response): TrackerResponse {
  const eras: Record<string, Era> = {};
  for (let i = 0; i < (v3.eras?.length ?? 0); i++) {
    const v3Era = v3.eras![i];
    const key = `${i}:${v3Era.name || ""}`;
    const grouped: Record<string, TALeak[]> = {};
    for (const track of v3Era.tracks) {
      const group = track.sub_era || "Default";
      if (!grouped[group]) grouped[group] = [];
      grouped[group].push(adaptV3Track(track));
    }
    eras[key] = {
      name: v3Era.name,
      extra: v3Era.aka?.join(", "),
      image: v3Era.cover_art,
      eraLogo: v3Era.era_logo,
      textColor: v3Era.text_color,
      backgroundColor: v3Era.color,
      font: v3Era.font_family || v3Era.font,
      description: v3Era.description,
      data: Object.keys(grouped).length > 0 ? grouped : undefined,
    };
  }
  const result: TrackerResponse = { name: v3.name, eras, ...buildTabMeta(v3) };
  result.era_dates = v3.era_dates ?? [];
  result.credits = v3.credits ?? "";
  result.lastUpdated = v3.last_updated ? new Date(v3.last_updated * 1000).toISOString() : undefined;
  if (v3.discord) {
    result.discord = Array.isArray(v3.discord) ? v3.discord[0] || undefined : v3.discord;
  }
  if (v3.era_dates?.length) {
    const datesByEra = new Map<string, EraDate[]>();
    for (const ed of v3.era_dates) {
      if (!datesByEra.has(ed.era)) datesByEra.set(ed.era, []);
      datesByEra.get(ed.era)!.push(ed);
    }
    for (const key of Object.keys(result.eras)) {
      const era = result.eras[key]!;
      era.era_dates = datesByEra.get(era.name) ?? [];
    }
  }
  return result;
}
export function adaptV3FlatResponse(v3: V3Response): TrackerResponse {
  const erasMeta: Record<string, Era> = {};
  const flat: TALeak[] = [];
  for (const track of v3.tracks ?? []) {
    const eraName = track.era || "Unknown";
    if (!erasMeta[eraName]) {
      erasMeta[eraName] = {
        name: eraName,
        backgroundColor: track.era_color,
        textColor: track.era_text_color,
        font: track.era_font || track.font_family,
      };
    }
    const taLeak = adaptV3Track(track);
    taLeak.eraName = eraName;
    taLeak.eraColor = track.era_color;
    taLeak.eraTextColor = track.era_text_color;
    taLeak.eraFont = track.era_font || track.font_family;
    flat.push(taLeak);
  }
  const eras: Record<string, Era> = { _flat: { name: "", data: { Default: flat } } };
  const result: TrackerResponse = { name: v3.name, eras, isFlat: true, ...buildTabMeta(v3) };
  result.era_dates = v3.era_dates ?? [];
  result.credits = v3.credits ?? "";
  result.lastUpdated = v3.last_updated ? new Date(v3.last_updated * 1000).toISOString() : undefined;
  if (v3.discord) {
    result.discord = Array.isArray(v3.discord) ? v3.discord[0] || undefined : v3.discord;
  }
  return result;
}
