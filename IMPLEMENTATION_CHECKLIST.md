# Implementation Checklist

## 🔴 Critical Path (Do First - ~30 min)

### Phase 1: API Error Handling (src/lib/resolve-url.ts)

- [ ] **KrakenFiles** - Add response check + timeout
  - [ ] Add `if (!res.ok) return null;` after fetch
  - [ ] Add `{ signal: AbortSignal.timeout(8000) }` to fetch
  - [ ] Wrap in try/catch
  - Lines to modify: 95-100

- [ ] **Imgur** - Add timeout + try/catch
  - [ ] Add `{ signal: AbortSignal.timeout(8000) }` to fetch
  - [ ] Wrap in try/catch
  - Lines to modify: 103-108

- [ ] **Qobuz** - Add timeout + try/catch
  - [ ] Add `{ signal: AbortSignal.timeout(10000) }` to fetch
  - [ ] Wrap in try/catch
  - Lines to modify: 134-139

- [ ] **Tidal** - Add try/catch (already has timeout)
  - [ ] Verify `if (!res.ok)` exists
  - [ ] Wrap entire case in try/catch if not already
  - Lines to modify: 117-132

- [ ] **Froste** - Add timeout (currently just returns formatted URL)
  - [ ] This one needs the URL directly, so add timeout to any fetch if added
  - [ ] Lines: 92-93

- [ ] **SoundCloud** - Add timeout + try/catch
  - [ ] Add `{ signal: AbortSignal.timeout(8000) }` if fetch added
  - [ ] Lines: 114-116

- [ ] **Pixeldrain** - Already has retries, verify error handling
  - [ ] Verify try/catch structure is complete
  - [ ] Lines: 75-90

### Phase 2: Download Limits (src/components/download-manager.tsx)

- [ ] **Increase ZIP Size Limit**
  - [ ] Change line 8: `MAX_ZIP_SIZE = 500 * 1024 * 1024` → `MAX_ZIP_SIZE = 2 * 1024 * 1024 * 1024`
  - [ ] 1 line change

- [ ] **Increase Retry Attempts**
  - [ ] Change line 12: `MAX_RETRY_ATTEMPTS = 2` → `MAX_RETRY_ATTEMPTS = 5`
  - [ ] 1 line change

- [ ] **Add Download Timeout**
  - [ ] In `downloadFileAsBlob()` function, add `{ signal: AbortSignal.timeout(30000) }` to fetch
  - [ ] Around line 65-70

- [ ] **Add File Size Validation**
  - [ ] Add check after getting contentLength: `if (total > MAX_ZIP_SIZE) return null;`
  - [ ] Add check during streaming to prevent exceeding limit
  - [ ] Around lines 65-100

---

## 🟡 High Priority (Do Next - ~30 min)

### Phase 3: Tracker Loading (src/pages/View.tsx)

- [ ] **Add Error State**
  - [ ] Add state: `const [loadError, setLoadError] = useState<string | null>(null);`
  - [ ] Around line 120

- [ ] **Improve Error Logging**
  - [ ] Modify `fail()` function to accept reason parameter
  - [ ] Log different messages for different failure types:
    - "Redirect detected - tracker may be restricted"
    - "Server error: {status} {statusText}"
    - "Invalid response format from server"
    - "Tracker contains no era data"
    - "Network error: {error message}"
  - [ ] Around lines 356-390

- [ ] **Update UI to Show Errors**
  - [ ] Pass `loadError` to FallbackView component
  - [ ] Display error message in error state
  - [ ] Show toast for tab errors

### Phase 4: Tidal API Smart Selection (src/lib/resolve-url.ts)

- [ ] **Add Health Tracking**
  - [ ] Add `TIDAL_API_HEALTH` Map to track failures
  - [ ] Modify `selectTidalApi()` to be health-aware
  - [ ] Add `recordTidalFailure()` function
  - [ ] Update Tidal case to call recordFailure on error
  - [ ] Around lines 16-23

---

## 🟢 Nice to Have (Lower Priority)

### Phase 5: Artist Status Updates (src/pages/Home.tsx)

