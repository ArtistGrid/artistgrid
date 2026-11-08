// functions/view.js
import { BOT_RE, documentResponse, handleBotTrackerRequest } from './_bot-renderer.js';

export async function onRequest(context) {
  const { request, env } = context;
  const ua = request.headers.get('User-Agent') || '';

  // Non-bots / human visitors receive the static SPA shell
  if (!BOT_RE.test(ua)) {
    const url = new URL(request.url);
    url.pathname = '/';
    return documentResponse(await env.ASSETS.fetch(new Request(url, request)));
  }

  const url = new URL(request.url);
  const trackerParam = url.searchParams.get('id') || '';
  const artistQuery = url.searchParams.get('artist') || '';

  if (!trackerParam) {
    const fallbackUrl = new URL(request.url);
    fallbackUrl.pathname = '/';
    const response = documentResponse(await env.ASSETS.fetch(new Request(fallbackUrl, request)));
    response.headers.set('X-Robots-Tag', 'noindex, follow');
    return response;
  }

  return handleBotTrackerRequest({
    trackerParam,
    tabParam: '',
    artistQuery,
    requestUrl: request.url,
  });
}
