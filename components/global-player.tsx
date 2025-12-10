"use client";

import { memo, useCallback, useState } from "react";
import { usePlayer } from "@/app/providers";
import { Button } from "@/components/ui/button";
import { X, SkipBack, SkipForward, Play, Pause, Volume2, ListMusic, GripVertical, Trash2, CircleSlash } from "lucide-react";

interface Track {
  id: string;
  name: string;
  extra: string;
  url: string;
  playableUrl: string | null;
  eraImage?: string;
  eraName?: string;
  artistName?: string;
}

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

const QueueModal = ({ isOpen, onClose, queue, currentTrack, onReorder, onRemove, onPlayFromQueue }: QueueModalProps) => {
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
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="bg-neutral-950 border border-neutral-800 shadow-2xl rounded-xl w-full max-w-md relative animate-in fade-in-0 zoom-in-95" onClick={(e) => e.stopPropagation()}>
        <Button variant="ghost" size="icon" onClick={onClose} className="absolute top-3 right-3 text-neutral-500 hover:text-white h-8 w-8 rounded-lg z-10">
          <X className="w-5 h-5" />
        </Button>
        <div className="p-6 pt-12">
          <div className="flex items-center gap-3 mb-6">
            <ListMusic className="w-6 h-6 text-neutral-400" />
            <h2 className="text-xl font-bold text-white">Queue</h2>
            <span className="text-sm text-neutral-500">({queue.length} tracks)</span>
          </div>
          {currentTrack && (
            <div className="mb-6">
              <p className="text-xs text-neutral-500 uppercase tracking-wider mb-2">Now Playing</p>
              <div className="flex items-center gap-3 p-3 bg-white/10 rounded-xl border border-white/20">
                {currentTrack.eraImage ? (
                  <img src={currentTrack.eraImage} alt="" className="w-10 h-10 rounded-lg object-cover" />
                ) : (
                  <div className="w-10 h-10 rounded-lg bg-neutral-800" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate">{currentTrack.name}</p>
                  <p className="text-xs text-neutral-400 truncate">{currentTrack.artistName}</p>
                </div>
              </div>
            </div>
          )}
          {queue.length === 0 ? (
            <div className="text-center py-8">
              <CircleSlash className="w-12 h-12 text-neutral-700 mx-auto mb-3" />
              <p className="text-neutral-500">Queue is empty</p>
            </div>
          ) : (
            <div className="space-y-1 max-h-80 overflow-y-auto">
              <p className="text-xs text-neutral-500 uppercase tracking-wider mb-2">Up Next</p>
              {queue.map((track, index) => (
                <div
                  key={`${track.id}-${index}`}
                  draggable
                  onDragStart={(e) => handleDragStart(e, index)}
                  onDragOver={(e) => handleDragOver(e, index)}
                  onDragEnd={handleDragEnd}
                  className={`flex items-center gap-2 p-2 rounded-lg transition-colors cursor-grab active:cursor-grabbing ${draggedIndex === index ? "opacity-50" : ""} ${dragOverIndex === index ? "bg-white/10" : "hover:bg-white/5"}`}
                >
                  <GripVertical className="w-4 h-4 text-neutral-600 flex-shrink-0" />
                  <span className="text-xs text-neutral-600 w-5">{index + 1}</span>
                  {track.eraImage ? (
                    <img src={track.eraImage} alt="" className="w-8 h-8 rounded object-cover" />
                  ) : (
                    <div className="w-8 h-8 rounded bg-neutral-800" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white truncate">{track.name}</p>
                    <p className="text-xs text-neutral-500 truncate">{track.artistName}</p>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => { onPlayFromQueue(index); onClose(); }} className="h-7 w-7 text-neutral-500 hover:text-white">
                    <Play className="w-3 h-3" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => onRemove(index)} className="h-7 w-7 text-neutral-500 hover:text-red-400">
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
  const { state, togglePlayPause, seekTo, setVolume, playNext, playPrevious, clearQueue, removeFromQueue, reorderQueue, playFromQueue } = usePlayer();
  const [queueModalOpen, setQueueModalOpen] = useState(false);

  const handleProgressClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const percent = (e.clientX - rect.left) / rect.width;
    seekTo(percent * state.duration);
  }, [seekTo, state.duration]);

  const handleClose = useCallback(() => {
    clearQueue();
  }, [clearQueue]);

  const handleQueueReorder = useCallback((fromIndex: number, toIndex: number) => {
    reorderQueue(fromIndex, toIndex);
  }, [reorderQueue]);

  const handleQueueRemove = useCallback((index: number) => {
    removeFromQueue(index);
  }, [removeFromQueue]);

  const handlePlayFromQueue = useCallback((index: number) => {
    playFromQueue(index);
  }, [playFromQueue]);

  if (!state.currentTrack) return null;

  const progress = state.duration ? (state.currentTime / state.duration) * 100 : 0;

  return (
    <>
      <div className="fixed bottom-0 left-0 right-0 bg-neutral-950/95 backdrop-blur-xl border-t border-neutral-800 z-50 p-3">
        <div className="max-w-7xl mx-auto flex items-center gap-4">
          <div className="flex items-center gap-3 min-w-[180px] max-w-[280px]">
            {state.currentTrack.eraImage ? (
              <img src={state.currentTrack.eraImage} alt="" className="w-12 h-12 rounded-lg object-cover flex-shrink-0" />
            ) : (
              <div className="w-12 h-12 rounded-lg bg-neutral-800 flex-shrink-0" />
            )}
            <div className="min-w-0">
              <div className="font-semibold text-white text-sm truncate">{state.currentTrack.name}</div>
              <div className="text-xs text-neutral-500 truncate">{state.currentTrack.artistName || state.currentTrack.extra}</div>
            </div>
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
          <Button variant="ghost" size="icon" onClick={() => setQueueModalOpen(true)} className={`rounded-lg w-9 h-9 relative ${state.queue.length > 0 ? "text-white hover:bg-white/10" : "text-neutral-500 hover:text-white hover:bg-white/10"}`}>
            <ListMusic className="w-4 h-4" />
            {state.queue.length > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-white text-black text-[10px] font-bold rounded-full flex items-center justify-center">{state.queue.length}</span>
            )}
          </Button>
          <Button variant="ghost" size="icon" onClick={handleClose} className="text-neutral-500 hover:text-white hover:bg-white/10 rounded-lg w-9 h-9">
            <X className="w-4 h-4" />
          </Button>
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
