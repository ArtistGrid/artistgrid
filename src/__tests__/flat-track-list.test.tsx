import { describe, it, expect, vi, beforeAll, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { SettingsProvider } from "@/src/hooks/use-settings";
import { FlatTrackList } from "@/src/components/view/flat-track-card";
import type { TALeak, Era, TrackSource } from "@/src/types";

vi.mock("@tanstack/react-virtual", () => ({
  useVirtualizer: ({ count }: { count: number }) => ({
    getTotalSize: () => count * 56,
    getVirtualItems: () =>
      Array.from({ length: count }, (_, index) => ({ key: index, index, start: index * 56, size: 56, end: (index + 1) * 56 })),
    measureElement: () => {},
    scrollToIndex: () => {},
  }),
}));

beforeAll(() => {
  window.HTMLMediaElement.prototype.play = vi.fn().mockResolvedValue(undefined);
  window.HTMLMediaElement.prototype.pause = vi.fn();
});

const tracks: TALeak[] = [
  { name: "Song One", url: "https://x.com/1", eraName: "Era X" },
  { name: "Song Two", url: "https://x.com/2", eraName: "Era X" },
  { name: "Song Three", url: "https://x.com/3", eraName: "Era X" },
];

const fakeEra: Era = { name: "Era X" };

function listProps(over: Record<string, unknown> = {}) {
  const noop = vi.fn();
  return {
    tracks,
    computeTrackState: (t: TALeak) => ({
      url: t.url,
      source: "youtube" as TrackSource,
      isPlayable: true,
      isCurrentlyPlaying: false,
      isCurrentTrack: false,
      isHighlighted: false,
      description: undefined,
      shouldShowSource: true,
      playableUrl: t.url,
    }),
    handlePlayTrack: noop,
    handleOpenUrl: noop,
    handleOpenOriginal: noop,
    handleToggleFavourite: noop,
    handleDownload: noop,
    handleAddToQueue: noop,
    favourites: [],
    highlightedTrackRef: { current: null },
    createTrackObject: vi.fn(),
    clearQueue: noop,
    playTrack: noop,
    ...over,
  } as unknown as Parameters<typeof FlatTrackList>[0];
}

function wrap(ui: React.ReactNode) {
  return <SettingsProvider>{ui}</SettingsProvider>;
}

describe("FlatTrackList", () => {
  afterEach(() => cleanup());

  it("renders all tracks when the virtualizer is mocked", () => {
    render(wrap(<FlatTrackList {...listProps()} />));
    expect(screen.getByText("Song One")).toBeInTheDocument();
    expect(screen.getByText("Song Two")).toBeInTheDocument();
    expect(screen.getByText("Song Three")).toBeInTheDocument();
  });

  it("plays a track from the list", () => {
    const handlePlayTrack = vi.fn();
    render(wrap(<FlatTrackList {...listProps({ handlePlayTrack })} />));
    const playButtons = screen.getAllByLabelText("Play");
    fireEvent.click(playButtons[1]);
    expect(handlePlayTrack).toHaveBeenCalled();
  });

  it("renders favourite state for favourited tracks", () => {
    render(wrap(<FlatTrackList {...listProps({ favourites: ["https://x.com/2"] })} />));
    expect(screen.getAllByLabelText("Remove from favourites").length).toBeGreaterThan(0);
  });
});
