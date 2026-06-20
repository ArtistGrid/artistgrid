import type { Era, TALeak, TrackerResponse } from "@/src/types";
import { isUrl } from "./track-utils";

const API_BASE = "https://trackerapi.artistgrid.cx";

export async function fetchWithFallback(endpoint: string, options?: RequestInit): Promise<Response> {
  return fetch(`${API_BASE}${endpoint}`, options);
}

// v3 response types
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
export interface V3Response {
  name: string;
  tab: V3Tab;
  tabs: V3Tab[];
  eras?: V3Era[];
  tracks?: V3FlatTrack[];
}

function buildTabMeta(v3: { name: string; tab: V3Tab; tabs: V3Tab[] }): Pick<TrackerResponse, "tabs" | "tabSlugs" | "current_tab"> {
  const tabNames = v3.tabs.map((t) => t.name);
  if (!tabNames.includes(v3.tab.name)) tabNames.unshift(v3.tab.name);
  const tabSlugs: Record<string, string> = {};
  for (const t of v3.tabs) tabSlugs[t.name] = t.slug;
  if (!tabSlugs[v3.tab.name]) tabSlugs[v3.tab.name] = v3.tab.slug;
  return { tabs: tabNames, tabSlugs, current_tab: v3.tab.name };
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
  };
}

export function adaptV3Response(v3: V3Response): TrackerResponse {
  const eras: Record<string, Era> = {};
  for (let i = 0; i < (v3.eras?.length ?? 0); i++) {
    const v3Era = v3.eras![i];
    // Prefix with index: plain numeric-looking names (e.g. "2022") would otherwise be
    // treated as array indices by JS and reordered ahead of string keys, breaking era order.
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
  return { name: v3.name, eras, ...buildTabMeta(v3) };
}

// Handles tabs that return a flat tracks list (e.g. "Recent") instead of era-grouped eras.
// Preserves original order — eras are only used as a lookup for era color metadata.
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
  // Store as a single pseudo-era so the rest of the data pipeline still works,
  // but set isFlat so the UI renders a plain list instead of the accordion.
  const eras: Record<string, Era> = { _flat: { name: "", data: { Default: flat } } };
  return { name: v3.name, eras, isFlat: true, ...buildTabMeta(v3) };
}
