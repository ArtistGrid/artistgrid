import type { TrackerResponse } from "@/src/types";
import { idbGet, idbSet, idbClear } from "@/src/lib/indexeddb-cache";

const CACHE_EXPIRY = 1000 * 60 * 60;

interface CacheEntry {
  data: TrackerResponse;
  timestamp: number;
  resolvedUrls: Record<string, string | null>;
}

const memCache = new Map<string, CacheEntry>();
let idbReady = false;
const idbPending = new Map<string, CacheEntry>();

function key(id: string, tab?: string): string {
  return tab ? `${id}/${tab}` : id;
}

async function loadFromIDB() {
  if (idbReady) return;
  try {
    const entries = await idbGet<Record<string, CacheEntry>>("tracker-cache");
    if (entries) {
      for (const [k, v] of Object.entries(entries)) {
        if (Date.now() - v.timestamp <= CACHE_EXPIRY) {
          memCache.set(k, v);
        }
      }
    }
  } catch {}
  idbReady = true;
  for (const [k, v] of idbPending) {
    memCache.set(k, v);
  }
  idbPending.clear();
  persistToIDB();
}

function persistToIDB() {
  const obj: Record<string, CacheEntry> = {};
  for (const [k, v] of memCache) {
    obj[k] = v;
  }
  idbSet("tracker-cache", obj).catch(() => {});
}

export function getCache(trackerId: string, tab?: string): CacheEntry | null {
  const k = key(trackerId, tab);
  const entry = memCache.get(k);
  if (!entry) {
    loadFromIDB();
    return null;
  }
  if (Date.now() - entry.timestamp > CACHE_EXPIRY) {
    memCache.delete(k);
    persistToIDB();
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
  const entry: CacheEntry = { data, timestamp: Date.now(), resolvedUrls: mergedResolved };
  memCache.set(k, entry);
  if (!idbReady) {
    idbPending.set(k, entry);
  }
  persistToIDB();
}

export function clearAllCache(): void {
  memCache.clear();
  idbPending.clear();
  idbClear().catch(() => {});
}
