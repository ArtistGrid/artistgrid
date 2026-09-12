import { useEffect, useRef, useState } from "react";
import { usePlayer } from "@/src/providers";
import { usePlayerTime } from "@/src/lib/player-time";
import { Modal } from "@/src/components/modal";
const SEEK_STEP = 5;
const VOLUME_STEP = 0.05;
const SHORTCUTS: Array<{
  keys: string;
  action: string;
}> = [
  { keys: "Space", action: "Play / pause" },
  { keys: "← / →", action: "Seek 5 seconds" },
  { keys: "↑ / ↓", action: "Volume up / down" },
  { keys: "N / P", action: "Next / previous track" },
  { keys: "M", action: "Mute / unmute" },
  { keys: "/", action: "Focus search box" },
  { keys: "?", action: "Show this help" },
  { keys: "Alt + ↑ / ↓", action: "Reorder queue (queue open)" },
];
function focusGlobalSearch(): boolean {
  const input = document.querySelector<HTMLInputElement>('input[data-global-search="1"]');
  if (!input) return false;
  input.focus();
  input.select();
  return true;
}
function ShortcutHelpModal({ onClose }: { onClose: () => void }) {
  return (
    <Modal isOpen onClose={onClose} ariaLabel="Keyboard shortcuts">
      <div className="p-6 pt-12">
        <h2 className="text-lg font-bold text-white mb-4">Keyboard Shortcuts</h2>
        <div className="space-y-2">
          {SHORTCUTS.map(({ keys, action }) => (
            <div key={keys} className="flex items-center justify-between gap-4 text-sm">
              <span className="text-neutral-300">{action}</span>
              <kbd className="flex-shrink-0 rounded-md border border-white/15 bg-white/[0.06] px-2 py-0.5 text-xs font-mono text-white/80">
                {keys}
              </kbd>
            </div>
          ))}
        </div>
      </div>
    </Modal>
  );
}
export function KeyboardShortcuts() {
  const { state, togglePlayPause, seekTo, setVolume, playNext, playPrevious } = usePlayer();
  const { currentTime } = usePlayerTime();
  const [helpOpen, setHelpOpen] = useState(false);
  const currentTimeRef = useRef(currentTime);
  currentTimeRef.current = currentTime;
  const stateRef = useRef(state);
  stateRef.current = state;
  const helpOpenRef = useRef(helpOpen);
  helpOpenRef.current = helpOpen;
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const tag = target.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || target.isContentEditable) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const s = stateRef.current;
      const t = currentTimeRef.current;
      switch (e.key) {
        case " ":
          if (tag === "BUTTON") return;
          e.preventDefault();
          togglePlayPause();
          break;
        case "/":
          e.preventDefault();
          focusGlobalSearch();
          break;
        case "?":
          e.preventDefault();
          setHelpOpen((open) => !open);
          break;
        case "Escape":
          if (helpOpenRef.current) setHelpOpen(false);
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
  return <>{helpOpen && <ShortcutHelpModal onClose={() => setHelpOpen(false)} />}</>;
}
