# Recommended Fixes

## Priority 0: Critical Fixes

### Fix 1: Add Response Status Checks to All API Calls
**File:** `src/lib/resolve-url.ts`

Replace the broken cases with proper error handling:

```typescript
case "krakenfiles": {
  const id = extractKrakenId(normalized);
  if (!id) return null;
  try {
    const res = await fetch(`${KRAKENFILES_API}${id}`, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;  // ✅ ADD THIS
    const data = await res.json();
    return data.success ? data.m4a : null;
  } catch {
    return null;
  }
}

case "imgur": {
  const id = extractImgurId(normalized);
  if (!id) return null;
  try {
    const res = await fetch(`${IMGUR_API}${id}`, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;  // ✅ ADD THIS
    const data = await res.json();
    return data.cdnUrl || null;
  } catch {
    return null;
  }
}

case "qobuz": {
  const id = extractQobuzId(normalized);
  if (!id) return null;
  try {
    const res = await fetch(`${QOBUZ_API}?track_id=${id}&quality=27`, { signal: AbortSignal.timeout(10000) });
    if (!res.ok) return null;  // ✅ ADD THIS
    const data = await res.json();
    return data?.data?.url || null;
  } catch {
    return null;
  }
}

case "tidal": {
  const id = extractTidalId(normalized);
  if (!id) return null;
  try {
    const apiBase = selectTidalApi();
    const res = await fetch(`${apiBase}/track/?id=${id}&quality=HI_RES_LOSSLESS`, {
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return null;  // ✅ ADD THIS (might be there already)
    const data = await res.json();
    if (data?.data?.manifest) {
      const manifestJson = JSON.parse(atob(data.data.manifest));
      if (manifestJson?.urls?.[0]) return manifestJson.urls[0];
    }
    return null;
  } catch {
    return null;
  }
}
```

---

### Fix 2: Increase ZIP Size Limit for Albums
**File:** `src/components/download-manager.tsx` (Line 8)

```typescript
// Change from 500MB to 2GB to accommodate larger albums
const MAX_ZIP_SIZE = 2 * 1024 * 1024 * 1024;  // 2GB instead of 500MB
```

---

### Fix 3: Add Proper Timeout to All Fetch Calls
**File:** `src/lib/resolve-url.ts`

Apply timeouts consistently:
- Pixeldrain: 8 seconds
- KrakenFiles: 8 seconds
- Imgur: 8 seconds
- Qobuz: 10 seconds
- Tidal: 10 seconds
- Froste: 8 seconds
- Soundcloud: 8 seconds

---

### Fix 4: Improve Tracker Data Load Error Handling
**File:** `src/pages/View.tsx` (Lines 356-390)

```typescript
const fail = (reason?: string) => {
  console.error(`Tracker load failed: ${reason || 'unknown error'}`);
  if (tab) {
    setData(null);
    setTabError(true);
    setStatus("success");
    // Show toast to user
    toast({
      title: "Tab not found",
      description: `The requested tab "${tab}" could not be loaded.`,
      variant: "destructive"
    });
  } else {
    setStatus("fallback");
  }
};

// Then update the calls:
try {
  const endpoint = tab ? `/get/${id}?tab=${encodeURIComponent(tab)}` : `/get/${id}`;
  const res = await fetchWithFallback(endpoint, { redirect: "manual" });
  
  if (res.type === "opaqueredirect") {
    fail("Redirect detected - tracker may be restricted");
    return;
  }
  if (!res.ok) {
    fail(`Server error: ${res.status} ${res.statusText}`);
    return;
  }
  
  const json: TrackerResponse = await res.json();
  if (!json || typeof json !== "object" || !json.eras || Object.keys(json.eras).length === 0) {
    fail("No eras found in tracker data");
    return;
  }
  
  // ... rest of code
} catch (error) {
  fail(`Network error: ${error instanceof Error ? error.message : 'Unknown'}`);
}
```

---

## Priority 1: High Impact Fixes

### Fix 5: Better Tidal API Failover
**File:** `src/lib/resolve-url.ts`

