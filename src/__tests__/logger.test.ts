import { describe, it, expect, beforeEach, vi } from "vitest";
import { logError } from "@/src/lib/logger";
import { saveSettings, DEFAULT_SETTINGS } from "@/src/lib/settings";

describe("logError", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it("logs to console.error when detailedErrors enabled", () => {
    saveSettings({ ...DEFAULT_SETTINGS, behavior: { ...DEFAULT_SETTINGS.behavior, detailedErrors: true } });
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    logError("boom", { a: 1 });
    expect(spy).toHaveBeenCalledWith("boom", { a: 1 });
  });

  it("does not log when detailedErrors disabled", () => {
    saveSettings({ ...DEFAULT_SETTINGS, behavior: { ...DEFAULT_SETTINGS.behavior, detailedErrors: false } });
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    logError("boom");
    expect(spy).not.toHaveBeenCalled();
  });
});
