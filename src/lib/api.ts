import type { Era, TALeak, TrackerResponse } from "@/src/types";
import { isUrl } from "./track-utils";

export const API_BASE = "https://trackerapi.artistgrid.cx";

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
  eras: V3Era[];
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
  for (let i = 0; i < v3.eras.length; i++) {
    const v3Era = v3.eras[i];
    const key = v3Era.name || String(i);
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
  // Ensure current tab is included in the tabs list
  const tabNames = v3.tabs.map((t) => t.name);
  if (!tabNames.includes(v3.tab.name)) tabNames.unshift(v3.tab.name);
  return {
    name: v3.name,
    tabs: tabNames,
    current_tab: v3.tab.name,
    eras,
  };
}
