import { describe, it, expect, vi, beforeAll } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { PlayerProvider, usePlayer } from "@/src/providers";
import { GlobalPlayer } from "@/components/global-player";
import type { Track } from "@/src/types";

beforeAll(() => {
  window.HTMLMediaElement.prototype.play = vi.fn().mockResolvedValue(undefined);
  window.HTMLMediaElement.prototype.pause = vi.fn();
  window.HTMLMediaElement.prototype.load = vi.fn();
  Object.defineProperty(window, "mediaSession", {
    configurable: true,
    value: { setActionHandler: vi.fn(), metadata: null, playbackState: "none" },
  });
});

const track = (id: string, url: string): Track => ({
  id,
  name: `Track ${id}`,
  playableUrl: url,
  url,
  source: "youtube",
  artistName: "Artist",
  eraName: "Era",
});

function Helper() {
  const { playTrack } = usePlayer();
  return <button onClick={() => playTrack(track("1", "https://x.com/1.mp3"))}>play</button>;
}

function wrap(ui: React.ReactNode) {
  return <PlayerProvider>{ui}</PlayerProvider>;
}

describe("GlobalPlayer", () => {
  it("renders nothing when no current track", () => {
    const { container } = render(wrap(<GlobalPlayer />));
    // No audio controls visible without a track
    expect(container.firstChild).toBeNull();
  });

  it("renders player UI when a track is playing", async () => {
    render(
      wrap(
        <>
          <Helper />
          <GlobalPlayer />
        </>
      )
    );
    act(() => screen.getByText("play").click());
    await new Promise((r) => setTimeout(r, 50));
    expect(screen.getByLabelText("Close player")).toBeInTheDocument();
  });

  it("closes player", () => {
    render(
      wrap(
        <>
          <Helper />
          <GlobalPlayer />
        </>
      )
    );
    act(() => screen.getByText("play").click());
    const close = screen.getByLabelText("Close player");
    fireEvent.click(close);
    expect(screen.queryByLabelText("Close player")).toBeNull();
  });
});
