import { memo, useMemo } from "react";
import { FileSpreadsheet } from "lucide-react";
import type { Artist } from "@/src/types";
import { ASSET_BASE } from "@/src/lib/home-constants";
import { extractTrackerId, getSheetViewUrl } from "@/src/lib/artist-utils";
export const ArtistCard = memo(function ArtistCard({
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
    <div
      role="link"
      tabIndex={0}
      className="border-neutral-800 hover:border-white/30 bg-neutral-950 border hover:bg-neutral-900 hover:-translate-y-1 group rounded-xl overflow-hidden cursor-pointer transition-all duration-300 hover:shadow-[0_0_30px_rgba(255,255,255,0.12)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-black focus-visible:ring-white"
      onClick={() => onClick(artist)}
      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && onClick(artist)}
    >
      <div className="flex flex-col h-full">
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
        <div className="flex items-start justify-between p-3">
          <h3 className="font-semibold text-white text-sm leading-tight flex-1 mr-2">{artist.name}</h3>
          {trackerId && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onSheetClick(getSheetViewUrl(artist.url));
              }}
              className="flex-shrink-0 p-1 -m-1 rounded-md text-neutral-500 group-hover:text-white transition-colors"
              aria-label={`Open sheet for ${artist.name}`}
            >
              <FileSpreadsheet className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
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
