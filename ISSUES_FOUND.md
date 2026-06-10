# ArtistGrid Pipeline Issues Report

## Critical Issues Found

### 1. **Missing Error Handling in API Calls** 🔴
**File:** `src/lib/resolve-url.ts` (Lines 95-100)

**Problem:** Several API endpoints don't check for response status before attempting to parse JSON:
```typescript
// BROKEN - No error handling for failed responses
const res = await fetch(`${KRAKENFILES_API}${id}`);
const data = await res.json();  // Will throw if response is not OK
return data.success ? data.m4a : null;
```

**Affected Sources:**
- KrakenFiles
- Imgur  
- Qobuz
- Tidal

**Impact:** When these APIs return error responses, the code crashes and returns null, making songs appear unplayable.

**Fix Needed:** Add `if (!res.ok) return null;` checks before parsing JSON

---

### 2. **Silent Failures in URL Resolution** 🔴
**File:** `src/lib/resolve-url.ts` (Lines 146-148)

**Problem:** All errors are caught and silently logged:
```typescript
} catch (error) {
  console.error(`Error resolving ${source} URL:`, error);
  return null;  // No distinction between different error types
}
```

**Impact:** Network timeouts, CORS errors, and API failures all look the same. No way to distinguish recoverable vs non-recoverable errors.

---

### 3. **Missing Timeout on Critical API Calls** 🟡
**File:** `src/lib/resolve-url.ts`

**Problem:** Most fetch calls have no timeout:
```typescript
const res = await fetch(`${IMGUR_API}${id}`);  // No timeout!
```

Only Tidal has a timeout (10 seconds).

**Impact:** If an API is slow or unresponsive, the entire track resolution hangs.

---

### 4. **No Fallback for Failed API Responses** 🟡
**File:** `src/lib/resolve-url.ts` (Lines 75-90 - Pixeldrain case)

**Problem:** Pixeldrain tries 3 API endpoints but doesn't properly handle network errors:
```typescript
for (const base of PIXELDRAIN_APIS) {
  try {
    const res = await fetch(`${base}/goy/dl/${match[1]}`);
    if (res.ok) {
      // ...
    }
  } catch {
    continue;  // Swallows errors silently
  }
}
```

**Impact:** If all three endpoints fail, returns null without any logging.

---

### 5. **Artist "Not Working" Status Issues** 🔴
**File:** `src/pages/Home.tsx` (Lines 110-120)

**Problem:** Artists are marked as "not working" based on `isLinkWorking` property from CSV:
```typescript
parsed.push({
  name: newName,
  url,
  imageFilename: getImageFilename(newName),
  isLinkWorking: links_work === TripleBool.YES,  // This determines "not working"
  isUpdated: updated === TripleBool.YES,
  isStarred: best === TripleBool.YES,
});
```

**Impact:** If the CSV data is stale or incorrect, artists show as "not working" even if they're actually fine.

**Related Issue:** The `/tested` endpoint at line 89-93 should be used to override the CSV status in real-time.

---

### 6. **Album Download Failures** 🟡
**File:** `src/components/download-manager.tsx`

**Problems:**
- **Line 8:** `MAX_ZIP_SIZE = 500 * 1024 * 1024` (500MB) - This is too small for many albums
- **Line 12:** `MAX_RETRY_ATTEMPTS = 2` - Only 2 retries might not be enough
- **Line 65:** `downloadFileAsBlob()` doesn't check response headers for file size before downloading
- **Line 265-297:** No handling for partial downloads or corrupted files

**Impact:** Large albums fail silently, and there's no size validation before attempting downloads.

---

### 7. **Tidal API Rotation Issue** 🟡
**File:** `src/lib/resolve-url.ts` (Lines 16-23)

**Problem:** The Tidal API selection uses a simple counter that rotates:
```typescript
const selectTidalApi = (() => {
  let i = 0;
  return (): string => {
    const { baseUrl } = TIDAL_APIS[i];
    i = (i + 1) % TIDAL_APIS.length;
    return baseUrl;
  };
})();
```

**Impact:** If one API endpoint is down, it will be used 1 out of 7 times, causing intermittent failures.

---

### 8. **Tracker Data Load Failures** 🔴
**File:** `src/pages/View.tsx` (Lines 356-385)

**Problem:** When tracker data fails to load, the FallbackView is shown, but there's no distinction between:
- API server down
- Invalid tracker ID
- Network connectivity issues

**Code Issue:** The `fail()` function doesn't provide user feedback on WHY it failed:
```typescript
const fail = () => {
  if (tab) {
    setData(null);
    setTabError(true);
    setStatus("success");
  } else {
    setStatus("fallback");
  }
};
```

---

### 9. **Cache Invalidation Issues** 🟡
**File:** `src/lib/cache.ts` & `src/pages/View.tsx`

**Problem:** Cache expiry is set per data source but there's no manual cache clear option for users when they encounter stale data.

**Impact:** Users might see old tracker data indefinitely until the cache expires.

---

### 10. **Missing CORS/Network Error Details** 🟡
**File:** `src/lib/resolve-url.ts` (Lines 146-148)

**Problem:** Network errors are logged but never shown to users. Users don't know if:
- URL resolution failed
- API is down
- Their internet is slow
- CORS blocked the request

---

## Summary Table

| Issue | Severity | Affects | Fix Priority |
|-------|----------|---------|--------------|
| Missing response checks before JSON parsing | Critical | Songs won't load | P0 |
| Silent API failures | High | Debug impossible | P0 |
| No timeouts on API calls | High | Hangs entire app | P1 |
| Small ZIP size limit (500MB) | High | Album downloads fail | P1 |
| Artist status from stale CSV | High | Artists show "not working" | P1 |
| No Tidal API failover strategy | Medium | Intermittent Tidal failures | P2 |
| Limited retry attempts (2) | Medium | Network hiccups fail immediately | P2 |
| No user-facing error messages | Medium | Poor UX | P2 |
| Cache never manually cleared | Low | Stale data until expiry | P3 |

