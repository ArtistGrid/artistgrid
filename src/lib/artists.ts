import Fuse from "fuse.js";
import type { Artist } from "../types";
import { extractTrackerId, getCleanArtistName, getImageFilename } from "./artist-utils";
import { getCachedData, isCacheExpired, setCachedData } from "./cache";
import { ARTISTS_CSV, CUSTOM_REDIRECTS, HOME_CACHE_EXPIRY, LOCAL_STORAGE_KEYS } from "./home-constants";
import { readResponseText, withDeadline } from "./request";
import { parseTrackerLink } from "./tracker-route";

export const ARTIST_DIRECTORY_TIMEOUT = 1500;
export const ARTIST_DIRECTORY_MAX_BYTES = 1024 * 1024;

export async function fetchArtistsCsv(signal: AbortSignal): Promise<string> {
  signal.throwIfAborted();
  const page =
    typeof window === "undefined" ? null : (window as Window & { __artistgridArtistsResponse?: Promise<Response> });
  const preloaded = page?.__artistgridArtistsResponse;
  if (page) delete page.__artistgridArtistsResponse;
  const response = await (preloaded || fetch(ARTISTS_CSV, { signal }));
  signal.throwIfAborted();
  if (!response.ok) throw new Error("Directory unavailable");
  return readResponseText(preloaded ? response.clone() : response, ARTIST_DIRECTORY_MAX_BYTES, signal);
}

const ARTIST_ALIASES: Record<string, string> = {
  ...CUSTOM_REDIRECTS,
  kanye: "Kanye West",
  yeezus: "Kanye West",
  uzi: "Lil Uzi Vert",
  kdot: "Kendrick Lamar",
  rocky: "A$AP Rocky",
  asap: "A$AP Rocky",
  frank: "Frank Ocean",
  tyler: "Tyler, The Creator",
  thug: "Young Thug",
  thugger: "Young Thug",
  travis: "Travis Scott",
  trav: "Travis Scott",
  weeknd: "The Weeknd",
  abel: "The Weeknd",
};

export function parseArtistsCsv(text: string, { onlyWorking = false } = {}): Artist[] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (char === '"') {
      if (quoted && text[i + 1] === '"') {
        field += '"';
        i++;
      } else quoted = !quoted;
    } else if (char === "," && !quoted) {
      row.push(field);
      field = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && text[i + 1] === "\n") i++;
      rows.push([...row, field]);
      row = [];
      field = "";
    } else field += char;
  }
  if (quoted) throw new Error("Malformed artists CSV: unterminated quoted field");
  if (field || row.length) rows.push([...row, field]);

  const headers = (rows.shift() || []).map((value) => value.replace(/^\uFEFF/, "").trim());
  const nameIdx = headers.indexOf("name");
  const urlIdx = headers.indexOf("url");
  const linksWorkIdx = headers.indexOf("links_work");
  const updatedIdx = headers.indexOf("updated");
  const bestIdx = headers.indexOf("best");
  if (nameIdx === -1 || urlIdx === -1) throw new Error("Malformed artists CSV: missing columns");
  const counts = new Map<string, number>();
  const artists: Artist[] = [];
  for (const fields of rows) {
    const name = fields[nameIdx]?.trim();
    const url = fields[urlIdx]?.trim();
    if (!name || !url) continue;
    if (onlyWorking && linksWorkIdx !== -1 && Number(fields[linksWorkIdx]) !== 1) continue;
    const count = counts.get(name) || 0;
    counts.set(name, count + 1);
    const displayName = count === 0 ? name : `${name} [Alt${count > 1 ? ` #${count}` : ""}]`;
    artists.push({
      name: displayName,
      url,
      imageFilename: getImageFilename(displayName),
      isLinkWorking: Number(fields[linksWorkIdx]) === 1,
      isUpdated: Number(fields[updatedIdx]) === 1,
      isStarred: fields[bestIdx]?.trim() === "true",
    });
  }
  return artists;
}

function normalizeArtistName(name: string): string {
  return name
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]/gu, "")
    .replace(/(?:tracker|discography|discog|unreleased)$/, "");
}

