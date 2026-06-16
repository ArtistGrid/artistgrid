import { useState } from "react";
import { ChevronDown, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useKeyPress } from "@/src/hooks/use-key-press";
import type { Era, TALeak } from "@/src/types";

function getImageUrl(url: string): string | null {
  if (url.includes("ibb.co")) {
    const match = url.match(/ibb\.co\/([a-zA-Z0-9]+)/);
    if (match) return `https://i.ibb.co/${match[1]}/image.jpg`;
  }
  if (url.includes("imgur.com") || url.includes("i.imgur.com")) {
    const match = url.match(/imgur\.com\/([a-zA-Z0-9]+)/);
    if (match) return `https://i.imgur.com/${match[1]}.jpg`;
  }
  if (url.match(/\.(jpg|jpeg|png|gif|webp)$/i)) return url;
  if (url.includes("docs.google.com/sheets-images-rt") || url.includes("googleusercontent.com")) return url;
  return null;
}

export function ArtGallery({
  eras,
  onImageClick,
}: {
  eras: Record<string, Era>;
  onImageClick: (url: string, name: string) => void;
}) {
  const [expandedEras, setExpandedEras] = useState<Set<string>>(new Set([Object.keys(eras)[0] || ""]));
  const toggleEra = (eraKey: string) => {
    setExpandedEras((prev) => {
      const next = new Set(prev);
      if (next.has(eraKey)) next.delete(eraKey);
      else next.add(eraKey);
      return next;
    });
  };
  return (
    <div className="space-y-4 sm:space-y-6">
      {Object.entries(eras).map(([key, era]) => (
        <div key={key} className="bg-neutral-950 border border-neutral-800 rounded-xl overflow-hidden">
          <button
            type="button"
            className="w-full flex items-center gap-3 sm:gap-4 p-4 sm:p-5 text-left hover:bg-white/[0.02] transition-colors"
            onClick={() => toggleEra(key)}
          >
            {era.image ? (
              <img
                src={era.image}
                alt={era.name}
                className="w-12 h-12 sm:w-16 sm:h-16 rounded-xl object-cover bg-neutral-800 flex-shrink-0"
                referrerPolicy="no-referrer"
                crossOrigin="anonymous"
              />
            ) : (
              <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-xl bg-neutral-800 flex-shrink-0" />
            )}
            <div className="flex-1 min-w-0">
              <h3 className="text-base sm:text-lg font-bold text-white truncate">{era.name || key}</h3>
              {era.extra && <p className="text-xs sm:text-sm text-neutral-500 truncate">{era.extra}</p>}
            </div>
            <ChevronDown
              className={`w-5 h-5 text-neutral-500 transition-transform flex-shrink-0 ${expandedEras.has(key) ? "rotate-180" : ""}`}
            />
          </button>
          {expandedEras.has(key) && era.data && (
            <div className="px-4 pb-4 sm:px-5 sm:pb-5">
              {Object.entries(era.data).map(([cat, items]) => (
                <div key={cat} className="mb-4 sm:mb-6 last:mb-0">
                  {cat !== "Default" && (
                    <h4 className="text-xs sm:text-sm font-semibold text-neutral-300 pb-2 sm:pb-3 mb-2 sm:mb-3 border-b border-neutral-800">
                      {cat}
                    </h4>
                  )}
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 sm:gap-4">
                    {(items as TALeak[]).map((item, i) => {
                      const url = item.url || (item.urls && item.urls[0]);
                      // A URL counts as an image if it resolves to a direct image (not a music link)
                      const urlAsImage = url ? getImageUrl(url) : null;
                      // The item's own image: explicit image field, or a URL that IS an image
                      const ownImageSrc = item.image || urlAsImage;
                      // Fall back to the era cover art so the grid always has something to show
                      const displaySrc = ownImageSrc || era.image || null;
                      // Only open the lightbox when we have an image that belongs to this item
                      const clickTarget = ownImageSrc || null;
                      return (
                        <div
                          key={i}
                          className={`group rounded-lg sm:rounded-xl overflow-hidden bg-neutral-900 border border-neutral-800 transition-all ${
                            clickTarget ? "cursor-pointer hover:border-neutral-600" : "cursor-default"
                          }`}
                          onClick={() => clickTarget && onImageClick(clickTarget, item.name)}
                        >
                          <div className="aspect-square relative bg-neutral-800 overflow-hidden">
                            {displaySrc ? (
                              <img
                                src={displaySrc}
                                alt={item.name}
                                className={`w-full h-full object-cover transition-transform duration-300 ${
                                  clickTarget ? "group-hover:scale-105" : "opacity-40"
                                }`}
                                referrerPolicy="no-referrer"
                                crossOrigin="anonymous"
                              />
                            ) : (
                              <div className="w-full h-full bg-neutral-800" />
                            )}
                          </div>
                          <div className="p-2 sm:p-3">
                            <p className="text-xs sm:text-sm font-medium text-white truncate">{item.name}</p>
                            {item.description && (
                              <p className="text-xs text-neutral-500 truncate mt-0.5 sm:mt-1 hidden sm:block">
                                {item.description}
                              </p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

export function ImageLightbox({
  src,
  alt,
  originalUrl,
  onClose,
}: {
  src: string;
  alt: string;
  originalUrl: string;
  onClose: () => void;
}) {
  useKeyPress("Escape", onClose);
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md p-4"
      onClick={onClose}
    >
      <div
        className="relative max-w-4xl max-h-[90vh] w-full h-full flex items-center justify-center"
        onClick={(e) => e.stopPropagation()}
      >
        <img
          src={src}
          alt={alt}
          className="max-w-full max-h-full object-contain rounded-xl cursor-pointer hover:opacity-90 transition-opacity shadow-2xl"
          onClick={() => window.open(originalUrl, "_blank", "noopener,noreferrer")}
          title="Click to open original"
          referrerPolicy="no-referrer"
          crossOrigin="anonymous"
        />
        <Button
          variant="ghost"
          size="icon"
          onClick={onClose}
          className="absolute top-3 right-3 text-white bg-black/40 hover:bg-black/60 rounded-xl w-9 h-9 backdrop-blur-sm"
        >
          <X className="w-5 h-5" />
        </Button>
        <p className="absolute bottom-3 left-1/2 -translate-x-1/2 text-xs text-neutral-400 bg-black/40 backdrop-blur-sm px-3 py-1.5 rounded-full">
          Click to open original
        </p>
      </div>
    </div>
  );
}
