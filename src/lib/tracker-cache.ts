import type { TrackerResponse } from "@/src/types";
const CACHE_KEY_PREFIX = "artistgrid_tracker_";
const CACHE_EXPIRY = 1000 * 60 * 60 * 24;
interface CacheEntry {
  data: TrackerResponse;
  timestamp: number;
  resolvedUrls: Record<string, string | null>;
}
export function getCache(trackerId: string, tab?: string): CacheEntry | null {
  try {
    const key = tab ? `${CACHE_KEY_PREFIX}${trackerId}_${tab}` : `${CACHE_KEY_PREFIX}${trackerId}`;
    const cached = localStorage.getItem(key);
    if (!cached) return null;
    const entry: CacheEntry = JSON.parse(cached);
    if (Date.now() - entry.timestamp > CACHE_EXPIRY) {
      localStorage.removeItem(key);
      return null;
    }
    return entry;
  } catch {
    return null;
  }
}
export function setCache(
  trackerId: string,
  data: TrackerResponse,
  resolvedUrls: Record<string, string | null>,
  tab?: string
): void {
  try {
    const key = tab ? `${CACHE_KEY_PREFIX}${trackerId}_${tab}` : `${CACHE_KEY_PREFIX}${trackerId}`;
    const entry: CacheEntry = { data, timestamp: Date.now(), resolvedUrls };
    localStorage.setItem(key, JSON.stringify(entry));
  } catch {}
}
