import { useEffect } from "react";

export type PageMeta = {
  title?: string;
  description?: string;
  image?: string;
  url?: string;
};

export function usePageMeta({ title, description, image, url }: PageMeta = {}) {
  useEffect(() => {
    const prevTitle = document.title;
    const prevDesc = document.querySelector('meta[name="description"]')?.getAttribute("content") ?? null;
    const prevOgImage = document.querySelector('meta[property="og:image"]')?.getAttribute("content") ?? null;
    const prevOgUrl = document.querySelector('meta[property="og:url"]')?.getAttribute("content") ?? null;

    if (title) document.title = title;
    if (description) {
      let meta = document.querySelector('meta[name="description"]');
      if (!meta) {
        meta = document.createElement("meta");
        meta.setAttribute("name", "description");
        document.head.appendChild(meta);
      }
      meta.setAttribute("content", description);
    }
    if (image || url) {
      const ogImage = image || url;
      if (ogImage) {
        let property = document.querySelector('meta[property="og:image"]');
        if (!property) {
          property = document.createElement("meta");
          property.setAttribute("property", "og:image");
          document.head.appendChild(property);
        }
        property.setAttribute("content", ogImage);
      }
      if (url) {
        let ogUrl = document.querySelector('meta[property="og:url"]');
        if (!ogUrl) {
          ogUrl = document.createElement("meta");
          ogUrl.setAttribute("property", "og:url");
          document.head.appendChild(ogUrl);
        }
        ogUrl.setAttribute("content", url);
      }
    }

    return () => {
      document.title = prevTitle;
      const descEl = document.querySelector('meta[name="description"]');
      if (descEl) {
        if (prevDesc) descEl.setAttribute("content", prevDesc);
        else descEl.remove();
      }
      const ogImageEl = document.querySelector('meta[property="og:image"]');
      if (ogImageEl) {
        if (prevOgImage) ogImageEl.setAttribute("content", prevOgImage);
        else ogImageEl.remove();
      }
      const ogUrlEl = document.querySelector('meta[property="og:url"]');
      if (ogUrlEl) {
        if (prevOgUrl) ogUrlEl.setAttribute("content", prevOgUrl);
        else ogUrlEl.remove();
      }
    };
  }, [title, description, image, url]);
}
