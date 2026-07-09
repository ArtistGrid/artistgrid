import { describe, it, expect, beforeEach } from "vitest";
import {
  getCustomViews,
  saveCustomViews,
  addCustomView,
  deleteCustomView,
  mergeTabData,
} from "../lib/custom-views";
import type { TrackerResponse, Era, TALeak } from "../types";

const track = (name: string): TALeak => ({ name });

describe("custom-views CRUD", () => {
  beforeEach(() => localStorage.clear());

  it("returns empty array when nothing stored", () => {
    expect(getCustomViews("abc")).toEqual([]);
  });

  it("adds, reads, and deletes a view", () => {
    const created = addCustomView("abc", { name: "My View", tabs: ["A", "B"] });
    expect(created.id).toBeTruthy();
    const views = getCustomViews("abc");
    expect(views).toHaveLength(1);
    expect(views[0].name).toBe("My View");

    deleteCustomView("abc", created.id);
    expect(getCustomViews("abc")).toHaveLength(0);
  });

  it("scopes views per tracker id", () => {
    addCustomView("abc", { name: "One", tabs: [] });
    expect(getCustomViews("other")).toEqual([]);
  });

  it("saveCustomViews persists an explicit list", () => {
    saveCustomViews("abc", [{ id: "x", name: "Saved", tabs: ["T"] }]);
    expect(getCustomViews("abc")[0].id).toBe("x");
  });
});

describe("mergeTabData", () => {
  const base = (): TrackerResponse => ({
    name: "Artist",
    tabs: [],
    current_tab: "Custom View",
    eras: {},
  });

  it("merges eras from multiple responses", () => {
    const r1: TrackerResponse = {
      ...base(),
      eras: { "1": { name: "Era 1", data: { Default: [track("a")] } } },
    };
    const r2: TrackerResponse = {
      ...base(),
      eras: { "2": { name: "Era 2", data: { Default: [track("b")] } } },
    };
    const merged = mergeTabData([r1, r2]);
    expect(Object.keys(merged.eras)).toHaveLength(2);
  });

  it("concatenates tracks within the same named era", () => {
    const era: Era = { name: "Dups", data: { Default: [track("x")] } };
    const merged = mergeTabData([{ ...base(), eras: { "1": era } }, { ...base(), eras: { "1": { name: "Dups", data: { Default: [track("y")] } } } }]);
    expect(merged.eras["1"].data!.Default).toHaveLength(2);
  });

  it("merges _flat eras", () => {
    const flat: Era = { name: "_flat", data: { Default: [track("f1")] } };
    const merged = mergeTabData([{ ...base(), eras: { _flat: flat } }, { ...base(), eras: { _flat: { name: "_flat", data: { Default: [track("f2")] } } } }]);
    expect(merged.eras._flat.data!.Default).toHaveLength(2);
  });

  it("dedupes era_dates by date and event", () => {
    const ed = { era: "E", date: "2020", event: "Release" };
    const merged = mergeTabData([
      { ...base(), era_dates: [ed] },
      { ...base(), era_dates: [ed] },
    ]);
    expect(merged.era_dates).toHaveLength(1);
  });
});
