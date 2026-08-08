import type { TrackerResponse } from "@/src/types";
import { idbGet, idbSet } from "@/src/lib/indexeddb-cache";

const CACHE_EXPIRY = 1000 * 60 * 60;
const IDB_PREFIX = "tc:";

interface CacheEntry {
  data: TrackerResponse;
  timestamp: number;
  resolvedUrls: Record<string, string | null>;
}

const memCache = new Map<string, CacheEntry>();
let idbReady = false;
const idbPending = new Map<string, CacheEntry>();

function idbKey(k: string): string {
  return `${IDB_PREFIX}${k}`;
}

function cacheKey(id: string, tab?: string): string {
  return tab ? `${id}/${tab}` : id;
}

async function loadFromIDB() {
  if (idbReady) return;
  try {
    const obj = await idbGet<Record<string, CacheEntry>>("tracker-cache");
    if (obj) {
      for (const [k, v] of Object.entries(obj)) {
        if (Date.now() - v.timestamp <= CACHE_EXPIRY) {
          memCache.set(k, v);
        }
      }
    }
  } catch {}
  idbReady = true;
  for (const [k, v] of idbPending) {
    memCache.set(k, v);
    idbSet(idbKey(k), v).catch(() => {});
  }
  idbPending.clear();
}

function persistEntry(k: string, entry: CacheEntry) {
  idbSet(idbKey(k), entry).catch(() => {});
}

export function getCache(trackerId: string, tab?: string): CacheEntry | null {
  const k = cacheKey(trackerId, tab);
  const entry = memCache.get(k);
  if (!entry) {
    loadFromIDB();
    return null;
  }
  if (Date.now() - entry.timestamp > CACHE_EXPIRY) {
    memCache.delete(k);
    idbSet(idbKey(k), null).catch(() => {});
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
  const k = cacheKey(trackerId, tab);
  const existing = memCache.get(k);
  const mergedResolved = { ...(existing?.resolvedUrls || {}), ...resolvedUrls };
  const entry: CacheEntry = { data, timestamp: Date.now(), resolvedUrls: mergedResolved };
  memCache.set(k, entry);
  if (!idbReady) {
    idbPending.set(k, entry);
  } else {
    persistEntry(k, entry);
  }
}

export function clearCache(trackerId?: string, tab?: string): void {
  if (trackerId) {
    const k = cacheKey(trackerId, tab);
    memCache.delete(k);
    idbPending.delete(k);
    idbSet(idbKey(k), null).catch(() => {});
  } else {
    memCache.clear();
    idbPending.clear();
    idbSet("tracker-cache", null).catch(() => {});
  }
}

void loadFromIDB();
