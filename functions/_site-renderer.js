import { DEFAULT_SHARE_IMAGE, SITE_ORIGIN } from '../src/lib/seo';
import { documentResponse, escapeHtml } from './_bot-renderer.js';

export function renderSitePage({ title, description, heading, url, content, graph = [], status = 200 }) {
  const schema = {
    '@context': 'https://schema.org',
    '@graph': [
      { '@type': 'WebSite', '@id': `${SITE_ORIGIN}/#website`, name: 'ArtistGrid', url: `${SITE_ORIGIN}/` },
      {
        '@type': graph.length ? 'CollectionPage' : 'WebPage',
        '@id': `${url}#page`,
        name: title,
        url,
        description,
        isPartOf: { '@id': `${SITE_ORIGIN}/#website` },
        ...(graph[0]?.['@id'] ? { mainEntity: { '@id': graph[0]['@id'] } } : {}),
      },
      ...graph,
    ],
  };
  return documentResponse(
    new Response(
      `<!DOCTYPE html>
<html lang="en"><head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title><meta name="description" content="${escapeHtml(description)}">
<meta name="robots" content="${status === 200 ? 'index, follow' : 'noindex, follow'}">
${status === 200 ? `<link rel="canonical" href="${escapeHtml(url)}">` : ''}
<meta property="og:site_name" content="ArtistGrid"><meta property="og:type" content="website">
<meta property="og:title" content="${escapeHtml(title)}"><meta property="og:description" content="${escapeHtml(description)}">
<meta property="og:url" content="${escapeHtml(url)}"><meta property="og:image" content="${DEFAULT_SHARE_IMAGE}">
<meta name="twitter:card" content="summary"><meta name="twitter:title" content="${escapeHtml(title)}">
<meta name="twitter:description" content="${escapeHtml(description)}"><meta name="twitter:image" content="${DEFAULT_SHARE_IMAGE}">
${status === 200 ? `<script type="application/ld+json">${JSON.stringify(schema).replace(/</g, '\\u003c')}</script>` : ''}
<style>body{font-family:system-ui,sans-serif;line-height:1.6;max-width:900px;margin:auto;padding:2rem 1rem;color:#222;overflow-wrap:anywhere}a{color:#164ca2}nav,footer{margin:1.5rem 0}li{margin:.5rem 0}</style>
</head><body><nav><a href="${SITE_ORIGIN}/">ArtistGrid artist directory</a> · <a href="${SITE_ORIGIN}/donate">Support ArtistGrid</a></nav>
<main><h1>${escapeHtml(heading)}</h1><p>${escapeHtml(description)}</p>${content}</main>
<footer><a href="https://github.com/ArtistGrid">ArtistGrid on GitHub</a></footer></body></html>`,
      {
        status,
        headers: {
          'Content-Type': 'text/html; charset=UTF-8',
          'X-Robots-Tag': status === 200 ? 'index, follow' : 'noindex, follow',
          ...(status === 503 ? { 'Retry-After': '60' } : {}),
        },
      }
    )
  );
}
