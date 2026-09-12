import { useLayoutEffect, useRef, useState } from "react";
import { useWindowVirtualizer } from "@tanstack/react-virtual";
import { DropdownMenuItem, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { Play, Radio, SkipForward, ListPlus, Download, Heart, ExternalLink } from "lucide-react";
import type { Era, TALeak, Track, TrackSource } from "@/src/types";
import {
  PlayButton,
  PauseButton,
  OpenLinkButton,
  TrackDescription,
  TrackItemActions,
} from "@/src/components/view/track-item";
import { getEraFontStyle } from "@/src/hooks/use-era-fonts";
import { useImageProxy } from "@/src/hooks/use-image-proxy";
import { useResolvedImage } from "@/src/hooks/use-image-resolve";
export interface FlatTrackCardProps {
  t: TALeak;
  fakeEra: Era;
  url: string | null;
  source: TrackSource;
  isPlayable: boolean;
  isCurrentlyPlaying: boolean;
  description: string | undefined;
  shouldShowSource: boolean;
  playableUrl: string | null;
  handlePlayTrack: (t: TALeak, era: Era) => void;
  handleOpenUrl: (url: string) => void;
  handleToggleFavourite: (url: string) => void;
  handleOpenOriginal: (t: TALeak) => void;
  handleDownload: (t: TALeak) => void;
  handlePlayNext: (t: TALeak, era: Era) => void;
  handleAddToQueue: (t: TALeak, era: Era) => void;
  favourites: string[];
  createTrackObject: (t: TALeak, era: Era, url: string, playableUrl: string) => Track;
  clearQueue: () => void;
  playTrack: (t: Track) => void;
}
export function FlatTrackCard({
  t,
  fakeEra,
  url,
  source,
  isPlayable,
  isCurrentlyPlaying,
  description,
  shouldShowSource,
  playableUrl,
  handlePlayTrack,
  handleOpenUrl,
  handleToggleFavourite,
  handleOpenOriginal,
  handleDownload,
  handlePlayNext,
  handleAddToQueue,
  favourites,
  createTrackObject,
  clearQueue,
  playTrack,
}: FlatTrackCardProps) {
  const { proxyImageUrl } = useImageProxy();
  const resolvedImage = useResolvedImage(t.image);
  return (
    <>
      <div className="flex items-center gap-2 sm:gap-3 p-2.5 sm:p-3">
        {isPlayable ? (
          isCurrentlyPlaying ? (
            <PauseButton onPlay={() => handlePlayTrack(t, fakeEra)} />
          ) : (
            <PlayButton onPlay={() => handlePlayTrack(t, fakeEra)} />
          )
        ) : (
          <OpenLinkButton onOpenLink={() => url && handleOpenUrl(url)} />
        )}
        {t.image && resolvedImage && (
          <img
            src={proxyImageUrl(resolvedImage)}
            alt=""
            aria-hidden="true"
            className="w-10 h-10 rounded-lg object-cover flex-shrink-0 hidden sm:block"
            loading="lazy"
            decoding="async"
            referrerPolicy="no-referrer"
            crossOrigin="anonymous"
            onError={(e) => {
              e.currentTarget.style.visibility = "hidden";
            }}
          />
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="font-semibold text-white text-xs sm:text-sm truncate">{t.name || "Unknown"}</span>
          </div>
          <div className="flex flex-wrap items-center gap-1 sm:gap-2 mt-0.5">
            {t.eraName && (
              <span
                className="text-[10px] px-1.5 py-0.5 rounded font-medium flex-shrink-0"
                style={{
                  ...(getEraFontStyle(fakeEra.font) || {}),
                  background: t.eraColor ? `color-mix(in srgb, ${t.eraColor}, oklch(14.5% 0 0) 70%)` : "rgb(38 38 38)",
                  color: t.eraTextColor
                    ? `color-mix(in srgb, ${t.eraTextColor}, rgb(255,255,255) 30%)`
                    : "rgb(163 163 163)",
                }}
              >
                {t.eraName}
              </span>
            )}
            {t.extra && <span className="text-xs text-neutral-500 truncate">{t.extra}</span>}
          </div>
        </div>
        <TrackItemActions
          track={t}
          source={source}
          shouldShowSource={shouldShowSource}
          url={url}
          onOpenUrl={url ? () => handleOpenUrl(url) : () => {}}
          isFavourited={url ? favourites.includes(url) : false}
          onToggleFavourite={url ? () => handleToggleFavourite(url) : undefined}
        >
          {isPlayable && (
            <>
              <DropdownMenuItem onClick={() => handlePlayTrack(t, fakeEra)} className="cursor-pointer">
                <Play className="w-4 h-4 mr-2" />
                Play
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => {
                  const pt = createTrackObject(t, fakeEra, url!, playableUrl!);
                  clearQueue();
                  playTrack(pt);
                }}
                className="cursor-pointer"
              >
                <Radio className="w-4 h-4 mr-2" />
                Play Track Only
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handlePlayNext(t, fakeEra)} className="cursor-pointer">
                <SkipForward className="w-4 h-4 mr-2" />
                Play Next
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleAddToQueue(t, fakeEra)} className="cursor-pointer">
                <ListPlus className="w-4 h-4 mr-2" />
                Add to Queue
              </DropdownMenuItem>
              <DropdownMenuSeparator className="bg-neutral-800" />
              <DropdownMenuItem onClick={() => handleDownload(t)} className="cursor-pointer">
                <Download className="w-4 h-4 mr-2" />
                Download
              </DropdownMenuItem>
            </>
          )}
          <DropdownMenuSeparator className="bg-neutral-800" />
          {url && (
            <DropdownMenuItem onClick={() => handleToggleFavourite(url)} className="cursor-pointer">
              <Heart className={`w-4 h-4 mr-2 ${favourites.includes(url) ? "fill-current text-red-400" : ""}`} />
              {favourites.includes(url) ? "Unfavourite" : "Favourite"}
            </DropdownMenuItem>
          )}
          <DropdownMenuItem onClick={() => handleOpenOriginal(t)} className="cursor-pointer">
            <ExternalLink className="w-4 h-4 mr-2" />
            Open Original URL
          </DropdownMenuItem>
        </TrackItemActions>
      </div>
      <TrackDescription description={description} />
    </>
  );
}
export interface FlatTrackListProps {
  tracks: TALeak[];
  computeTrackState: (t: TALeak) => {
    url: string | null;
    source: TrackSource;
    isPlayable: boolean;
    isCurrentlyPlaying: boolean;
    isCurrentTrack: boolean;
    isHighlighted: boolean;
    description: string | undefined;
    shouldShowSource: boolean;
    playableUrl: string | null;
  };
  handlePlayTrack: (t: TALeak, era: Era) => void;
  handlePlayNext: (t: TALeak, era: Era) => void;
  handleAddToQueue: (t: TALeak, era: Era) => void;
  handleOpenUrl: (url: string) => void;
  handleOpenOriginal: (t: TALeak) => void;
  handleToggleFavourite: (url: string) => void;
  handleDownload: (t: TALeak) => void;
  favourites: string[];
  highlightedTrackRef: React.RefObject<HTMLDivElement | null>;
  createTrackObject: (t: TALeak, era: Era, url: string, playableUrl: string) => Track;
  clearQueue: () => void;
  playTrack: (t: Track) => void;
}
export function FlatTrackList({
  tracks,
  computeTrackState,
  handlePlayTrack,
  handlePlayNext,
  handleAddToQueue,
  handleOpenUrl,
  handleOpenOriginal,
  handleToggleFavourite,
  handleDownload,
  favourites,
  highlightedTrackRef,
  createTrackObject,
  clearQueue,
  playTrack,
}: FlatTrackListProps) {
  const parentRef = useRef<HTMLDivElement>(null);
  const [scrollMargin, setScrollMargin] = useState(0);
  useLayoutEffect(() => {
    const measure = () => {
      if (parentRef.current) {
        setScrollMargin(parentRef.current.getBoundingClientRect().top + window.scrollY);
      }
    };
    measure();
    const t = window.setTimeout(measure, 300);
    window.addEventListener("resize", measure);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener("resize", measure);
    };
  }, []);
  const virtualizer = useWindowVirtualizer({
    count: tracks.length,
    estimateSize: () => 70,
    overscan: 15,
    scrollMargin,
  });
  return (
    <div ref={parentRef}>
      <div style={{ height: virtualizer.getTotalSize(), width: "100%", position: "relative" }}>
        {virtualizer.getVirtualItems().map((virtualRow) => {
          const t = tracks[virtualRow.index];
          const {
            url,
            source,
            isPlayable,
            isCurrentlyPlaying,
            isCurrentTrack,
            isHighlighted,
            description,
            shouldShowSource,
            playableUrl,
          } = computeTrackState(t);
          const fakeEra: Era = {
            name: t.eraName ?? "",
            backgroundColor: t.eraColor,
            textColor: t.eraTextColor,
            font: t.eraFont,
          };
          return (
            <div
              key={virtualRow.key}
              ref={(node) => {
                virtualizer.measureElement(node);
                if (isHighlighted) highlightedTrackRef.current = node;
              }}
              data-index={virtualRow.index}
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                transform: `translateY(${virtualRow.start - scrollMargin}px)`,
              }}
              className={`rounded-xl transition-colors pb-3 ${isHighlighted ? "bg-yellow-400/15 border border-yellow-400/40 ring-2 ring-yellow-400/20" : isCurrentTrack ? "bg-white/[0.08] border border-white/[0.15]" : "glass-flat"}`}
            >
              <FlatTrackCard
                t={t}
                fakeEra={fakeEra}
                url={url}
                source={source}
                isPlayable={isPlayable}
                isCurrentlyPlaying={isCurrentlyPlaying}
                description={description}
                shouldShowSource={shouldShowSource}
                playableUrl={playableUrl}
                handlePlayTrack={handlePlayTrack}
                handleOpenUrl={handleOpenUrl}
                handleToggleFavourite={handleToggleFavourite}
                handleOpenOriginal={handleOpenOriginal}
                handleDownload={handleDownload}
                handlePlayNext={handlePlayNext}
                handleAddToQueue={handleAddToQueue}
                favourites={favourites}
                createTrackObject={createTrackObject}
                clearQueue={clearQueue}
                playTrack={playTrack}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
