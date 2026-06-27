import { useState } from "react";
import { ChevronDown, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useKeyPress } from "@/src/hooks/use-key-press";
import { proxyImageUrl } from "@/src/lib/track-utils";
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
    <div className="space-y-4 sm:space-y-5">
      {Object.entries(eras).map(([key, era]) => (
        <div key={key} className="glass rounded-2xl overflow-hidden">
          <button
            type="button"
            className="w-full flex items-center gap-3 sm:gap-4 p-4 sm:p-5 text-left hover:bg-white/[0.03] transition-colors"
            onClick={() => toggleEra(key)}
          >
            {era.image ? (
              <img
                src={proxyImageUrl(era.image)}
                alt={era.name}
                className="w-12 h-12 sm:w-16 sm:h-16 rounded-xl object-cover bg-white/[0.08] flex-shrink-0"
                referrerPolicy="no-referrer"
                crossOrigin="anonymous"
              />
            ) : (
              <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-xl bg-white/[0.08] flex-shrink-0" />
            )}
            <div className="flex-1 min-w-0">
              <h3 className="text-base sm:text-lg font-bold text-white truncate">{era.name || key}</h3>
              {era.extra && <p className="text-xs sm:text-sm text-white/40 truncate">{era.extra}</p>}
            </div>
            <ChevronDown
              className={`w-4 h-4 text-white/30 transition-transform flex-shrink-0 ${expandedEras.has(key) ? "rotate-180" : ""}`}
            />
          </button>
          {expandedEras.has(key) && era.data && (
            <div className="px-4 pb-4 sm:px-5 sm:pb-5">
              {Object.entries(era.data).map(([cat, items]) => (
                <div key={cat} className="mb-4 sm:mb-6 last:mb-0">
                  {cat !== "Default" && (
                    <h4 className="text-xs sm:text-sm font-semibold text-white/50 pb-2 sm:pb-3 mb-2 sm:mb-3 border-b border-white/[0.08]">
                      {cat}
                    </h4>
                  )}
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 sm:gap-3">
                    {(items as TALeak[]).map((item, i) => {
                      const url = item.url || (item.urls && item.urls[0]);
                      const urlAsImage = url ? getImageUrl(url) : null;
                      const ownImageSrc = item.image || urlAsImage;
                       const displaySrc = proxyImageUrl(ownImageSrc || era.image || null);
                      const clickTarget = ownImageSrc || null;
                      const stableKey = item.name ? `${cat}-${item.name}` : `${cat}-${i}`;
                      const cardContent = (
                        <>
                          <div className="aspect-square relative bg-white/[0.05] overflow-hidden">
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
                              <div className="w-full h-full bg-white/[0.05]" />
                            )}
                          </div>
                          <div className="p-2 sm:p-3">
                            <p className="text-xs sm:text-sm font-medium text-white truncate">{item.name}</p>
                            {item.description && (
                              <p className="text-xs text-white/35 truncate mt-0.5 sm:mt-1 hidden sm:block">
                                {item.description}
                              </p>
                            )}
                          </div>
                        </>
                      );
                      return clickTarget ? (
                        <button
                          key={stableKey}
                          type="button"
                          className="group glass-flat rounded-xl overflow-hidden transition-all cursor-pointer text-left w-full"
                          onClick={() => onImageClick(clickTarget, item.name)}
                        >
                          {cardContent}
                        </button>
                      ) : (
                        <div
                          key={stableKey}
                          className="group glass-flat rounded-xl overflow-hidden transition-all cursor-default"
                        >
                          {cardContent}
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-xl p-4">
      <button
        type="button"
        className="absolute inset-0"
        onClick={onClose}
        aria-label="Close lightbox"
        tabIndex={-1}
      />
      <div className="relative z-10 max-w-4xl max-h-[90vh] w-full h-full flex items-center justify-center">
        <button
          type="button"
          className="max-w-full max-h-full p-0 bg-transparent border-0"
          onClick={() => window.open(originalUrl, "_blank", "noopener,noreferrer")}
          title="Click to open original"
        >
          <img
            src={src}
            alt={alt}
            className="max-w-full max-h-full object-contain rounded-2xl cursor-pointer hover:opacity-90 transition-opacity shadow-2xl"
            referrerPolicy="no-referrer"
            crossOrigin="anonymous"
          />
        </button>
        <Button
          variant="ghost"
          size="icon"
          onClick={onClose}
          className="absolute top-3 right-3 text-white glass rounded-xl w-9 h-9"
        >
          <X className="w-4 h-4" />
        </Button>
        <p className="absolute bottom-3 left-1/2 -translate-x-1/2 text-xs text-white/50 glass rounded-full px-3 py-1.5">
          Click to open original
        </p>
      </div>
    </div>
  );
}
