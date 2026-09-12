import type { TrackerResponse } from "@/src/types";
import { idbSet, idbDelete, idbEntries } from "@/src/lib/indexeddb-cache";
const CACHE_EXPIRY = 1000 * 60 * 10;
const IDB_PREFIX = "tc:";
interface CacheEntry {
  data: TrackerResponse;
  timestamp: number;
  resolvedUrls: Record<string, string | null>;
}
const memCache = new Map<string, CacheEntry>();
let idbReady = false;
let idbLoadPromise: Promise<void> | null = null;
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
    const entries = await idbEntries<CacheEntry>(IDB_PREFIX);
    for (const [k, v] of entries) {
      if (v && typeof v === "object" && v.data && Date.now() - v.timestamp <= CACHE_EXPIRY) {
        memCache.set(k, v);
      } else {
        idbDelete(idbKey(k)).catch(() => {});
      }
    }
  } catch {}
  idbReady = true;
  for (const [k, v] of idbPending) {
    memCache.set(k, v);
    persistEntry(k, v);
  }
  idbPending.clear();
}
function ensureLoaded(): Promise<void> {
  idbLoadPromise ??= loadFromIDB();
  return idbLoadPromise;
}
export function getCache(trackerId: string, tab?: string): CacheEntry | null {
  const k = cacheKey(trackerId, tab);
  const entry = memCache.get(k);
  if (!entry) {
    ensureLoaded();
    return null;
  }
  if (Date.now() - entry.timestamp > CACHE_EXPIRY) {
    memCache.delete(k);
    idbDelete(idbKey(k)).catch(() => {});
    return null;
  }
  return entry;
}
export async function getCacheAsync(trackerId: string, tab?: string): Promise<CacheEntry | null> {
  await ensureLoaded();
  return getCache(trackerId, tab);
}
function persistEntry(k: string, entry: CacheEntry) {
  idbSet(idbKey(k), entry).catch(() => {});
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
    idbDelete(idbKey(k)).catch(() => {});
  } else {
    const keys = [...memCache.keys()];
    memCache.clear();
    idbPending.clear();
    for (const k of keys) idbDelete(idbKey(k)).catch(() => {});
  }
}
void ensureLoaded();