```typescript
// Replace the simple rotation with smart selection
const TIDAL_API_HEALTH = new Map<string, { failures: number; lastFailTime: number }>();

const selectTidalApi = (): string => {
  const now = Date.now();
  const apis = TIDAL_APIS.map((api) => {
    const health = TIDAL_API_HEALTH.get(api.baseUrl) || { failures: 0, lastFailTime: 0 };
    // Reset failures after 5 minutes
    if (now - health.lastFailTime > 5 * 60 * 1000) {
      health.failures = 0;
    }
    return { ...api, health };
  });
  
  // Sort by health (fewer failures first)
  apis.sort((a, b) => a.health.failures - b.health.failures);
  return apis[0].baseUrl;
};

// Track failures
const recordTidalFailure = (apiUrl: string) => {
  const health = TIDAL_API_HEALTH.get(apiUrl) || { failures: 0, lastFailTime: 0 };
  health.failures++;
  health.lastFailTime = Date.now();
  TIDAL_API_HEALTH.set(apiUrl, health);
};
```

---

### Fix 6: Increase Retry Attempts
**File:** `src/components/download-manager.tsx` (Line 12)

```typescript
// Increase from 2 to 5 retries for better reliability on unstable connections
const MAX_RETRY_ATTEMPTS = 5;
```

---

### Fix 7: Add Request Validation Before Download
**File:** `src/components/download-manager.tsx` (Lines 65-100)

```typescript
async function downloadFileAsBlob(
  url: string,
  onProgress?: (loaded: number, total: number) => void
): Promise<{
  blob: Blob;
  contentType: string;
} | null> {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(30000) });
    if (!response.ok) return null;
    
    const contentLength = response.headers.get("content-length");
    const total = contentLength ? parseInt(contentLength, 10) : 0;
    
    // ✅ ADD: Validate file size before downloading
    if (total > MAX_ZIP_SIZE) {
      console.error(`File too large: ${total} bytes > ${MAX_ZIP_SIZE} bytes`);
      return null;
    }
    
    if (!response.body) {
      const blob = await response.blob();
      const contentType = response.headers.get("content-type") || "";
      return { blob, contentType };
    }
    
    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let loaded = 0;
    
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      
      // ✅ ADD: Stop if we exceed size limit
      if (total && loaded + value.length > MAX_ZIP_SIZE) {
        console.error("Download exceeded maximum file size");
        return null;
      }
      
      chunks.push(value);
      loaded += value.length;
      if (onProgress && total) onProgress(loaded, total);
    }
    
    const blob = new Blob(chunks as BlobPart[]);
    const contentType = response.headers.get("content-type") || "";
    return { blob, contentType };
  } catch (error) {
    console.error("Download error:", error);
    return null;
  }
}
```

---

## Priority 2: UX Improvements

### Fix 8: Add Detailed Error Messages
Add a new error tracking context:

```typescript
// In View.tsx
const [loadError, setLoadError] = useState<string | null>(null);

// Then show in UI:
{status === "error" && (
  <div className="flex items-center justify-center py-12 sm:py-20">
    <div className="text-center bg-neutral-900 border border-red-500/30 p-6 sm:p-8 rounded-xl max-w-md">
      <h2 className="text-lg sm:text-xl font-bold text-white mb-2">Error Loading Data</h2>
      {loadError && <p className="text-red-400 text-sm">{loadError}</p>}
    </div>
  </div>
)}
```

---

### Fix 9: Add Manual Cache Clear Button
Add to Home.tsx header:

```typescript
const handleClearCache = useCallback(() => {
  localStorage.removeItem(LOCAL_STORAGE_KEYS.CSV_CACHE_LOCAL);
  localStorage.removeItem(LOCAL_STORAGE_KEYS.CSV_CACHE_REMOTE);
  localStorage.removeItem(LOCAL_STORAGE_KEYS.TRENDS_CACHE);
  location.reload();
}, []);

// Add to FilterControls:
<Button
  variant="ghost"
  size="sm"
  onClick={handleClearCache}
  className="text-xs text-neutral-500 hover:text-white"
>
  Clear Cache
</Button>
```

---

## Implementation Priority Order

1. **This Week:** Fix 1, 2, 3 (critical - blocks core functionality)
2. **Next Week:** Fix 4, 5, 6 (high impact - reliability)
3. **Following Week:** Fix 7, 8, 9 (UX improvements)

