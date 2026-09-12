import type { Era, TALeak } from "@/src/types";
import { getTrackDescription } from "@/src/lib/track-utils";

export interface SearchableTrackItem {
  track: TALeak;
  era: Era;
  category: string;
  eraKey: string;
  name: string;
  extra: string;
  description: string;
}

export interface FuseSearchResult<T> {
  item: T;
  score?: number;
}

export interface TrackFuseInstance {
  search(query: string): Array<FuseSearchResult<SearchableTrackItem>>;
}

export const FUSE_TRACK_OPTIONS = {
  keys: [
    { name: "name", weight: 0.65 },
    { name: "extra", weight: 0.25 },
    { name: "description", weight: 0.1 },
  ],
  threshold: 0.35,
  ignoreLocation: true,
  minMatchCharLength: 2,
};

export type TrackFuseConstructor = new (
  list: SearchableTrackItem[],
  options: typeof FUSE_TRACK_OPTIONS
) => TrackFuseInstance;

export function flattenErasForSearch(eras: Record<string, Era>): SearchableTrackItem[] {
  const items: SearchableTrackItem[] = [];
  for (const [eraKey, era] of Object.entries(eras)) {
    if (!era.data) continue;
    for (const [category, tracks] of Object.entries(era.data)) {
      if (!Array.isArray(tracks)) continue;
      for (const track of tracks) {
        items.push({
          track,
          era,
          category,
          eraKey,
          name: track.name || "",
          extra: track.extra || "",
          description: getTrackDescription(track) || "",
        });
      }
    }
  }
  return items;
}

export function searchTracks(
  items: SearchableTrackItem[],
  query: string,
  fuseInstance?: TrackFuseInstance | null
): Set<TALeak> {
  const cleanQuery = query.trim().toLowerCase();
  if (!cleanQuery) return new Set();

  const matched = new Set<TALeak>();

  if (fuseInstance) {
    try {
      const results = fuseInstance.search(cleanQuery);
      for (const r of results) {
        matched.add(r.item.track);
      }
    } catch (err) {
      console.warn("Fuse track search failed, falling back to substring:", err);
    }
  }

  // Exact substring matching ensures complete backwards compatibility,
  // covers single-char queries (< minMatchCharLength), and handles exact matches in large fields
  for (const item of items) {
    if (matched.has(item.track)) continue;
    const searchable = `${item.name} ${item.extra} ${item.description}`.toLowerCase();
    if (searchable.includes(cleanQuery)) {
      matched.add(item.track);
    }
  }

  return matched;
}
