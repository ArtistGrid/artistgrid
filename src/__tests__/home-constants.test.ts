import { describe, it, expect, vi, beforeEach } from "vitest";
import { trackEvent } from "@/lib/home-constants";
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
