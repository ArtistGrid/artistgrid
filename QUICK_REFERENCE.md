# 🚨 Quick Reference: Critical Issues Found

## Songs Not Loading/Working

### Root Causes:
1. **API Error Responses Not Checked** ❌
   - KrakenFiles, Imgur, Qobuz endpoints don't validate `res.ok` before parsing JSON
   - When API returns error, code crashes trying to parse error response as JSON
   - Silent failure → user sees "not playable"

2. **Missing Timeouts on Fetch Calls** ❌  
   - KrakenFiles, Imgur, Froste, SoundCloud have no timeout
   - Slow API = app hangs indefinitely
   - Users think it's broken but it's just waiting

3. **No Error Distinction** ❌
   - All errors return `null` - could be API down, CORS blocked, network timeout, etc.
   - Impossible to debug or retry intelligently

---

## Albums Can't Be Downloaded

### Root Causes:
1. **ZIP Size Limit Too Small** ❌
   - `MAX_ZIP_SIZE = 500MB` hardcoded
   - Any album > 500MB fails silently
   - **Fix:** Increase to 2GB

2. **No File Size Validation** ❌
   - Downloads don't check size before fetching
   - Could start downloading a 1GB file into a 100MB ZIP
   - **Fix:** Check `Content-Length` header first

3. **Only 2 Retry Attempts** ❌
   - Network blip = immediate failure
   - **Fix:** Increase to 5 retries

---

## Artists Show "Not Working"

### Root Causes:
1. **Stale CSV Data** ❌
   - `isLinkWorking` flag comes from CSV file
   - CSV might be outdated or incorrect
   - No real-time verification

2. **No Integration with `/tested` Endpoint** ❌
   - There's a `/tested` endpoint that shows which trackers actually work
   - But it's not being used to override CSV status
   - **Fix:** Use real-time endpoint data to override CSV flags

3. **Missing Error Messages** ❌
   - When tracker fails to load, user sees generic error
   - Doesn't know if: tracker is down, invalid ID, network issue, etc.
   - **Fix:** Add detailed error messages

---

## Quick Fixes (Do These First)

### 1. Add Response Checks (5 minutes)
```typescript
// Before parsing JSON, ALWAYS check:
if (!res.ok) return null;
const data = await res.json();
```

### 2. Add Timeouts (10 minutes)
```typescript
// Every fetch needs a timeout
fetch(url, { signal: AbortSignal.timeout(8000) })
```

### 3. Increase ZIP Limit (1 minute)
```typescript
// src/components/download-manager.tsx line 8
const MAX_ZIP_SIZE = 2 * 1024 * 1024 * 1024;  // 2GB
```

---

## Files To Edit

| File | Issue | Lines |
|------|-------|-------|
| `src/lib/resolve-url.ts` | Missing response checks, no timeouts | 75-144 |
| `src/components/download-manager.tsx` | Small ZIP limit, no size validation | 8, 65-100, 265-297 |
| `src/pages/View.tsx` | No error details, missing feedback | 356-390 |
| `src/pages/Home.tsx` | Stale CSV data, `/tested` not used | 89-93, 110-120 |

---

## Testing These Issues

### Test 1: Try playing a song from KrakenFiles source
- **Current:** Shows "not playable" or hangs
- **After fix:** Should play or show clear error

### Test 2: Download album with 100+ tracks  
- **Current:** Fails at ZIP creation if > 500MB
- **After fix:** Should support up to 2GB

### Test 3: Check artist that shows "not working"
- **Current:** Shows "not working" from CSV
- **After fix:** Will verify against real-time `/tested` endpoint

---

## See Also
- `ISSUES_FOUND.md` - Detailed breakdown of all 10 issues
- `FIXES_GUIDE.md` - Code snippets for each fix

