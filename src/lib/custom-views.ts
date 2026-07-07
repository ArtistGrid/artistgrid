import type { Era, EraDate, TrackerResponse } from "@/src/types";

export interface CustomView {
  id: string;
  name: string;
  tabs: string[];
}

const KEY_PREFIX = "artistgrid-custom-views_";

function getKey(trackerId: string): string {
  return `${KEY_PREFIX}${trackerId}`;
}

export function getCustomViews(trackerId: string): CustomView[] {
  try {
    const raw = localStorage.getItem(getKey(trackerId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveCustomViews(trackerId: string, views: CustomView[]): void {
  try {
    localStorage.setItem(getKey(trackerId), JSON.stringify(views));
  } catch {}
}

export function addCustomView(trackerId: string, view: Omit<CustomView, "id">): CustomView {
  const views = getCustomViews(trackerId);
  const newView: CustomView = { ...view, id: Date.now().toString(36) };
  views.push(newView);
  saveCustomViews(trackerId, views);
  return newView;
}

export function updateCustomView(trackerId: string, id: string, patch: Partial<Omit<CustomView, "id">>): void {
  const views = getCustomViews(trackerId);
  const idx = views.findIndex((v) => v.id === id);
  if (idx === -1) return;
  views[idx] = { ...views[idx], ...patch };
  saveCustomViews(trackerId, views);
}

export function deleteCustomView(trackerId: string, id: string): void {
  const views = getCustomViews(trackerId).filter((v) => v.id !== id);
  saveCustomViews(trackerId, views);
}

export function mergeTabData(responses: TrackerResponse[]): TrackerResponse {
  const merged: TrackerResponse = {
    name: responses[0]?.name ?? null,
    tabs: [],
    tabSlugs: {},
    current_tab: "Custom View",
    eras: {},
    isFlat: false,
    credits: responses[0]?.credits ?? '',
    era_dates: [],
    discord: responses[0]?.discord,
  };

  const seenDates = new Set<string>();

  for (const res of responses) {
    if (res.era_dates?.length) {
      for (const ed of res.era_dates) {
        const key = `${ed.era}|${ed.date}|${ed.event}`;
        if (!seenDates.has(key)) {
          seenDates.add(key);
          merged.era_dates!.push(ed);
        }
      }
    }

    for (const [key, era] of Object.entries(res.eras)) {
      if (key === "_flat") {
        if (!merged.eras._flat) {
          merged.eras._flat = { ...era, data: {} };
        }
        if (era.data) {
          for (const [cat, tracks] of Object.entries(era.data)) {
            const existing = merged.eras._flat.data?.[cat] ?? [];
            merged.eras._flat.data![cat] = [...existing, ...tracks];
          }
        }
        continue;
      }

      const label = era.name || key;
      const existingKey = Object.keys(merged.eras).find((k) => {
        const e = merged.eras[k];
        return (e.name || k) === label;
      });

      if (existingKey) {
        const existing = merged.eras[existingKey];
        if (!existing.data) existing.data = {};
        if (era.data) {
          for (const [cat, tracks] of Object.entries(era.data)) {
            const existingTracks = existing.data[cat] ?? [];
            existing.data[cat] = [...existingTracks, ...tracks];
          }
        }
        if (era.image && !existing.image) existing.image = era.image;
        if (era.extra && !existing.extra) existing.extra = era.extra;
        if (era.description && !existing.description) existing.description = era.description;
        if (era.era_dates?.length) {
          if (!existing.era_dates) existing.era_dates = [];
          for (const ed of era.era_dates) {
            const edKey = `${ed.date}|${ed.event}`;
            if (!existing.era_dates.some((e) => `${e.date}|${e.event}` === edKey)) {
              existing.era_dates.push(ed);
            }
          }
        }
      } else {
        merged.eras[key] = { ...era };
      }
    }
  }

  const sorted: Record<string, Era> = {};
  const entries = Object.entries(merged.eras);
  entries.sort((a, b) => {
    const aIdx = parseInt(a[0], 10);
    const bIdx = parseInt(b[0], 10);
    if (!isNaN(aIdx) && !isNaN(bIdx)) return aIdx - bIdx;
    if (!isNaN(aIdx)) return -1;
    if (!isNaN(bIdx)) return 1;
    return 0;
  });
  for (const [k, v] of entries) sorted[k] = v;
  merged.eras = sorted;

  return merged;
}
