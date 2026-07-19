import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { SettingsProvider } from "@/src/hooks/use-settings";
import { FlatTrackCard, type FlatTrackCardProps } from "@/src/components/view/flat-track-card";
import type { Era, TALeak } from "@/src/types";

const track: TALeak = { name: "Song", url: "https://x.com/a", eraName: "Era X" };
const fakeEra: Era = { name: "Era X" };

function cardProps(over: Partial<FlatTrackCardProps> = {}): FlatTrackCardProps {
  const noop = vi.fn();
  return {
    t: track,
    fakeEra,
    url: "https://x.com/a",
    source: "youtube",
    isPlayable: true,
    isCurrentlyPlaying: false,
    description: undefined,
    shouldShowSource: true,
    playableUrl: "https://x.com/a",
    handlePlayTrack: noop,
    handleOpenUrl: noop,
    handleToggleFavourite: noop,
    handleOpenOriginal: noop,
    handleDownload: noop,
    handleAddToQueue: noop,
    favourites: [],
    createTrackObject: vi.fn(),
    clearQueue: noop,
    playTrack: noop,
    ...over,
  };
}

function wrapper({ children }: { children: React.ReactNode }) {
  return <SettingsProvider>{children}</SettingsProvider>;
}

describe("FlatTrackCard", () => {
  it("renders track name and era tag", () => {
    render(<FlatTrackCard {...cardProps()} />, { wrapper });
    expect(screen.getByText("Song")).toBeInTheDocument();
    expect(screen.getByText("Era X")).toBeInTheDocument();
  });

  it("plays track on play button", () => {
    const handlePlayTrack = vi.fn();
    render(<FlatTrackCard {...cardProps({ handlePlayTrack })} />, { wrapper });
    fireEvent.click(screen.getByLabelText("Play"));
    expect(handlePlayTrack).toHaveBeenCalledWith(track, fakeEra);
  });

  it("renders favourite state when favourited", () => {
    render(<FlatTrackCard {...cardProps({ favourites: ["https://x.com/a"] })} />, { wrapper });
    expect(screen.getByLabelText("Remove from favourites")).toBeInTheDocument();
  });
});
