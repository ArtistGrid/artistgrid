
function isQuotaExceededError(e: unknown): boolean {
  return (
    e instanceof DOMException &&
    (e.name === "QuotaExceededError" ||
      e.name === "NS_ERROR_DOM_QUOTA_REACHED" ||
      e.code === 22 ||
      e.code === 1014)
  );
}

function isNonEssentialKey(key: string | null): boolean {
  if (!key) return false;
  return (
    key === "artistgrid-history:v1" ||
    key.includes("CsvCache") ||
    key.startsWith("artistgrid-cache")
  );
}

function evictNonEssential(): void {
  const keys: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (isNonEssentialKey(k)) keys.push(k as string);
  }
  for (const k of keys) {
    try {
      localStorage.removeItem(k);
    } catch {
    }
  }
}

export function safeSetItem(key: string, value: string): boolean {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch (e) {
    if (isQuotaExceededError(e)) {
      evictNonEssential();
      try {
        localStorage.setItem(key, value);
        return true;
      } catch {
        return false;
      }
    }
    return false;
  }
}


