# ArtistGrid

## Cloudflare Pages

`npm run build` runs the tests, builds the React app, and compiles the Pages
Functions into `dist/_worker.js`. Deploy the entire `dist` output so the sitemap
and bot-rendered pages are included.

- Local preview: `npm run dev:pages`
- Deploy: `CLOUDFLARE_ACCOUNT_ID=437166d9026f3443e3de30f527ed6d80 npm run deploy:pages`

The `SEO_CACHE` KV binding is configured in `wrangler.jsonc`. Local Pages preview
uses local KV; production uses the configured Cloudflare namespace.

`/sitemap.xml` includes the homepage, donation page, and deduplicated canonical
artist tracker URLs from `artists.csv`. Rows explicitly marked as unavailable
are excluded. Tab pages are discovered through the tracker navigation, and
duplicate `/view?id=…` and `/main/` URLs are excluded from the sitemap.

The sitemap is refreshed on the first request after 24 hours. The last good
snapshot is retained for seven days so CSV outages can serve a valid stale
sitemap. No synthetic modification dates are emitted.

## Performance checks

Local Chromium checks use a 390×844 viewport, cold cache, 4× CPU slowdown and
1.6 Mbps bandwidth. These are synthetic checks, not field Core Web Vitals.

| Change                                       | Observation                                                                | Result                                        |
| -------------------------------------------- | -------------------------------------------------------------------------- | --------------------------------------------- |
| Reserve tracker cover dimensions             | Delayed-cover CLS 0.101 → 0                                                | Kept                                          |
| Stabilize the loading layout                 | Tracker CLS about 0.140 → 0.0025                                           | Kept                                          |
| Load only the monitoring SDK exports in use  | Monitoring transfer about 154 KB → 48 KB                                   | Kept; error reporting and tracing retained    |
| Reuse the initial artist-directory download  | CSV requests 2 → 1                                                         | Kept                                          |
| Preload the tracker route's JavaScript       | Route download starts during HTML parsing                                  | Kept                                          |
| Preload the full tracker API response        | Contended with critical JavaScript downloads                               | Reverted                                      |
| Share a low-priority initial tracker fetch   | Direct-ID API request starts about 0.25s rather than 2.9s into a cold load | Kept; cancelled when cached data is available |
| Prepare playable URLs after the first render | Large tracker content renders before the background URL scan               | Kept; request-generation checks retained      |

The initial fetch is shared with the normal tracker loader; it does not download
the same dataset twice. Direct Sheet IDs, published Sheet IDs and tracker domains
start early, while artist-name routes continue through directory resolution.
Network failures retry through the normal request, and navigation cancellation
also cancels the shared download. Tracker credits remain visible as plain text.

The large-tracker synthetic check moved from approximately 5.7s to 5.2s LCP with
the loading changes. This remains a lab measurement, not a field CWV pass or an
API-payload reduction.
