export interface V3TrackName {
  raw: string;
  title: string;
  credits: string[];
}
export interface V3Track {
  name: V3TrackName;
  notes?: string;
  track_length?: string | null;
  file_date?: string | null;
  leak_date?: string | null;
  available_length?: string;
  quality?: string;
  links?: {
    url: string;
    text?: string;
  }[];
  image?: string;
  type?: string;
  sub_era?: string;
  art_used?: boolean;
}
export interface V3FlatTrack extends V3Track {
  era: string;
  era_color?: string;
  era_text_color?: string;
  era_font?: string;
  font_family?: string;
  og_filename?: string;
}
export interface V3Era {
  name: string;
  aka?: string[];
  timeline?: string;
  description?: string;
  cover_art?: string;
  era_logo?: string;
  color?: string;
  text_color?: string;
  font?: string;
  font_family?: string;
  tracks: V3Track[];
}
export interface V3Tab {
  name: string;
  slug: string;
  gid: string;
}
export interface V3EraDate {
  date: string;
  event: string;
  era: string;
}
export interface V3Response {
  name: string;
  tab: V3Tab;
  tabs: V3Tab[];
  eras?: V3Era[];
  tracks?: V3FlatTrack[];
  era_dates?: V3EraDate[];
  credits?: string | null;
  discord?: string | string[] | null;
  last_updated?: number | null;
}
