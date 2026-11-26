import { documentResponse, handleBotTrackerRequest, isBot, serveSpaShell } from '../_bot-renderer.js';
import { parseTrackerPath } from '../../src/lib/tracker-route';

export async function onRequest(context) {
  const url = new URL(context.request.url);
  let route;
  try {
    route = parseTrackerPath(url.pathname);
  } catch {
    return documentResponse(new Response('Invalid path encoding', { status: 400 }));
  }
  if (!route) return documentResponse(new Response('Not found', { status: 404 }));
  if (!isBot(context.request)) return serveSpaShell(context);

  return handleBotTrackerRequest({
    trackerParam: route.trackerParam,
    tabParam: route.tabSlug,
    artistQuery: url.searchParams.get('artist') || '',
    requestUrl: context.request.url,
  });
}
