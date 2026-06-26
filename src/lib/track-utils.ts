import type { Track, TALeak } from "@/src/types";
import { normalizePillowsUrl } from "./resolve-url";
export const TRACKER_ID_LENGTH = 44;
export const SUPPORTED_SOURCES: Track["source"][] = [
  "pillows",
  "youtube",
  "krakenfiles",
  "pixeldrain",
  "imgur",
  "yetracker",
  "soundcloud",
  "qobuz",
];
export function generateTrackId(url: string): string {
  let hash = 0;
  for (let i = 0; i < url.length; i++) {
    hash = (hash << 5) - hash + url.charCodeAt(i);
    hash = hash & hash;
  }
  return "tk" + Math.abs(hash).toString(36);
}
export function isUrl(str: string | null | undefined): boolean {
  if (!str || typeof str !== "string") return false;
  return str.startsWith("http://") || str.startsWith("https://");
}
export function getTrackUrl(track: TALeak): string | null {
  if (track.url && isUrl(track.url)) return normalizePillowsUrl(track.url);
  if (track.quality && isUrl(track.quality)) return normalizePillowsUrl(track.quality);
  if (track.available_length && isUrl(track.available_length)) return normalizePillowsUrl(track.available_length);
  return null;
}
export function getTrackDescription(track: TALeak): string | null {
  return track.description || track.notes || track.info || null;
}


const SPECIAL_TRACKER_IDS = ["yetracker.net", "franktracker.net"];

export function isValidTrackerId(id: string): boolean {
  if (!id || typeof id !== "string") return false;
  const trimmed = id.trim();
  if (SPECIAL_TRACKER_IDS.includes(trimmed)) return true;
  if (trimmed.startsWith("2PACX-")) return /^[a-zA-Z0-9_-]+$/.test(trimmed);
  return trimmed.length === TRACKER_ID_LENGTH && /^[a-zA-Z0-9_-]+$/.test(trimmed);
}
export function encodeTrackForUrl(url: string): string {
  return btoa(url).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
export function decodeTrackFromUrl(encoded: string): string | null {
  try {
    const base64 = encoded.replace(/-/g, "+").replace(/_/g, "/");
    const padding = (4 - (base64.length % 4)) % 4;
    return atob(base64 + "=".repeat(padding));
  } catch {
    return null;
  }
}
export function getGoogleSheetsUrl(trackerId: string): string {
  return `https://docs.google.com/spreadsheets/d/${trackerId}/htmlview`;
}
export function getSourceDisplayName(source: Track["source"]): string {
  const names: Record<Track["source"], string> = {
    pillows: "Pillows",
    froste: "Froste",
    krakenfiles: "KrakenFiles",
    juicewrldapi: "JuiceWrldAPI",
    imgur: "Imgur",
    pixeldrain: "Pixeldrain",
    soundcloud: "SoundCloud",
    qobuz: "Qobuz",
    yetracker: "YeTracker",
    youtube: "YouTube",
    unknown: "Unknown",
  };
  return names[source];
}
