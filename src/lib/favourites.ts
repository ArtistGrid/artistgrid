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

export function getFavouritedTracks(
  data: { eras: Record<string, Era> },
  favourites: string[]
): Array<{ track: TALeak; era: Era }> {
  if (favourites.length === 0) return [];
  const favSet = new Set(favourites);
  const urlToTrack = new Map<string, { track: TALeak; era: Era }>();
  for (const era of Object.values(data.eras)) {
    if (!era.data) continue;
    for (const tracks of Object.values(era.data)) {
      if (!Array.isArray(tracks)) continue;
      for (const track of tracks) {
        const url = track.url || track.quality || track.available_length;
        if (url && favSet.has(url)) {
          urlToTrack.set(url, { track, era });
        }
      }
    }
  }
  return favourites
    .map((url) => urlToTrack.get(url))
    .filter((item): item is { track: TALeak; era: Era } => item !== undefined);
}
