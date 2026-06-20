import { memo, useCallback, useState } from "react";
import { usePlayer } from "@/src/providers";
import type { Track } from "@/src/types";
import { Button } from "@/components/ui/button";
import {
  X,
  SkipBack,
  SkipForward,
  Play,
  Pause,
  Volume2,
  VolumeX,
  ListMusic,
  Shuffle,
  GripVertical,
  Trash2,
  CircleSlash,
} from "lucide-react";
interface QueueModalProps {
  isOpen: boolean;
  onClose: () => void;
  queue: Track[];
  currentTrack: Track | null;
  onReorder: (fromIndex: number, toIndex: number) => void;
  onRemove: (index: number) => void;
  onPlayFromQueue: (index: number) => void;
}
function formatTime(seconds: number): string {
  if (!seconds || isNaN(seconds)) return "0:00";
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}
const QueueModal = ({
  isOpen,
  onClose,
  queue,
  currentTrack,
  onReorder,
  onRemove,
  onPlayFromQueue,
}: QueueModalProps) => {
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = "move";
  };
  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    setDragOverIndex(index);
  };
  const handleDragEnd = () => {
    if (draggedIndex !== null && dragOverIndex !== null && draggedIndex !== dragOverIndex) {
      onReorder(draggedIndex, dragOverIndex);
    }
    setDraggedIndex(null);
    setDragOverIndex(null);
  };
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-4 pb-36 sm:pb-4">
      <button
        type="button"
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
        aria-label="Close queue"
        tabIndex={-1}
      />
      <div className="relative z-10 bg-neutral-950 border border-neutral-800 shadow-2xl rounded-2xl w-full max-w-md animate-in fade-in-0 slide-in-from-bottom-4 sm:zoom-in-95 duration-200">
        <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-neutral-800">
          <div className="flex items-center gap-2.5">
            <ListMusic className="w-5 h-5 text-neutral-400" />
            <h2 className="text-base font-semibold text-white">Queue</h2>
            <span className="text-xs text-neutral-500 bg-neutral-800 px-2 py-0.5 rounded-full">{queue.length}</span>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="text-neutral-500 hover:text-white h-8 w-8 rounded-lg"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
        <div className="p-4 max-h-[60vh] overflow-y-auto">
          {currentTrack && (
            <div className="mb-4">
              <p className="text-[10px] font-medium text-neutral-500 uppercase tracking-widest mb-2">Now Playing</p>
              <div className="flex items-center gap-3 p-3 bg-white/5 rounded-xl border border-white/10">
                {currentTrack.eraImage ? (
                  <img
                    src={currentTrack.eraImage}
                    alt=""
                    className="w-10 h-10 rounded-lg object-cover flex-shrink-0"
                    referrerPolicy="no-referrer"
                    crossOrigin="anonymous"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-lg bg-neutral-800 flex-shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate">{currentTrack.name}</p>
                  <p className="text-xs text-neutral-400 truncate">{currentTrack.artistName}</p>
                </div>
              </div>
            </div>
          )}
          {queue.length === 0 ? (
            <div className="text-center py-10">
              <CircleSlash className="w-10 h-10 text-neutral-700 mx-auto mb-3" />
              <p className="text-sm text-neutral-500">Nothing queued up</p>
            </div>
          ) : (
            <div className="space-y-0.5">
              <p className="text-[10px] font-medium text-neutral-500 uppercase tracking-widest mb-2">Up Next</p>
              {queue.map((track, index) => (
                <div
                  key={`${track.id}-${index}`}
                  draggable
                  onDragStart={(e) => handleDragStart(e, index)}
                  onDragOver={(e) => handleDragOver(e, index)}
                  onDragEnd={handleDragEnd}
                  className={`flex items-center gap-2 p-2 rounded-lg transition-colors cursor-grab active:cursor-grabbing ${draggedIndex === index ? "opacity-40" : ""} ${dragOverIndex === index && draggedIndex !== index ? "bg-white/10" : "hover:bg-white/5"}`}
                >
                  <GripVertical className="w-4 h-4 text-neutral-700 flex-shrink-0" />
                  <span className="text-xs text-neutral-600 w-5 text-center flex-shrink-0">{index + 1}</span>
                  {track.eraImage ? (
                    <img
                      src={track.eraImage}
                      alt=""
                      className="w-8 h-8 rounded object-cover flex-shrink-0"
                      referrerPolicy="no-referrer"
                      crossOrigin="anonymous"
                    />
                  ) : (
                    <div className="w-8 h-8 rounded bg-neutral-800 flex-shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white truncate">{track.name}</p>
                    <p className="text-xs text-neutral-500 truncate">{track.artistName}</p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      onPlayFromQueue(index);
                      onClose();
                    }}
                    className="h-7 w-7 text-neutral-500 hover:text-white flex-shrink-0"
                  >
                    <Play className="w-3 h-3" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => onRemove(index)}
                    className="h-7 w-7 text-neutral-500 hover:text-red-400 flex-shrink-0"
                  >
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
export const GlobalPlayer = memo(function GlobalPlayer() {
  const {
    state,
    togglePlayPause,
    seekTo,
    setVolume,
    playNext,
    playPrevious,
    clearQueue,
    removeFromQueue,
    reorderQueue,
    playFromQueue,
    toggleShuffle,
  } = usePlayer();
  const [queueModalOpen, setQueueModalOpen] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [prevVolume, setPrevVolume] = useState(state.volume);
  const handleProgressClick = useCallback(
    (e: React.MouseEvent<HTMLElement>) => {
      const rect = e.currentTarget.getBoundingClientRect();
      const percent = (e.clientX - rect.left) / rect.width;
      seekTo(percent * state.duration);
    },
    [seekTo, state.duration]
  );
  const handleVolumeToggle = useCallback(() => {
    if (isMuted) {
      setVolume(prevVolume || 0.7);
      setIsMuted(false);
    } else {
      setPrevVolume(state.volume);
      setVolume(0);
      setIsMuted(true);
    }
  }, [isMuted, prevVolume, state.volume, setVolume]);
  const handleClose = useCallback(() => {
    clearQueue();
  }, [clearQueue]);
  const handleQueueReorder = useCallback(
    (fromIndex: number, toIndex: number) => {
      reorderQueue(fromIndex, toIndex);
    },
    [reorderQueue]
  );
  const handleQueueRemove = useCallback(
    (index: number) => {
      removeFromQueue(index);
    },
    [removeFromQueue]
  );
  const handlePlayFromQueue = useCallback(
    (index: number) => {
      playFromQueue(index);
    },
    [playFromQueue]
  );
  if (!state.currentTrack) return null;
  const progress = state.duration ? (state.currentTime / state.duration) * 100 : 0;
  return (
    <>
      <div className="fixed bottom-3 left-3 right-3 z-50 sm:bottom-4 sm:left-4 sm:right-4">
        <div className="max-w-screen-xl mx-auto">
          <div className="bg-neutral-900/95 backdrop-blur-2xl border border-white/[0.08] rounded-2xl shadow-2xl shadow-black/60 overflow-hidden">
            {/* Main player row */}
            <div className="flex items-center gap-2 px-3 py-2.5 sm:gap-3 sm:px-4 sm:py-3">
              {/* Track info — takes up flex-1 on mobile, fixed width on desktop */}
              <div className="flex items-center gap-2.5 min-w-0 flex-1 sm:flex-none sm:w-44">
                {state.currentTrack.eraImage ? (
                  <img
                    src={state.currentTrack.eraImage}
                    alt=""
                    className="w-10 h-10 rounded-lg object-cover flex-shrink-0"
                    referrerPolicy="no-referrer"
                    crossOrigin="anonymous"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-lg bg-neutral-800 flex-shrink-0" />
                )}
                <div className="min-w-0">
                  <p className="text-sm font-medium text-white truncate leading-snug">
                    {state.currentTrack.name}
                  </p>
                  <p className="text-xs text-neutral-400 truncate">
                    {state.currentTrack.artistName || state.currentTrack.extra}
                  </p>
                </div>
              </div>

              {/* Playback controls */}
              <div className="flex items-center gap-0.5 flex-shrink-0">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={toggleShuffle}
                  className={`hidden sm:flex hover:bg-white/10 rounded-full w-9 h-9 ${state.isShuffled ? "text-white" : "text-neutral-500 hover:text-white"}`}
                  aria-label="Shuffle"
                  aria-pressed={state.isShuffled}
                >
                  <Shuffle className="w-4 h-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={playPrevious}
                  className="hidden sm:flex text-neutral-400 hover:text-white hover:bg-white/10 rounded-full w-9 h-9"
                >
                  <SkipBack className="w-4 h-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={togglePlayPause}
                  className="bg-white text-black hover:bg-neutral-200 rounded-full w-9 h-9"
                >
                  {state.isPlaying ? (
                    <Pause className="w-4 h-4" />
                  ) : (
                    <Play className="w-4 h-4 ml-0.5" />
                  )}
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={playNext}
                  className="text-neutral-400 hover:text-white hover:bg-white/10 rounded-full w-9 h-9"
                >
                  <SkipForward className="w-4 h-4" />
                </Button>
              </div>

              {/* Progress bar with timestamps — desktop only */}
              <div className="hidden sm:flex flex-1 items-center gap-2 min-w-0">
                <span className="text-xs text-neutral-500 tabular-nums w-8 text-right flex-shrink-0">
                  {formatTime(state.currentTime)}
                </span>
                <button
                  type="button"
                  className="flex-1 h-1 bg-neutral-800 rounded-full cursor-pointer group relative"
                  onClick={handleProgressClick}
                  aria-label="Seek playback position"
                >
                  <div
                    className="absolute inset-y-0 left-0 bg-white/70 rounded-full group-hover:bg-white/90 transition-colors"
                    style={{ width: `${progress}%` }}
                  />
                </button>
                <span className="text-xs text-neutral-500 tabular-nums w-8 flex-shrink-0">
                  {formatTime(state.duration)}
                </span>
              </div>

              {/* Volume — md and up only */}
              <div className="hidden md:flex items-center gap-1.5 flex-shrink-0">
                <button
                  type="button"
                  onClick={handleVolumeToggle}
                  className="text-neutral-500 hover:text-white transition-colors p-1"
                  aria-label="Toggle mute"
                >
                  {state.volume === 0 || isMuted ? (
                    <VolumeX className="w-4 h-4" />
                  ) : (
                    <Volume2 className="w-4 h-4" />
                  )}
                </button>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={isMuted ? 0 : state.volume}
                  onChange={(e) => {
                    const v = parseFloat(e.target.value);
                    setVolume(v);
                    if (v > 0) setIsMuted(false);
                  }}
                  className="w-20 accent-white cursor-pointer"
                  aria-label="Volume"
                />
              </div>

              {/* Queue + close */}
              <div className="flex items-center gap-0.5 flex-shrink-0">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setQueueModalOpen(true)}
                  className={`rounded-lg w-8 h-8 relative ${
                    state.queue.length > 0 ? "text-white" : "text-neutral-500 hover:text-white"
                  } hover:bg-white/10`}
                  aria-label="Queue"
                >
                  <ListMusic className="w-4 h-4" />
                  {state.queue.length > 0 && (
                    <span className="absolute -top-1 -right-1 w-4 h-4 bg-white text-black text-[10px] font-bold rounded-full flex items-center justify-center leading-none">
                      {Math.min(state.queue.length, 99)}
                    </span>
                  )}
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleClose}
                  className="text-neutral-600 hover:text-white hover:bg-white/10 rounded-lg w-8 h-8"
                  aria-label="Close player"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
      <QueueModal
        isOpen={queueModalOpen}
        onClose={() => setQueueModalOpen(false)}
        queue={state.queue}
        currentTrack={state.currentTrack}
        onReorder={handleQueueReorder}
        onRemove={handleQueueRemove}
        onPlayFromQueue={handlePlayFromQueue}
      />
    </>
  );
});
