import { getDirectTrackerId } from '../src/lib/artists';
import { HOME_DESCRIPTION, HOME_TITLE, SITE_ORIGIN, trackerCanonicalUrl } from '../src/lib/seo';
import { withDeadline } from '../src/lib/request';
import { BOT_RE, documentResponse, escapeHtml, loadArtistsData } from './_bot-renderer.js';
import { renderSitePage } from './_site-renderer.js';

export async function onRequest(context) {
  const { request, env } = context;
  if (!BOT_RE.test(request.headers.get('User-Agent') || '')) return documentResponse(await env.ASSETS.fetch(request));
  try {
    const artists = await withDeadline(3500, (signal) => loadArtistsData(signal));
    const seen = new Set();
    const items = [];
    for (const artist of artists) {
      let id;
      try {
        id = getDirectTrackerId(artist.url);
      } catch {
        continue;
      }
      if (id?.includes('.')) id = id.toLowerCase();
      if (!id || seen.has(id)) continue;
      seen.add(id);
      items.push({ name: artist.name, url: trackerCanonicalUrl(id) });
    }
    return renderSitePage({
      title: HOME_TITLE,
      description: HOME_DESCRIPTION,
      heading: 'ArtistGrid',
      url: `${SITE_ORIGIN}/`,
      content: `<h2>Browse ${items.length} artist trackers</h2><ul>${items.map((artist) => `<li><a href="${escapeHtml(artist.url)}">${escapeHtml(artist.name)} Tracker</a></li>`).join('')}</ul><p>Trackers are maintained by their communities. Each tracker links to its original source and includes credits where available.</p>`,
      graph: [
        {
          '@type': 'ItemList',
          '@id': `${SITE_ORIGIN}/#artists`,
          name: 'Artist trackers',
          numberOfItems: items.length,
          itemListElement: items.map((artist, index) => ({
            '@type': 'ListItem',
            position: index + 1,
            name: artist.name,
            url: artist.url,
          })),
        },
      ],
    });
  } catch {
    return renderSitePage({
      title: HOME_TITLE,
      description: HOME_DESCRIPTION,
      heading: 'Artist directory temporarily unavailable',
      url: `${SITE_ORIGIN}/`,
      content: '<p>Please try again shortly.</p>',
      status: 503,
    });
  }
}
