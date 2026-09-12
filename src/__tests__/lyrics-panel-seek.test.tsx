import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, act, waitFor } from "@testing-library/react";
import { SettingsProvider } from "@/src/hooks/use-settings";
import { LyricsPanel } from "@/src/components/lyrics-panel";
import type { Track } from "@/src/types";
const seekTo = vi.fn();
const currentTrack: Track = {
  id: "t1",
  name: "Song",
  extra: "",
  playableUrl: "https://x.com/1.mp3",
  url: "https://x.com/1.mp3",
  source: "pillows",
  artistName: "Artist",
  eraName: "Era",
};
vi.mock("@/src/providers", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/src/providers")>();
  return {
    ...actual,
    usePlayer: () => ({ state: { currentTrack }, seekTo }),
  };
});
describe("LyricsPanel line-click seeking", () => {
  beforeEach(() => {
    seekTo.mockClear();
  });
  it("seeks the player via the player context when a lyric line is clicked", async () => {
    const { container } = render(
      <SettingsProvider>
        <LyricsPanel />
      </SettingsProvider>
    );
    await waitFor(() => expect(container.querySelector("am-lyrics")).not.toBeNull());
    const el = container.querySelector("am-lyrics")!;
    act(() => {
      el.dispatchEvent(new CustomEvent("line-click", { detail: { timestamp: 12345 } }));
    });
    expect(seekTo).toHaveBeenCalledWith(12.345);
  });
  it("ignores line clicks without a numeric timestamp", async () => {
    const { container } = render(
      <SettingsProvider>
        <LyricsPanel />
      </SettingsProvider>
    );
    await waitFor(() => expect(container.querySelector("am-lyrics")).not.toBeNull());
    const el = container.querySelector("am-lyrics")!;
    act(() => {
      el.dispatchEvent(new CustomEvent("line-click", { detail: {} }));
    });
    expect(seekTo).not.toHaveBeenCalledWith(expect.anything());
    expect(seekTo).toHaveBeenCalledTimes(0);
  });
});
