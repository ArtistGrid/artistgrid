import { safeSetItem } from "@/src/lib/storage";

type DownloadFormat = "original" | "mp3" | "opus" | "ogg" | "flac" | "wav";

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
  };
  player: {
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
  },
  player: {
    showAlbumArt: true,
    showNextSong: false,
    startupShuffle: false,
  },
  scrobbling: {
    lastfm: {
      enabled: true,
      customServer: false,
      apiUrl: "",
      apiKey: "",
      apiSecret: "",
    },
    listenbrainz: {
      enabled: true,
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

let cachedRaw: string | null | undefined = undefined;
let cachedSettings: Settings | null = null;

if (typeof window !== "undefined") {
  window.addEventListener("storage", (e) => {
    if (e.key === STORAGE_KEY) cachedRaw = undefined;
  });
}

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === cachedRaw && cachedSettings) return cachedSettings;
    let settings: Settings;
    if (!raw) {
      settings = { ...DEFAULT_SETTINGS };
    } else {
      const parsed = JSON.parse(raw);
      settings = {
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
    }
    cachedRaw = raw;
    cachedSettings = settings;
    return settings;
  } catch {
    cachedRaw = undefined;
    cachedSettings = { ...DEFAULT_SETTINGS };
    return cachedSettings;
  }
}

export function saveSettings(settings: Settings): void {
  const raw = JSON.stringify(settings);
  cachedRaw = raw;
  cachedSettings = settings;
  safeSetItem(STORAGE_KEY, raw);
}
