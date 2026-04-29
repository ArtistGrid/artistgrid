import type { Artist } from "@/src/types";
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
  const id = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/)?.[1];
  return id ? `https://docs.google.com/spreadsheets/d/${id}/edit` : url;
}
export function extractTrackerId(url: string): string | null {
  const match = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]{44})/);
  return match ? match[1] : null;
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
