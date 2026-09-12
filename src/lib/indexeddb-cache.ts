const DB_NAME = "artistgrid-cache";
const DB_VERSION = 1;
const STORE_NAME = "tracker-data";
function openDB(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === "undefined") return Promise.resolve(null);
  return new Promise((resolve) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => resolve(null);
  });
}
export async function idbGet<T>(key: string): Promise<T | null> {
  const db = await openDB();
  if (!db) return null;
  return new Promise((resolve) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);
    const req = store.get(key);
    req.onsuccess = () => resolve(req.result ?? null);
    req.onerror = () => resolve(null);
    tx.oncomplete = () => db.close();
  });
}
export async function idbSet(key: string, value: unknown): Promise<void> {
  const db = await openDB();
  if (!db) return;
  return new Promise((resolve) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    store.put(value, key);
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => {
      db.close();
      resolve();
    };
  });
}
export async function idbDelete(key: string): Promise<void> {
  const db = await openDB();
  if (!db) return;
  return new Promise((resolve) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    store.delete(key);
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => {
      db.close();
      resolve();
    };
  });
}
export async function idbEntries<T>(prefix: string): Promise<Array<[string, T]>> {
  const db = await openDB();
  if (!db) return [];
  return new Promise((resolve) => {
    const results: Array<[string, T]> = [];
    try {
      const tx = db.transaction(STORE_NAME, "readonly");
      const req = tx.objectStore(STORE_NAME).openCursor();
      req.onsuccess = () => {
        const cursor = req.result;
        if (!cursor) return;
        const key = cursor.key;
        if (typeof key === "string" && key.startsWith(prefix)) {
          results.push([key.slice(prefix.length), cursor.value as T]);
        }
        cursor.continue();
      };
      tx.oncomplete = () => {
        db.close();
        resolve(results);
      };
      tx.onerror = () => {
        db.close();
        resolve(results);
      };
      tx.onabort = () => {
        db.close();
        resolve(results);
      };
    } catch {
      db.close();
      resolve(results);
    }
  });
}
