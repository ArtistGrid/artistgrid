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
export const DISCORD_INVITE = "https://discord.gg/YuwTae6QC4";
export const LOCAL_STORAGE_KEYS = {
  USE_SHEET: "artistGridUseSheet",
  FILTER_OPTIONS: "artistGridFilterOptions",
  CSV_CACHE_REMOTE: "artistGridCsvCache_remote",
  CSV_CACHE_LOCAL: "artistGridCsvCache_local",

  MESSAGE_HASH: "artistGridMessageHash",
} as const;
export const ARTISTS_CSV = "https://artists.artistgrid.cx/artists.csv";

export const HOME_CACHE_EXPIRY = 1000 * 60 * 30;
export const DONATION_OPTIONS = {
  URL: [
    { name: "Ko-fi", value: "https://ko-fi.com/edideaur" },
  ],
  CRYPTO: [
    { name: "Monero (XMR)", value: "84QSJs6sq1GSS6f3HFL1Yc6QK3f73867aQduTnaxGdcvXTkpnduaU16f98akdwRo6HdPYfoNwn1GJijc3iLfGXhd5MLcfsk", uriScheme: "monero" },
    { name: "Bitcoin · Active", value: "bc1qzl0kznz3xxdpmz2m77qe3mx8ds06tcvm7pk2t4", uriScheme: "bitcoin" },
    { name: "Bitcoin · P2WPKH", value: "bc1qf7elcxp394a7ly5pgqg0wsetzkkqn2xrlzpeh2", uriScheme: "bitcoin" },
    { name: "Bitcoin · P2PKH", value: "1NnLbNBH8RcTfbfEpZyf1iW1ezXv3XBAQR", uriScheme: "bitcoin" },
    { name: "Bitcoin · P2SH", value: "3J3YpbRZtX7exyt962s5zbC9PMGQhZ4B7j", uriScheme: "bitcoin" },
    { name: "Bitcoin · P2TR (Taproot)", value: "bc1p87xf6f8tnsnlt0tjkj9suysyq72kxz4a8fprgynggxk6p9mcr3wq5rhd43", uriScheme: "bitcoin" },
    { name: "Bitcoin · P2WSH", value: "bc1q6luyymmww83d260925g6cvy8qjy4y4djg40cgqjcqszs9upes3xsy9nt6m", uriScheme: "bitcoin" },
    { name: "Bitcoin · Silent Payments", value: "sp1qq0wnt8ehzg9hes4kyc23s5h4mc0gcr69fp6clm4m5yjuc78v0as4xq5j3wz03v9jw4yslcmue7xy7ek80sm3lnw8eq7ce9tkjfs3d0rj3yhj6lw6", uriScheme: "bitcoin" },
    { name: "Bitcoin · Lightning", value: "oblongbalinese7350@cake.cash", uriScheme: "lightning" },
    { name: "Litecoin · Active", value: "ltc1qt9jspfdwcgas9q4sf5q9ajn7x9ka8mfywsehrr", uriScheme: "litecoin" },
    { name: "Litecoin · P2WPKH", value: "ltc1qqtsdhlae2rm67avrw7eal57j77845lz5kvz6qj", uriScheme: "litecoin" },
    { name: "Litecoin · MWEB", value: "ltcmweb1qq06pgdyw2xlwy64vhz3l903kmp84j0qgx9nu7er8ckr6tp2289r9sqe9ntqyzyd2usf298ln5cvpfc7wccsys320ajr5sx8hfy43eut74c2jae4c", uriScheme: "litecoin" },
    { name: "Ethereum / EVM · ETH · BNB · Polygon · Base · Arbitrum", value: "0x078A47E9bbe2e0D7aEb2B2B09302ceB2af964593", uriScheme: "ethereum" },
    { name: "Solana (SOL)", value: "2zdNcs4Uu2377Nzjc8P91qH7hHiyQs8E1f27A6icUSKx", uriScheme: "solana" },
    { name: "Zcash (ZEC)", value: "u120zcwxlt9azs36d07uafdnj7fzsa62stwuk4f2eruk272e8he0czxvyjquakhp968mvm0tuzmqx6ln7c5k3qdw2qem2ypk4p6s3hgczx", uriScheme: "zcash" },
    { name: "Tron (TRX)", value: "TQU2kovh58VnnPr1PUjZUhNY2a3UfM4ERh", uriScheme: "tron" },
    { name: "Dogecoin (DOGE)", value: "DNpErVMo3yPM6UFAStSfWuBbHPvUwx95D9", uriScheme: "dogecoin" },
    { name: "Bitcoin Cash (BCH)", value: "bitcoincash:qzg8j4ddjew3ptcr9g503qk0345kdr332s5jmrzeym", uriScheme: "" },
    { name: "Nano (XNO)", value: "nano_1qfmbi1b9tzocx9socbffy7z6te6r7z75byc7ofpfpqjpbfb1i3eaqe3etjz", uriScheme: "nano" },
  ],
};
export const CUSTOM_REDIRECTS: Record<string, string> = {
  ye: "Kanye West",
  drizzy: "Drake",
  carti: "Playboi Carti",
  kendrick: "Kendrick Lamar",
  discord: DISCORD_INVITE,
  github: "https://github.com/ArtistGrid",
};
export const SUFFIXES_TO_STRIP = ["tracker"];
export const DEFAULT_FILTER_OPTIONS: ArtistFilterOptions = {
  showWorking: false,
  showUpdated: false,
  showStarred: false,
  showAlts: true,

};
export const ANNOUNCEMENT_MESSAGE = `# Hi.

ArtistGrid has been going for over a year now. In that time we've received nothing in donations. Donations help us improve the site and keep building it.`;
export function trackEvent(eventName: string, props?: Record<string, string | boolean | number>): void {
  if (window.plausible) window.plausible(eventName, props ? { props } : undefined);
}
