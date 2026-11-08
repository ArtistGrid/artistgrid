// functions/sh/[[catchall]].js
import { BOT_RE, documentResponse, handleBotTrackerRequest } from '../_bot-renderer.js';
import { parseTrackerPath } from '../../src/lib/tracker-route';

export async function onRequest(context) {
  const { request, env } = context;
  const ua = request.headers.get('User-Agent') || '';
  const url = new URL(request.url);
  let route;
  try {
    route = parseTrackerPath(url.pathname);
  } catch {
    return documentResponse(new Response('Invalid path encoding', { status: 400 }));
  }
  if (!route) return documentResponse(new Response('Not found', { status: 404 }));

  // Non-bots / human visitors receive the static SPA shell
  if (!BOT_RE.test(ua)) {
    url.pathname = '/';
    return documentResponse(await env.ASSETS.fetch(new Request(url, request)));
  }
  const artistQuery = url.searchParams.get('artist') || '';

  return handleBotTrackerRequest({
    trackerParam: route.trackerParam,
    tabParam: route.tabSlug,
    artistQuery,
    requestUrl: request.url,
  });
}
