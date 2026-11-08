// functions/_bot-renderer.js
import {
  ARTIST_DIRECTORY_MAX_BYTES,
  ARTIST_DIRECTORY_TIMEOUT,
  findMatchingArtist,
  getDirectTrackerId,
  parseArtistsCsv,
} from '../src/lib/artists';
import {
  extractTrackerId,
  getCleanArtistName,
  getImageFilename,
  getArtistNameFromSheetTitle,
} from '../src/lib/artist-utils';
import { readResponseText, withDeadline } from '../src/lib/request';
import { parseTrackerLink, trackerPath } from '../src/lib/tracker-route';
import { ASSETS_ORIGIN, SITE_ORIGIN, cleanTabName, trackerCanonicalUrl } from '../src/lib/seo';

export const BOT_RE =
  /discordbot|twitterbot|facebookexternalhit|bingbot|googlebot|slurp|whatsapp|pinterest|slackbot|telegrambot|linkedinbot|mastodon|signal|snapchat|redditbot|skypeuripreview|viberbot|linebot|embedly|quora|outbrain|tumblr|duckduckbot|yandexbot|rogerbot|showyoubot|kakaotalk|naverbot|seznambot|mediapartners|adsbot|petalbot|applebot|ia_archiver|curl|wget|bytespider/i;

const ARTISTS_CSV_URL = 'https://artists.artistgrid.cx/artists.csv';
const ASSETS_BASE = ASSETS_ORIGIN;
const API_BASE = 'https://trackerapi.artistgrid.cx';

