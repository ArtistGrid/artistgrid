import { useEffect } from "react";

export type PageMeta = {
  title?: string;
  description?: string;
  image?: string;
  url?: string;
  noIndex?: boolean;
};

export function usePageMeta({ title, description, image, url, noIndex }: PageMeta = {}) {
  useEffect(() => {
    const previousTitle = document.title;
    if (title) document.title = title;
    const fields: ["name" | "property", string, string | undefined][] = [
      ["name", "description", description],
      ["property", "og:title", title],
      ["property", "og:description", description],
      ["property", "og:image", image],
      ["property", "og:url", url],
      ["name", "twitter:title", title],
      ["name", "twitter:description", description],
      ["name", "twitter:image", image],
      ["name", "robots", noIndex === undefined ? undefined : `${noIndex ? "noindex" : "index"}, follow`],
    ];
    const changed: { element: Element; created: boolean; content: string | null }[] = [];
    for (const [attribute, name, value] of fields) {
      if (value === undefined) continue;
      let element = document.querySelector(`meta[${attribute}="${name}"]`);
      const created = !element;
      if (!element) {
        element = document.createElement("meta");
        element.setAttribute(attribute, name);
        document.head.appendChild(element);
      }
      changed.push({ element, created, content: element.getAttribute("content") });
      element.setAttribute("content", value);
    }
    let canonical = document.querySelector('link[rel="canonical"]');
    const previousCanonical = canonical?.getAttribute("href") ?? null;
    const createdCanonical = !!url && !canonical;
    if (url) {
      if (!canonical) {
        canonical = document.createElement("link");
        canonical.setAttribute("rel", "canonical");
        document.head.appendChild(canonical);
      }
      canonical.setAttribute("href", url);
    }
    return () => {
      document.title = previousTitle;
      for (const { element, created, content } of changed) {
        if (created) element.remove();
        else if (content === null) element.removeAttribute("content");
        else element.setAttribute("content", content);
      }
      if (url && canonical) {
        if (createdCanonical) canonical.remove();
        else if (previousCanonical === null) canonical.removeAttribute("href");
        else canonical.setAttribute("href", previousCanonical);
      }
    };
  }, [title, description, image, url, noIndex]);
}
