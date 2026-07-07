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
export function getSheetViewUrl(url: string, htmlview = true): string {
  const mode = htmlview ? "htmlview" : "edit";
  if (url.includes("/spreadsheets/d/e/")) return url;
  const id = url.match(/\/spreadsheets(?:\/u\/\d+)?\/d\/([a-zA-Z0-9-_]+)/)?.[1];
  if (id) return `https://docs.google.com/spreadsheets/d/${id}/${mode}`;
  const trackerId = extractTrackerId(url);
  if (trackerId && !trackerId.includes(".")) return `https://docs.google.com/spreadsheets/d/${trackerId}/${mode}`;
  if (trackerId && !url.startsWith("http")) return `https://${url}`;
  return url;
}
const SPECIAL_IDS: Record<string, string> = {
  "yetracker.net": "yetracker.net",
  "https://yetracker.net": "yetracker.net",
  "https://yetracker.net/": "yetracker.net",
  "franktracker.net": "franktracker.net",
  "https://franktracker.net": "franktracker.net",
  "https://franktracker.net/": "franktracker.net",
  "deftonestracker.net": "deftonestracker.net",
  "https://deftonestracker.net": "deftonestracker.net",
  "https://deftonestracker.net/": "deftonestracker.net",
};

export function extractTrackerId(input: string): string | null {
  if (SPECIAL_IDS[input]) return SPECIAL_IDS[input];
  const cleanInput = input.replace(/\./g, '');
  const pubhtml = input.match(/\/spreadsheets\/d\/e\/(2PACX-[a-zA-Z0-9_-]+)\//);
  if (pubhtml) return pubhtml[1];
  const match = input.match(/\/spreadsheets(?:\/u\/\d+)?\/d\/([a-zA-Z0-9_-]{20,})/);
  if (match) return match[1];
  if (/^[a-zA-Z0-9][a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(input.trim())) return input.trim();
  if (/^[a-zA-Z0-9_-]+$/.test(cleanInput)) return cleanInput;
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
  return name.replace(/\s*[\(\[\{][^\)\]\}]*[\)\]\}]\s*/g, "").trim();
}
