import { useCallback, useRef, useEffect, useState, memo, createElement } from "react";
import { Client } from "lrclib-api";
import { usePlayer } from "@/src/providers";
import { useSettings } from "@/src/hooks/use-settings";
import { toTTML, type LyricsData } from "@/src/lib/lyrics";

// Import the side-effect to register the custom element
import "@uimaxbai/am-lyrics/am-lyrics.js";

interface AmLyricsElement extends HTMLElement {
  songTitle: string;
  songArtist: string;
  query: string;
  ttml: string;
  highlightColor: string;
  autoScroll: boolean;
  interpolate: boolean;
  currentTime: number;
  fetchLyrics(): Promise<void>;
}

const lrclibClient = new Client();

function buildQuery(name: string, artist: string, extra?: string): string {
  const clean = (s: string) => s.replace(/\s*[\(\[].*?[\)\]]/g, "").replace(/\s+/g, " ").trim();
  const title = clean(name);
  const artistName = clean(artist);
  const parts = [title, artistName].filter(Boolean);
  const base = parts.join(" - ");
  const extraClean = extra ? clean(extra) : "";
  return extraClean && !base.toLowerCase().includes(extraClean.toLowerCase()) ? `${base} - ${extraClean}` : base;
}

async function fetchFromLRCLIB(name: string, artist: string): Promise<string | null> {
  try {
    const results = await lrclibClient.searchLyrics({ track_name: name, artist_name: artist });
    if (!results.length) return null;

    const first = results[0];
    if (first.instrumental) return null;

    const lyricsData: LyricsData = {
      plainLyrics: first.plainLyrics,
      syncedLyrics: first.syncedLyrics
        ? first.syncedLyrics.split("\n").flatMap((line) => {
            if (!line.trim()) return [];
            const match = line.match(/^\[(\d{2}):(\d{2})\.(\d{2,3})\]\s*(.*)/);
            if (!match) return [];
            const ms = parseInt(match[1]) * 60000 + parseInt(match[2]) * 1000 + parseInt(match[3].padEnd(3, "0"));
            return [{ text: match[4].trim(), startTime: ms }];
          })
        : null,
      instrumental: false,
      trackName: name,
      artistName: artist,
      albumName: first.albumName || "",
      duration: first.duration || 0,
    };

    if (!lyricsData.plainLyrics && (!lyricsData.syncedLyrics || lyricsData.syncedLyrics.length === 0)) return null;

    return toTTML(lyricsData);
  } catch {
    return null;
  }
}

export const LyricsPanel = memo(function LyricsPanel() {
  const { state } = usePlayer();
  const { currentTrack, currentTime } = state;
  const { settings } = useSettings();
  const ref = useRef<AmLyricsElement>(null);
  const [ttml, setTtml] = useState<string | null>(null);

  const handleLineClick = useCallback((e: Event) => {
    const audio = document.querySelector("audio");
    const detail = (e as CustomEvent<{ timestamp: number }>).detail;
    if (audio && typeof detail?.timestamp === "number") {
      audio.currentTime = detail.timestamp / 1000;
    }
  }, []);

  useEffect(() => {
    if (!currentTrack) return;
    setTtml(null);

    const artist = currentTrack.artistName || "Unknown";
    fetchFromLRCLIB(currentTrack.name, artist).then(setTtml);
  }, [currentTrack]);

  useEffect(() => {
    const el = ref.current;
    if (!el || !currentTrack) return;

    const artist = currentTrack.artistName || "Unknown";
    const query = buildQuery(currentTrack.name, artist, currentTrack.extra);

    el.songTitle = currentTrack.name;
    el.songArtist = artist;
    el.query = query;
    el.highlightColor = "#ffffff";
    el.autoScroll = !settings.lyrics.syncedOnly;
    el.interpolate = true;

    if (ttml) {
      el.ttml = ttml;
    }

    el.fetchLyrics();
  }, [currentTrack, settings.lyrics.syncedOnly, ttml]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.currentTime = Math.floor(currentTime * 1000);
  }, [currentTime]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.addEventListener("line-click", handleLineClick);
    return () => el.removeEventListener("line-click", handleLineClick);
  }, [handleLineClick]);

  if (!currentTrack) return null;

  return createElement("div", { className: "flex-1 min-h-0 overflow-hidden flex flex-col" },
    createElement("am-lyrics", { ref, className: "h-full w-full" })
  );
});
