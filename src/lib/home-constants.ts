import type { ArtistFilterOptions } from "@/src/types";
declare global {
  interface Window {
    plausible?: (
      eventName: string,
      options?: {
        props?: Record<string, string | boolean | number>;
      }
    ) => void;
  }
}
export const ASSET_BASE = "https://assets.artistgrid.cx";
export const LOCAL_STORAGE_KEYS = {
  USE_SHEET: "artistGridUseSheet",
  FILTER_OPTIONS: "artistGridFilterOptions",
  CSV_CACHE_REMOTE: "artistGridCsvCache_remote",
  CSV_CACHE_LOCAL: "artistGridCsvCache_local",
  TRENDS_CACHE: "artistGridTrendsCache",
  MESSAGE_HASH: "artistGridMessageHash",
} as const;
export const ARTISTS_CSV = "https://artists.artistgrid.cx/artists.csv";
export const TRENDS_API = "https://trends.artistgrid.cx/";
export const HOME_CACHE_EXPIRY = 1000 * 60 * 30;
export const DONATION_OPTIONS = {
  URL: [
    { name: "PayPal", value: "https://paypal.me/artistgrid" },
    { name: "Patreon", value: "https://www.patreon.com/c/ArtistGrid" },
    { name: "Liberapay", value: "https://liberapay.com/ArtistGrid/" },
    { name: "Ko-fi", value: "https://ko-fi.com/artistgrid" },
  ],
  CRYPTO: [
    { name: "Bitcoin (BTC)", value: "bc1qn3ufzs4nk62lhfykx78atzjxx8hxptzmrm0ckr", uriScheme: "bitcoin" },
    { name: "Ethereum (ETH)", value: "0x0b39d5D190fDB127d13458bd2086cDf950D3034C", uriScheme: "ethereum" },
    { name: "Litecoin (LTC)", value: "ltc1q88kpywg3jxxg0jsx9c4e9d8gqs7p07fqptjgtv", uriScheme: "litecoin" },
    { name: "Monero (XMR)", value: "bc1qn3ufzs4nk62lhfykx78atzjxx8hxptzmrm0ckr", uriScheme: "monero" },
  ],
};
export const CUSTOM_REDIRECTS: Record<string, string> = {
  ye: "Kanye West",
  drizzy: "Drake",
  carti: "Playboi Carti",
  kendrick: "Kendrick Lamar",
  discord: "https://discord.gg/RdBeMZ2m8S",
  github: "https://github.com/ArtistGrid",
};
export const SUFFIXES_TO_STRIP = ["tracker"];
export const DEFAULT_FILTER_OPTIONS: ArtistFilterOptions = {
  showWorking: false,
  showUpdated: false,
  showStarred: false,
  showAlts: true,
  sortByTrends: true,
};
export const ANNOUNCEMENT_MESSAGE = `# Welcome.

We've made some updates:

- **New Tab System**: Browse different categories like Released, Best Of, Art, and more
- **Art Gallery**: View album artwork and promotional materials
- **Share Tracks**: Share direct links to specific tracks with friends

Thank You.`;
export function trackEvent(eventName: string, props?: Record<string, string | boolean | number>): void {
  if (window.plausible) window.plausible(eventName, props ? { props } : undefined);
}
