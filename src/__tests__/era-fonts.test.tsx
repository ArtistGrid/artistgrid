import { describe, expect, it } from "vitest";
import { renderHook } from "@testing-library/react";
import { getEraFontStyle, useEraFonts } from "../hooks/use-era-fonts";

describe("tracker font metadata", () => {
  it("decodes quoted system fonts without requesting invalid font assets", () => {
    const fonts = ["&quot;Arial&quot;", "docs-'Calibri', sans-serif"];
    const before = document.querySelectorAll('link[rel="stylesheet"]').length;
    const { unmount } = renderHook(() => useEraFonts(fonts));
    expect(getEraFontStyle(fonts[0])).toEqual({ fontFamily: '"Arial", sans-serif' });
    expect(document.querySelectorAll('link[rel="stylesheet"]')).toHaveLength(before);
    unmount();
  });
  it("ignores malformed font names rather than loading them", () => {
    expect(getEraFontStyle('url("https://bad.example/font")')).toBeUndefined();
    expect(getEraFontStyle("&quot;")).toBeUndefined();
  });
});
