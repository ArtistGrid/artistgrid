import { useEffect } from "react";

export type PageMeta = {
  title?: string;
  description?: string;
  image?: string;
  url?: string;
};

export function usePageMeta({ title, description, image, url }: PageMeta = {}) {
  useEffect(() => {
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
      if (!ogImage) return;
      let property = document.querySelector('meta[property="og:image"]');
      if (!property) {
        property = document.createElement("meta");
        property.setAttribute("property", "og:image");
        document.head.appendChild(property);
      }
      property.setAttribute("content", ogImage);
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
  }, [title, description, image, url]);
}
