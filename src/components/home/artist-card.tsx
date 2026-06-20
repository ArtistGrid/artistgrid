import { memo, useMemo } from "react";
import { FileSpreadsheet } from "lucide-react";
import type { Artist } from "@/src/types";
import { ASSET_BASE } from "@/src/lib/home-constants";
import { extractTrackerId, getSheetViewUrl } from "@/src/lib/artist-utils";
const ArtistCard = memo(function ArtistCard({
  artist,
  priority,
  onClick,
  onSheetClick,
}: {
  artist: Artist;
  priority: boolean;
  onClick: (artist: Artist) => void;
  onSheetClick: (url: string) => void;
}) {
  const trackerId = useMemo(() => extractTrackerId(artist.url), [artist.url]);
  return (
    <div className="relative border-neutral-800 hover:border-white/30 bg-neutral-950 border hover:bg-neutral-900 hover:-translate-y-1 group rounded-xl overflow-hidden transition-all duration-300 hover:shadow-[0_0_30px_rgba(255,255,255,0.12)]">
      <button
        type="button"
        className="w-full text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-black focus-visible:ring-white"
        onClick={() => onClick(artist)}
      >
        <div className="relative aspect-square w-full bg-neutral-900 overflow-hidden">
          <img
            src={`${ASSET_BASE}/${artist.imageFilename}`}
            alt={artist.name}
            className="object-cover w-full h-full transition-transform duration-300 group-hover:scale-105"
            loading={priority ? "eager" : "lazy"}
            draggable={false}
            referrerPolicy="no-referrer"
            crossOrigin="anonymous"
          />
        </div>
        <div className={`p-3 ${trackerId ? "pr-8" : ""}`}>
          <h3 className="font-semibold text-white text-sm leading-tight">{artist.name}</h3>
        </div>
      </button>
      {trackerId && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onSheetClick(getSheetViewUrl(artist.url));
          }}
          className="absolute bottom-3 right-3 z-10 p-1 rounded-md text-neutral-500 group-hover:text-white transition-colors"
          aria-label={`Open sheet for ${artist.name}`}
        >
          <FileSpreadsheet className="w-4 h-4" />
        </button>
      )}
    </div>
  );
});
export const ArtistGridDisplay = memo(
  ({
    artists,
    onArtistClick,
    onSheetClick,
  }: {
    artists: Artist[];
    onArtistClick: (artist: Artist) => void;
    onSheetClick: (url: string) => void;
  }) => (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 sm:gap-6">
      {artists.map((artist, i) => (
        <div
          key={artist.imageFilename}
          className="animate-in fade-in-0 slide-in-from-bottom-4 duration-500"
          style={{ animationDelay: `${Math.min(i, 50) * 20}ms` }}
        >
          <ArtistCard
            artist={artist}
            priority={i < 18}
            onClick={onArtistClick}
            onSheetClick={onSheetClick}
          />
        </div>
      ))}
    </div>
  )
);
