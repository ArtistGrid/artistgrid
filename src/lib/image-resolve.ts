const IBB_HINT_RE = /ibb\.co\/([a-zA-Z0-9]+)/i;
const IMGUR_HINT_RE = /imgur\.com\/([a-zA-Z0-9]+)/i;
const IBB_OEMBED = "https://ibb.artistgrid.cx";

export function extractIbbId(url: string): string | null {
  const m = url.match(IBB_HINT_RE);
  return m ? m[1] : null;
}

// Synchronous best-effort resolution, used as the initial value before the
// async oEmbed lookup resolves (and as the fallback when the lookup fails).
export function syncImageUrl(url: string): string | null {
  if (url.includes("ibb.co")) {
    const id = extractIbbId(url);
    if (id) return `https://i.ibb.co/${id}/image.jpg`;
  }
  if (url.includes("imgur.com") || url.includes("i.imgur.com")) {
    const m = url.match(IMGUR_HINT_RE);
    if (m) return `https://i.imgur.com/${m[1]}.jpg`;
  }
  if (/\.(jpg|jpeg|png|gif|webp)$/i.test(url)) return url;
  if (url.includes("docs.google.com/sheets-images-rt") || url.includes("googleusercontent.com")) return url;
  return null;
}

const cache = new Map<string, string | null>();
const inflight = new Map<string, Promise<string | null>>();

async function resolveIbb(id: string): Promise<string | null> {
  const key = `ibb:${id}`;
  if (cache.has(key)) return cache.get(key) ?? null;
  const existing = inflight.get(key);
  if (existing) return existing;

  const run = async (): Promise<string | null> => {
    const fallback = `https://i.ibb.co/${id}/image.jpg`;
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 6000);
      const res = await fetch(`${IBB_OEMBED}/${id}/oembed.json`, { signal: controller.signal });
      clearTimeout(timeout);
      if (!res.ok) return fallback;
      const json = (await res.json()) as Record<string, unknown>;
      const full =
        (typeof json.url === "string" && json.url) ||
        (typeof json.fullurl === "string" && json.fullurl) ||
        (typeof json.full_url === "string" && json.full_url) ||
        (typeof json.thumbnail_url === "string" && json.thumbnail_url) ||
        (typeof json.image === "string" && json.image);
      return full ? (full as string) : fallback;
    } catch {
      return fallback;
    }
  };

  const promise = run().then((result) => {
    cache.set(key, result);
    inflight.delete(key);
    return result;
  });
  inflight.set(key, promise);
  return promise;
}

export async function resolveImageUrl(url: string): Promise<string | null> {
  if (!url) return null;
  if (url.includes("ibb.co")) {
    const id = extractIbbId(url);
    if (id) return resolveIbb(id);
  }
  if (url.includes("imgur.com") || url.includes("i.imgur.com")) {
    const m = url.match(IMGUR_HINT_RE);
    if (m) return `https://i.imgur.com/${m[1]}.jpg`;
  }
  if (/\.(jpg|jpeg|png|gif|webp)$/i.test(url)) return url;
  if (url.includes("docs.google.com/sheets-images-rt") || url.includes("googleusercontent.com")) return url;
  return null;
}
