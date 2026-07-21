type DownloadFormat = "original" | "mp3" | "opus" | "ogg" | "flac" | "wav";
type TagPreset = "default" | "minimal" | "full";

export interface Settings {
  lyrics: {
    syncedOnly: boolean;
    alignment: "left" | "center" | "right";
    fontSize: "small" | "medium" | "large";
  };
  downloads: {
    useOgFilename: boolean;
    embedMetadata: boolean;
    format: DownloadFormat;
    tagPreset: TagPreset;
  };
  player: {
    miniPlayer: boolean;
    showAlbumArt: boolean;
    showNextSong: boolean;
    startupShuffle: boolean;
  };
  scrobbling: {
    lastfm: {
      enabled: boolean;
      customServer: boolean;
      apiUrl: string;
      apiKey: string;
      apiSecret: string;
    };
    listenbrainz: {
      enabled: boolean;
      token: string;
      apiUrl: string;
    };
  };
  behavior: {
    detailedErrors: boolean;
    notifications: boolean;
    rememberSearch: boolean;
    openInNewTab: boolean;
    sheetsHtmlview: boolean;
    showEmojis: boolean;
    useImageProxy: boolean;
  };
  font: string;
}

export const DEFAULT_SETTINGS: Settings = {
  lyrics: {
    syncedOnly: false,
    alignment: "center",
    fontSize: "medium",
  },
  downloads: {
    useOgFilename: false,
    embedMetadata: false,
    format: "original",
    tagPreset: "default",
  },
  player: {
    miniPlayer: true,
    showAlbumArt: true,
    showNextSong: false,
    startupShuffle: false,
  },
  scrobbling: {
    lastfm: {
      enabled: false,
      customServer: false,
      apiUrl: "",
      apiKey: "",
      apiSecret: "",
    },
    listenbrainz: {
      enabled: false,
      token: "",
      apiUrl: "https://api.listenbrainz.org",
    },
  },
  behavior: {
    detailedErrors: false,
    notifications: false,
    rememberSearch: false,
    openInNewTab: true,
    sheetsHtmlview: false,
    showEmojis: true,
    useImageProxy: false,
  },
  font: "IBM Plex Sans",
};

const STORAGE_KEY = "artistgrid-settings:v1";

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    const parsed = JSON.parse(raw);
    return {
      lyrics: { ...DEFAULT_SETTINGS.lyrics, ...parsed.lyrics },
      downloads: { ...DEFAULT_SETTINGS.downloads, ...parsed.downloads },
      player: { ...DEFAULT_SETTINGS.player, ...parsed.player },
      scrobbling: {
        lastfm: { ...DEFAULT_SETTINGS.scrobbling.lastfm, ...parsed.scrobbling?.lastfm },
        listenbrainz: { ...DEFAULT_SETTINGS.scrobbling.listenbrainz, ...parsed.scrobbling?.listenbrainz },
      },
      behavior: { ...DEFAULT_SETTINGS.behavior, ...parsed.behavior },
      font: parsed.font ?? DEFAULT_SETTINGS.font,
    };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(settings: Settings): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {}
}
