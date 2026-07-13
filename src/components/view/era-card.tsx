import { motion, AnimatePresence } from "framer-motion";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { ChevronDown, MoreHorizontal, Heart, FolderDown } from "lucide-react";
import type { Era, TALeak, TrackSource } from "@/src/types";
import { getTrackUrl } from "@/src/lib/track-utils";
import { TrackRow } from "@/src/components/view/track-row";
import { useImageProxy } from "@/src/hooks/use-image-proxy";

export type EraCardTrackState = {
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

interface EraCategoryHeaderProps {
  cat: string;
  tracks: TALeak[];
  resolvedUrls: Map<string, string | null>;
  onDownload: () => void;
}

function EraCategoryHeader({ cat, tracks, resolvedUrls, onDownload }: EraCategoryHeaderProps) {
  if (cat.toLowerCase() === "default") return null;
  const hasResolved = tracks.some((t) => {
    const u = getTrackUrl(t);
    return u ? !!resolvedUrls.get(u) : false;
  });
  return (
    <div className="flex items-center justify-between pb-2 sm:pb-3 mb-2 sm:mb-3 border-b border-white/[0.08]">
      <h4 className="text-xs sm:text-sm font-semibold text-white/50">{cat}</h4>
      {hasResolved && (
        <button
          type="button"
          onClick={onDownload}
          aria-label={`Download ${cat}`}
          className="text-white/25 hover:text-white transition-colors p-1 -m-1 flex-shrink-0"
          title={`Download ${cat}`}
        >
          <FolderDown className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}

export interface EraCardProps {
  eraKey: string;
  era: Era;
  resolvedUrls: Map<string, string | null>;
  trackerId: string;
  expandedEras: Set<string>;
  toggleEra: (key: string) => void;
  computeTrackState: (t: TALeak) => EraCardTrackState;
  handlePlayTrack: (t: TALeak, era: Era) => void;
  handleOpenUrl: (url: string) => void;
  handleShareTrack: (url: string, name: string) => void;
  handlePlayNext: (t: TALeak, era: Era) => void;
  handleAddToQueue: (t: TALeak, era: Era) => void;
  handleDownload: (t: TALeak) => void;
  handleToggleFavourite: (url: string) => void;
  handleOpenOriginal: (t: TALeak) => void;
  handleToggleEraFavourite: (era: Era) => void;
  isEraFavourited: (trackerId: string, era: Era) => boolean;
  downloadTracker: (eraKey?: string, cat?: string) => void;
  favourites: string[];
  highlightedTrackRef: React.RefObject<HTMLDivElement | null>;
}

export function EraCard({
  eraKey,
  era,
  resolvedUrls,
  trackerId,
  expandedEras,
  toggleEra,
  computeTrackState,
  handlePlayTrack,
  handleOpenUrl,
  handleShareTrack,
  handlePlayNext,
  handleAddToQueue,
  handleDownload,
  handleToggleFavourite,
  handleOpenOriginal,
  handleToggleEraFavourite,
  isEraFavourited,
  downloadTracker,
  favourites,
  highlightedTrackRef,
}: EraCardProps) {
  const { proxyImageSrcSet } = useImageProxy();
  const eraPlayableCount = era.data
    ? Object.values(era.data)
        .flat()
        .filter((t) => {
          const url = getTrackUrl(t);
          return url && resolvedUrls.get(url);
        }).length
    : 0;
  return (
    <div
      key={eraKey}
      className="rounded-2xl overflow-hidden border border-white/[0.1]"
      style={{
        background: era.backgroundColor
          ? `color-mix(in srgb, ${era.backgroundColor}, oklch(10% 0 0) 82%)`
          : "rgba(255,255,255,0.055)",
        backdropFilter: "blur(8px)",
        WebkitBackdropFilter: "blur(8px)",
        boxShadow: "inset 0 1px 0 rgba(255,255,255,0.1), 0 4px 20px rgba(0,0,0,0.3)",
      }}
    >
      <div className="flex items-center">
        <button
          type="button"
          className="flex-1 flex items-center gap-3 sm:gap-4 p-4 sm:p-5 text-left hover:bg-white/[0.03] transition-colors"
          onClick={() => toggleEra(eraKey)}
        >
          {era.image ? (
            (() => {
              const srcs = proxyImageSrcSet(era.image);
              return (
                <picture>
                  <source type="image/jxl" srcSet={srcs.jxl} />
                  <source type="image/webp" srcSet={srcs.webp} />
                  <img
                    src={srcs.original}
                    alt={era.name}
                    className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl object-contain flex-shrink-0"
                    style={{
                      background: era.backgroundColor
                        ? `color-mix(in srgb, ${era.backgroundColor}, oklch(10% 0 0) 70%)`
                        : "rgba(255,255,255,0.07)",
                    }}
                    referrerPolicy="no-referrer"
                    crossOrigin="anonymous"
                  />
                </picture>
              );
            })()
          ) : (
            <div
              className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl flex-shrink-0"
              style={{
                background: era.backgroundColor
                  ? `color-mix(in srgb, ${era.backgroundColor}, oklch(10% 0 0) 70%)`
                  : "rgba(255,255,255,0.07)",
              }}
            />
          )}
          <div className="flex-1 min-w-0">
            <h3
              style={{
                color: era.textColor
                  ? `color-mix(in srgb, ${era.textColor}, rgb(255,255,255) 40%)`
                  : "white",
              }}
              className="text-base sm:text-lg font-bold truncate"
            >
              {era.name || eraKey}
            </h3>
            <p className="text-xs sm:text-sm text-white/40">
              {era.extra && <>{era.extra} · </>}
              {era.data ? Object.values(era.data).reduce((n, arr) => n + arr.length, 0) : 0} songs
              {eraPlayableCount > 0 && <> | {eraPlayableCount} playable</>}
            </p>
          </div>
          <ChevronDown
            className={`w-4 h-4 text-white/30 transition-transform flex-shrink-0 ${expandedEras.has(eraKey) ? "rotate-180" : ""}`}
          />
        </button>
        {eraPlayableCount > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="text-white/30 hover:text-white hover:bg-white/10 mr-2 h-9 w-9 flex-shrink-0 rounded-xl"
                aria-label="Era options"
              >
                <MoreHorizontal className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              className="w-48 glass-elevated border-0 rounded-2xl text-white/80 p-1"
            >
              <DropdownMenuItem onClick={() => handleToggleEraFavourite(era)} className="cursor-pointer rounded-xl">
                <Heart className={`w-4 h-4 mr-2 ${isEraFavourited(trackerId, era) ? "fill-current text-red-400" : ""}`} />
                {isEraFavourited(trackerId, era) ? "Unfavourite Era" : "Favourite Era"}
              </DropdownMenuItem>
              <DropdownMenuSeparator className="bg-neutral-800" />
              <DropdownMenuItem onClick={() => downloadTracker(eraKey)} className="cursor-pointer rounded-xl">
                <FolderDown className="w-4 h-4 mr-2" />
                Download Era ({eraPlayableCount})
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
      <AnimatePresence initial={false}>
        {expandedEras.has(eraKey) && (
          <motion.div
            key={`era-content-${eraKey}`}
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
          >
            <div className="px-3 pb-3 sm:px-5 sm:pb-5">
              {era.description && (
                <p className="text-xs sm:text-sm text-white/45 p-3 sm:p-4 bg-black/20 rounded-xl mb-3 sm:mb-5">
                  {era.description}
                </p>
              )}
              {era.era_dates && era.era_dates.length > 0 && (
                <div className="mb-3 px-1">
                  {era.era_dates.map((ed, i) => (
                    <p key={`${ed.date}-${ed.event}`} className="text-[10px] sm:text-xs text-white/40 mb-0.5 last:mb-0">
                      {ed.date}{ed.event ? ` — ${ed.event}` : ""}
                    </p>
                  ))}
                </div>
              )}
              {era.data &&
                Object.entries(era.data).map(([cat, tracks]) => (
                  <div key={cat} className="mb-4 sm:mb-5 last:mb-0">
                    <EraCategoryHeader
                      cat={cat}
                      tracks={tracks as TALeak[]}
                      resolvedUrls={resolvedUrls}
                      onDownload={() => downloadTracker(eraKey, cat)}
                    />
                    <div className="space-y-1.5 sm:space-y-2">
                      {(tracks as TALeak[]).map((track, i) => (
                        <TrackRow
                          key={`${eraKey}-${cat}-${track.name || i}`}
                          track={track}
                          era={era}
                          computeTrackState={computeTrackState}
                          handlePlayTrack={handlePlayTrack}
                          handleOpenUrl={handleOpenUrl}
                          handleShareTrack={handleShareTrack}
                          handlePlayNext={handlePlayNext}
                          handleAddToQueue={handleAddToQueue}
                          handleDownload={handleDownload}
                          handleToggleFavourite={handleToggleFavourite}
                          handleOpenOriginal={handleOpenOriginal}
                          favourites={favourites}
                          highlightedTrackRef={highlightedTrackRef}
                        />
                      ))}
                    </div>
                  </div>
                ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
