import type { TALeak, Era } from "@/src/types";

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
      const url = track.url || track.quality || track.available_length;
      if (url) urls.push(url);
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
  data: { eras: Record<string, Era> },
  favourites: string[]
): Array<{ track: TALeak; era: Era }> {
  if (favourites.length === 0) return [];
  const favSet = new Set(favourites);
  const result: Array<{ track: TALeak; era: Era }> = [];
  for (const era of Object.values(data.eras)) {
    if (!era.data) continue;
    for (const tracks of Object.values(era.data)) {
      if (!Array.isArray(tracks)) continue;
      for (const track of tracks) {
        const url = track.url || track.quality || track.available_length;
        if (url && favSet.has(url)) {
          result.push({ track, era });
        }
      }
    }
  }
  return result;
}
