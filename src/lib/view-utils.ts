import type { Era, TALeak, TrackerResponse } from "@/src/types";
import { getCache, setCache } from "@/src/lib/tracker-cache";

export function forEachEraTrack(eras: Record<string, Era>, cb: (track: TALeak, era: Era) => boolean | void): void {
  for (const era of Object.values(eras)) {
    if (!era.data) continue;
    for (const tracks of Object.values(era.data)) {
      if (!Array.isArray(tracks)) continue;
      for (const track of tracks) {
        if (cb(track, era) === false) return;
      }
    }
  }
}

export function mergeAndCache(
  id: string,
  cacheKey: string | undefined,
  trackerData: TrackerResponse,
  newResolved: Record<string, string | null>
): void {
  const existing = getCache(id, cacheKey)?.resolvedUrls || {};
  setCache(id, trackerData, { ...existing, ...newResolved }, cacheKey);
}

const VIDEO_EXTENSIONS = /\.(mp4|webm|mkv|mov|avi|flv|wmv|m4v|ogv|ogm)(\?|$)/i;
export function isVideoUrl(url: string): boolean {
  try {
    const pathname = new URL(url).pathname;
    return VIDEO_EXTENSIONS.test(pathname);
  } catch {
    return VIDEO_EXTENSIONS.test(url);
  }
}

export function formatRelativeTime(isoString: string): string {
  const then = new Date(isoString).getTime();
  if (Number.isNaN(then)) return "";
  const seconds = Math.floor((Date.now() - then) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}
