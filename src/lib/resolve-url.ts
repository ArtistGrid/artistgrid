import type { Track } from "@/src/types";
import { logError } from "./logger";
const IMGUR_API = "https://imgur.gg/api/file/";

export function normalizePillowsUrl(url: string): string {
  return url.replace(/pillowcase\.su/g, "pillows.su");
}

function extractImgurId(url: string): string | null {
  let match = url.match(/\/f\/([a-zA-Z0-9]+)/);
  if (match) return match[1];
  match = url.match(/\/([a-zA-Z0-9]+)(?:\?|$)/);
  return match ? match[1] : null;
}

function extractSoundcloudPath(url: string): string | null {
  const match = url.match(/soundcloud\.com\/([^/]+\/[^/?#]+)/);
  return match ? match[1] : null;
}

const NETWORK_SOURCES = new Set<Track["source"]>(["imgur", "pixeldrain"]);

export function isNetworkSource(source: Track["source"]): boolean {
  return NETWORK_SOURCES.has(source);
}

export function getTrackSource(url: string): Track["source"] {
  const normalized = normalizePillowsUrl(url);
  if (/https?:\/\/pillows\.su\/f\//.test(normalized)) return "pillows";
  if (/https?:\/\/(?:www\.|music\.)?youtube\.com\/|https?:\/\/youtu\.be\//.test(normalized)) return "youtube";
  if (/https?:\/\/pixeldrain.com\/[du]\//.test(normalized)) return "pixeldrain";
  if (/https?:\/\/juicewrldapi\.com\/juicewrld/.test(normalized)) return "juicewrldapi";
  if (/https?:\/\/.*imgur\.gg/.test(normalized)) return "imgur";
  if (/https?:\/\/(www\.)?soundcloud\.com\//.test(normalized)) return "soundcloud";
  if (/https?:\/\/drive\.google\.com\/file\/d\//.test(normalized)) return "googledrive";
  return "unknown";
}

export async function resolvePlayableUrl(url: string): Promise<string | null> {
  const normalized = normalizePillowsUrl(url);
  const source = getTrackSource(normalized);

  try {
    switch (source) {
      case "pillows": {
        const match = normalized.match(/pillows\.su\/f\/([a-f0-9]+)/);
        return match ? `https://api.pillows.su/api/download/${match[1]}` : null;
      }
      case "pixeldrain": {
        const match = normalized.match(/pixeldrain\.com\/[du]\/([a-zA-Z0-9]+)/);
        return match ? `https://fuck-unvaulted.artistgrid.cx/${match[1]}` : null;
      }
      case "youtube":
        return null;
      case "imgur": {
        const id = extractImgurId(normalized);
        if (!id) return null;
        const res = await fetch(`${IMGUR_API}${id}`);
        if (!res.ok) return null;
        const data = await res.json();
        const mediaType: string = data.mediaType || data.mimeType || data.type || "";
        if (mediaType.startsWith("image/")) return null;
        return data.cdnUrl || null;
      }
      case "soundcloud": {
        const path = extractSoundcloudPath(normalized);
        return path ? `https://sc.monochrome.tf/_/restream/${path}` : null;
      }
      case "juicewrldapi":
        return url;
      case "googledrive": {
        const match = normalized.match(/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/);
        return match ? `https://fuck-unvaulted.artistgrid.cx/gd/${match[1]}` : null;
      }
      default:
        return null;
    }
  } catch (error) {
    logError(`Error resolving ${source} URL:`, error);
    return null;
  }
}
export function transformUrlForOpening(url: string): string {
  if (url.includes("soundcloud.com/")) {
    const path = extractSoundcloudPath(url);
    if (path) return `https://sc.monochrome.tf/${path}`;
  }
  return url;
}
