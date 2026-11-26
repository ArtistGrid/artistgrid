import { handleBotTrackerRequest, isBot, serveSpaShell } from './_bot-renderer.js';

export async function onRequest(context) {
  if (!isBot(context.request)) return serveSpaShell(context);
  const url = new URL(context.request.url);
  const trackerParam = url.searchParams.get('id') || '';
  if (!trackerParam) {
    const response = await serveSpaShell(context);
    response.headers.set('X-Robots-Tag', 'noindex, follow');
    return response;
  }
  return handleBotTrackerRequest({
    trackerParam,
    tabParam: '',
    artistQuery: url.searchParams.get('artist') || '',
    requestUrl: context.request.url,
  });
}
