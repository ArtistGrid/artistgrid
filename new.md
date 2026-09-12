# ArtistGrid — Improvement Ideas

Ideas from the full-site audit. Items marked **[done]** were implemented in
the improvement passes; the rest are ranked future work.

## High-impact product ideas

1. **[done] Shareable queue** — "Share queue" button in the queue modal copies
   a `/?queue=…` link; `PlayerProvider` hydrates the queue on load (no
   autoplay) and strips the param from the URL. See
   `src/lib/player-queue-share.ts`.
2. **Track-level "leak date" timeline view** — tried and removed: real
   tracker data (150+ tracks with messy/ranged dates like "Mar 7-8, 2017")
   produced an unreadable wall of overlapping markers. Not worth revisiting
   without a fundamentally different design (e.g. grouped-by-month dropdown).
3. **[done] Favourites export/import** — Export/Import buttons in the
   Favourites tab download/merge an `artistgrid-favourites-*.json` payload.
   See `exportAllFavourites` / `importFavourites` in `src/lib/favourites.ts`.
4. **[done] Offline app shell** — Workbox now precaches HTML/JS/CSS and uses
   `navigateFallback: index.html`, so cold offline loads render the SPA.
5. **[done] Waveform peak caching** — decoded peaks persist per track in
   IndexedDB (`wf:<trackId>`), so revisits skip re-downloading/re-decoding.
6. **[done] Similar tracks via Last.fm** — fullscreen view shows up to 5
   `track.getSimilar` chips when scrobbling is connected (links to Last.fm).
7. **[done] Keyboard-first navigation** — `/` focuses the search box,
   `?` toggles a shortcuts help overlay; queue rows support Alt+↑/↓ reorder.
8. **[done] PWA update toast** — silent SW updates now surface an
   "ArtistGrid updated — Refresh" toast instead of changing version unnoticed.
9. **[done] Download manager persistence** — active jobs persist (metadata
   only, capped at 200 items) and resume automatically after a reload.
10. **[done] Lyrics translation toggle** — Settings → Lyrics exposes
    "Translate Lyrics" (off by default), a LibreTranslate server URL, and a
    target language code. `translateLines` batches lines through a sentinel
    separator and falls back to the original lyrics on any failure.

## Technical improvements

11. **[done] Split `View.tsx`** — extracted `DownloadConfirmDialog`,
    `FavouritesTab`, and deduplicated the Discord SVG icon. The tracker page
    is still substantial; further extraction is incremental polish.
12. **[done] Typed Fuse integration** — `FuseLike`/`FuseConstructor`
    interfaces replace the old `any` pipeline in Home.tsx.
13. **[done] Unified URL extraction audit** — no stragglers left doing raw
    `url || quality || available_length`; everything routes through
    `getAllTrackUrls`.
14. **[done] Abort-aware `resolveUrls`** — preload batches stop between
    batches when the tab switch aborts the controller.
15. **[done] SHA-256 announcement dismissal hashes** — v2 hashes with legacy
    32-bit acceptance + background upgrade; no re-showing for existing users.
16. **[done] E2E smoke tests (Playwright)** — `npm run test:e2e` boots vite,
    mocks the CSV/tracker APIs via route interception, and covers: home grid +
    search filtering, opening a tracker (eras, last-updated), favouriting →
    Favourites tab, and queue-link hydration.
17. **[done] Visual regression snapshots** — `e2e/visual.spec.ts` locks the
    home grid and an expanded era card with `toHaveScreenshot` (2% tolerance,
    deterministic SVG artwork via route mocks). Re-baseline after intentional
    UI changes: `npx playwright test e2e/visual.spec.ts --update-snapshots`.
18. **[done] Error boundary granularity** — each EraCard renders inside its
    own `ChunkErrorBoundary`, so one bad era can't blank the tracker page.
19. **[done] i18n groundwork** — thin `t()` helper with dictionaries, param
    interpolation, locale persistence, `<html lang>`/`dir` handling incl.
    RTL set (`src/lib/i18n.ts`). Home messages migrated as the pattern; adopt
    per-component over time.
20. **[done] Virtualize large lists** — eras over 200 tracks render through a
    windowed list (`VirtualEraTracks`), matching FlatTrackList's behavior.

## Smaller polish

21. **[done]** `<html lang>` + RTL-aware `dir` switching via i18n groundwork.
22. **[done]** Toast stack raised to 3 concurrent toasts.
23. **[done]** Download manager shows byte progress ("12.3 MB / 45 MB").
24. **[done]** Queue modal keyboard reorder via Alt+Up/Down.
25. **[done]** Settings modal closes on Escape.
26. **[done]** `formatRelativeTime`: years unit + future tense ("3d from now").
27. **[done]** `content-visibility: auto` on era cards for cheaper off-screen
    rendering.
28. **[done]** Visitor counter fetch has a 5s timeout and validates the count.

## Bug fixes shipped across the improvement passes (reference)

- IndexedDB tracker-cache persistence was dead code (aggregate key never
  written); now restores per-entry records across sessions (`getCacheAsync`).
- "Play Next" appended to queue end like "Add to Queue"; added real
  insert-at-front semantics (`queueNext`) across all menus.
- Favourites used raw vs normalized URLs inconsistently — era favourites and
  the Favourites tab could miss pillowcase.su→pillows.su style URLs.
- Lyrics panel seek queried a non-existent DOM `<audio>` element; now seeks
  through the player context.
- Download jobs never incremented `failedCount` (progress stuck <100% on
  failures); counts are now derived from item statuses.
- Download watchdog killed slow-but-active transfers; timeout now resets per chunk.
- ZIP exports silently overwrote duplicate filenames; now disambiguated.
- Malformed artists CSV could wipe a good cache; guarded.
- Stale favourites/custom views when switching trackers via header input.
- Clipboard writes had no failure path (silent unhandled rejection).
- Keyboard shortcuts hijacked arrows/space over selects/buttons and fired
  during modifier combos.
- Volume resets to 100% on reload; persisted (clamped) now.
- Repeat-one didn't reschedule scrobbles for repeat listens.
- Modal background scroll lock; DraggablePanel clamping + arrow-key moving.
- Queue modal exit animation never ran (conditional outside AnimatePresence).
- Tracker gid lookup failed for slug-only deep links.
- Settings loader hardened against corrupted sections/font types.
- api.ts etag/body caches bounded; 304-with-evicted-body now refetches.
- SEO middleware catch referenced out-of-scope variable.
