import type { Track, Era, TALeak } from "@/src/types";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Play, Pause, ExternalLink, Link as LinkIcon, AlertTriangle, MoreHorizontal } from "lucide-react";
import { Link } from "react-router-dom";
import { isUrl, getSourceDisplayName } from "@/src/lib/track-utils";

export { getSourceDisplayName, isUrl };

export interface FilterOptions {
  showPlayableOnly: boolean;
  qualityFilter: string[];
  sourceFilter: Track["source"][];
}

export interface PlayableTrackData {
  track: TALeak;
  era: Era;
  url: string;
  playableUrl: string;
}

export function TrackMetaBadges({ source, type, quality, trackLength, shouldShowSource }: {
  source: Track["source"]; type?: string; quality?: string; trackLength?: string; shouldShowSource: boolean;
}) {
  return (
    <div className="hidden sm:flex items-center gap-1.5 flex-shrink-0">
      {shouldShowSource && <span className="text-xs px-2 py-0.5 glass-flat rounded-lg text-white/40">{getSourceDisplayName(source)}</span>}
      {type && type !== "Unknown" && type !== "N/A" && <span className="text-xs px-2 py-0.5 glass-flat rounded-lg text-white/40">{type}</span>}
      {quality && !isUrl(quality) && quality !== "N/A" && <span className="text-xs px-2 py-0.5 glass-flat rounded-lg text-white/40">{quality}</span>}
      {trackLength && trackLength !== "N/A" && trackLength !== "?:??" && <span className="text-xs px-2 py-0.5 glass-flat rounded-lg text-white/40">{trackLength}</span>}
    </div>
  );
}

export function PlayButton({ onPlay }: { onPlay: () => void }) {
  return (
    <button type="button" onClick={onPlay} className="w-8 h-8 sm:w-9 sm:h-9 flex-shrink-0 flex items-center justify-center rounded-full bg-white text-black hover:bg-white/90 hover:scale-105 transition-all">
      <Play className="w-3 sm:w-3.5 h-3 sm:h-3.5 ml-0.5" />
    </button>
  );
}

export function PauseButton({ onPlay }: { onPlay: () => void }) {
  return (
    <button type="button" onClick={onPlay} className="w-8 h-8 sm:w-9 sm:h-9 flex-shrink-0 flex items-center justify-center rounded-full bg-white text-black hover:bg-white/90 hover:scale-105 transition-all">
      <Pause className="w-3 sm:w-3.5 h-3 sm:h-3.5" />
    </button>
  );
}

export function OpenLinkButton({ onOpenLink }: { onOpenLink: () => void }) {
  return (
    <button type="button" onClick={onOpenLink} className="w-8 h-8 sm:w-9 sm:h-9 flex-shrink-0 flex items-center justify-center rounded-full glass text-white/60 hover:text-white hover:scale-105 transition-all">
      <LinkIcon className="w-3 sm:w-3.5 h-3 sm:h-3.5" />
    </button>
  );
}

export function TrackDescription({ description }: { description: string | undefined }) {
  if (!description) return null;
  return (
    <div className="px-2.5 pb-2.5 sm:px-3 sm:pb-3">
      <p className="text-[10px] sm:text-xs text-neutral-500 pl-11 sm:pl-[52px]">{description}</p>
    </div>
  );
}

export function TrackItemActions({ track, source, shouldShowSource, url, onOpenUrl, children }: {
  track: TALeak; source: Track["source"]; shouldShowSource: boolean; url: string | null | undefined;
  onOpenUrl: () => void; children: React.ReactNode;
}) {
  return (
    <>
      <TrackMetaBadges source={source} type={track.type} quality={track.quality} trackLength={track.track_length} shouldShowSource={shouldShowSource} />
      {url && (
        <Button variant="ghost" size="icon" onClick={onOpenUrl} className="text-neutral-500 hover:text-white hover:bg-white/10 w-7 h-7 sm:w-8 sm:h-8 rounded-lg flex-shrink-0">
          <ExternalLink className="w-4 h-4" />
        </Button>
      )}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="text-neutral-500 hover:text-white hover:bg-white/10 w-7 h-7 sm:w-8 sm:h-8 rounded-lg flex-shrink-0">
            <MoreHorizontal className="w-4 h-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48 glass-elevated border-0 rounded-2xl text-white/80 p-1">
          {children}
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
}

export function FallbackView({ sheetsUrl }: { sheetsUrl: string }) {
  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-4">
      <div className="max-w-lg w-full glass-elevated rounded-2xl p-6 sm:p-8 text-center">
        <AlertTriangle className="w-12 h-12 sm:w-14 sm:h-14 text-yellow-400/80 mx-auto mb-4 sm:mb-6" />
        <h1 className="text-xl sm:text-2xl font-bold text-white mb-3 sm:mb-4">Unable to Load Tracker</h1>
        <p className="text-sm sm:text-base text-white/50 mb-5 sm:mb-6">
          We couldn't load the tracker data from our API. You can view the original spreadsheet directly on Google Sheets.
        </p>
        <Button asChild className="bg-white text-black hover:bg-white/90 mb-4 sm:mb-6 w-full rounded-xl h-11">
          <a href={sheetsUrl} target="_blank" rel="noopener noreferrer">
            <ExternalLink className="w-4 h-4 mr-2" />
            Open Original Spreadsheet
          </a>
        </Button>
        <div className="glass-flat rounded-xl p-3 sm:p-4 text-left">
          <p className="text-xs text-white/35 leading-relaxed">
            <strong className="text-white/50">Disclaimer:</strong> ArtistGrid is not affiliated with, endorsed by, or
            associated with Google, TrackerHub, or any artists whose content may appear in these trackers. We do not host,
            store, or distribute any copyrighted content.
          </p>
        </div>
        <div className="mt-5 sm:mt-6">
          <Link to="/" className="text-sm text-white/35 hover:text-white transition-colors">
            ← Back to Home
          </Link>
        </div>
      </div>
    </div>
  );
}
