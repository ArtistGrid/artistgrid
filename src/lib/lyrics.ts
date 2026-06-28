import { type LyricLine } from "lrclib-api";

const API_BASE = "https://lrclib.net/api";

export interface LyricsData {
  plainLyrics: string | null;
  syncedLyrics: LyricLine[] | null;
  instrumental: boolean;
  trackName: string;
  artistName: string;
  albumName: string;
  duration: number;
}

let abortController: AbortController | null = null;
const lyricsCache = new Map<string, LyricsData | null>();

function cleanName(name: string): string {
  return name.replace(/[\r\n]+/g, " ").replace(/\s+/g, " ").trim();
}

function stripAllParentheticals(name: string): string {
  return name.replace(/\s*[\(\[].*?[\)\]]/g, "").replace(/\s+/g, " ").replace(/,\s*$/, "").trim();
}

function extractAlternateNames(name: string): string[] {
  const alts: string[] = [];
  const regex = /[\(\[]([^)\]]+)[\)\]]/g;
  let m;
  while ((m = regex.exec(name)) !== null) {
    const inner = m[1].trim();
    if (!inner) continue;
    const lower = inner.toLowerCase();
    if (
      lower.startsWith("feat") || lower.startsWith("ft") || lower.startsWith("prod") ||
      lower.startsWith("with") || lower.startsWith("aka") || lower.startsWith("also") ||
      lower.startsWith("remix") || lower.startsWith("original") || lower.startsWith("written")
    ) continue;
    if (/^\d+:\d+/.test(inner) || /^\d+\s*(min|sec|kbps)/i.test(inner)) continue;
    alts.push(inner);
  }
  return alts;
}

interface LrcTrack {
  trackName: string;
  artistName: string;
  albumName: string;
  duration: number;
  instrumental: boolean;
  plainLyrics: string | null;
  syncedLyrics: string | null;
}

function buildGetUrl(params: { track_name: string; artist_name: string }): string {
  const entries: [string, string][] = [
    ["track_name", params.track_name],
    ["artist_name", params.artist_name],
  ];
  return `${API_BASE}/get?${entries.map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join("&")}`;
}

async function fetchTrack(trackName: string, artistName: string, signal: AbortSignal): Promise<LrcTrack | null> {
  const url = buildGetUrl({ track_name: trackName, artist_name: artistName });
  try {
    const res = await fetch(url, { signal });
    if (!res.ok) return null;
    const data = await res.json();
    if (data.error) return null;
    return data as LrcTrack;
  } catch {
    return null;
  }
}

function parseSyncedTimestamps(syncedLyrics: string): LyricLine[] {
  const lines: LyricLine[] = [];
  const regex = /\[(\d{2}):(\d{2})\.(\d{2,3})\]\s*(.*)/g;
  let match;
  while ((match = regex.exec(syncedLyrics)) !== null) {
    const minutes = parseInt(match[1], 10);
    const seconds = parseInt(match[2], 10);
    const ms = parseInt(match[3].padEnd(3, "0"), 10);
    const startTime = minutes * 60 * 1000 + seconds * 1000 + ms;
    const text = match[4].trim();
    if (text) lines.push({ text, startTime });
  }
  return lines;
}

function lyricsScore(l: LyricsData): number {
  if (l.syncedLyrics && l.syncedLyrics.length > 0) return 2;
  if (l.plainLyrics) return 1;
  return 0;
}

export async function fetchLyrics(
  trackName: string,
  artistName: string,
  extra?: string
): Promise<LyricsData | null> {
  const cacheKey = `${cleanName(trackName)}|${cleanName(artistName)}`;
  if (lyricsCache.has(cacheKey)) return lyricsCache.get(cacheKey)!;

  if (abortController) abortController.abort();
  abortController = new AbortController();
  const signal = abortController.signal;

  const cleanedTrack = cleanName(trackName);
  const cleanedArtist = cleanName(artistName);
  const strippedTrack = stripAllParentheticals(cleanedTrack);
  const alts = extractAlternateNames(cleanedTrack);
  const extraAlts = extra ? extractAlternateNames(cleanName(extra)) : [];
  const allAlts = [...alts, ...extraAlts];
  const trackCandidates = [strippedTrack, ...allAlts.filter((a) => a !== strippedTrack)];

  try {
    const tracks = await Promise.allSettled(
      trackCandidates.map((tc) => fetchTrack(tc, cleanedArtist, signal))
    );

    const found = tracks
      .filter((r): r is PromiseFulfilledResult<LrcTrack> => r.status === "fulfilled" && r.value !== null)
      .map((r) => r.value);

    if (found.length === 0) {
      lyricsCache.set(cacheKey, null);
      return null;
    }

    const syncedResults = await Promise.allSettled(
      found.map(async (track) => {
        let syncedLines: LyricLine[] | null = null;
        if (track.syncedLyrics) {
          syncedLines = parseSyncedTimestamps(track.syncedLyrics);
        }
        return {
          plainLyrics: track.plainLyrics,
          syncedLyrics: syncedLines,
          instrumental: track.instrumental,
          trackName: track.trackName,
          artistName: track.artistName,
          albumName: track.albumName,
          duration: track.duration,
        } satisfies LyricsData;
      })
    );

    let best: LyricsData | null = null;
    let bestScore = -1;
    for (const r of syncedResults) {
      if (r.status === "fulfilled") {
        const s = lyricsScore(r.value);
        if (s > bestScore) {
          bestScore = s;
          best = r.value;
        }
      }
    }
    lyricsCache.set(cacheKey, best);
    return best;
  } catch (e: any) {
    if (e?.name === "AbortError" || e?.message?.includes("abort")) return null;
    console.error("[lrclib] fetch failed:", e);
    return null;
  }
}

export { parseSyncedTimestamps as parseSyncedLyrics };

export function findCurrentLineIndex(
  lines: LyricLine[],
  currentTimeMs: number
): number {
  for (let i = lines.length - 1; i >= 0; i--) {
    if (currentTimeMs >= lines[i].startTime!) return i;
  }
  return 0;
}
