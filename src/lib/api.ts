import type { Era, EraDate, TALeak, TrackerResponse } from "@/src/types";
import { isUrl } from "./track-utils";

const API_BASE = "https://trackerapi.artistgrid.cx";

const etagStore = new Map<string, string>();
const bodyCache = new Map<string, string>();

export function clearETags(): void {
  etagStore.clear();
  bodyCache.clear();
}

export async function computeETag(body: string): Promise<string> {
  const data = new TextEncoder().encode(body);
  const hash = await crypto.subtle.digest("SHA-256", data);
  const hex = [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, "0")).join("");
  return `"${hex}"`;
}

export async function fetchWithFallback(endpoint: string, options?: RequestInit): Promise<Response> {
  const url = `${API_BASE}${endpoint}`;
  const storedETag = etagStore.get(url);

  const mergedHeaders: Record<string, string> = {};
  if (options?.headers) {
    if (options.headers instanceof Headers) {
      options.headers.forEach((v, k) => { mergedHeaders[k] = v; });
    } else {
      for (const [k, v] of Object.entries(options.headers)) mergedHeaders[k] = v;
    }
  }
  if (storedETag) mergedHeaders["If-None-Match"] = storedETag;

  const res = await fetch(url, { ...options, headers: mergedHeaders });

  if (res.status === 304 && storedETag) {
    const cached = bodyCache.get(url) || "{}";
    return new Response(cached, {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (res.ok) {
    const body = await res.clone().text();
    const etag = await computeETag(body);
    etagStore.set(url, etag);
    bodyCache.set(url, body);
  }

  return res;
}

interface V3TrackName {
  raw: string;
  title: string;
  credits: string[];
}
interface V3Track {
  name: V3TrackName;
  notes?: string;
  track_length?: string | null;
  file_date?: string | null;
  leak_date?: string | null;
  available_length?: string;
  quality?: string;
  links?: string[];
  image?: string;
  type?: string;
  sub_era?: string;
  art_used?: boolean;
}
interface V3FlatTrack extends V3Track {
  era: string;
  era_color?: string;
  era_text_color?: string;
  og_filename?: string;
}
interface V3Era {
  name: string;
  aka?: string[];
  timeline?: string;
  description?: string;
  cover_art?: string;
  color?: string;
  text_color?: string;
  tracks: V3Track[];
}
interface V3Tab {
  name: string;
  slug: string;
  gid: string;
}
export interface V3EraDate {
  date: string;
  event: string;
  era: string;
}
export interface V3Response {
  name: string;
  tab: V3Tab;
  tabs: V3Tab[];
  eras?: V3Era[];
  tracks?: V3FlatTrack[];
  era_dates: V3EraDate[];
  credits: string;
  discord?: string | string[];
}

function buildTabMeta(v3: { name: string; tab: V3Tab; tabs: V3Tab[] }): Pick<TrackerResponse, "tabs" | "tabSlugs" | "tabGids" | "current_tab"> {
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
  const links = (v3Track.links ?? []).filter(isUrl);
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
      timeline: v3Era.timeline,
      image: v3Era.cover_art,
      textColor: v3Era.text_color,
      backgroundColor: v3Era.color,
      description: v3Era.description,
      data: Object.keys(grouped).length > 0 ? grouped : undefined,
    };
  }

  const result: TrackerResponse = { name: v3.name, eras, ...buildTabMeta(v3) };

  result.era_dates = v3.era_dates ?? [];
  result.credits = v3.credits ?? '';
  if (v3.discord) {
    result.discord = Array.isArray(v3.discord) ? (v3.discord[0] || undefined) : v3.discord;
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
      };
    }
    const taLeak = adaptV3Track(track);
    taLeak.eraName = eraName;
    taLeak.eraColor = track.era_color;
    taLeak.eraTextColor = track.era_text_color;
    flat.push(taLeak);
  }
  const eras: Record<string, Era> = { _flat: { name: "", data: { Default: flat } } };

  const result: TrackerResponse = { name: v3.name, eras, isFlat: true, ...buildTabMeta(v3) };

  result.era_dates = v3.era_dates ?? [];
  result.credits = v3.credits ?? '';
  if (v3.discord) {
    result.discord = Array.isArray(v3.discord) ? (v3.discord[0] || undefined) : v3.discord;
  }

  return result;
}