- [ ] **Use Real-Time Tracker Status**
  - [ ] The `/tested` endpoint is already being fetched (lines 89-93)
  - [ ] Use this to override CSV `isLinkWorking` status
  - [ ] Around line 110-120

### Phase 6: Cache Management (UI Enhancement)

- [ ] **Add Cache Clear Button**
  - [ ] Add button to FilterControls component
  - [ ] Clears all localStorage cache keys
  - [ ] Reloads page
  - [ ] In src/components/home/header.tsx

---

## Testing Checklist

### After Implementing Critical Fixes:

- [ ] **Test KrakenFiles Song**
  - [ ] Find a song with KrakenFiles source
  - [ ] Try to play it
  - [ ] Should either play or show clear error, not hang

- [ ] **Test Qobuz Song**
  - [ ] Find a song with Qobuz source  
  - [ ] Try to play it
  - [ ] Should resolve correctly or show error

- [ ] **Test Large Album Download**
  - [ ] Find album with 100+ tracks
  - [ ] Attempt download
  - [ ] Should succeed if < 2GB, not fail at 500MB

- [ ] **Test Slow Network**
  - [ ] Open DevTools > Network
  - [ ] Set to "Slow 3G"
  - [ ] Try loading a tracker
  - [ ] Should timeout gracefully after 8-10 seconds, not hang forever

- [ ] **Test Tab Loading**
  - [ ] Load a tracker with multiple tabs
  - [ ] Switch between tabs
  - [ ] All tabs should load or show specific error message

---

## Files Summary

### Need to Edit:
1. **src/lib/resolve-url.ts** - 7 cases, ~40 lines of changes
2. **src/components/download-manager.tsx** - 2 lines + 2 functions, ~30 lines
3. **src/pages/View.tsx** - Error handling updates, ~50 lines

### Total Changes: ~120 lines across 3 files

---

## Commit Strategy

### Commit 1: Critical API Fixes
```
fix: Add response checks and timeouts to URL resolution APIs

- Add response status checks before JSON parsing (KrakenFiles, Imgur, Qobuz)
- Add 8-10 second timeouts to all fetch calls in resolve-url.ts
- Prevent crashes and hangs when APIs return errors
- Affects: KrakenFiles, Imgur, Qobuz, Tidal, Pixeldrain

Fixes: Songs not loading from these sources
```

### Commit 2: Download Reliability Fixes
```
fix: Improve album download reliability and safety

- Increase MAX_ZIP_SIZE from 500MB to 2GB
- Increase MAX_RETRY_ATTEMPTS from 2 to 5
- Add file size validation before downloading
- Add timeout to download requests

Fixes: Albums failing to download, large albums rejected
```

### Commit 3: Better Error Messages
```
fix: Add detailed error messages for tracker loading

- Log specific failure reasons instead of generic errors
- Show error messages to users in UI
- Distinguish between API errors, network errors, and invalid data

Improves: Debuggability and user experience
```

### Commit 4: Tidal Failover (Optional)
```
fix: Smart Tidal API selection based on health

- Track failures per Tidal API endpoint
- Prefer healthy endpoints
- Auto-recover after 5 minutes
- Reduce intermittent Tidal failures

Improves: Tidal song reliability
```

---

## Progress Tracking

Start Date: ___________

### Phase 1: API Error Handling
- Start: ___________
- End: ___________
- Status: [ ] Complete

### Phase 2: Download Limits  
- Start: ___________
- End: ___________
- Status: [ ] Complete

### Phase 3: Error Messages
- Start: ___________
- End: ___________
- Status: [ ] Complete

### Phase 4: Tidal Failover
- Start: ___________
- End: ___________
- Status: [ ] Complete (Optional)

### Testing
- Start: ___________
- End: ___________
- Status: [ ] Complete

---

## Resources

- **Issue Details:** See `ISSUES_FOUND.md`
- **Code Examples:** See `BEFORE_AFTER_FIXES.md`  
- **Implementation Guide:** See `FIXES_GUIDE.md`
- **Quick Reference:** See `QUICK_REFERENCE.md`

