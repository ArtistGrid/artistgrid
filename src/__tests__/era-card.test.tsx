import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { SettingsProvider } from "@/src/hooks/use-settings";
import { EraCard, type EraCardProps, type EraCardTrackState } from "@/src/components/view/era-card";
import type { Era, TALeak, TrackSource } from "@/src/types";
vi.mock("@tanstack/react-virtual", () => {
  const stub = ({ count }: { count: number }) => ({
    getTotalSize: () => count * 60,
    getVirtualItems: () =>
      Array.from({ length: Math.min(count, 10) }, (_, index) => ({
        key: index,
        index,
        start: index * 60,
        size: 60,
        end: (index + 1) * 60,
      })),
    measureElement: () => {},
    scrollToIndex: () => {},
  });
  return { useVirtualizer: stub, useWindowVirtualizer: stub };
});
const track: TALeak = { name: "Song", url: "https://x.com/a" };
const era: Era = { name: "Era X", data: { default: [track] } };
function state(): EraCardTrackState {
  return {
    url: "https://x.com/a",
    source: "youtube" as TrackSource,
    isPlayable: true,
    isCurrentlyPlaying: false,
    isCurrentTrack: false,
    isHighlighted: false,
    description: undefined,
    shouldShowSource: true,
    playableUrl: "https://x.com/a",
  };
}
function props(over: Partial<EraCardProps> = {}): EraCardProps {
  const noop = vi.fn();
  return {
    eraKey: "1",
    era,
    resolvedUrls: new Map([["https://x.com/a", "https://x.com/a"]]),
    trackerId: "tid",
    expandedEras: new Set(["1"]),
    toggleEra: noop,
    computeTrackState: () => state(),
    handlePlayTrack: noop,
    handleOpenUrl: noop,
    handleShareTrack: noop,
    handlePlayNext: noop,
    handleAddToQueue: noop,
    handleDownload: noop,
    handleToggleFavourite: noop,
    handleOpenOriginal: noop,
    handleToggleEraFavourite: noop,
    isEraFavourited: () => false,
    downloadTracker: noop,
    favourites: [],
    highlightedTrackRef: { current: null },
    ...over,
  };
}
function wrapper({ children }: { children: React.ReactNode }) {
  return <SettingsProvider>{children}</SettingsProvider>;
}
describe("EraCard", () => {
  it("renders era name and song count", () => {
    render(<EraCard {...props()} />, { wrapper });
    expect(screen.getByText("Era X")).toBeInTheDocument();
    expect(screen.getByText(/1 songs?/)).toBeInTheDocument();
  });
  it("toggles era on header click", () => {
    const toggleEra = vi.fn();
    render(<EraCard {...props({ toggleEra })} />, { wrapper });
    fireEvent.click(screen.getByText("Era X"));
    expect(toggleEra).toHaveBeenCalledWith("1");
  });
  it("renders track rows when expanded", () => {
    render(<EraCard {...props()} />, { wrapper });
    expect(screen.getByText("Song")).toBeInTheDocument();
  });
  it("renders era options menu when playable", () => {
    render(<EraCard {...props()} />, { wrapper });
    expect(screen.getByLabelText("Era options")).toBeInTheDocument();
  });
  it("virtualizes rendering when the era exceeds the track threshold", () => {
    const many = Array.from({ length: 250 }, (_, i) => ({
      name: `Song ${i}`,
      url: `https://x.com/t${i}`,
    }));
    const bigEra: Era = { name: "Big Era", data: { default: many } };
    render(<EraCard {...props({ era: bigEra })} />, { wrapper });
    expect(screen.getByText("Big Era")).toBeInTheDocument();
    const rendered = screen.queryAllByText(/Song \d+/);
    expect(rendered.length).toBeGreaterThan(0);
    expect(rendered.length).toBeLessThan(250);
  });
  it("keeps the full DOM for small eras (no virtualization)", () => {
    const few = Array.from({ length: 5 }, (_, i) => ({
      name: `Small ${i}`,
      url: `https://x.com/s${i}`,
    }));
    const smallEra: Era = { name: "Small Era", data: { default: few } };
    render(<EraCard {...props({ era: smallEra })} />, { wrapper });
    expect(screen.getByText("Small 0")).toBeInTheDocument();
    expect(screen.getByText("Small 4")).toBeInTheDocument();
  });
});
