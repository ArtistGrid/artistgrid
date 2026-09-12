import { describe, it, expect, vi, beforeAll } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { PlayerProvider, usePlayer } from "@/src/providers";
import type { Track } from "@/src/types";
beforeAll(() => {
  window.HTMLMediaElement.prototype.play = vi.fn().mockResolvedValue(undefined);
  window.HTMLMediaElement.prototype.pause = vi.fn();
  window.HTMLMediaElement.prototype.load = vi.fn();
  Object.defineProperty(window, "mediaSession", {
    configurable: true,
    value: { setActionHandler: vi.fn() },
  });
});
const track = (id: string, url: string): Track => ({
  id,
  name: id,
  extra: "",
  playableUrl: url,
  url,
  source: "pillows",
  artistName: "A",
  eraName: "E",
});
describe("player volume persistence and queueNext", () => {
  it("starts with persisted volume on mount", () => {
    localStorage.setItem("artistgrid-volume:v1", "0.25");
    const { result } = renderHook(() => usePlayer(), { wrapper: PlayerProvider });
    expect(result.current.state.volume).toBe(0.25);
  });
  it("clamps out-of-range persisted volumes", () => {
    localStorage.setItem("artistgrid-volume:v1", "7");
    const { result } = renderHook(() => usePlayer(), { wrapper: PlayerProvider });
    expect(result.current.state.volume).toBe(1);
    localStorage.setItem("artistgrid-volume:v1", "-3");
    const { result: r2 } = renderHook(() => usePlayer(), { wrapper: PlayerProvider });
    expect(r2.current.state.volume).toBe(0);
  });
  it("persists volume changes to localStorage", () => {
    const { result } = renderHook(() => usePlayer(), { wrapper: PlayerProvider });
    act(() => result.current.setVolume(0.4));
    expect(localStorage.getItem("artistgrid-volume:v1")).toBe("0.4");
  });
  it("clamps setVolume input", () => {
    const { result } = renderHook(() => usePlayer(), { wrapper: PlayerProvider });
    act(() => result.current.setVolume(2));
    expect(result.current.state.volume).toBe(1);
    act(() => result.current.setVolume(-1));
    expect(result.current.state.volume).toBe(0);
  });
  it("queueNext inserts at the front of the queue", () => {
    const { result } = renderHook(() => usePlayer(), { wrapper: PlayerProvider });
    act(() => result.current.playTrack(track("current", "https://x.com/c.mp3")));
    act(() => result.current.addToQueue(track("last", "https://x.com/l.mp3")));
    act(() => result.current.queueNext(track("next", "https://x.com/n.mp3")));
    expect(result.current.state.queue.map((t) => t.id)).toEqual(["next", "last"]);
  });
});
