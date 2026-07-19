import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { TrackRow } from "@/src/components/view/track-row";
import type { TALeak, Era, TrackSource } from "@/src/types";

const track: TALeak = {
  name: "Song",
  url: "https://x.com/a",
  type: "Leak",
  quality: "320",
  track_length: "3:00",
  extra: "feat",
};

const era: Era = { name: "Era" };

function makeProps(over: Partial<Parameters<typeof TrackRow>[0]> = {}) {
  const noop = vi.fn();
  return {
    track,
    era,
    computeTrackState: () => ({
      url: "https://x.com/a",
      source: "youtube" as TrackSource,
      isPlayable: true,
      isCurrentlyPlaying: false,
      isCurrentTrack: false,
      isHighlighted: false,
      description: "desc",
      shouldShowSource: true,
      playableUrl: "https://x.com/a",
    }),
    handlePlayTrack: noop,
    handleOpenUrl: noop,
    handleShareTrack: noop,
    handlePlayNext: noop,
    handleAddToQueue: noop,
    handleDownload: noop,
    handleToggleFavourite: noop,
    handleOpenOriginal: noop,
    favourites: [],
    highlightedTrackRef: { current: null },
    ...over,
  } as Parameters<typeof TrackRow>[0];
}

describe("TrackRow", () => {
  it("renders track name", () => {
    render(<TrackRow {...makeProps()} />);
    expect(screen.getByText("Song")).toBeInTheDocument();
  });

  it("plays track on play button", () => {
    const handlePlayTrack = vi.fn();
    render(<TrackRow {...makeProps({ handlePlayTrack })} />);
    fireEvent.click(screen.getByLabelText("Play"));
    expect(handlePlayTrack).toHaveBeenCalledWith(track, era);
  });

  it("opens url when playable false", () => {
    const handleOpenUrl = vi.fn();
    render(
      <TrackRow
        {...makeProps({
          handleOpenUrl,
          computeTrackState: () => ({
            url: "https://x.com/a",
            source: "youtube",
            isPlayable: false,
            isCurrentlyPlaying: false,
            isCurrentTrack: false,
            isHighlighted: false,
            description: undefined,
            shouldShowSource: false,
            playableUrl: null,
          }),
        })}
      />
    );
    fireEvent.click(screen.getByLabelText("Open link"));
    expect(handleOpenUrl).toHaveBeenCalledWith("https://x.com/a");
  });

  it("shows highlighted styling", () => {
    const { container } = render(
      <TrackRow {...makeProps({ computeTrackState: () => ({ url: "u", source: "youtube", isPlayable: true, isCurrentlyPlaying: false, isCurrentTrack: false, isHighlighted: true, description: undefined, shouldShowSource: false, playableUrl: "u" }) })} />
    );
    expect((container.firstChild as HTMLElement).className).toContain("ring-yellow-400");
  });

  it("renders favourite state when favourited", () => {
    render(<TrackRow {...makeProps({ favourites: ["https://x.com/a"] })} />);
    expect(screen.getByLabelText("Remove from favourites")).toBeInTheDocument();
  });
});
