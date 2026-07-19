import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useKeyPress } from "@/src/hooks/use-key-press";
import type { Era, TALeak } from "@/src/types";
import { useImageProxy } from "@/src/hooks/use-image-proxy";

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
  onImageClick: (imageUrl: string, name: string, description?: string, linkUrl?: string) => void;
}) {
  const [expandedEras, setExpandedEras] = useState<Set<string>>(() => new Set([Object.keys(eras)[0] || ""]));
  const { proxyImageSrcSet } = useImageProxy();
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
              (() => {
                const srcs = proxyImageSrcSet(era.image);
                return (
                  <picture>
                    <source type="image/jxl" srcSet={srcs.jxl} />
                    <source type="image/webp" srcSet={srcs.webp} />
                    <img
                      src={srcs.original}
                      alt={era.name}
                      className="w-12 h-12 sm:w-16 sm:h-16 rounded-xl object-cover bg-white/[0.08] flex-shrink-0"
                      referrerPolicy="no-referrer"
                      crossOrigin="anonymous"
                    />
                  </picture>
                );
              })()
            ) : (
              <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-xl bg-white/[0.08] flex-shrink-0" />
            )}
            <div className="flex-1 min-w-0">
              <h3 className="text-base sm:text-lg font-bold text-white truncate">{era.name || key}</h3>
              <p className="text-xs sm:text-sm text-white/40">
                {era.extra && <>{era.extra} · </>}
                {era.data ? Object.values(era.data).reduce((n, arr) => n + arr.length, 0) : 0} songs
              </p>
            </div>
            <ChevronDown
              className={`w-4 h-4 text-white/30 transition-transform flex-shrink-0 ${expandedEras.has(key) ? "rotate-180" : ""}`}
            />
          </button>
          <AnimatePresence initial={false}>
            {expandedEras.has(key) && era.data && (
              <motion.div
                key={`art-era-${key}`}
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
              >
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
                       const displaySrc = ownImageSrc || era.image || null;
                      const clickTarget = ownImageSrc || null;
                       const stableKey = item.url ? `${cat}-${item.url}` : item.name ? `${cat}-${item.name}` : `${cat}-${i}`;
                      const proxied = displaySrc ? proxyImageSrcSet(displaySrc) : null;
                      const cardContent = (
                        <>
                          <div className="aspect-square relative bg-white/[0.05] overflow-hidden">
                            {proxied ? (
                              <picture>
                                <source type="image/jxl" srcSet={proxied.jxl} />
                                <source type="image/webp" srcSet={proxied.webp} />
                                <img
                                  src={proxied.original}
                                  alt={item.name}
                                  className={`w-full h-full object-cover transition-transform duration-300 ${
                                    clickTarget ? "group-hover:scale-105" : "opacity-40"
                                  }`}
                                  referrerPolicy="no-referrer"
                                  crossOrigin="anonymous"
                                />
                              </picture>
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
                          onClick={() => onImageClick(ownImageSrc || era.image || "", item.name, item.description, url)}
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
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      ))}
    </div>
  );
}

export function ImageLightbox({
  src,
  alt,
  originalUrl,
  description,
  onClose,
}: {
  src: string;
  alt: string;
  originalUrl: string;
  description?: string;
  onClose: () => void;
}) {
  useKeyPress("Escape", onClose);
  const { proxyImageSrcSet } = useImageProxy();
  const srcs = proxyImageSrcSet(src);
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-xl p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Image preview"
      tabIndex={-1}
      onKeyDown={(e) => {
        if (e.key === "Escape") onClose();
      }}
    >
      <div className="relative z-10 max-w-4xl max-h-[90vh] w-full h-full flex flex-col items-center justify-center" onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          className="max-w-full max-h-full p-0 bg-transparent border-0"
          onClick={() => window.open(originalUrl, "_blank", "noopener,noreferrer")}
          title="Click to open original"
        >
          <picture>
            <source type="image/jxl" srcSet={srcs.jxl} />
            <source type="image/webp" srcSet={srcs.webp} />
            <img
              src={srcs.original}
              alt={alt}
              className="max-w-full max-h-[80vh] object-contain rounded-2xl cursor-pointer hover:opacity-90 transition-opacity shadow-2xl"
              referrerPolicy="no-referrer"
              crossOrigin="anonymous"
            />
          </picture>
        </button>
        {description && (
          <p className="mt-3 text-sm text-white/60 text-center max-w-lg">{description}</p>
        )}
        <Button
          variant="ghost"
          size="icon"
          onClick={onClose}
          className="absolute top-3 right-3 text-white glass rounded-xl w-9 h-9"
          aria-label="Close lightbox"
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