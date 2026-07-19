import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { PlayerProvider, usePlayer } from "@/src/providers";
import type { Track } from "@/src/types";

beforeAll(() => {
  // jsdom has no HTMLMediaElement playback
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

function setup() {
  return renderHook(() => usePlayer(), {
    wrapper: ({ children }: { children: React.ReactNode }) => <PlayerProvider>{children}</PlayerProvider>,
  });
}

describe("PlayerProvider", () => {
  beforeEach(() => localStorage.clear());

  it("plays a track and sets currentTrack", () => {
    const { result } = setup();
    act(() => result.current.playTrack(track("1", "https://x.com/1.mp3")));
    expect(result.current.state.currentTrack?.id).toBe("1");
    expect(result.current.state.isPlaying).toBe(true);
  });

  it("adds to queue", () => {
    const { result } = setup();
    act(() => result.current.playTrack(track("1", "https://x.com/1.mp3")));
    act(() => result.current.addToQueue(track("2", "https://x.com/2.mp3")));
    expect(result.current.state.queue).toHaveLength(1);
    expect(result.current.state.queue[0].id).toBe("2");
  });

  it("removes from queue", () => {
    const { result } = setup();
    act(() => result.current.playTrack(track("1", "https://x.com/1.mp3")));
    act(() => result.current.addToQueue(track("2", "https://x.com/2.mp3")));
    act(() => result.current.removeFromQueue(0));
    expect(result.current.state.queue).toHaveLength(0);
  });

  it("clears queue", () => {
    const { result } = setup();
    act(() => result.current.playTrack(track("1", "https://x.com/1.mp3")));
    act(() => result.current.addToQueue(track("2", "https://x.com/2.mp3")));
    act(() => result.current.clearQueue());
    expect(result.current.state.queue).toHaveLength(0);
  });

  it("toggles shuffle", () => {
    const { result } = setup();
    const before = result.current.state.isShuffled;
    act(() => result.current.toggleShuffle());
    expect(result.current.state.isShuffled).toBe(!before);
  });

  it("cycles repeat mode", () => {
    const { result } = setup();
    act(() => result.current.toggleRepeat());
    expect(result.current.state.repeatMode).toBe("all");
    act(() => result.current.toggleRepeat());
    expect(result.current.state.repeatMode).toBe("one");
    act(() => result.current.toggleRepeat());
    expect(result.current.state.repeatMode).toBe("off");
  });

  it("reorders queue", () => {
    const { result } = setup();
    act(() => result.current.playTrack(track("1", "https://x.com/1.mp3")));
    act(() => result.current.addToQueue(track("2", "https://x.com/2.mp3")));
    act(() => result.current.addToQueue(track("3", "https://x.com/3.mp3")));
    act(() => result.current.reorderQueue(0, 2));
    expect(result.current.state.queue.map((t) => t.id)).toEqual(["3", "2"]);
  });

  it("plays from queue", () => {
    const { result } = setup();
    act(() => result.current.playTrack(track("1", "https://x.com/1.mp3")));
    act(() => result.current.addToQueue(track("2", "https://x.com/2.mp3")));
    act(() => result.current.playFromQueue(0));
    expect(result.current.state.currentTrack?.id).toBe("2");
  });

  it("seekTo and setVolume update state", () => {
    const { result } = setup();
    act(() => result.current.seekTo(30));
    act(() => result.current.setVolume(0.5));
    expect(result.current.state.volume).toBe(0.5);
  });

  it("togglePlayPause triggers audio control", () => {
    const { result } = setup();
    act(() => result.current.playTrack(track("1", "https://x.com/1.mp3")));
    const playSpy = vi.spyOn(window.HTMLMediaElement.prototype, "play");
    act(() => result.current.togglePlayPause());
    expect(playSpy).toHaveBeenCalled();
  });
});
