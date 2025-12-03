// components/global-player.tsx
"use client";

import { memo, useCallback } from "react";
import { usePlayer } from "@/app/providers";
import { Button } from "@/components/ui/button";
import { X, SkipBack, SkipForward, Play, Pause, Volume2, ListMusic } from "lucide-react";

function formatTime(seconds: number): string {
  if (!seconds || isNaN(seconds)) return "0:00";
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

export const GlobalPlayer = memo(function GlobalPlayer() {
  const { state, togglePlayPause, seekTo, setVolume, playNext, playPrevious, clearQueue } = usePlayer();

  const handleProgressClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const percent = (e.clientX - rect.left) / rect.width;
    seekTo(percent * state.duration);
  }, [seekTo, state.duration]);

  const handleClose = useCallback(() => {
    clearQueue();
  }, [clearQueue]);

  if (!state.currentTrack) return null;

  const progress = state.duration ? (state.currentTime / state.duration) * 100 : 0;

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-neutral-950/95 backdrop-blur-xl border-t border-neutral-800 z-50 p-3">
      <div className="max-w-7xl mx-auto flex items-center gap-4">
        <div className="min-w-[150px] max-w-[250px]">
          <div className="font-semibold text-white text-sm truncate">{state.currentTrack.name}</div>
          <div className="text-xs text-neutral-500 truncate">{state.currentTrack.extra}</div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={playPrevious} className="text-white hover:bg-white/10 rounded-full w-10 h-10">
            <SkipBack className="w-5 h-5" />
          </Button>
          <Button variant="ghost" size="icon" onClick={togglePlayPause} className="bg-white text-black hover:bg-neutral-200 rounded-full w-11 h-11">
            {state.isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-0.5" />}
          </Button>
          <Button variant="ghost" size="icon" onClick={playNext} className="text-white hover:bg-white/10 rounded-full w-10 h-10">
            <SkipForward className="w-5 h-5" />
          </Button>
        </div>
        <div className="flex-1 flex items-center gap-3">
          <span className="text-xs text-neutral-500 min-w-[40px] tabular-nums">{formatTime(state.currentTime)}</span>
          <div className="flex-1 h-1 bg-neutral-800 rounded cursor-pointer group" onClick={handleProgressClick}>
            <div className="h-full bg-white rounded transition-all" style={{ width: `${progress}%` }} />
          </div>
          <span className="text-xs text-neutral-500 min-w-[40px] tabular-nums">{formatTime(state.duration)}</span>
        </div>
        <div className="hidden md:flex items-center gap-2">
          <Volume2 className="w-4 h-4 text-neutral-400" />
          <input type="range" min="0" max="1" step="0.1" value={state.volume} onChange={(e) => setVolume(parseFloat(e.target.value))} className="w-20 h-1 bg-neutral-800 rounded cursor-pointer accent-white" />
        </div>
        {state.queue.length > 0 && (
          <div className="flex items-center gap-1 text-neutral-400">
            <ListMusic className="w-4 h-4" />
            <span className="text-xs">{state.queue.length}</span>
          </div>
        )}
        <Button variant="ghost" size="icon" onClick={handleClose} className="text-neutral-500 hover:text-white hover:bg-white/10 rounded-lg w-9 h-9">
          <X className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
});
