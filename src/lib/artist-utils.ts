import type { Artist } from "@/src/types";
import { isValidTrackerId } from "@/src/lib/track-utils";
export function hashString(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash = hash & hash;
  }
  return hash.toString(36);
}
export function getImageFilename(artistName: string): string {
  return artistName.toLowerCase().replace(/[^a-z0-9]/g, "") + ".webp";
}
export function getSheetViewUrl(url: string): string {
  if (url.includes("/spreadsheets/d/e/")) return url;
  const id = url.match(/\/spreadsheets(?:\/u\/\d+)?\/d\/([a-zA-Z0-9-_]+)/)?.[1];
  return id ? `https://docs.google.com/spreadsheets/d/${id}/edit` : url;
}
const SPECIAL_IDS: Record<string, string> = {
  "yetracker.net": "yetracker.net",
  "https://yetracker.net": "yetracker.net",
  "https://yetracker.net/": "yetracker.net",
};

export function extractTrackerId(input: string): string | null {
  if (SPECIAL_IDS[input]) return SPECIAL_IDS[input];
  if (isValidTrackerId(input)) return input;
  const pubhtml = input.match(/\/spreadsheets\/d\/e\/(2PACX-[a-zA-Z0-9_-]+)\//);
  if (pubhtml) return pubhtml[1];
  const match = input.match(/\/spreadsheets(?:\/u\/\d+)?\/d\/([a-zA-Z0-9_-]{20,})/);
  if (match) return match[1];
  if (/^[a-zA-Z0-9][a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(input.trim())) return input.trim();
  return null;
}
export function artistsEqual(a: Artist[], b: Artist[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i].name !== b[i].name || a[i].url !== b[i].url) return false;
  }
  return true;
}
export function getCleanArtistName(name: string): string {
  let cleanName = name.trim();
  const altMatch = cleanName.match(/^(.+?)\s*\[Alt.*?\]$/i);
  if (altMatch) cleanName = altMatch[1].trim();
  return cleanName;
}
