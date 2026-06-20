import type { Track } from "@/src/types";
const KRAKENFILES_API = "https://info.artistgrid.cx/kf/?id=";
const IMGUR_API = "https://imgur.gg/api/file/";
const QOBUZ_API = "https://qobuz.squid.wtf/api/download-music";
const PIXELDRAIN_APIS = [
  "https://trackerapi-1.artistgrid.cx",
  "https://trackerapi-2.artistgrid.cx",
  "https://trackerapi-3.artistgrid.cx",
];
export function normalizePillowsUrl(url: string): string {
  return url.replace(/pillowcase\.su/g, "pillows.su");
}
function extractKrakenId(url: string): string | null {
  const match = url.match(/krakenfiles\.com\/view\/([a-zA-Z0-9]+)/);
  return match ? match[1] : null;
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
function extractQobuzId(url: string): string | null {
  const match = url.match(/(?:open\.)?qobuz\.com\/track\/(\d+)/);
  return match ? match[1] : null;
}
export function getTrackSource(url: string): Track["source"] {
  const normalized = normalizePillowsUrl(url);
  if (/https?:\/\/pillows\.su\/f\//.test(normalized)) return "pillows";
  if (/https?:\/\/music\.froste\.lol\/song\//.test(normalized)) return "froste";
  if (/https?:\/\/(?:www\.|music\.)?youtube\.com\/|https?:\/\/youtu\.be\//.test(normalized)) return "youtube";
  if (/https?:\/\/krakenfiles\.com\/view\//.test(normalized)) return "krakenfiles";
  if (/https?:\/\/pixeldrain.com\/d\//.test(normalized)) return "pixeldrain";
  if (/https?:\/\/juicewrldapi\.com\/juicewrld/.test(normalized)) return "juicewrldapi";
  if (/https?:\/\/.*imgur\.gg/.test(normalized)) return "imgur";
  if (/https?:\/\/files\.yetracker\.org\/f\//.test(normalized)) return "yetracker";
  if (/https?:\/\/(www\.)?soundcloud\.com\//.test(normalized)) return "soundcloud";
  if (/https?:\/\/(open\.)?qobuz\.com\/track\//.test(normalized)) return "qobuz";
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
        const match = normalized.match(/pixeldrain\.com\/d\/([a-zA-Z0-9]+)/);
        if (!match) return null;
        try {
          const url = await Promise.any(
            PIXELDRAIN_APIS.map(async (base) => {
              const res = await fetch(`${base}/goy/dl/${match[1]}`);
              if (!res.ok) throw new Error("not ok");
              const data = await res.json();
              if (!data?.url) throw new Error("no url");
              return data.url as string;
            })
          );
          return url;
        } catch {
          return null;
        }
      }
      case "froste":
        return null;
      case "youtube":
        return null;
      case "krakenfiles": {
        const id = extractKrakenId(normalized);
        if (!id) return null;
        const res = await fetch(`${KRAKENFILES_API}${id}`);
        const data = await res.json();
        return data.success ? data.m4a : null;
      }
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
      case "yetracker": {
        const match = normalized.match(/files\.yetracker\.org\/f\/([a-zA-Z0-9]+)/);
        return match ? `https://files.yetracker.org/raw/${match[1]}` : null;
      }
      case "soundcloud": {
        const path = extractSoundcloudPath(normalized);
        return path ? `https://sc.maid.zone/_/restream/${path}` : null;
      }
      case "qobuz": {
        const id = extractQobuzId(normalized);
        if (!id) return null;
        const res = await fetch(`${QOBUZ_API}?track_id=${id}&quality=27`);
        if (!res.ok) return null;
        const data = await res.json();
        return data?.data?.url || null;
      }
      case "juicewrldapi":
        return url;
      default:
        return null;
    }
  } catch (error) {
    console.error(`Error resolving ${source} URL:`, error);
    return null;
  }
}
export function transformUrlForOpening(url: string): string {
  if (url.includes("soundcloud.com/")) {
    const path = extractSoundcloudPath(url);
    if (path) return `https://sc.maid.zone/${path}`;
  }
  return url;
}
