import { safeSetItem } from "@/src/lib/storage";

export interface CacheData<T> {
  data: T;
  timestamp: number;
}
export function getCachedData<T>(key: string): CacheData<T> | null {
  try {
    const cached = localStorage.getItem(key);
    if (!cached) return null;
    return JSON.parse(cached) as CacheData<T>;
  } catch {
    return null;
  }
}
export function isCacheExpired<T>(cache: CacheData<T> | null, expiry: number): boolean {
  if (!cache) return true;
  return Date.now() - cache.timestamp > expiry;
}
export function setCachedData<T>(key: string, data: T): void {
  safeSetItem(key, JSON.stringify({ data, timestamp: Date.now() }));
}
