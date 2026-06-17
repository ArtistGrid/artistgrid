export type TrackSource =
  | "pillows"
  | "froste"
  | "juicewrldapi"
  | "krakenfiles"
  | "imgur"
  | "pixeldrain"
  | "soundcloud"
  | "tidal"
  | "qobuz"
  | "yetracker"
  | "unknown";
export interface Track {
  id: string;
  name: string;
  extra: string;
  url: string;
  playableUrl: string | null;
  source: TrackSource;
  quality?: string;
  trackLength?: string;
  type?: string;
  description?: string;
  eraImage?: string;
  eraName?: string;
  artistName?: string;
}
export interface Era {
  name: string;
  extra?: string;
  timeline?: string;
  fileInfo?: string[];
  image?: string;
  textColor?: string;
  backgroundColor?: string;
  description?: string;
  data?: Record<string, TALeak[]>;
}
export interface TALeak {
  name: string;
  extra?: string;
  description?: string;
  track_length?: string;
  leak_date?: string;
  file_date?: string;
  type?: string;
  available_length?: string;
  quality?: string;
  url?: string;
  urls?: string[];
  notes?: string;
  info?: string;
  image?: string;
  eraName?: string;
  eraColor?: string;
  eraTextColor?: string;
}
export interface TrackerResponse {
  name: string | null | undefined;
  tabs: string[];
  tabSlugs?: Record<string, string>;
  current_tab: string;
  eras: Record<string, Era>;
  isFlat?: boolean;
}
export interface Artist {
  name: string;
  url: string;
  imageFilename: string;
  isLinkWorking: boolean;
  isUpdated: boolean;
  isStarred: boolean;
}
export interface ArtistFilterOptions {
  showWorking: boolean;
  showUpdated: boolean;
  showStarred: boolean;
  showAlts: boolean;
  sortByTrends: boolean;
}
