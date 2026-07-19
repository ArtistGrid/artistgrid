import { describe, it, expect, vi, beforeAll } from "vitest";
import { render, screen, act } from "@testing-library/react";
import { PlayerProvider, usePlayer } from "@/src/providers";
import { SettingsProvider } from "@/src/hooks/use-settings";
import { LyricsPanel } from "@/src/components/lyrics-panel";
import type { Track } from "@/src/types";

beforeAll(() => {
  window.HTMLMediaElement.prototype.play = vi.fn().mockResolvedValue(undefined);
  window.HTMLMediaElement.prototype.pause = vi.fn();
  Object.defineProperty(window, "mediaSession", { configurable: true, value: { setActionHandler: vi.fn() } });
  globalThis.fetch = vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => ({ syncedLyrics: "[00:01.00] hi" }),
  }) as unknown as typeof fetch;
});

const track = (id: string, url: string): Track => ({ id, name: id, playableUrl: url, url, source: "youtube", artistName: "A", eraName: "E" });

function Helper() {
  const { playTrack } = usePlayer();
  return <button onClick={() => playTrack(track("1", "https://x.com/1.mp3"))}>play</button>;
}

describe("LyricsPanel", () => {
  it("renders without crashing when a track is playing", async () => {
    render(
      <SettingsProvider>
        <PlayerProvider>
          <Helper />
          <LyricsPanel />
        </PlayerProvider>
      </SettingsProvider>
    );
    act(() => screen.getByText("play").click());
    // allow effects to run
    await new Promise((r) => setTimeout(r, 50));
    expect(screen.getByText("play")).toBeInTheDocument();
  });
});
