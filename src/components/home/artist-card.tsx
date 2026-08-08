import { memo, useMemo, useRef, useState, useEffect, useLayoutEffect } from "react";
import { useWindowVirtualizer } from "@tanstack/react-virtual";
import { FileSpreadsheet } from "lucide-react";
import type { Artist } from "@/src/types";
import { ASSET_BASE } from "@/src/lib/home-constants";
import { extractTrackerId, getSheetViewUrl } from "@/src/lib/artist-utils";
const ArtistCard = memo(function ArtistCard({
  artist,
  priority,
  lcp,
  enterDelay,
  onClick,
  onSheetClick,
}: {
  artist: Artist;
  priority: boolean;
  lcp?: boolean;
  enterDelay?: number;
  onClick: (artist: Artist) => void;
  onSheetClick: (url: string) => void;
}) {
  const trackerId = useMemo(() => extractTrackerId(artist.url), [artist.url]);
  return (
    <div className="relative glass rounded-2xl overflow-hidden hover:border-white/25 hover:-translate-y-1 group transition-all duration-300 hover:shadow-[0_8px_32px_rgba(255,255,255,0.08)]">
      <button
        type="button"
        className={`${lcp ? "" : "card-enter "}w-full text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-black focus-visible:ring-white/50`}
        style={!lcp && enterDelay ? { animationDelay: `${enterDelay}ms` } : undefined}
        onClick={() => onClick(artist)}
      >
        <div className="relative aspect-square w-full overflow-hidden">
          <picture>
            <source
              type="image/jxl"
              srcSet={`${ASSET_BASE}/jxl/${artist.imageFilename.replace(/\.webp$/, ".jxl")}`}
            />
            <source
              type="image/webp"
              srcSet={`${ASSET_BASE}/webp/${artist.imageFilename}`}
            />
            <img
              src={`${ASSET_BASE}/jpg/${artist.imageFilename.replace(/\.webp$/, ".jpg")}`}
              alt=""
              className="object-cover w-full h-full transition-transform duration-300 group-hover:scale-105"
              loading={priority ? "eager" : "lazy"}
              decoding="async"
              fetchPriority={lcp ? "high" : "auto"}
              draggable={false}
              referrerPolicy="no-referrer"
              crossOrigin="anonymous"
            />
          </picture>
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
          className="absolute bottom-3 right-3 z-10 p-1.5 rounded-lg text-white/30 group-hover:text-white/60 hover:!text-white hover:bg-white/10 transition-all"
          aria-label={`Open sheet for ${artist.name}`}
        >
          <FileSpreadsheet className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
});
const COLUMN_BREAKPOINTS = [
  { min: 1280, cols: 6 },
  { min: 1024, cols: 5 },
  { min: 768, cols: 4 },
  { min: 640, cols: 3 },
];
function getColumns(width: number) {
  for (const bp of COLUMN_BREAKPOINTS) if (width >= bp.min) return bp.cols;
  return 2;
}

export const ArtistGridDisplay = memo(
  ({
    artists,
    onArtistClick,
    onSheetClick,
  }: {
    artists: Artist[];
    onArtistClick: (artist: Artist) => void;
    onSheetClick: (url: string) => void;
  }) => {
    const parentRef = useRef<HTMLDivElement>(null);
    const [cols, setCols] = useState(() =>
      typeof window !== "undefined" ? getColumns(window.innerWidth) : 6
    );
    const [scrollMargin, setScrollMargin] = useState(0);

    useEffect(() => {
      const update = () => setCols(getColumns(window.innerWidth));
      update();
      window.addEventListener("resize", update);
      return () => window.removeEventListener("resize", update);
    }, []);

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

    const rowCount = Math.ceil(artists.length / cols);
    const virtualizer = useWindowVirtualizer({
      count: rowCount,
      estimateSize: () => 280,
      overscan: 6,
      scrollMargin,
    });

    return (
      <div
        ref={parentRef}
        className="relative w-full"
        style={{ height: virtualizer.getTotalSize() }}
      >
        {virtualizer.getVirtualItems().map((virtualRow) => {
          const start = virtualRow.index * cols;
          const rowArtists = artists.slice(start, start + cols);
          return (
            <div
              key={virtualRow.key}
              data-index={virtualRow.index}
              ref={virtualizer.measureElement}
              className="absolute left-0 w-full pb-4 sm:pb-6"
              style={{ transform: `translateY(${virtualRow.start - scrollMargin}px)` }}
            >
              <div
                className="grid gap-4 sm:gap-6"
                style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
              >
                {rowArtists.map((artist, i) => (
                  <ArtistCard
                    key={artist.imageFilename}
                    artist={artist}
                    priority={start + i < 6}
                    lcp={virtualRow.index === 0 && i === 0}
                    enterDelay={i * 55}
                    onClick={onArtistClick}
                    onSheetClick={onSheetClick}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    );
  }
);
