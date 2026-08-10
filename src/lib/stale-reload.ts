let attempted = false;

const STALE_PATTERNS = [
  "is not a valid JavaScript MIME type",
  "Failed to fetch dynamically imported module",
  "Importing a module script failed",
  "Unexpected token",
  "error loading dynamically imported module",
  /Loading chunk [\d]+ failed/,
];

function isStaleAssetError(message: string): boolean {
  return STALE_PATTERNS.some((p) => (typeof p === "string" ? message.includes(p) : p.test(message)));
}

export function reloadOnStaleError(message: string): boolean {
  if (!isStaleAssetError(message) || attempted) return false;
  attempted = true;
  if (typeof window !== "undefined" && window.location) {
    window.location.reload();
  }
  return true;
}

let cacheCleared = false;

const STALE_LOCAL_STORAGE_KEYS = [
  "artistGridCsvCache_remote",
  "artistGridCsvCache_local",
  "artistgrid-search",
];

const PRESERVED_IDB_DBS = new Set(["artistgrid-cache"]);

export async function clearCacheAndReload(): Promise<void> {
  if (cacheCleared) return;
  cacheCleared = true;
  try {
    for (const k of STALE_LOCAL_STORAGE_KEYS) {
      localStorage.removeItem(k);
    }
    if (typeof caches !== "undefined") {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
    }
    if (typeof navigator !== "undefined" && "serviceWorker" in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map((r) => r.unregister()));
    }
    if (typeof indexedDB !== "undefined") {
      const databases = await indexedDB.databases();
      const deletions: Promise<void>[] = [];
      for (const db of databases) {
        if (!db.name || PRESERVED_IDB_DBS.has(db.name)) continue;
        deletions.push(
          new Promise<void>((resolve, reject) => {
            const req = indexedDB.deleteDatabase(db.name!);
            req.onsuccess = () => resolve();
            req.onerror = () => reject(req.error);
            req.onblocked = () => resolve();
          }),
        );
      }
      await Promise.all(deletions);
    }
  } catch {
  }
  window.location.reload();
}
