const BOT_RE = /discordbot|twitterbot|facebookexternalhit|bingbot|googlebot|slurp|whatsapp|pinterest|slackbot|telegrambot|linkedinbot|mastodon|signal|snapchat|redditbot|skypeuripreview|viberbot|linebot|embedly|quora|outbrain|tumblr|duckduckbot|yandexbot|rogerbot|showyoubot|kakaotalk|naverbot|seznambot|mediapartners|adsbot|petalbot|applebot|ia_archiver/i;

function escapeHtml(s) {
  return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export async function onRequest(context) {
  try {
    const { request, next } = context;
    const url = new URL(request.url);
    const ua = request.headers.get('User-Agent') || '';

    if (!BOT_RE.test(ua)) return next(request);
    if (url.pathname !== '/view') return next(request);

    const trackerId = url.searchParams.get('id');
    const artist = url.searchParams.get('artist');

    if (!trackerId || !artist) return next(request);

    const title = artist + ' - ArtistGrid';
    const description = 'Unreleased music by ' + artist;
    const pageUrl = 'https://artistgrid.cx/view?id=' + trackerId;
    const image = 'https://artistgrid.cx/og-default.png';

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
