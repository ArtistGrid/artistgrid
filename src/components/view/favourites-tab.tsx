import { motion } from "framer-motion";
import { DropdownMenuItem, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Play, SkipForward, ListPlus, Download, ExternalLink, Heart, Trash2, FolderDown, Share, Upload } from "lucide-react";
import type { RefObject } from "react";
import type { Era, TALeak, TrackSource } from "@/src/types";
import type { PlayableTrackData } from "@/src/components/view/track-item";
import {
  PlayButton,
  PauseButton,
  OpenLinkButton,
  TrackDescription,
  TrackItemActions,
} from "@/src/components/view/track-item";
export interface FavouritesTabProps {
  favourites: string[];
  favouriteTracks: PlayableTrackData[];
  isPreloading: boolean;
  computeTrackState: (t: TALeak) => {
    url: string | null;
    source: TrackSource;
    isPlayable: boolean;
    isCurrentlyPlaying: boolean;
    isCurrentTrack: boolean;
    isHighlighted: boolean;
    description: string | undefined;
    shouldShowSource: boolean;
  };
  handlePlayTrack: (t: TALeak, era: Era) => void;
  handleOpenUrl: (url: string) => void;
  handlePlayNext: (t: TALeak, era: Era) => void;
  handleAddToQueue: (t: TALeak, era: Era) => void;
  handleDownload: (t: TALeak) => void;
  handleToggleFavourite: (url: string) => void;
  handleOpenOriginal: (t: TALeak) => void;
  onDownloadAll: () => void;
  onExport: () => void;
  importFileRef: RefObject<HTMLInputElement | null>;
  onImportClick: () => void;
  onImportFile: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onClearAll: () => void;
  highlightedTrackRef: RefObject<HTMLDivElement | null>;
}
export function FavouritesTab({
  favourites,
  favouriteTracks,
  isPreloading,
  computeTrackState,
  handlePlayTrack,
  handleOpenUrl,
  handlePlayNext,
  handleAddToQueue,
  handleDownload,
  handleToggleFavourite,
  handleOpenOriginal,
  onDownloadAll,
  onExport,
  importFileRef,
  onImportClick,
  onImportFile,
  onClearAll,
  highlightedTrackRef,
}: FavouritesTabProps) {
  return (
    <motion.div
      key="favourites"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.2 }}
    >
      {favourites.length > 0 && (
        <div className="flex items-center justify-between mb-4">
          <span className="text-sm text-white/55">
            {favourites.length} favourite{favourites.length !== 1 ? "s" : ""}
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={onDownloadAll}
              disabled={isPreloading || favouriteTracks.length === 0}
              className="text-white/55 hover:text-white"
            >
              <FolderDown className="w-3.5 h-3.5 mr-1.5" />
              Download
            </Button>
            <Button variant="ghost" size="sm" onClick={onExport} className="text-white/55 hover:text-white">
              <Share className="w-3.5 h-3.5 mr-1.5" />
              Export
            </Button>
            <Button variant="ghost" size="sm" onClick={onImportClick} className="text-white/55 hover:text-white">
              <Upload className="w-3.5 h-3.5 mr-1.5" />
              Import
            </Button>
            <input
              ref={importFileRef}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={onImportFile}
              aria-label="Import favourites file"
            />
            <Button variant="ghost" size="sm" onClick={onClearAll} className="text-white/55 hover:text-red-400">
              <Trash2 className="w-3.5 h-3.5 mr-1.5" />
              Clear All
            </Button>
          </div>
        </div>
      )}
      {favouriteTracks.length > 0 ? (
        <div className="space-y-1.5 sm:space-y-2">
          {favouriteTracks.map((t) => {
            const {
              url,
              source,
              isPlayable,
              isCurrentlyPlaying,
              isCurrentTrack,
              isHighlighted,
              description,
              shouldShowSource,
            } = computeTrackState(t.track);
            return (
              <div
                key={`fav-${t.url}`}
                ref={isHighlighted ? highlightedTrackRef : null}
                className={`rounded-xl transition-colors ${isHighlighted ? "bg-yellow-400/15 border border-yellow-400/40 ring-2 ring-yellow-400/20" : isCurrentTrack ? "bg-white/[0.08] border border-white/[0.15]" : "glass-flat"}`}
              >
                <div className="flex items-center gap-2 sm:gap-3 p-2.5 sm:p-3">
                  {isPlayable ? (
                    isCurrentlyPlaying ? (
                      <PauseButton onPlay={() => handlePlayTrack(t.track, t.era)} />
                    ) : (
                      <PlayButton onPlay={() => handlePlayTrack(t.track, t.era)} />
                    )
                  ) : (
                    <OpenLinkButton onOpenLink={() => url && handleOpenUrl(url)} />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-white text-xs sm:text-sm truncate">
                      {t.track.name || "Unknown"}
                    </div>
                    <div className="flex flex-wrap items-center gap-1 sm:gap-2 mt-0.5">
                      {t.era.name && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded font-medium flex-shrink-0 glass-flat text-white/50">
                          {t.era.name}
                        </span>
                      )}
                      {t.track.extra && <span className="text-xs text-neutral-500 truncate">{t.track.extra}</span>}
                    </div>
                  </div>
                  <TrackItemActions
                    track={t.track}
                    source={source}
                    shouldShowSource={shouldShowSource}
                    url={url}
                    onOpenUrl={url ? () => handleOpenUrl(url) : () => {}}
                    isFavourited={true}
                    onToggleFavourite={url ? () => handleToggleFavourite(url) : undefined}
                  >
                    {isPlayable && (
                      <>
                        <DropdownMenuItem onClick={() => handlePlayTrack(t.track, t.era)} className="cursor-pointer">
                          <Play className="w-4 h-4 mr-2" />
                          Play
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handlePlayNext(t.track, t.era)} className="cursor-pointer">
                          <SkipForward className="w-4 h-4 mr-2" />
                          Play Next
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleAddToQueue(t.track, t.era)} className="cursor-pointer">
                          <ListPlus className="w-4 h-4 mr-2" />
                          Add to Queue
                        </DropdownMenuItem>
                        <DropdownMenuSeparator className="bg-neutral-800" />
                        <DropdownMenuItem onClick={() => handleDownload(t.track)} className="cursor-pointer">
                          <Download className="w-4 h-4 mr-2" />
                          Download
                        </DropdownMenuItem>
                      </>
                    )}
                    <DropdownMenuItem onClick={() => handleOpenOriginal(t.track)} className="cursor-pointer">
                      <ExternalLink className="w-4 h-4 mr-2" />
                      Open Original URL
                    </DropdownMenuItem>
                  </TrackItemActions>
                </div>
                <TrackDescription description={description} />
              </div>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-12 sm:py-20 flex flex-col items-center">
          <Heart className="w-12 h-12 sm:w-16 sm:h-16 text-neutral-700 mb-3 sm:mb-4" />
          <h3 className="text-base sm:text-lg font-medium text-neutral-300">No Favourites Yet</h3>
          <p className="text-sm sm:text-base text-neutral-500 mt-1">Tap the heart icon on any track to add it here</p>
        </div>
      )}
    </motion.div>
  );
}
