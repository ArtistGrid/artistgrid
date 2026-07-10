import type { Era, EraDate, TrackerResponse } from "@/src/types";

function latestTimestamp(a?: string, b?: string): string | undefined {
  if (!a) return b;
  if (!b) return a;
  return a > b ? a : b;
}

function mergeEraDates(
  target: EraDate[],
  seen: Set<string>,
  sources?: EraDate[]
): void {
  if (!sources?.length) return;
  for (const ed of sources) {
    const key = `${ed.era}|${ed.date}|${ed.event}`;
    if (!seen.has(key)) {
      seen.add(key);
      target.push(ed);
    }
  }
}

function mergeFlatTracks(
  merged: Record<string, Era>,
  era: Era
): void {
  if (!merged._flat) {
    merged._flat = { ...era, data: {} };
  }
  if (era.data) {
    for (const [cat, tracks] of Object.entries(era.data)) {
      const existing = merged._flat.data?.[cat] ?? [];
      merged._flat.data![cat] = [...existing, ...tracks];
    }
  }
}

function findEraByKey(eras: Record<string, Era>, label: string): string | undefined {
  return Object.keys(eras).find((k) => (eras[k].name || k) === label);
}

function mergeEraInto(target: Era, source: Era): void {
  if (!target.data) target.data = {};
  if (source.data) {
    for (const [cat, tracks] of Object.entries(source.data)) {
      const existing = target.data[cat] ?? [];
      target.data[cat] = [...existing, ...tracks];
    }
  }
  if (source.image && !target.image) target.image = source.image;
  if (source.extra && !target.extra) target.extra = source.extra;
  if (source.description && !target.description) target.description = source.description;
  if (source.era_dates?.length) {
    if (!target.era_dates) target.era_dates = [];
    for (const ed of source.era_dates) {
      const edKey = `${ed.date}|${ed.event}`;
      if (!target.era_dates.some((e) => `${e.date}|${e.event}` === edKey)) {
        target.era_dates.push(ed);
      }
    }
  }
}

function sortErasByNumericKey(eras: Record<string, Era>): Record<string, Era> {
  const entries = Object.entries(eras);
  entries.sort((a, b) => {
    const aIdx = parseInt(a[0], 10);
    const bIdx = parseInt(b[0], 10);
    if (!isNaN(aIdx) && !isNaN(bIdx)) return aIdx - bIdx;
    if (!isNaN(aIdx)) return -1;
    if (!isNaN(bIdx)) return 1;
    return 0;
  });
  const sorted: Record<string, Era> = {};
  for (const [k, v] of entries) sorted[k] = v;
  return sorted;
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
    lastUpdated: responses.reduce(
      (latest, r) => latestTimestamp(latest, r.lastUpdated),
      undefined as string | undefined
    ),
  };

  const seenDates = new Set<string>();

  for (const res of responses) {
    mergeEraDates(merged.era_dates!, seenDates, res.era_dates);

    for (const [key, era] of Object.entries(res.eras)) {
      if (key === "_flat") {
        mergeFlatTracks(merged.eras, era);
        continue;
      }

      const label = era.name || key;
      const existingKey = findEraByKey(merged.eras, label);

      if (existingKey) {
        mergeEraInto(merged.eras[existingKey], era);
      } else {
        merged.eras[key] = { ...era };
      }
    }
  }

  merged.eras = sortErasByNumericKey(merged.eras);
  return merged;
}
