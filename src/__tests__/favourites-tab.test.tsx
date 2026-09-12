import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { SettingsProvider } from "@/src/hooks/use-settings";
import { FavouritesTab, type FavouritesTabProps } from "@/src/components/view/favourites-tab";
import type { Era, TALeak, TrackSource } from "@/src/types";
const era: Era = { name: "Era One" };
const favTracks = [
  {
    track: { name: "Fav Song", url: "https://x.com/1" } as TALeak,
    era,
    url: "https://x.com/1",
    playableUrl: "https://x.com/1p",
  },
];
function state(t: TALeak) {
  return {
    url: t.url ?? null,
    source: "youtube" as TrackSource,
    isPlayable: true,
    isCurrentlyPlaying: false,
    isCurrentTrack: false,
    isHighlighted: false,
    description: undefined,
    shouldShowSource: true,
  };
}
function props(over: Partial<FavouritesTabProps> = {}): FavouritesTabProps {
  const noop = vi.fn();
  return {
    favourites: ["https://x.com/1"],
    favouriteTracks: favTracks,
    isPreloading: false,
    computeTrackState: state,
    handlePlayTrack: noop,
    handleOpenUrl: noop,
    handlePlayNext: noop,
    handleAddToQueue: noop,
    handleDownload: noop,
    handleToggleFavourite: noop,
    handleOpenOriginal: noop,
    onDownloadAll: noop,
    onExport: noop,
    importFileRef: { current: null },
    onImportClick: noop,
    onImportFile: noop,
    onClearAll: noop,
    highlightedTrackRef: { current: null },
    ...over,
  };
}
function wrap(ui: React.ReactNode) {
  return <SettingsProvider>{ui}</SettingsProvider>;
}
describe("FavouritesTab", () => {
  beforeEach(() => {
    localStorage.clear();
  });
  it("shows the empty state when nothing is favourited", () => {
    render(wrap(<FavouritesTab {...props({ favourites: [], favouriteTracks: [] })} />));
    expect(screen.getByText("No Favourites Yet")).toBeInTheDocument();
  });
  it("renders favourite rows with count and actions", () => {
    const onExport = vi.fn();
    const onClearAll = vi.fn();
    render(wrap(<FavouritesTab {...props({ onExport, onClearAll })} />));
    expect(screen.getByText("1 favourite")).toBeInTheDocument();
    expect(screen.getByText("Fav Song")).toBeInTheDocument();
    expect(screen.getByText("Era One")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Export/ }));
    fireEvent.click(screen.getByRole("button", { name: /Clear All/ }));
    expect(onExport).toHaveBeenCalledTimes(1);
    expect(onClearAll).toHaveBeenCalledTimes(1);
  });
  it("wires play and play-next handlers", async () => {
    const userEvent = (await import("@testing-library/user-event")).default;
    const handlePlayTrack = vi.fn();
    const handlePlayNext = vi.fn();
    render(wrap(<FavouritesTab {...props({ handlePlayTrack, handlePlayNext })} />));
    fireEvent.click(screen.getByLabelText("Play"));
    expect(handlePlayTrack).toHaveBeenCalledTimes(1);
    await userEvent.click(screen.getByLabelText("Track actions"));
    fireEvent.click(screen.getByRole("menuitem", { name: /Play Next/i }));
    expect(handlePlayNext).toHaveBeenCalledTimes(1);
  });
  it("disables download-all while preloading", () => {
    render(wrap(<FavouritesTab {...props({ isPreloading: true })} />));
    expect(screen.getByRole("button", { name: /Download/ })).toBeDisabled();
  });
});
