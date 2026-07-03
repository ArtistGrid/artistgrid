import type { TrackerResponse } from "@/src/types";

const CACHE_EXPIRY = 1000 * 60 * 60;

interface CacheEntry {
  data: TrackerResponse;
  timestamp: number;
  resolvedUrls: Record<string, string | null>;
}

const memCache = new Map<string, CacheEntry>();

function key(id: string, tab?: string): string {
  return tab ? `${id}/${tab}` : id;
}

export function getCache(trackerId: string, tab?: string): CacheEntry | null {
  const k = key(trackerId, tab);
  const entry = memCache.get(k);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > CACHE_EXPIRY) {
    memCache.delete(k);
    return null;
  }
  return entry;
}

export function setCache(
  trackerId: string,
  data: TrackerResponse,
  resolvedUrls: Record<string, string | null>,
  tab?: string
): void {
  const k = key(trackerId, tab);
  const existing = memCache.get(k);
  const mergedResolved = { ...(existing?.resolvedUrls || {}), ...resolvedUrls };
  memCache.set(k, { data, timestamp: Date.now(), resolvedUrls: mergedResolved });
}

export function clearAllCache(): void {
  memCache.clear();
}
