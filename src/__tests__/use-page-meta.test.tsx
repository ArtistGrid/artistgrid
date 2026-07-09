import { describe, it, expect, afterEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { usePageMeta } from "../hooks/use-page-meta";

describe("usePageMeta", () => {
  afterEach(() => {
    document.title = "ArtistGrid";
    document.querySelectorAll('meta[name="description"], meta[property^="og:"]').forEach((el) => el.remove());
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
});
