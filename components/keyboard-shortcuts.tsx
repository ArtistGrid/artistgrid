import { useEffect } from "react";
import { usePlayer } from "@/src/providers";

const SEEK_STEP = 5;
const VOLUME_STEP = 0.05;

export function KeyboardShortcuts() {
  const { state, togglePlayPause, seekTo, setVolume, playNext, playPrevious } = usePlayer();

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || (e.target as HTMLElement).isContentEditable) return;

      switch (e.key) {
        case " ":
          e.preventDefault();
          togglePlayPause();
          break;
        case "ArrowLeft":
          e.preventDefault();
          if (state.currentTrack) seekTo(state.currentTime - SEEK_STEP);
          break;
        case "ArrowRight":
          e.preventDefault();
          if (state.currentTrack) seekTo(state.currentTime + SEEK_STEP);
          break;
        case "ArrowUp":
          e.preventDefault();
          setVolume(Math.min(1, state.volume + VOLUME_STEP));
          break;
        case "ArrowDown":
          e.preventDefault();
          setVolume(Math.max(0, state.volume - VOLUME_STEP));
          break;
        case "n":
        case "N":
          playNext();
          break;
        case "p":
        case "P":
          playPrevious();
          break;
        case "m":
        case "M":
          setVolume(state.volume > 0 ? 0 : 1);
          break;
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [state.currentTime, state.currentTrack, state.volume, togglePlayPause, seekTo, setVolume, playNext, playPrevious]);

  return null;
}