export function getDirectTrackerId(input: string): string | null {
  const query = parseTrackerLink(input.trim())?.trackerParam || input.trim();
  const id = extractTrackerId(query);
  if (!id) return null;
  if (/^https?:\/\//i.test(query) || id.includes(".") || id.startsWith("2PACX-")) return id;
  return /^[a-zA-Z0-9_-]{20,}$/.test(id) && (id.length === 44 || /[A-Z0-9_]/.test(id)) ? id : null;
}

export function findMatchingArtist(query: string, artists: Artist[]): Artist | null {
  const input = (parseTrackerLink(query.trim())?.trackerParam || query).trim();
  if (!input) return null;
  const id = extractTrackerId(input);
  const direct =
    id &&
    artists.find((artist) => {
      const artistId = extractTrackerId(artist.url);
      return artistId === id || (!!id?.includes(".") && artistId?.toLowerCase() === id.toLowerCase());
    });
  if (direct) return direct;
  const displayName = artists.find((artist) => artist.name.trim().toLowerCase() === input.toLowerCase());
  if (displayName) return displayName;
  const literalId = getDirectTrackerId(input);
  if (literalId && (/^https?:\/\//i.test(input) || literalId.includes(".") || literalId.startsWith("2PACX-"))) {
    return null;
  }

  const aliasKey = Object.hasOwn(ARTIST_ALIASES, input.toLowerCase())
    ? input.toLowerCase()
    : normalizeArtistName(input);
  const alias = Object.hasOwn(ARTIST_ALIASES, aliasKey) ? ARTIST_ALIASES[aliasKey] : input;
  if (/^https?:\/\//i.test(alias)) return null;
  const normalized = normalizeArtistName(alias);
  if (!normalized) return null;
  const candidates = artists
    .map((artist) => ({ artist, normalized: normalizeArtistName(artist.name) }))
    .sort((a, b) => Number(/\[alt/i.test(a.artist.name)) - Number(/\[alt/i.test(b.artist.name)));
  const exact = candidates.find((candidate) => candidate.normalized === normalized);
  if (exact) return exact.artist;
  // Explicit links/domains and canonical Sheet IDs stay literal; ambiguous names may be fuzzy matched.
  if ((literalId && (input.length === 44 || input.startsWith("1"))) || normalized.length < 3) return null;
  return (
    new Fuse(candidates, { keys: ["normalized"], threshold: 0.35, ignoreLocation: true }).search(normalized, {
      limit: 1,
    })[0]?.item.artist || null
  );
}

export async function resolveArtistTracker(
  input: string,
  signal: AbortSignal,
  origin?: string
): Promise<{ trackerId: string; artistName: string | null }> {
  signal.throwIfAborted();
  const query = parseTrackerLink(input.trim(), origin)?.trackerParam || input.trim();
  const cached = getCachedData<Artist[]>(LOCAL_STORAGE_KEYS.CSV_CACHE_LOCAL);
  let artists = Array.isArray(cached?.data)
    ? cached.data.filter((artist) => artist && typeof artist.name === "string" && typeof artist.url === "string")
    : [];
  const cachedMatch = findMatchingArtist(query, artists);
  const directId = getDirectTrackerId(query);
  const fresh =
    !!cached &&
    Number.isFinite(cached.timestamp) &&
    cached.timestamp <= Date.now() &&
    !isCacheExpired(cached, HOME_CACHE_EXPIRY);
  if (fresh && artists.length) {
    const id = cachedMatch ? extractTrackerId(cachedMatch.url) : directId;
    if (id) return { trackerId: id, artistName: cachedMatch ? getCleanArtistName(cachedMatch.name) : null };
  }
  if (!artists.length || !fresh) {
    try {
      const freshArtists = await withDeadline(
        ARTIST_DIRECTORY_TIMEOUT,
        async (directorySignal) => {
          const rows = parseArtistsCsv(await fetchArtistsCsv(directorySignal));
          if (!rows.length) throw new Error("Directory unavailable");
          return rows;
        },
        signal
      );
      signal.throwIfAborted();
      artists = freshArtists;
      setCachedData(LOCAL_STORAGE_KEYS.CSV_CACHE_LOCAL, artists);
    } catch (error) {
      if (signal.aborted) throw error;
      if (!artists.length && !directId) {
        throw new Error("Could not load the artist list. Please try again.");
      }
    }
  }
  const matched = findMatchingArtist(query, artists);
  const trackerId = matched ? extractTrackerId(matched.url) : directId;
  if (!trackerId) throw new Error(`No matching artist found for "${input}".`);
  return { trackerId, artistName: matched ? getCleanArtistName(matched.name) : null };
}
