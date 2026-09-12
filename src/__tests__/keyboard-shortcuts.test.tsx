import { describe, it, expect, vi, beforeAll } from "vitest";
import { renderHook, act, render, screen } from "@testing-library/react";
import { PlayerProvider, usePlayer } from "@/src/providers";
import { KeyboardShortcuts } from "@/components/keyboard-shortcuts";
import type { Track } from "@/src/types";
beforeAll(() => {
  window.HTMLMediaElement.prototype.play = vi.fn().mockResolvedValue(undefined);
  window.HTMLMediaElement.prototype.pause = vi.fn();
  Object.defineProperty(window, "mediaSession", { configurable: true, value: { setActionHandler: vi.fn() } });
  HTMLDialogElement.prototype.showModal = vi.fn(function (this: HTMLDialogElement) {
    Object.defineProperty(this, "open", { value: true, configurable: true });
  });
  HTMLDialogElement.prototype.close = vi.fn(function (this: HTMLDialogElement) {
    Object.defineProperty(this, "open", { value: false, configurable: true });
  });
});
const track = (id: string, url: string): Track => ({
  id,
  name: id,
  extra: "",
  playableUrl: url,
  url,
  source: "youtube",
  artistName: "A",
  eraName: "E",
});
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
  it("ignores keys when a select is focused", () => {
    const { result } = setup();
    act(() => result.current.playTrack(track("1", "https://x.com/1.mp3")));
    const select = document.createElement("select");
    document.body.appendChild(select);
    select.focus();
    act(() => select.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true })));
    expect(result.current.state.volume).toBe(1);
  });
  it("ignores shortcut combos with ctrl/meta/alt modifiers", () => {
    const { result } = setup();
    act(() => result.current.playTrack(track("1", "https://x.com/1.mp3")));
    act(() => window.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowLeft", ctrlKey: true })));
    act(() => window.dispatchEvent(new KeyboardEvent("keydown", { key: "n", metaKey: true })));
    act(() => window.dispatchEvent(new KeyboardEvent("keydown", { key: " ", altKey: true })));
    expect(result.current.state.isPlaying).toBe(true);
  });
  it("lets space activate a focused button instead of toggling play", () => {
    const { result } = setup();
    act(() => result.current.playTrack(track("1", "https://x.com/1.mp3")));
    const button = document.createElement("button");
    document.body.appendChild(button);
    button.focus();
    act(() => button.dispatchEvent(new KeyboardEvent("keydown", { key: " ", bubbles: true })));
    expect(result.current.state.isPlaying).toBe(true);
  });
  it("/ focuses the global search input", () => {
    render(
      <PlayerProvider>
        <KeyboardShortcuts />
      </PlayerProvider>
    );
    const input = document.createElement("input");
    input.setAttribute("data-global-search", "1");
    document.body.appendChild(input);
    act(() => window.dispatchEvent(new KeyboardEvent("keydown", { key: "/" })));
    expect(document.activeElement).toBe(input);
    input.remove();
  });
  it("? opens the shortcuts help overlay and Escape closes it", () => {
    render(
      <PlayerProvider>
        <KeyboardShortcuts />
      </PlayerProvider>
    );
    expect(screen.queryByText("Keyboard Shortcuts")).toBeNull();
    act(() => window.dispatchEvent(new KeyboardEvent("keydown", { key: "?" })));
    expect(screen.getByText("Keyboard Shortcuts")).toBeInTheDocument();
    act(() => window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" })));
    expect(screen.queryByText("Keyboard Shortcuts")).toBeNull();
  });
});
