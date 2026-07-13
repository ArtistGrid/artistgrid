import { useCallback } from "react";
import { useSettings } from "@/src/hooks/use-settings";

const PROXY_BASE = "https://i.edideaur.works";

export function useImageProxy() {
  const { settings } = useSettings();
  const enabled = settings.behavior.useImageProxy;

  const proxyImageUrl = useCallback(
    (url: string) => {
      if (!enabled) return url;
      return `${PROXY_BASE}/?url=${encodeURIComponent(url)}`;
    },
    [enabled]
  );

  const proxyImageSrcSet = useCallback(
    (url: string) => {
      if (!enabled) return { jxl: url, webp: url, original: url };
      return {
        jxl: `${PROXY_BASE}/?url=${encodeURIComponent(url)}&output=jxl`,
        webp: `${PROXY_BASE}/?url=${encodeURIComponent(url)}&output=webp`,
        original: `${PROXY_BASE}/?url=${encodeURIComponent(url)}`,
      };
    },
    [enabled]
  );

  return { proxyImageUrl, proxyImageSrcSet };
}
