// app/components/Player.tsx
"use client";

import { usePlayer } from "@/app/providers";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Play, Pause, SkipBack, SkipForward, Volume2, VolumeX, X, ListMusic } from "lucide-react";
import { useState, useCallback, memo } from "react";

function formatTime(seconds: number): string {
  if (!seconds || !isFinite(seconds)) return "0:00";
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

const Player = memo(function Player() {
  const { state, togglePlayPause, seekTo, setVolume, playNext, playPrevious, closePlayer, history } = usePlayer();
  const [showQueue, setShowQueue] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [prevVolume, setPrevVolume] = useState(1);

  const handleVolumeToggle = useCallback(() => {
    if (isMuted) {
      setVolume(prevVolume);
      setIsMuted(false);
    } else {
      setPrevVolume(state.volume);
      setVolume(0);
      setIsMuted(true);
    }
  }, [isMuted, prevVolume, setVolume, state.volume]);

  const handleVolumeChange = useCallback((value: number[]) => {
    const vol = value[0];
    setVolume(vol);
    setIsMuted(vol === 0);
  }, [setVolume]);

  const handleSeek = useCallback((value: number[]) => {
    seekTo(value[0]);
  }, [seekTo]);

  if (!state.currentTrack) return null;

  const canPlayPrevious = history.length >= 2;
  const canPlayNext = state.queue.length > 0;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 bg-neutral-950/95 backdrop-blur-lg border-t border-neutral-800">
      <div className="max-w-7xl mx-auto px-4 py-3">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            {state.currentTrack.eraImage ? (
              <img
                src={state.currentTrack.eraImage}
                alt={state.currentTrack.eraName || "Album art"}
                className="w-14 h-14 rounded-lg object-cover bg-neutral-800 flex-shrink-0"
              />
            ) : (
              <div className="w-14 h-14 rounded-lg bg-neutral-800 flex-shrink-0" />
            )}
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-white truncate">{state.currentTrack.name}</p>
              <p className="text-xs text-neutral-400 truncate">
                {state.currentTrack.artistName || state.currentTrack.eraName || "Unknown Artist"}
                {state.currentTrack.eraName && state.currentTrack.artistName && ` • ${state.currentTrack.eraName}`}
              </p>
            </div>
          </div>

          <div className="flex flex-col items-center gap-1 flex-1">
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={playPrevious}
                disabled={!canPlayPrevious}
                className="text-neutral-400 hover:text-white disabled:opacity-30 h-8 w-8"
              >
                <SkipBack className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={togglePlayPause}
                className="bg-white text-black hover:bg-neutral-200 rounded-full h-10 w-10"
              >
                {state.isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-0.5" />}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={playNext}
                disabled={!canPlayNext}
                className="text-neutral-400 hover:text-white disabled:opacity-30 h-8 w-8"
              >
                <SkipForward className="w-4 h-4" />
              </Button>
            </div>
            <div className="flex items-center gap-2 w-full max-w-md">
              <span className="text-xs text-neutral-500 w-10 text-right">{formatTime(state.currentTime)}</span>
              <Slider
                value={[state.currentTime]}
                max={state.duration || 100}
                step={1}
                onValueChange={handleSeek}
                className="flex-1"
              />
              <span className="text-xs text-neutral-500 w-10">{formatTime(state.duration)}</span>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-1 justify-end">
            <div className="hidden sm:flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={handleVolumeToggle}
                className="text-neutral-400 hover:text-white h-8 w-8"
              >
                {isMuted || state.volume === 0 ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
              </Button>
              <Slider
                value={[isMuted ? 0 : state.volume]}
                max={1}
                step={0.01}
                onValueChange={handleVolumeChange}
                className="w-24"
              />
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowQueue(!showQueue)}
              className={`text-neutral-400 hover:text-white h-8 w-8 ${state.queue.length > 0 ? "text-white" : ""}`}
            >
              <ListMusic className="w-4 h-4" />
              {state.queue.length > 0 && (
                <span className="absolute -top-1 -right-1 bg-white text-black text-xs rounded-full w-4 h-4 flex items-center justify-center">
                  {state.queue.length}
                </span>
              )}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={closePlayer}
              className="text-neutral-400 hover:text-white h-8 w-8"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>

      {showQueue && state.queue.length > 0 && (
        <div className="absolute bottom-full left-0 right-0 bg-neutral-950/95 backdrop-blur-lg border-t border-neutral-800 max-h-64 overflow-y-auto">
          <div className="max-w-7xl mx-auto px-4 py-3">
            <h4 className="text-sm font-semibold text-neutral-300 mb-2">Up Next ({state.queue.length})</h4>
            <div className="space-y-2">
              {state.queue.map((track, i) => (
                <div key={`${track.id}-${i}`} className="flex items-center gap-3 p-2 rounded-lg hover:bg-white/5">
                  {track.eraImage ? (
                    <img src={track.eraImage} alt="" className="w-10 h-10 rounded object-cover bg-neutral-800" />
                  ) : (
                    <div className="w-10 h-10 rounded bg-neutral-800" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-white truncate">{track.name}</p>
                    <p className="text-xs text-neutral-500 truncate">{track.eraName}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
});

export default Player;
