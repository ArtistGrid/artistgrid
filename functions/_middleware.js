const BOT_RE = /discordbot|twitterbot|facebookexternalhit|bingbot|googlebot|slurp|whatsapp|pinterest|slackbot|telegrambot|linkedinbot|mastodon|signal|snapchat|redditbot|skypeuripreview|viberbot|linebot|embedly|quora|outbrain|tumblr|duckduckbot|yandexbot|rogerbot|showyoubot|kakaotalk|naverbot|seznambot|mediapartners|adsbot|petalbot|applebot|ia_archiver/i;

const SPECIAL_IDS = {
  'yetracker.net': 'yetracker.net',
  'https://yetracker.net': 'yetracker.net',
  'https://yetracker.net/': 'yetracker.net',
};

function extractTrackerId(url) {
  if (SPECIAL_IDS[url]) return SPECIAL_IDS[url];
  const pubhtml = url.match(/\/spreadsheets\/d\/e\/(2PACX-[a-zA-Z0-9_-]+)\//);
  if (pubhtml) return pubhtml[1];
  const match = url.match(/\/spreadsheets(?:\/u\/\d+)?\/d\/([a-zA-Z0-9_-]{20,})/);
  return match ? match[1] : null;
}

function parseCSVRow(line) {
  const fields = [];
  let cur = '';
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      if (inQ && line[i + 1] === '"') { cur += '"'; i++; }
      else inQ = !inQ;
    } else if (c === ',' && !inQ) {
      fields.push(cur);
      cur = '';
    } else {
      cur += c;
    }
  }
  fields.push(cur);
  return fields;
}

export async function onRequest(context) {
  try {
    const { request, next, url } = context;
    const ua = request.headers.get('User-Agent') || '';

    if (!BOT_RE.test(ua)) return next(request);
    if (url.pathname !== '/view') return next(request);

    const trackerId = url.searchParams.get('id');
    if (!trackerId) return next(request);

    let csvText = '';
    try {
      const res = await fetch('https://artists.artistgrid.cx/artists.csv');
      if (!res.ok) return next(request);
      csvText = await res.text();
    } catch (e) {
      console.error('SEO middleware: CSV fetch failed', e);
      return next(request);
    }

    if (!csvText) return next(request);

    const rows = csvText.split('\n');
    if (rows.length < 2) return next(request);

    const headers = parseCSVRow(rows[0]);
    const nameIdx = headers.indexOf('name');
    const urlIdx = headers.indexOf('url');
    const imageIdx = headers.indexOf('image_filename');
    if (nameIdx < 0 || urlIdx < 0) return next(request);

    let artist = null;
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i].trim();
      if (!row) continue;
      const fields = parseCSVRow(row);
      const artistUrl = fields[urlIdx] || '';
      const extractedId = extractTrackerId(artistUrl);
      if (extractedId && extractedId === trackerId) {
        artist = { name: fields[nameIdx], imageFilename: fields[imageIdx] || '' };
        break;
      }
    }

    if (!artist) return next(request);

    const title = artist.name + ' - ArtistGrid';
    const description = 'Unreleased music by ' + artist.name;
    const pageUrl = 'https://artistgrid.cx/view?id=' + trackerId;
    const image = artist.imageFilename
      ? 'https://assets.artistgrid.cx/' + artist.imageFilename
      : 'https://artistgrid.cx/og-default.png';

    const html = '<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>' + title + '</title><meta name="description" content="' + description + '"><meta property="og:site_name" content="ArtistGrid"><meta property="og:title" content="' + title + '"><meta property="og:description" content="' + description + '"><meta property="og:image" content="' + image + '"><meta property="og:type" content="website"><meta property="og:url" content="' + pageUrl + '"><meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="' + title + '"><meta name="twitter:description" content="' + description + '"><meta name="twitter:image" content="' + image + '"></head><body><h1>' + title + '</h1><p>' + description + '</p></body></html>';

    return new Response(html, { headers: { 'content-type': 'text/html;charset=UTF-8' } });
  } catch (e) {
    console.error('SEO middleware: unexpected error', e);
    return next(request);
  }
}
