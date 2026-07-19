import { describe, it, expect, vi, beforeAll } from "vitest";
import { render, screen, fireEvent, act, within } from "@testing-library/react";
import { PlayerProvider, usePlayer } from "@/src/providers";
import { SettingsProvider } from "@/src/hooks/use-settings";
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
  const { playTrack, addToQueue } = usePlayer();
  return (
    <>
      <button onClick={() => playTrack(track("1", "https://x.com/1.mp3"))}>play</button>
      <button onClick={() => addToQueue(track("2", "https://x.com/2.mp3"))}>queue2</button>
      <button onClick={() => addToQueue(track("3", "https://x.com/3.mp3"))}>queue3</button>
    </>
  );
}

function wrap(ui: React.ReactNode) {
  return (
    <SettingsProvider>
      <PlayerProvider>{ui}</PlayerProvider>
    </SettingsProvider>
  );
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

  it("opens the queue modal and plays a track from the queue", async () => {
    render(
      wrap(
        <>
          <Helper />
          <GlobalPlayer />
        </>
      )
    );
    act(() => screen.getByText("play").click());
    act(() => screen.getByText("queue2").click());
    act(() => screen.getByText("queue3").click());
    fireEvent.click(screen.getByLabelText("Queue"));
    expect(screen.getByLabelText("Close queue")).toBeInTheDocument();
    expect(screen.getByText("Track 2")).toBeInTheDocument();
    const row = screen.getByText("Track 2").closest("div[draggable]") as HTMLElement;
    const playBtn = within(row).getAllByRole("button")[0];
    fireEvent.click(playBtn);
    expect(screen.queryByLabelText("Close queue")).toBeNull();
  });

  it("removes a track from the queue", async () => {
    render(
      wrap(
        <>
          <Helper />
          <GlobalPlayer />
        </>
      )
    );
    act(() => screen.getByText("play").click());
    act(() => screen.getByText("queue2").click());
    fireEvent.click(screen.getByLabelText("Queue"));
    const row = screen.getByText("Track 2").closest("div[draggable]") as HTMLElement;
    const removeBtn = within(row).getAllByRole("button")[1];
    fireEvent.click(removeBtn);
    expect(screen.queryByText("Track 2")).toBeNull();
  });

  it("toggles the lyrics panel", async () => {
    render(
      wrap(
        <>
          <Helper />
          <GlobalPlayer />
        </>
      )
    );
    act(() => screen.getByText("play").click());
    const lyricsBtn = screen.getByLabelText("Lyrics");
    fireEvent.click(lyricsBtn);
    expect(screen.getByText("Lyrics")).toBeInTheDocument();
  });

  it("toggles shuffle and repeat", async () => {
    render(
      wrap(
        <>
          <Helper />
          <GlobalPlayer />
        </>
      )
    );
    act(() => screen.getByText("play").click());
    fireEvent.click(screen.getByLabelText("Shuffle"));
    fireEvent.click(screen.getByLabelText(/Repeat/));
    fireEvent.click(screen.getByLabelText(/Repeat/));
    expect(screen.getByLabelText(/Repeat/)).toBeInTheDocument();
  });
});
