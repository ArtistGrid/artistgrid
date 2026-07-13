import { loadSettings } from "@/src/lib/settings";

const PROXY_BASE = "https://i.edideaur.works";

function isProxyEnabled(): boolean {
  return loadSettings().behavior.useImageProxy;
}

export function proxyImageUrl(url: string): string {
  if (!isProxyEnabled()) return url;
  return `${PROXY_BASE}/?url=${encodeURIComponent(url)}`;
}

export function proxyImageSrcSet(url: string) {
  if (!isProxyEnabled()) {
    return { jxl: url, webp: url, original: url };
  }
  return {
    jxl: `${PROXY_BASE}/?url=${encodeURIComponent(url)}&output=jxl`,
    webp: `${PROXY_BASE}/?url=${encodeURIComponent(url)}&output=webp`,
    original: proxyImageUrl(url),
  };
}
