import { type LyricLine } from "lrclib-api";

export interface LyricsData {
  plainLyrics: string | null;
  syncedLyrics: LyricLine[] | null;
  instrumental: boolean;
  trackName: string;
  artistName: string;
  albumName: string;
  duration: number;
}

function formatTtmlTime(ms: number): string {
  const totalSeconds = Math.max(0, ms) / 1000;
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = Math.floor(totalSeconds % 60);
  const millis = Math.floor(ms % 1000);
  const pad = (n: number, w = 2) => n.toString().padStart(w, "0");
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}.${pad(millis, 3)}`;
}

function escapeXml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export function toTTML(lyrics: LyricsData): string {
  const lines: Array<{ text: string; start: number; end: number }> = [];
  if (lyrics.syncedLyrics && lyrics.syncedLyrics.length > 0) {
    const synced = lyrics.syncedLyrics;
    for (let i = 0; i < synced.length; i++) {
      const start = synced[i].startTime ?? 0;
      const next = synced[i + 1]?.startTime;
      const end = next !== undefined ? next : start + 4000;
      lines.push({ text: synced[i].text, start, end });
    }
  } else if (lyrics.plainLyrics) {
    const plain = lyrics.plainLyrics.split("\n").filter((l) => l.trim());
    for (const text of plain) {
      lines.push({ text, start: 0, end: 0 });
    }
  }
  const body = lines
    .map((l) => `      <p begin="${formatTtmlTime(l.start)}" end="${formatTtmlTime(l.end)}">${escapeXml(l.text)}</p>`)
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>
 <tt xmlns="http://www.w3.org/ns/ttml">
   <body>
     <div>
 ${body}
     </div>
   </body>
 </tt>`;
}