export function escapeHtml(s) {
  if (!s) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

let cachedArtists = null;
let cacheTime = 0;

export async function loadArtistsData(signal) {
  if (cachedArtists && Date.now() - cacheTime < 3600000) {
    return cachedArtists;
  }
  try {
    const fresh = await withDeadline(
      ARTIST_DIRECTORY_TIMEOUT,
      async (directorySignal) => {
        const res = await fetch(ARTISTS_CSV_URL, {
          signal: directorySignal,
          cf: { cacheTtlByStatus: { '200-299': 86400, '400-599': -1 } },
        });
        if (!res.ok) throw new Error('Directory unavailable');
        const rows = parseArtistsCsv(await readResponseText(res, ARTIST_DIRECTORY_MAX_BYTES, directorySignal));
        if (!rows.length) throw new Error('Directory unavailable');
        return rows;
      },
      signal
    );
    cachedArtists = fresh;
    cacheTime = Date.now();
    return cachedArtists;
  } catch (e) {
    if (signal.aborted) throw e;
    if (cachedArtists?.length) return cachedArtists;
    throw e;
  }
}

function getTrackTitle(t) {
  if (!t) return '';
  if (typeof t === 'string') return t.trim();
  if (typeof t.name === 'object' && t.name) {
    const title = typeof t.name.title === 'string' ? t.name.title.trim() : '';
    return title || (typeof t.name.raw === 'string' ? t.name.raw.trim() : '');
  }
  if (typeof t.name === 'string') return t.name.trim();
  if (typeof t.title === 'string') return t.title.trim();
  return '';
}

function text(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function tabName(value) {
  return cleanTabName(value);
}

function validTabSlug(value) {
  return typeof value === 'string' && !!value.trim() && !['.', '..'].includes(value) && !/[\uD800-\uDFFF]/u.test(value);
}

function trackDuration(value) {
  if (!/^\d+:[0-5]\d$/.test(value)) return '';
  const [minutes, seconds] = value.split(':').map(Number);
  const total = minutes * 60 + seconds;
  return Number.isSafeInteger(total) && total > 0 ? `PT${total}S` : '';
}

export function documentResponse(response) {
  const result = new Response(response.body, response);
  result.headers.set('Cache-Control', 'no-store');
  result.headers.append('Vary', 'User-Agent');
  result.headers.set('X-Content-Type-Options', 'nosniff');
  if (result.status >= 400) result.headers.set('X-Robots-Tag', 'noindex, follow');
  return result;
}

export async function handleBotTrackerRequest({ trackerParam, tabParam, artistQuery, requestUrl }) {
  let artistName = typeof artistQuery === 'string' && artistQuery ? artistQuery : 'Artist';
  let tabSlug = typeof tabParam === 'string' ? tabParam : '';
  let trackerId = '';
  try {
    const link = parseTrackerLink(trackerParam, requestUrl ? new URL(requestUrl).origin : undefined);
    if (link) {
      trackerParam = link.trackerParam;
      tabSlug ||= link.tabSlug;
    }
  } catch (err) {
    return renderTrackerPage({ trackerId, artistName, tabSlug, status: 400, message: 'Invalid tracker link' });
  }
  try {
    return await withDeadline(3500, async (signal) => {
      let directoryUnavailable = false;
      let artistsData = [];
      try {
        artistsData = await loadArtistsData(signal);
      } catch (error) {
        if (signal.aborted) throw error;
        directoryUnavailable = true;
      }
      const matched = findMatchingArtist(trackerParam, artistsData);
      trackerId = (matched ? extractTrackerId(matched.url) : getDirectTrackerId(trackerParam)) || '';
      artistName =
        (matched && getCleanArtistName(matched.name)) || (typeof artistQuery === 'string' && artistQuery) || artistName;
      if (!trackerId) {
        return renderTrackerPage({
          trackerId,
          artistName,
          tabSlug,
          status: directoryUnavailable ? 503 : 404,
          message: directoryUnavailable ? 'Tracker temporarily unavailable' : 'Tracker not found',
        });
      }
      const apiUrl = tabSlug
        ? `${API_BASE}/sh/${encodeURIComponent(trackerId)}/tab/${encodeURIComponent(tabSlug)}`
        : `${API_BASE}/sh/${encodeURIComponent(trackerId)}/`;
      const res = await fetch(apiUrl, {
        signal,
        headers: { 'User-Agent': 'ArtistGrid-BotRenderer/1.0', Accept: 'application/json' },
        cf: { cacheTtlByStatus: { '200-299': 86400, '400-599': -1 } },
      });
      if (!res.ok) {
        const status = res.status >= 400 && res.status < 500 && res.status !== 429 ? 404 : 503;
        return renderTrackerPage({
          trackerId,
          artistName,
          tabSlug,
          status,
          message: status === 404 ? 'Tracker not found' : 'Tracker temporarily unavailable',
        });
      }
      let apiData;
      try {
        apiData = JSON.parse(await readResponseText(res, 16 * 1024 * 1024, signal));
        if (!apiData || typeof apiData !== 'object' || (!Array.isArray(apiData.eras) && !Array.isArray(apiData.tracks)))
          throw new Error('Invalid tracker data');
      } catch (error) {
        if (signal.aborted) throw error;
        return renderTrackerPage({
          trackerId,
          artistName,
          tabSlug,
          status: 502,
          message: 'Tracker data temporarily unavailable',
        });
      }
      if (!matched) artistName = getArtistNameFromSheetTitle(apiData.name) || artistName;
      return renderTrackerPage({ trackerId, artistName, tabSlug, apiData, artistsData });
    });
  } catch (error) {
    return renderTrackerPage({
      trackerId,
      artistName,
      tabSlug,
      status: 503,
      message: 'Tracker temporarily unavailable',
    });
  }
}

function renderTrackerPage({
  trackerId,
  artistName,
  tabSlug,
  apiData = null,
  artistsData = [],
  status = 200,
  message = '',
}) {
  const effectiveArtist = artistName !== 'Artist' ? artistName : getArtistNameFromSheetTitle(apiData?.name) || 'Artist';

  const tabTitle = tabName(apiData?.tab?.name) || tabName(tabSlug.replace(/[-_]/g, ' '));
  const trackerUrl = trackerCanonicalUrl(trackerId);
  const tabUrl = (slug) => trackerCanonicalUrl(trackerId, slug);
  // The default tab and /main/ are aliases; other tabs have their own content.
  const canonicalTab = tabSlug ? (validTabSlug(apiData?.tab?.slug) ? apiData.tab.slug : tabSlug) : '';
  const pageUrl = tabUrl(canonicalTab);
  const imageFilename = getImageFilename(effectiveArtist);
  const imageUrl = `${ASSETS_BASE}/webp/${imageFilename}`;

  const datesByEra = new Map();
  for (const date of Array.isArray(apiData?.era_dates) ? apiData.era_dates : []) {
    const name = text(date?.era);
    if (!name || !text(date?.date) || !text(date?.event)) continue;
    if (!datesByEra.has(name)) datesByEra.set(name, []);
    datesByEra.get(name).push({ date: text(date.date), event: text(date.event) });
  }

  const flatEras = new Map();
  for (const track of Array.isArray(apiData?.tracks) ? apiData.tracks : []) {
    const name = text(track?.era) || 'Tracks';
    if (!flatEras.has(name)) flatEras.set(name, { name, tracks: [] });
    flatEras.get(name).tracks.push(track);
  }
  const eras = flatEras.size ? [...flatEras.values()] : Array.isArray(apiData?.eras) ? apiData.eras : [];

  let totalTracks = 0;
  const parsedEras = eras
    .filter((era) => era && typeof era === 'object' && !Array.isArray(era))
    .map((era) => {
      const rawTracks = Array.isArray(era.tracks) ? era.tracks : [];
      const tracks = rawTracks
        .map((track) => {
          const notes = text(track?.notes);
          return {
            name: getTrackTitle(track),
            notes: notes.length > 500 ? `${notes.slice(0, 500).trimEnd()}…` : notes,
            length: text(track?.track_length),
            quality: text(track?.quality),
          };
        })
        .filter((track) => track.name);
      totalTracks += tracks.length;
      return {
        name: text(era.name) || 'Untitled Era',
        description: text(era.description),
        timeline: text(era.timeline),
        dates: datesByEra.get(text(era.name)) || [],
        tracks,
      };
    });
  if (eras.length && !parsedEras.length) {
    status = 502;
    message = 'Tracker data temporarily unavailable';
  }

  const indexable =
    status === 200 &&
    parsedEras.some((era) => era.tracks.length || era.description || era.timeline || era.dates.length);
  const isMusic = !/\b(?:art|artwork|covers?|tracklists?|performances?|buys?|misc|timeline)\b/i.test(
    tabTitle || tabSlug
  );
  const entryLabel = totalTracks === 1 ? (isMusic ? 'track' : 'entry') : isMusic ? 'tracks' : 'entries';
  const heading = `${effectiveArtist} Tracker${tabTitle ? ` (${tabTitle})` : ''}`;
  const title = `${effectiveArtist}${tabTitle ? ` ${tabTitle}` : ''} Tracker | ArtistGrid`;
  const eraCount = parsedEras.filter((era) => !['Tracks', 'Untitled Era'].includes(era.name)).length;
  const eraSummary = eraCount ? ` across ${eraCount} ${eraCount === 1 ? 'era' : 'eras'}` : '';
  const description =
    status === 200
      ? `Explore ${effectiveArtist}'s ${tabTitle ? `${tabTitle.toLowerCase()} ` : ''}tracker: ${totalTracks.toLocaleString('en-US')} ${entryLabel}${eraSummary}. Browse ${isMusic ? 'song notes and recording details' : 'entries and notes'} on ArtistGrid.`
      : `${message || 'Tracker unavailable'} for ${effectiveArtist}. Browse artist trackers on ArtistGrid.`;
  const credits = text(apiData?.credits);
  const updatedDate =
    typeof apiData?.last_updated === 'number' && apiData.last_updated > 0
      ? new Date(apiData.last_updated * 1000)
      : null;
  const dateModified = updatedDate && Number.isFinite(updatedDate.getTime()) ? updatedDate.toISOString() : '';

  const breadcrumbs = [
    { name: 'Home', item: `${SITE_ORIGIN}/` },
    ...(trackerId ? [{ name: `${effectiveArtist} Tracker`, item: trackerUrl }] : []),
    ...(trackerId && pageUrl !== trackerUrl ? [{ name: tabTitle || canonicalTab, item: pageUrl }] : []),
  ];
  const breadcrumbsHtml = breadcrumbs
    .map(
      (crumb, index) =>
        `<li><a href="${escapeHtml(crumb.item)}"${index === breadcrumbs.length - 1 ? ' aria-current="page"' : ''}>${escapeHtml(crumb.name)}</a></li>`
    )
    .join('');
  const tabs = new Map();
  for (const tab of [...(Array.isArray(apiData?.tabs) ? apiData.tabs : []), apiData?.tab]) {
    if (validTabSlug(tab?.slug) && tabName(tab?.name)) tabs.set(tabUrl(tab.slug), tabName(tab.name));
  }
  if (trackerId && !tabs.has(trackerUrl)) tabs.set(trackerUrl, 'Default tab');
  const tabsHtml = [...tabs]
    .map(
      ([url, name]) =>
        `<li><a href="${escapeHtml(url)}"${url === pageUrl ? ' aria-current="page"' : ''}>${escapeHtml(name)}</a></li>`
    )
    .join('');

  const moreArtists = [];
  const seenTrackers = new Set([trackerId]);
  const artistIndex = artistsData.findIndex((artist) => extractTrackerId(artist.url) === trackerId);
  for (let offset = 1; offset <= artistsData.length && moreArtists.length < 3; offset++) {
    const artist = artistsData[(artistIndex + offset) % artistsData.length];
    const id = extractTrackerId(artist.url);
    if (!id || seenTrackers.has(id)) continue;
    seenTrackers.add(id);
    moreArtists.push(
      `<li><a href="${escapeHtml(`${SITE_ORIGIN}${trackerPath(id)}/`)}">${escapeHtml(artist.name)} Tracker</a></li>`
    );
  }
  const sourceUrl = trackerId.startsWith('2PACX-')
    ? `https://docs.google.com/spreadsheets/d/e/${encodeURIComponent(trackerId)}/pubhtml`
    : trackerId.includes('.')
      ? `https://${trackerId}/`
      : `https://docs.google.com/spreadsheets/d/${encodeURIComponent(trackerId)}/htmlview`;

  const jsonLdTracks = [];
  for (const era of parsedEras) {
    for (const track of era.tracks) {
      if (jsonLdTracks.length >= 100) break;
      jsonLdTracks.push({
        '@type': 'MusicRecording',
        name: track.name,
        byArtist: { '@id': `${trackerUrl}#artist` },
        ...(track.notes ? { description: track.notes } : {}),
        ...(trackDuration(track.length) ? { duration: trackDuration(track.length) } : {}),
      });
    }
    if (jsonLdTracks.length >= 100) break;
  }

  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'MusicGroup',
        '@id': `${trackerUrl}#artist`,
        name: effectiveArtist,
        url: trackerUrl,
        image: imageUrl,
      },
      isMusic
        ? {
            '@type': 'MusicPlaylist',
            '@id': `${pageUrl}#entries`,
            name: heading,
            url: pageUrl,
            numTracks: totalTracks,
            track: jsonLdTracks,
          }
        : {
            '@type': 'ItemList',
            '@id': `${pageUrl}#entries`,
            name: heading,
            numberOfItems: totalTracks,
            itemListElement: jsonLdTracks.map((track, index) => ({
              '@type': 'ListItem',
              position: index + 1,
              name: track.name,
            })),
          },
      {
        '@type': 'BreadcrumbList',
        '@id': `${pageUrl}#breadcrumb`,
        itemListElement: breadcrumbs.map((crumb, index) => ({ '@type': 'ListItem', position: index + 1, ...crumb })),
      },
      {
        '@type': 'CollectionPage',
        '@id': `${pageUrl}#webpage`,
        url: pageUrl,
        name: title,
        description,
        inLanguage: 'en',
        about: { '@id': `${trackerUrl}#artist` },
        mainEntity: { '@id': `${pageUrl}#entries` },
        breadcrumb: { '@id': `${pageUrl}#breadcrumb` },
        ...(dateModified ? { dateModified } : {}),
      },
    ],
  };

  const erasHtml = parsedEras
    .map(
      (era) => `
      <section class="era">
        <h2>${escapeHtml(era.name)}</h2>
        ${era.timeline ? `<p class="era-desc">${escapeHtml(era.timeline)}</p>` : ''}
        ${era.description ? `<p class="era-desc">${escapeHtml(era.description)}</p>` : ''}
        ${
          era.tracks.length > 0
            ? `<ul>
          ${era.tracks.map((track) => `<li>${escapeHtml(track.name)}${track.notes ? `<p class="track-notes">${escapeHtml(track.notes)}</p>` : ''}${track.length || track.quality ? `<p class="track-meta">${[track.length ? `Length: ${track.length}` : '', track.quality ? `Quality: ${track.quality}` : ''].filter(Boolean).map(escapeHtml).join(' · ')}</p>` : ''}</li>`).join('\n          ')}
        </ul>`
            : ''
        }
        ${era.dates.length ? `<details><summary>${escapeHtml(era.name)} timeline</summary><ul>${era.dates.map((date) => `<li>${escapeHtml(date.date)}: ${escapeHtml(date.event)}</li>`).join('')}</ul></details>` : ''}
      </section>`
    )
    .join('\n');

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)}</title>
  <meta name="description" content="${escapeHtml(description)}">
  <meta name="robots" content="${indexable ? 'index, follow' : 'noindex, follow'}">
  ${indexable ? `<link rel="canonical" href="${escapeHtml(pageUrl)}">` : ''}
  <meta name="theme-color" content="#0a0a0a">

  <meta property="og:site_name" content="ArtistGrid">
  <meta property="og:title" content="${escapeHtml(title)}">
  <meta property="og:description" content="${escapeHtml(description)}">
  <meta property="og:type" content="${indexable && isMusic ? 'music.playlist' : 'website'}">
  <meta property="og:url" content="${escapeHtml(pageUrl)}">
  <meta property="og:image" content="${escapeHtml(imageUrl)}">
  <meta property="og:image:alt" content="${escapeHtml(effectiveArtist)}">

  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${escapeHtml(title)}">
  <meta name="twitter:description" content="${escapeHtml(description)}">
  <meta name="twitter:image" content="${escapeHtml(imageUrl)}">
  <meta name="twitter:image:alt" content="${escapeHtml(effectiveArtist)}">

  ${indexable ? `<script type="application/ld+json">\n${JSON.stringify(jsonLd).replace(/</g, '\\u003c')}\n  </script>` : ''}
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; line-height: 1.6; max-width: 900px; margin: 0 auto; padding: 2rem 1rem; color: #222; overflow-wrap: anywhere; }
    header { margin-bottom: 2rem; border-bottom: 1px solid #eee; padding-bottom: 1.5rem; }
    h1 { font-size: 2rem; margin-bottom: 0.5rem; }
    .cover { width: 200px; height: 200px; object-fit: cover; border-radius: 8px; margin-top: 1rem; }
    .era { margin-bottom: 2rem; }
    .era h2 { font-size: 1.35rem; color: #111; margin-bottom: 0.35rem; border-bottom: 1px solid #f0f0f0; padding-bottom: 0.25rem; }
    .era-desc { color: #555; font-size: 0.95rem; margin-bottom: 0.5rem; }
    ul { list-style: disc; padding-left: 1.5rem; }
    li { margin-bottom: 0.25rem; }
    a { color: #164ca2; }
    nav ul, .breadcrumbs { display: flex; flex-wrap: wrap; gap: 0.5rem 1rem; list-style: none; padding: 0; }
    .breadcrumbs li + li::before { content: "›"; margin-right: 1rem; }
    .track-notes, .track-meta { margin: 0.25rem 0 0.75rem; font-size: 0.95rem; color: #555; }
    .track-notes { white-space: pre-line; }
    footer { border-top: 1px solid #eee; padding-top: 1rem; }
  </style>
</head>
<body>
  <nav aria-label="Breadcrumb"><ol class="breadcrumbs">${breadcrumbsHtml}</ol></nav>
  <header>
    <h1>${escapeHtml(heading)}</h1>
    <p>${escapeHtml(description)}</p>
    ${dateModified ? `<p>Tracker last updated: <time datetime="${escapeHtml(dateModified)}">${escapeHtml(dateModified.slice(0, 10))}</time></p>` : ''}
    <img src="${escapeHtml(imageUrl)}" alt="${escapeHtml(effectiveArtist)}" width="200" height="200" class="cover">
    ${tabsHtml ? `<nav aria-label="Tracker tabs"><ul>${tabsHtml}</ul></nav>` : ''}
  </header>
  <main>
    ${erasHtml || `<p>${escapeHtml(message || 'No tracks available.')}</p>`}
  </main>
  <footer>
    ${trackerId ? `<p><a href="${escapeHtml(sourceUrl)}">Original ${escapeHtml(effectiveArtist)} tracker source</a></p>` : ''}
    ${credits ? `<p>Tracker credits: ${escapeHtml(credits)}</p>` : ''}
    ${moreArtists.length ? `<nav aria-label="More artist trackers"><h2>More artist trackers</h2><ul>${moreArtists.join('')}</ul></nav>` : ''}
  </footer>
</body>
</html>`;

  return documentResponse(
    new Response(html, {
      status,
      headers: {
        'content-type': 'text/html; charset=UTF-8',
        'x-robots-tag': indexable ? 'index, follow' : 'noindex, follow',
        ...(status === 502 || status === 503 ? { 'Retry-After': '60' } : {}),
      },
    })
  );
}
