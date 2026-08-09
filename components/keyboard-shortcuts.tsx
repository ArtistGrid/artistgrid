import { useEffect, useRef } from "react";
import { usePlayer } from "@/src/providers";
import { usePlayerTime } from "@/src/lib/player-time";

const SEEK_STEP = 5;
const VOLUME_STEP = 0.05;

export function KeyboardShortcuts() {
  const { state, togglePlayPause, seekTo, setVolume, playNext, playPrevious } = usePlayer();
  const { currentTime } = usePlayerTime();
  const currentTimeRef = useRef(currentTime);
  currentTimeRef.current = currentTime;
  const stateRef = useRef(state);
  stateRef.current = state;

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || (e.target as HTMLElement).isContentEditable) return;
      const s = stateRef.current;
      const t = currentTimeRef.current;

      switch (e.key) {
        case " ":
          e.preventDefault();
          togglePlayPause();
          break;
        case "ArrowLeft":
          e.preventDefault();
          if (s.currentTrack) seekTo(t - SEEK_STEP);
          break;
        case "ArrowRight":
          e.preventDefault();
          if (s.currentTrack) seekTo(t + SEEK_STEP);
          break;
        case "ArrowUp":
          e.preventDefault();
          setVolume(Math.min(1, s.volume + VOLUME_STEP));
          break;
        case "ArrowDown":
          e.preventDefault();
          setVolume(Math.max(0, s.volume - VOLUME_STEP));
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
          setVolume(s.volume > 0 ? 0 : 1);
          break;
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [togglePlayPause, seekTo, setVolume, playNext, playPrevious]);

  return null;
}
