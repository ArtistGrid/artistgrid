const BOT_RE = /discordbot|twitterbot|facebookexternalhit|bingbot|googlebot|slurp|whatsapp|pinterest|slackbot|telegrambot|linkedinbot|mastodon|signal|snapchat|redditbot|skypeuripreview|viberbot|linebot|embedly|quora|outbrain|tumblr|duckduckbot|yandexbot|rogerbot|showyoubot|kakaotalk|naverbot|seznambot|mediapartners|adsbot|petalbot|applebot|ia_archiver/i;

function escapeHtml(s) {
  return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function getImageFilename(artistName) {
  return artistName.toLowerCase().replace(/[^a-z0-9]/g, '') + '.webp';
}

export async function onRequest(context) {
  try {
    const { request, next } = context;
    const url = new URL(request.url);
    const ua = request.headers.get('User-Agent') || '';

    if (!BOT_RE.test(ua)) return next(request);
    const isViewPath = url.pathname === '/view';
  const shMatch = url.pathname.match(/^\/sh\/([a-zA-Z0-9_%.%-]+)\/?$/);
  if (!isViewPath && !shMatch) return next(request);

  let trackerId = null;
  let artist = null;
  let sheetUrl = null;

  if (isViewPath) {
    trackerId = url.searchParams.get('id');
    artist = url.searchParams.get('artist');
  } else {
    try { sheetUrl = decodeURIComponent(shMatch[1]); } catch (_) { sheetUrl = shMatch[1]; }
    trackerId = sheetUrl;
    artist = url.searchParams.get('artist');
  }

  if (!trackerId || !artist) return next(request);

    const imageFilename = getImageFilename(artist);
    const image = 'https://assets.artistgrid.cx/' + imageFilename;

    const title = artist + ' - ArtistGrid';
    const description = 'Unreleased music by ' + artist;
    const pageUrl = 'https://artistgrid.cx/sh/' + trackerId + (artist ? '?artist=' + encodeURIComponent(artist) : '');

    const html = '<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>' +
      escapeHtml(title) + '</title><meta name="description" content="' + escapeHtml(description) + '">' +
      '<meta property="og:site_name" content="ArtistGrid">' +
      '<meta property="og:title" content="' + escapeHtml(title) + '">' +
      '<meta property="og:description" content="' + escapeHtml(description) + '">' +
      '<meta property="og:image" content="' + image + '">' +
      '<meta property="og:type" content="website"><meta property="og:url" content="' + pageUrl + '">' +
      '<meta name="twitter:card" content="summary_large_image">' +
      '<meta name="twitter:title" content="' + escapeHtml(title) + '">' +
      '<meta name="twitter:description" content="' + escapeHtml(description) + '">' +
      '<meta name="twitter:image" content="' + image + '"></head>' +
      '<body><h1>' + escapeHtml(title) + '</h1><p>' + escapeHtml(description) + '</p></body></html>';

    return new Response(html, { headers: { 'content-type': 'text/html;charset=UTF-8' } });
  } catch (e) {
    console.error('SEO middleware:', e);
    return next(request);
  }
}
