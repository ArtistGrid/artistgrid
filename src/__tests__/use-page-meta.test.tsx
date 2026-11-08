import { describe, it, expect, afterEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { usePageMeta } from "../hooks/use-page-meta";
describe("usePageMeta", () => {
  afterEach(() => {
    document.title = "ArtistGrid";
    document
      .querySelectorAll(
        'meta[name="description"], meta[name="robots"], meta[name^="twitter:"], meta[property^="og:"], link[rel="canonical"]'
      )
      .forEach((el) => el.remove());
  });
  it("sets the document title", () => {
    renderHook(() => usePageMeta({ title: "Test Title" }));
    expect(document.title).toBe("Test Title");
  });
  it("creates and restores the description meta", () => {
    renderHook(() => usePageMeta({ description: "A description" }));
    expect(document.querySelector('meta[name="description"]')?.getAttribute("content")).toBe("A description");
  });
  it("sets og:image and og:url", () => {
    renderHook(() => usePageMeta({ image: "https://x/i.png", url: "https://x" }));
    expect(document.querySelector('meta[property="og:image"]')?.getAttribute("content")).toBe("https://x/i.png");
    expect(document.querySelector('meta[property="og:url"]')?.getAttribute("content")).toBe("https://x");
  });
  it("restores previous title on unmount", () => {
    document.title = "Original";
    const { unmount } = renderHook(() => usePageMeta({ title: "Temp" }));
    unmount();
    expect(document.title).toBe("Original");
  });
  it("does nothing when called with no args", () => {
    const prevTitle = document.title;
    const { unmount } = renderHook(() => usePageMeta());
    expect(document.title).toBe(prevTitle);
    expect(document.querySelector('meta[name="description"]')).toBeNull();
    expect(document.querySelector('meta[property="og:image"]')).toBeNull();
    unmount();
  });
  it("removes newly created description meta on unmount", () => {
    expect(document.querySelector('meta[name="description"]')).toBeNull();
    const { unmount } = renderHook(() => usePageMeta({ description: "New desc" }));
    expect(document.querySelector('meta[name="description"]')).not.toBeNull();
    unmount();
    expect(document.querySelector('meta[name="description"]')).toBeNull();
  });
  it("removes newly created og:image on unmount", () => {
    const { unmount } = renderHook(() => usePageMeta({ image: "https://x/new.png" }));
    expect(document.querySelector('meta[property="og:image"]')?.getAttribute("content")).toBe("https://x/new.png");
    unmount();
    expect(document.querySelector('meta[property="og:image"]')).toBeNull();
  });
  it("keeps page URLs out of image metadata and sets the canonical", () => {
    renderHook(() => usePageMeta({ url: "https://x/page" }));
    expect(document.querySelector('meta[property="og:image"]')).toBeNull();
    expect(document.querySelector('meta[property="og:url"]')?.getAttribute("content")).toBe("https://x/page");
    expect(document.querySelector('link[rel="canonical"]')?.getAttribute("href")).toBe("https://x/page");
  });
  it("restores previous og:url on unmount", () => {
    const meta = document.createElement("meta");
    meta.setAttribute("property", "og:url");
    meta.setAttribute("content", "https://old.url");
    document.head.appendChild(meta);
    const { unmount } = renderHook(() => usePageMeta({ url: "https://new.url" }));
    expect(document.querySelector('meta[property="og:url"]')?.getAttribute("content")).toBe("https://new.url");
    unmount();
    expect(document.querySelector('meta[property="og:url"]')?.getAttribute("content")).toBe("https://old.url");
  });
  it("restores previous og:image on unmount", () => {
    const meta = document.createElement("meta");
    meta.setAttribute("property", "og:image");
    meta.setAttribute("content", "https://old.png");
    document.head.appendChild(meta);
    const { unmount } = renderHook(() => usePageMeta({ image: "https://new.png" }));
    unmount();
    expect(document.querySelector('meta[property="og:image"]')?.getAttribute("content")).toBe("https://old.png");
  });
  it("restores previous description on unmount", () => {
    const meta = document.createElement("meta");
    meta.setAttribute("name", "description");
    meta.setAttribute("content", "Old desc");
    document.head.appendChild(meta);
    const { unmount } = renderHook(() => usePageMeta({ description: "New desc" }));
    expect(document.querySelector('meta[name="description"]')?.getAttribute("content")).toBe("New desc");
    unmount();
    expect(document.querySelector('meta[name="description"]')?.getAttribute("content")).toBe("Old desc");
  });
  it("updates meta when props change", () => {
    const { rerender } = renderHook(({ title }) => usePageMeta({ title }), { initialProps: { title: "First" } });
    expect(document.title).toBe("First");
    rerender({ title: "Second" });
    expect(document.title).toBe("Second");
  });
  it("restores canonical and indexing metadata after route changes", () => {
    const canonical = document.createElement("link");
    canonical.rel = "canonical";
    canonical.href = "https://artistgrid.cx/";
    document.head.appendChild(canonical);
    const { unmount } = renderHook(() => usePageMeta({ url: "https://artistgrid.cx/sh/artist/", noIndex: true }));
    expect(canonical.href).toBe("https://artistgrid.cx/sh/artist/");
    expect(document.querySelector('meta[name="robots"]')?.getAttribute("content")).toBe("noindex, follow");
    unmount();
    expect(canonical.href).toBe("https://artistgrid.cx/");
    expect(document.querySelector('meta[name="robots"]')).toBeNull();
  });
  it("keeps Open Graph and Twitter text aligned with the page", () => {
    renderHook(() => usePageMeta({ title: "Artist Released Tracker", description: "Released songs" }));
    expect(document.querySelector('meta[property="og:title"]')?.getAttribute("content")).toBe(
      "Artist Released Tracker"
    );
    expect(document.querySelector('meta[name="twitter:description"]')?.getAttribute("content")).toBe("Released songs");
  });
});
