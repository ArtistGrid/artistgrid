export interface Settings {
  lyrics: {
    syncedOnly: boolean;
    alignment: "left" | "center" | "right";
    fontSize: "small" | "medium" | "large";
  };
  downloads: {
    useOgFilename: boolean;
    embedMetadata: boolean;
  };
  player: {
    miniPlayer: boolean;
    showAlbumArt: boolean;
    showNextSong: boolean;
    startupShuffle: boolean;
  };
  behavior: {
    detailedErrors: boolean;
    notifications: boolean;
    rememberSearch: boolean;
    openInNewTab: boolean;
    sheetsHtmlview: boolean;
  };
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
  },
  player: {
    miniPlayer: true,
    showAlbumArt: true,
    showNextSong: false,
    startupShuffle: false,
  },
  behavior: {
    detailedErrors: false,
    notifications: false,
    rememberSearch: false,
    openInNewTab: true,
    sheetsHtmlview: false,
  },
};

const STORAGE_KEY = "artistgrid-settings";

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    const parsed = JSON.parse(raw);
    return {
      lyrics: { ...DEFAULT_SETTINGS.lyrics, ...parsed.lyrics },
      downloads: { ...DEFAULT_SETTINGS.downloads, ...parsed.downloads },
      player: { ...DEFAULT_SETTINGS.player, ...parsed.player },
      behavior: { ...DEFAULT_SETTINGS.behavior, ...parsed.behavior },
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
