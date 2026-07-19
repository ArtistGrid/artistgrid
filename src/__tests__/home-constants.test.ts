import { describe, it, expect, vi, beforeEach } from "vitest";
import { trackEvent, CUSTOM_REDIRECTS, SUFFIXES_TO_STRIP, DEFAULT_FILTER_OPTIONS } from "@/src/lib/home-constants";

describe("trackEvent", () => {
  beforeEach(() => {
    vi.stubGlobal("window", { plausible: vi.fn() });
  });

  it("calls window.plausible with props", () => {
    trackEvent("Test", { a: 1 });
    expect((window as any).plausible).toHaveBeenCalledWith("Test", { props: { a: 1 } });
  });

  it("calls window.plausible without props arg", () => {
    trackEvent("Test2");
    expect((window as any).plausible).toHaveBeenCalledWith("Test2", undefined);
  });

  it("no-ops when plausible missing", () => {
    vi.stubGlobal("window", {});
    expect(() => trackEvent("X")).not.toThrow();
  });
});

describe("home-constants", () => {
  it("has custom redirects", () => {
    expect(CUSTOM_REDIRECTS.ye).toBe("Kanye West");
  });
  it("strips suffixes", () => {
    expect(SUFFIXES_TO_STRIP).toContain("tracker");
  });
  it("has default filter options", () => {
    expect(DEFAULT_FILTER_OPTIONS.showAlts).toBe(true);
  });
});
