import { describe, it, expect } from "vitest";
import { mergeTabData } from "@/src/lib/merge-tab-data";
import type { TrackerResponse, Era } from "@/src/types";

function makeRes(over: Partial<TrackerResponse> = {}): TrackerResponse {
  return {
    name: "A",
    tabs: [],
    tabSlugs: {},
    current_tab: "Custom View",
    eras: {},
    isFlat: false,
    credits: "",
    era_dates: [],
    lastUpdated: "2024-01-01T00:00:00.000Z",
    ...over,
  };
}

function era(tracks: Record<string, unknown[]> = {}, over: Partial<Era> = {}): Era {
  return { name: "Era", data: tracks as Era["data"], ...over };
}

describe("mergeTabData", () => {
  it("merges name and latest lastUpdated", () => {
    const merged = mergeTabData([
      makeRes({ name: "X", lastUpdated: "2024-01-01T00:00:00.000Z" }),
      makeRes({ name: "Y", lastUpdated: "2024-02-01T00:00:00.000Z" }),
    ]);
    expect(merged.name).toBe("X");
    expect(merged.lastUpdated).toBe("2024-02-01T00:00:00.000Z");
  });

  it("merges era tracks across responses by name", () => {
    const a = makeRes({ eras: { "1": era({ Leaks: [{ url: "u1" }] }) } });
    const b = makeRes({ eras: { "1": era({ Leaks: [{ url: "u2" }] }) } });
    const merged = mergeTabData([a, b]);
    const key = Object.keys(merged.eras).find((k) => (merged.eras[k].name || k) === "Era")!;
    expect(merged.eras[key].data!.Leaks).toHaveLength(2);
  });

  it("keeps first image/extra/description when absent", () => {
    const a = makeRes({ eras: { "1": era({}, { image: "img1", extra: "x", description: "d" }) } });
    const b = makeRes({ eras: { "1": era({}, { image: "img2" }) } });
    const merged = mergeTabData([a, b]);
    const key = Object.keys(merged.eras)[0];
    expect(merged.eras[key].image).toBe("img1");
    expect(merged.eras[key].extra).toBe("x");
    expect(merged.eras[key].description).toBe("d");
  });

  it("dedupes era_dates", () => {
    const ed = { era: "Era", date: "2024", event: "drop" };
    const merged = mergeTabData([
      makeRes({ era_dates: [ed] }),
      makeRes({ era_dates: [ed] }),
    ]);
    expect(merged.era_dates).toHaveLength(1);
  });

  it("merges _flat tracks", () => {
    const a = makeRes({ eras: { _flat: { name: "_flat", data: { Leaks: [{ url: "u1" }] } } } });
    const b = makeRes({ eras: { _flat: { name: "_flat", data: { Leaks: [{ url: "u2" }] } } } });
    const merged = mergeTabData([a, b]);
    expect(merged.eras._flat.data!.Leaks).toHaveLength(2);
  });

  it("sorts eras by numeric key", () => {
    const merged = mergeTabData([
      makeRes({ eras: { "10": era({}, { name: "Ten" }), "2": era({}, { name: "Two" }) } }),
    ]);
    expect(Object.keys(merged.eras)).toEqual(["2", "10"]);
  });

  it("handles single empty response", () => {
    const merged = mergeTabData([makeRes()]);
    expect(merged.eras).toEqual({});
    expect(merged.name).toBe("A");
  });
});
