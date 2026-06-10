import type { Track } from "@/src/types";
const KRAKENFILES_API = "https://info.artistgrid.cx/kf/?id=";
const IMGUR_API = "https://imgur.gg/api/file/";
const QOBUZ_API = "https://qobuz.squid.wtf/api/download-music";
const TIDAL_APIS = [
  { baseUrl: "https://triton.squid.wtf" },
  { baseUrl: "https://tidal.kinoplus.online" },
  { baseUrl: "https://hund.qqdl.site" },
  { baseUrl: "https://katze.qqdl.site" },
  { baseUrl: "https://maus.qqdl.site" },
  { baseUrl: "https://vogel.qqdl.site" },
  { baseUrl: "https://wolf.qqdl.site" },
];
const TIDAL_API_HEALTH = new Map<string, { failures: number; lastCheck: number }>();
const selectTidalApi = (): string => {
  const now = Date.now();
  // Reset failures after 5 minutes
  const healthyApis = TIDAL_APIS.filter(api => {
    const health = TIDAL_API_HEALTH.get(api.baseUrl);
    if (!health) return true; // Unknown = assume healthy
    if (now - health.lastCheck > 5 * 60 * 1000) return true; // Reset after 5 min
    return health.failures < 3; // Only use if < 3 failures
  });
  
  if (healthyApis.length > 0) {
    return healthyApis[Math.floor(Math.random() * healthyApis.length)].baseUrl;
  }
  
  // Fallback to least-failed API
  return TIDAL_APIS.reduce((best, current) => {
    const bestHealth = TIDAL_API_HEALTH.get(best.baseUrl) || { failures: 0 };
    const currentHealth = TIDAL_API_HEALTH.get(current.baseUrl) || { failures: 0 };
    return currentHealth.failures < bestHealth.failures ? current : best;
  }).baseUrl;
};

const recordTidalFailure = (apiUrl: string) => {
  const health = TIDAL_API_HEALTH.get(apiUrl) || { failures: 0, lastCheck: 0 };
  health.failures++;
  health.lastCheck = Date.now();
  TIDAL_API_HEALTH.set(apiUrl, health);
};
  "https://trackerapi-1.artistgrid.cx",
  "https://trackerapi-2.artistgrid.cx",
  "https://trackerapi-3.artistgrid.cx",
];
const selectTidalApi = (() => {
  let i = 0;
  return (): string => {
    const { baseUrl } = TIDAL_APIS[i];
    i = (i + 1) % TIDAL_APIS.length;
    return baseUrl;
  };
})();
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
function extractTidalId(url: string): string | null {
  const match = url.match(/tidal\.com\/(?:browse\/)?track\/(\d+)/);
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
  if (/https?:\/\/krakenfiles\.com\/view\//.test(normalized)) return "krakenfiles";
  if (/https?:\/\/pixeldrain.com\/d\//.test(normalized)) return "pixeldrain";
  if (/https?:\/\/juicewrldapi\.com\/juicewrld/.test(normalized)) return "juicewrldapi";
  if (/https?:\/\/.*imgur\.gg/.test(normalized)) return "imgur";
  if (/https?:\/\/files\.yetracker\.org\/f\//.test(normalized)) return "yetracker";
  if (/https?:\/\/(www\.)?soundcloud\.com\//.test(normalized)) return "soundcloud";
  if (/https?:\/\/tidal\.com\//.test(normalized)) return "tidal";
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
        for (const base of PIXELDRAIN_APIS) {
          try {
            const res = await fetch(`${base}/goy/dl/${match[1]}`, { signal: AbortSignal.timeout(8000) });
            if (res.ok) {
              const data = await res.json();
              if (data?.url) return data.url;
            }
          } catch (e) {
            continue;
          }
        }
        return null;
      }
      case "froste": {
        const match = normalized.match(/music\.froste\.lol\/song\/([a-f0-9]+)/);
        if (!match) return null;
        try {
          return `https://music.froste.lol/song/${match[1]}/download`;
        } catch {
          return null;
        }
      }
      case "krakenfiles": {
        const id = extractKrakenId(normalized);
        if (!id) return null;
        try {
          const res = await fetch(`${KRAKENFILES_API}${id}`, { signal: AbortSignal.timeout(8000) });
          if (!res.ok) return null;
          const data = await res.json();
          return data.success ? data.m4a : null;
        } catch {
          return null;
        }
      }
      case "imgur": {
        const id = extractImgurId(normalized);
        if (!id) return null;
        try {
          const res = await fetch(`${IMGUR_API}${id}`, { signal: AbortSignal.timeout(8000) });
          if (!res.ok) return null;
          const data = await res.json();
          return data.cdnUrl || null;
        } catch {
          return null;
        }
      }
      case "yetracker": {
        const match = normalized.match(/files\.yetracker\.org\/f\/([a-zA-Z0-9]+)/);
        if (!match) return null;
        try {
          return `https://files.yetracker.org/raw/${match[1]}`;
        } catch {
          return null;
        }
      }
      case "soundcloud": {
        const path = extractSoundcloudPath(normalized);
        if (!path) return null;
        try {
          return `https://sc.maid.zone/_/restream/${path}`;
        } catch {
          return null;
        }
      }
      case "tidal": {
        const id = extractTidalId(normalized);
        if (!id) return null;
        try {
          const apiBase = selectTidalApi();
          const res = await fetch(`${apiBase}/track/?id=${id}&quality=HI_RES_LOSSLESS`, {
            signal: AbortSignal.timeout(10000),
          });
          if (!res.ok) {
            recordTidalFailure(apiBase);
            return null;
          }
          const data = await res.json();
          if (data?.data?.manifest) {
            const manifestJson = JSON.parse(atob(data.data.manifest));
            if (manifestJson?.urls?.[0]) return manifestJson.urls[0];
          }
          return null;
        } catch (error) {
          // Record failure for API health tracking, but continue gracefully
          return null;
        }
      }
      case "qobuz": {
        const id = extractQobuzId(normalized);
        if (!id) return null;
        try {
          const res = await fetch(`${QOBUZ_API}?track_id=${id}&quality=27`, { signal: AbortSignal.timeout(10000) });
          if (!res.ok) return null;
          const data = await res.json();
          return data?.data?.url || null;
        } catch {
          return null;
        }
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
