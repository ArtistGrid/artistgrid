import { ARTIST_DIRECTORY_MAX_BYTES, getDirectTrackerId, parseArtistsCsv } from '../src/lib/artists';
import { ARTISTS_CSV } from '../src/lib/home-constants';
import { readResponseText, withDeadline } from '../src/lib/request';
import { SITE_ORIGIN, trackerCanonicalUrl } from '../src/lib/seo';
import { escapeHtml } from './_bot-renderer.js';

export const SITEMAP_CACHE_KEY = 'seo:sitemap:v1';
export const SITEMAP_MAX_AGE = 86400;
const RETENTION_SECONDS = SITEMAP_MAX_AGE * 7;
const STATIC_PAGES = ['/', '/donate'];

export function buildSitemap(artists) {
  const urls = new Set(STATIC_PAGES.map((path) => `${SITE_ORIGIN}${path}`));
  for (const artist of artists) {
    try {
      const id = getDirectTrackerId(artist.url);
      if (id) urls.add(trackerCanonicalUrl(id.includes('.') ? id.toLowerCase() : id));
    } catch {
      // Malformed directory links are not sitemap entries.
    }
  }
  if (urls.size > 50000) throw new Error('Artist directory requires a sitemap index');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${[
    ...urls,
  ]
    .sort()
    .map((url) => `  <url><loc>${escapeHtml(url)}</loc></url>`)
    .join('\n')}\n</urlset>`;
}

function validSnapshot(value, now) {
  return (
    value &&
    typeof value.xml === 'string' &&
    value.xml.startsWith('<?xml ') &&
    value.xml.endsWith('</urlset>') &&
    typeof value.etag === 'string' &&
    /^"[a-f0-9]{64}"$/.test(value.etag) &&
    Number.isFinite(value.generatedAt) &&
    value.generatedAt <= now &&
    now - value.generatedAt < RETENTION_SECONDS * 1000
  );
}

function xmlResponse(request, snapshot, cacheState) {
  const headers = {
    'Content-Type': 'application/xml; charset=UTF-8',
    'Cache-Control': cacheState === 'STALE' ? 'public, max-age=60' : 'public, max-age=300, s-maxage=300',
    'X-Content-Type-Options': 'nosniff',
    'X-Sitemap-Cache': cacheState,
    ETag: snapshot.etag,
  };
  const unchanged = request.headers
    .get('If-None-Match')
    ?.split(',')
    .some((value) => {
      const tag = value.trim();
      return tag === '*' || tag.replace(/^W\//, '') === snapshot.etag;
    });
  return new Response(unchanged || request.method === 'HEAD' ? null : snapshot.xml, {
    status: unchanged ? 304 : 200,
    headers,
  });
}

function unavailable() {
  return new Response('Sitemap temporarily unavailable', {
    status: 503,
    headers: { 'Cache-Control': 'no-store', 'Retry-After': '60', 'X-Robots-Tag': 'noindex, follow' },
  });
}

export async function onRequest(context) {
  const { request, env } = context;
  if (!['GET', 'HEAD'].includes(request.method)) {
    return new Response('Method not allowed', { status: 405, headers: { Allow: 'GET, HEAD' } });
  }
  if (!env.SEO_CACHE) return unavailable();
  let cached;
  try {
    const value = await env.SEO_CACHE.get(SITEMAP_CACHE_KEY, { type: 'json', cacheTtl: 60 });
    if (validSnapshot(value, Date.now())) cached = value;
  } catch {
    console.warn(JSON.stringify({ event: 'sitemap_cache_read_failed' }));
  }
  if (cached && Date.now() - cached.generatedAt < SITEMAP_MAX_AGE * 1000) {
    return xmlResponse(request, cached, 'HIT');
  }
  try {
    const artists = await withDeadline(5000, async (signal) => {
      const response = await fetch(ARTISTS_CSV, { signal });
      if (!response.ok) throw new Error('Directory unavailable');
      const csv = await readResponseText(response, ARTIST_DIRECTORY_MAX_BYTES, signal);
      if (!parseArtistsCsv(csv).length) throw new Error('Directory unavailable');
      return parseArtistsCsv(csv, { onlyWorking: true });
    });
    const xml = buildSitemap(artists);
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(xml));
    const etag = `"${Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')}"`;
    const snapshot = { xml, etag, generatedAt: Date.now() };
    // Keep the last good result for outages; freshness is still limited to one day.
    try {
      await env.SEO_CACHE.put(SITEMAP_CACHE_KEY, JSON.stringify(snapshot), { expirationTtl: RETENTION_SECONDS });
    } catch {
      console.warn(JSON.stringify({ event: 'sitemap_cache_write_failed' }));
    }
    return xmlResponse(request, snapshot, 'MISS');
  } catch {
    if (cached) return xmlResponse(request, cached, 'STALE');
    return unavailable();
  }
}
