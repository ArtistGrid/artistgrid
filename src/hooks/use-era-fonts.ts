import { useEffect, useMemo, useRef } from "react";
import { buildFontCssUrl } from "@/src/lib/fonts";

const loadedFonts = new Set<string>();

function sanitizeFontName(raw: string): string {
  let name = raw.trim();
  // Strip "docs-" prefix used by some tracker responses
  if (name.toLowerCase().startsWith("docs-")) name = name.slice(5);
  // Take only the primary font (before comma)
  const commaIdx = name.indexOf(",");
  if (commaIdx !== -1) name = name.slice(0, commaIdx);
  return name.trim();
}

export { sanitizeFontName };

function loadFont(fontName: string): HTMLLinkElement | null {
  const clean = sanitizeFontName(fontName);
  if (!clean || loadedFonts.has(clean)) return null;
  if (["ibm plex sans", "ibm plex mono"].includes(clean.toLowerCase())) return null;

  loadedFonts.add(clean);
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = buildFontCssUrl(clean);
  document.head.appendChild(link);
  return link;
}

function removeLink(link: HTMLLinkElement) {
  link.remove();
  const match = link.href.match(/family=([^&:]+)/);
  if (match) {
    const decoded = decodeURIComponent(match[1]);
    const clean = sanitizeFontName(decoded);
    loadedFonts.delete(clean);
  }
}

export function useEraFonts(eraFonts: (string | undefined)[]) {
  const linksRef = useRef<HTMLLinkElement[]>([]);
  const fontsKey = useMemo(
    () =>
      eraFonts
        .filter(Boolean)
        .map((f) => sanitizeFontName(f!))
        .sort()
        .join(","),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [eraFonts.length, eraFonts.filter(Boolean).sort().join(",")]
  );

  useEffect(() => {
    for (const link of linksRef.current) removeLink(link);
    linksRef.current = [];

    const unique = fontsKey ? fontsKey.split(",").filter(Boolean) : [];
    const newLinks: HTMLLinkElement[] = [];
    for (const font of unique) {
      const link = loadFont(font);
      if (link) newLinks.push(link);
    }
    linksRef.current = newLinks;

    return () => {
      for (const link of linksRef.current) removeLink(link);
      linksRef.current = [];
    };
  }, [fontsKey]);
}

export function getEraFontStyle(font?: string): React.CSSProperties | undefined {
  if (!font) return undefined;
  const clean = sanitizeFontName(font);
  return { fontFamily: `"${clean}", sans-serif` };
}
