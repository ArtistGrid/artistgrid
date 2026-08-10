export function buildFontCssUrl(family: string): string {
  const encoded = encodeURIComponent(family);
  return `https://api.fonts.coollabs.io/css2?family=${encoded}&display=swap`;
}