import { describe, it, expect } from "vitest";
import {
  PLAY_ICON_NODE,
  PAUSE_ICON_NODE,
  VOLUME_2_ICON_NODE,
  VOLUME_X_ICON_NODE,
  MAXIMIZE_ICON_NODE,
  MINIMIZE_ICON_NODE,
} from "@/src/lib/morph-icons";
describe("morph-icons", () => {
  it("exports valid IconNode definitions with array structures", () => {
    expect(Array.isArray(PLAY_ICON_NODE)).toBe(true);
    expect(PLAY_ICON_NODE.length).toBeGreaterThan(0);
    expect(Array.isArray(PAUSE_ICON_NODE)).toBe(true);
    expect(PAUSE_ICON_NODE.length).toBeGreaterThan(0);
    expect(Array.isArray(VOLUME_2_ICON_NODE)).toBe(true);
    expect(VOLUME_2_ICON_NODE.length).toBeGreaterThan(0);
    expect(Array.isArray(VOLUME_X_ICON_NODE)).toBe(true);
    expect(VOLUME_X_ICON_NODE.length).toBeGreaterThan(0);
    expect(Array.isArray(MAXIMIZE_ICON_NODE)).toBe(true);
    expect(MAXIMIZE_ICON_NODE.length).toBeGreaterThan(0);
    expect(Array.isArray(MINIMIZE_ICON_NODE)).toBe(true);
    expect(MINIMIZE_ICON_NODE.length).toBeGreaterThan(0);
  });
});
