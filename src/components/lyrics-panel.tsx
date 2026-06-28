import { useState, useEffect, useRef, useMemo, useCallback, memo } from "react";
import { usePlayer } from "@/src/providers";
import { useSettings } from "@/src/hooks/use-settings";
import { fetchLyrics, parseSyncedLyrics, findCurrentLineIndex, type LyricsData } from "@/src/lib/lyrics";
import type { LyricLine } from "lrclib-api";

const FONT_SIZES = { small: "text-[10px]", medium: "text-[11px]", large: "text-[13px]" };
const FONT_SIZES_ACTIVE = { small: "text-[12px]", medium: "text-[13px]", large: "text-[15px]" };
const ALIGNMENTS = { left: "text-left", center: "text-center", right: "text-right" };

export const LyricsPanel = memo(function LyricsPanel() {
  const { state } = usePlayer();
  const { currentTrack, currentTime } = state;
  const { settings } = useSettings();
  const [lyrics, setLyrics] = useState<LyricsData | null>(null);
  const [loading, setLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const lineRefs = useRef<(HTMLDivElement | null)[]>([]);

  const syncedLines = useMemo<LyricLine[] | null>(() => {
    if (lyrics?.syncedLyrics && lyrics.syncedLyrics.length > 0) return lyrics.syncedLyrics;
    if (!settings.lyrics.syncedOnly && lyrics?.plainLyrics) return parseSyncedLyrics(lyrics.plainLyrics);
    return null;
  }, [lyrics, settings.lyrics.syncedOnly]);

  const plainLines = useMemo(() => {
    if (!lyrics?.plainLyrics) return [];
    return lyrics.plainLyrics.split("\n").filter((l) => l.trim());
  }, [lyrics]);

  const hasSynced = !!syncedLines && syncedLines.length > 0;
  const currentTimeMs = currentTime * 1000;

  const currentLineIndex = useMemo(() => {
    if (!hasSynced || !syncedLines) return -1;
    return findCurrentLineIndex(syncedLines, currentTimeMs);
  }, [hasSynced, syncedLines, currentTimeMs]);

  const doFetch = useCallback(() => {
    if (!currentTrack) return;
    let cancelled = false;
    setLoading(true);
    setLyrics(null);
    lineRefs.current = [];
    fetchLyrics(
      currentTrack.name,
      currentTrack.artistName || "Unknown",
      currentTrack.extra
    ).then((data) => {
      if (!cancelled) {
        setLyrics(data);
        setLoading(false);
      }
    });
    return () => { cancelled = true; };
  }, [currentTrack]);

  useEffect(() => {
    if (!currentTrack) {
      setLyrics(null);
      return;
    }
    const cleanup = doFetch();
    return cleanup;
  }, [currentTrack?.name, currentTrack?.artistName]);

  useEffect(() => {
    if (currentLineIndex >= 0 && lineRefs.current[currentLineIndex] && containerRef.current) {
      const container = containerRef.current;
      const line = lineRefs.current[currentLineIndex];
      const containerRect = container.getBoundingClientRect();
      const lineRect = line.getBoundingClientRect();
      const offset = lineRect.top - containerRect.top - containerRect.height / 2 + lineRect.height / 2;
      container.scrollBy({ top: offset, behavior: "smooth" });
    }
  }, [currentLineIndex]);

  if (!currentTrack) return null;

  const showPlain = !settings.lyrics.syncedOnly;
  const displayLines: Array<{ text: string; startTime?: number }> = hasSynced
    ? syncedLines!
    : showPlain
    ? plainLines.map((text) => ({ text }))
    : [];
  const hasLyrics = !!lyrics && (lyrics.plainLyrics || lyrics.syncedLyrics);

  const fontSize = settings.lyrics.fontSize;
  const alignment = settings.lyrics.alignment;

  return (
    <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
      <div
        ref={containerRef}
        className="flex-1 overflow-y-auto no-scrollbar scroll-smooth px-1"
        style={{
          maskImage: "linear-gradient(to bottom, transparent 0%, black 8%, black 92%, transparent 100%)",
        }}
      >
        <div className={`py-3 space-y-0.5 ${ALIGNMENTS[alignment]}`}>
          {loading && (
            <div className="text-center py-6">
              <div className="inline-flex items-center gap-2 text-white/30 text-[11px]">
                <div className="w-2.5 h-2.5 border-[1.5px] border-white/20 border-t-white/60 rounded-full animate-spin" />
                <span>Loading...</span>
              </div>
            </div>
          )}
          {!loading && lyrics && lyrics.instrumental && (
            <div className="text-center py-6">
              <p className={`${FONT_SIZES[fontSize]} text-white/30 italic`}>Instrumental</p>
            </div>
          )}
          {!loading && hasLyrics && displayLines.length === 0 && (
            <div className="text-center py-6">
              <p className={`${FONT_SIZES[fontSize]} text-white/20`}>No lyrics available</p>
            </div>
          )}
          {!loading && !lyrics && (
            <div className="text-center py-6 flex flex-col items-center gap-2">
              <p className={`${FONT_SIZES[fontSize]} text-white/20`}>No lyrics found</p>
              <button
                type="button"
                onClick={doFetch}
                className={`${FONT_SIZES[fontSize]} text-white/40 hover:text-white px-2.5 py-1 rounded-md glass-flat transition-colors`}
              >
                Search again
              </button>
            </div>
          )}
          {!loading && hasLyrics && displayLines.length > 0 && displayLines.map((line, i) => {
            const isActive = hasSynced && i === currentLineIndex;
            return (
              <div
                key={i}
                ref={(el) => { lineRefs.current[i] = el; }}
                className={`py-0.5 px-1.5 rounded transition-all duration-300 cursor-pointer hover:bg-white/[0.05] ${
                  isActive
                    ? `text-white ${FONT_SIZES_ACTIVE[fontSize]} font-semibold`
                    : hasSynced && currentLineIndex >= 0 && i < currentLineIndex
                    ? `text-white/20 ${FONT_SIZES[fontSize]}`
                    : `text-white/40 ${FONT_SIZES[fontSize]}`
                }`}
                onClick={() => {
                  if (hasSynced && line.startTime !== undefined) {
                    const audio = document.querySelector("audio");
                    if (audio) audio.currentTime = line.startTime / 1000;
                  }
                }}
              >
                {line.text}
              </div>
            );
          })}
          <div className="h-4" />
        </div>
      </div>
    </div>
  );
});
