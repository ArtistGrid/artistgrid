import { trackerPath } from "./tracker-route";

export const SITE_ORIGIN = "https://artistgrid.cx";
export const ASSETS_ORIGIN = "https://assets.artistgrid.cx";
export const HOME_TITLE = "ArtistGrid | Unreleased Music Trackers";
export const HOME_DESCRIPTION =
  "Browse artist trackers for unreleased music, leaks and released songs. Explore tracklists, era timelines, recording details and original sources on ArtistGrid.";
export const DEFAULT_SHARE_IMAGE = `${SITE_ORIGIN}/favicon.png`;

export function trackerCanonicalUrl(trackerId: string, tabSlug = ""): string {
  return `${SITE_ORIGIN}${trackerPath(trackerId, tabSlug === "main" ? "" : tabSlug)}/`;
}

export function cleanTabName(value: unknown): string {
  return typeof value === "string"
    ? value
        .replace(/[\p{Extended_Pictographic}\uFE0F\u200D]/gu, "")
        .replace(/\s+/g, " ")
        .trim()
    : "";
}
