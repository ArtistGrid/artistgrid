import { SITE_ORIGIN } from '../src/lib/seo';
import { DONATION_OPTIONS } from '../src/lib/home-constants';
import { escapeHtml, isBot, serveSpaShell } from './_bot-renderer.js';
import { renderSitePage } from './_site-renderer.js';

export async function onRequest(context) {
  if (!isBot(context.request)) return serveSpaShell(context);
  return renderSitePage({
    title: 'Support ArtistGrid | Donations',
    description: 'Support ArtistGrid development and server costs.',
    heading: 'Support ArtistGrid',
    url: `${SITE_ORIGIN}/donate`,
    content: `<p>Your contributions help cover server costs and keep ArtistGrid available.</p><h2>Donation methods</h2><ul>${DONATION_OPTIONS.URL.map((option) => `<li><a href="${escapeHtml(option.value)}">${escapeHtml(option.name)}</a></li>`).join('')}</ul><h2>Cryptocurrency</h2><dl>${DONATION_OPTIONS.CRYPTO.map((option) => `<dt>${escapeHtml(option.name)}</dt><dd><code>${escapeHtml(option.value)}</code></dd>`).join('')}</dl>`,
  });
}
