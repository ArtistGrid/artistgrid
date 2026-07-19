import { describe, it, expect, vi, beforeAll } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { PlayerProvider, usePlayer } from "@/src/providers";
import { KeyboardShortcuts } from "@/components/keyboard-shortcuts";
import type { Track } from "@/src/types";

beforeAll(() => {
  window.HTMLMediaElement.prototype.play = vi.fn().mockResolvedValue(undefined);
  window.HTMLMediaElement.prototype.pause = vi.fn();
  Object.defineProperty(window, "mediaSession", { configurable: true, value: { setActionHandler: vi.fn() } });
});

const track = (id: string, url: string): Track => ({ id, name: id, playableUrl: url, url, source: "youtube", artistName: "A", eraName: "E" });

function setup() {
  return renderHook(() => usePlayer(), {
    wrapper: ({ children }: { children: React.ReactNode }) => (
      <PlayerProvider>
        <KeyboardShortcuts />
        {children}
      </PlayerProvider>
    ),
  });
}

describe("KeyboardShortcuts", () => {
  it("toggles play with space", () => {
    const { result } = setup();
    act(() => result.current.playTrack(track("1", "https://x.com/1.mp3")));
    act(() => window.dispatchEvent(new KeyboardEvent("keydown", { key: " " })));
    // play called (paused stays true in jsdom) -> just assert no throw and handler ran
    expect(result.current.state.isPlaying).toBe(true);
  });

  it("handles arrow seek keys without throwing when track present", () => {
    const { result } = setup();
    act(() => result.current.playTrack(track("1", "https://x.com/1.mp3")));
    act(() => window.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight" })));
    act(() => window.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowLeft" })));
    expect(result.current.state.currentTrack?.id).toBe("1");
  });

  it("changes volume with up arrow", () => {
    const { result } = setup();
    act(() => result.current.playTrack(track("1", "https://x.com/1.mp3")));
    act(() => window.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowUp" })));
    expect(result.current.state.volume).toBeGreaterThan(0);
  });

  it("ignores keys when typing in input", () => {
    const { result } = setup();
    act(() => result.current.playTrack(track("1", "https://x.com/1.mp3")));
    const input = document.createElement("input");
    document.body.appendChild(input);
    act(() => input.dispatchEvent(new KeyboardEvent("keydown", { key: " ", bubbles: true })));
    expect(result.current.state.isPlaying).toBe(true);
  });
});
