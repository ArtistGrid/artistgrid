import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { Share, SkipForward, ListPlus, Download, Heart, ExternalLink } from "lucide-react";
import type { Era, TALeak, TrackSource } from "@/src/types";
import { PlayButton, PauseButton, OpenLinkButton, TrackDescription, TrackItemActions } from "@/src/components/view/track-item";

export interface TrackRowProps {
  track: TALeak;
  era: Era;
  computeTrackState: (t: TALeak) => { url: string | null; source: TrackSource; isPlayable: boolean; isCurrentlyPlaying: boolean; isCurrentTrack: boolean; isHighlighted: boolean; description: string | undefined; shouldShowSource: boolean; playableUrl: string | null };
  handlePlayTrack: (t: TALeak, era: Era) => void;
  handleOpenUrl: (url: string) => void;
  handleShareTrack: (url: string, name: string) => void;
  handlePlayNext: (t: TALeak, era: Era) => void;
  handleAddToQueue: (t: TALeak, era: Era) => void;
  handleDownload: (t: TALeak) => void;
  handleToggleFavourite: (url: string) => void;
  handleOpenOriginal: (t: TALeak) => void;
  favourites: string[];
  highlightedTrackRef: React.RefObject<HTMLDivElement | null>;
}

export function TrackRow({
  track,
  era,
  computeTrackState,
  handlePlayTrack,
  handleOpenUrl,
  handleShareTrack,
  handlePlayNext,
  handleAddToQueue,
  handleDownload,
  handleToggleFavourite,
  handleOpenOriginal,
  favourites,
  highlightedTrackRef,
}: TrackRowProps) {
  const {
    url,
    source,
    isPlayable,
    isCurrentlyPlaying,
    isCurrentTrack,
    isHighlighted,
    description,
    shouldShowSource,
  } = computeTrackState(track);
  return (
    <div
      ref={isHighlighted ? highlightedTrackRef : null}
      className={`rounded-xl transition-all ${
        isHighlighted
          ? "bg-yellow-400/15 border border-yellow-400/40 ring-2 ring-yellow-400/20"
          : isCurrentTrack
            ? "bg-white/[0.08] border border-white/[0.15]"
            : "glass-flat"
      }`}
    >
      <div className="flex items-center gap-2 sm:gap-3 p-2.5 sm:p-3">
        {isPlayable ? (
          isCurrentlyPlaying ? (
            <PauseButton onPlay={() => handlePlayTrack(track, era)} />
          ) : (
            <PlayButton onPlay={() => handlePlayTrack(track, era)} />
          )
        ) : (
          <OpenLinkButton onOpenLink={() => url && handleOpenUrl(url)} />
        )}
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-white text-xs sm:text-sm truncate">{track.name || "Unknown"}</div>
          <div className="flex flex-wrap items-center gap-1 sm:gap-2 mt-0.5 sm:mt-1">
            {track.extra && (
              <span className="text-xs text-neutral-500 truncate max-w-[120px] sm:max-w-none">{track.extra}</span>
            )}
            <div className="flex items-center gap-1 sm:hidden">
              {track.type && track.type !== "Unknown" && track.type !== "N/A" && (
                <span className="text-[10px] px-1.5 py-0.5 bg-white/5 rounded text-neutral-400">{track.type}</span>
              )}
              {track.track_length && track.track_length !== "N/A" && track.track_length !== "?:??" && (
                <span className="text-[10px] px-1.5 py-0.5 bg-white/5 rounded text-neutral-400">{track.track_length}</span>
              )}
              {track.art_used && (
                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] sm:text-[10px] font-medium bg-emerald-500/15 text-emerald-400">
                  ✓ Used
                </span>
              )}
            </div>
          </div>
        </div>
        <TrackItemActions
          track={track}
          source={source}
          shouldShowSource={shouldShowSource}
          url={url}
          onOpenUrl={url ? () => handleOpenUrl(url) : () => {}}
          isFavourited={url ? favourites.includes(url) : false}
          onToggleFavourite={url ? () => handleToggleFavourite(url) : undefined}
        >
          {url && (
            <DropdownMenuItem onClick={() => handleShareTrack(url, track.name || "Track")} className="cursor-pointer">
              <Share className="w-4 h-4 mr-2" />
              Share Track
            </DropdownMenuItem>
          )}
          {isPlayable && (
            <>
              <DropdownMenuItem onClick={() => handlePlayNext(track, era)} className="cursor-pointer">
                <SkipForward className="w-4 h-4 mr-2" />
                Play Next
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleAddToQueue(track, era)} className="cursor-pointer">
                <ListPlus className="w-4 h-4 mr-2" />
                Add to Queue
              </DropdownMenuItem>
              <DropdownMenuSeparator className="bg-neutral-800" />
              <DropdownMenuItem onClick={() => handleDownload(track)} className="cursor-pointer">
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
          <DropdownMenuItem onClick={() => handleOpenOriginal(track)} className="cursor-pointer">
            <ExternalLink className="w-4 h-4 mr-2" />
            Open Original URL
          </DropdownMenuItem>
        </TrackItemActions>
      </div>
      <TrackDescription description={description} />
    </div>
  );
}
