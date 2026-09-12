import * as t from "io-ts";
import { isLeft } from "fp-ts/Either";
import type { TALeak, Era } from "@/src/types";
import { getAllTrackUrls } from "@/src/lib/track-utils";
const FavouritesImportCodec = t.interface({
  trackers: t.record(t.string, t.array(t.unknown)),
});
const KEY_PREFIX = "artistgrid-favourites_";
function getKey(trackerId: string): string {
  return `${KEY_PREFIX}${trackerId}`;
}
export function getFavourites(trackerId: string): string[] {
  try {
    const raw = localStorage.getItem(getKey(trackerId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
export function isFavourited(trackerId: string, url: string): boolean {
  return getFavourites(trackerId).includes(url);
}
export function toggleFavourite(trackerId: string, url: string): boolean {
  const favs = getFavourites(trackerId);
  const idx = favs.indexOf(url);
  if (idx === -1) {
    favs.push(url);
  } else {
    favs.splice(idx, 1);
  }
  try {
    localStorage.setItem(getKey(trackerId), JSON.stringify(favs));
  } catch {}
  return idx === -1;
}
export function clearFavourites(trackerId: string): void {
  try {
    localStorage.removeItem(getKey(trackerId));
  } catch {}
}
function getTrackUrls(era: Era): string[] {
  const urls: string[] = [];
  if (!era.data) return urls;
  for (const tracks of Object.values(era.data)) {
    if (!Array.isArray(tracks)) continue;
    for (const track of tracks) {
      for (const url of getAllTrackUrls(track)) {
        if (!urls.includes(url)) urls.push(url);
      }
    }
  }
  return urls;
}
export function toggleEraFavourite(trackerId: string, era: Era): boolean {
  const eraUrls = getTrackUrls(era);
  if (eraUrls.length === 0) return false;
  const favs = getFavourites(trackerId);
  const favSet = new Set(favs);
  const allFavourited = eraUrls.every((u) => favSet.has(u));
  if (allFavourited) {
    for (const u of eraUrls) {
      const idx = favs.indexOf(u);
      if (idx !== -1) favs.splice(idx, 1);
    }
  } else {
    for (const u of eraUrls) {
      if (!favSet.has(u)) favs.push(u);
    }
  }
  try {
    localStorage.setItem(getKey(trackerId), JSON.stringify(favs));
  } catch {}
  return !allFavourited;
}
export function isEraFavourited(trackerId: string, era: Era): boolean {
  const eraUrls = getTrackUrls(era);
  if (eraUrls.length === 0) return false;
  const favs = getFavourites(trackerId);
  const favSet = new Set(favs);
  return eraUrls.every((u) => favSet.has(u));
}
export function getFavouritedTracks(
  data: {
    eras: Record<string, Era>;
  },
  favourites: string[]
): Array<{
  track: TALeak;
  era: Era;
}> {
  if (favourites.length === 0) return [];
  const favSet = new Set(favourites);
  const result: Array<{
    track: TALeak;
    era: Era;
  }> = [];
  for (const era of Object.values(data.eras)) {
    if (!era.data) continue;
    for (const tracks of Object.values(era.data)) {
      if (!Array.isArray(tracks)) continue;
      for (const track of tracks) {
        const matched = getAllTrackUrls(track).some((url) => favSet.has(url));
        if (matched) {
          result.push({ track, era });
        }
      }
    }
  }
  return result;
}
export interface FavouritesExport {
  version: 1;
  exportedAt: string;
  trackers: Record<string, string[]>;
}
function allFavouriteTrackerIds(): string[] {
  const ids: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith(KEY_PREFIX)) ids.push(key.slice(KEY_PREFIX.length));
  }
  return ids;
}
export function exportAllFavourites(): FavouritesExport {
  const trackers: Record<string, string[]> = {};
  for (const id of allFavouriteTrackerIds()) {
    const favs = getFavourites(id);
    if (favs.length > 0) trackers[id] = favs;
  }
  return { version: 1, exportedAt: new Date().toISOString(), trackers };
}
export function importFavourites(data: unknown, mode: "merge" | "replace" = "merge"): number {
  const parsed = FavouritesImportCodec.decode(data);
  if (isLeft(parsed)) return 0;
  const trackers = parsed.right.trackers as Record<string, unknown[]>;
  let added = 0;
  for (const [trackerId, urls] of Object.entries(trackers)) {
    if (!trackerId) continue;
    const cleanUrls = urls.filter((u): u is string => typeof u === "string" && u.length > 0);
    if (mode === "replace") {
      try {
        localStorage.setItem(getKey(trackerId), JSON.stringify(cleanUrls));
        added += cleanUrls.length;
      } catch {}
      continue;
    }
    const existing = new Set(getFavourites(trackerId));
    const merged = [...getFavourites(trackerId)];
    for (const u of cleanUrls) {
      if (!existing.has(u)) {
        merged.push(u);
        existing.add(u);
        added++;
      }
    }
    try {
      localStorage.setItem(getKey(trackerId), JSON.stringify(merged));
    } catch {}
  }
  return added;
}
