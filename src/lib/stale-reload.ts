// Detects the class of errors caused by a stale deployment: a browser holding an
// old index.html that references JS chunk hashes which no longer exist on the CDN.
// Those requests 404 and return an HTML error page, which surfaces as a MIME-type
// error, a chunk-load failure, or a parse error when the HTML is injected as a
// script. A single reload pulls the fresh assets and clears the condition.
let attempted = false;

const STALE_PATTERNS = [
  "is not a valid JavaScript MIME type",
  "Failed to fetch dynamically imported module",
  "Importing a module script failed",
  "Unexpected token",
  /Loading chunk [\d]+ failed/,
];

export function isStaleAssetError(message: string): boolean {
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
