import { memo, useCallback, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
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
  Repeat,
  Repeat1,
  GripVertical,
  Trash2,
  CircleSlash,
  Mic2,
} from "lucide-react";
import { LyricsPanel } from "@/src/components/lyrics-panel";
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
    <AnimatePresence>
      <motion.div
        key="queue-modal"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.15 }}
        className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-4 pb-36 sm:pb-4"
      >
        <button
          type="button"
          className="absolute inset-0 bg-black/60 backdrop-blur-md"
          onClick={onClose}
          aria-label="Close queue"
          tabIndex={-1}
        />
        <motion.div
          initial={{ y: 20, opacity: 0, scale: 0.97 }}
          animate={{ y: 0, opacity: 1, scale: 1 }}
          exit={{ y: 20, opacity: 0, scale: 0.97 }}
          transition={{ type: "spring", damping: 25, stiffness: 350 }}
          className="relative z-10 glass-elevated rounded-2xl w-full max-w-md"
        >
        <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-white/[0.08]">
          <div className="flex items-center gap-2.5">
            <ListMusic className="w-4 h-4 text-white/50" />
            <h2 className="text-sm font-semibold text-white">Queue</h2>
            <span className="text-xs text-white/40 bg-white/[0.08] px-2 py-0.5 rounded-full">{queue.length}</span>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="text-white/40 hover:text-white hover:bg-white/10 h-8 w-8 rounded-xl"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
        <div className="p-4 max-h-[60vh] overflow-y-auto no-scrollbar">
          {currentTrack && (
            <div className="mb-4">
              <p className="text-[10px] font-semibold text-white/30 uppercase tracking-widest mb-2">Now Playing</p>
              <div className="flex items-center gap-3 p-3 bg-white/[0.06] rounded-xl border border-white/[0.1]">
                {currentTrack.eraImage ? (
                  <img
                    src={currentTrack.eraImage}
                    alt=""
                    className="w-10 h-10 rounded-lg object-cover flex-shrink-0"
                    referrerPolicy="no-referrer"
                    crossOrigin="anonymous"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-lg bg-white/[0.08] flex-shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate">{currentTrack.name}</p>
                  <p className="text-xs text-white/40 truncate">{currentTrack.artistName}</p>
                </div>
              </div>
            </div>
          )}
          {queue.length === 0 ? (
            <div className="text-center py-10">
              <CircleSlash className="w-10 h-10 text-white/15 mx-auto mb-3" />
              <p className="text-sm text-white/30">Nothing queued up</p>
            </div>
          ) : (
            <div className="space-y-0.5">
              <p className="text-[10px] font-semibold text-white/30 uppercase tracking-widest mb-2">Up Next</p>
              {queue.map((track, index) => (
                <div
                  key={track.id || `${index}`}
                  draggable
                  onDragStart={(e) => handleDragStart(e, index)}
                  onDragOver={(e) => handleDragOver(e, index)}
                  onDragEnd={handleDragEnd}
                  className={`flex items-center gap-2 p-2 rounded-xl transition-colors cursor-grab active:cursor-grabbing ${draggedIndex === index ? "opacity-40" : ""} ${dragOverIndex === index && draggedIndex !== index ? "bg-white/[0.08]" : "hover:bg-white/[0.05]"}`}
                >
                  <GripVertical className="w-4 h-4 text-white/20 flex-shrink-0" />
                  <span className="text-xs text-white/20 w-5 text-center flex-shrink-0">{index + 1}</span>
                  {track.eraImage ? (
                    <img
                      src={track.eraImage}
                      alt=""
                      className="w-8 h-8 rounded-lg object-cover flex-shrink-0"
                      referrerPolicy="no-referrer"
                      crossOrigin="anonymous"
                    />
                  ) : (
                    <div className="w-8 h-8 rounded-lg bg-white/[0.08] flex-shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white truncate">{track.name}</p>
                    <p className="text-xs text-white/35 truncate">{track.artistName}</p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => { onPlayFromQueue(index); onClose(); }}
                    className="h-7 w-7 text-white/30 hover:text-white hover:bg-white/10 rounded-lg flex-shrink-0"
                  >
                    <Play className="w-3 h-3" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => onRemove(index)}
                    className="h-7 w-7 text-white/30 hover:text-red-400 hover:bg-red-400/10 rounded-lg flex-shrink-0"
                  >
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
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
    removeFromQueue,
    reorderQueue,
    playFromQueue,
    toggleShuffle,
    toggleRepeat,
    closePlayer,
  } = usePlayer();
  const [queueModalOpen, setQueueModalOpen] = useState(false);
  const [lyricsOpen, setLyricsOpen] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [prevVolume, setPrevVolume] = useState(state.volume);
  const [seekPreview, setSeekPreview] = useState<number | null>(null);
  const displayTime = seekPreview ?? state.currentTime;
  const progress = state.duration ? (displayTime / state.duration) * 100 : 0;
  const handleVolumeToggle = useCallback(() => {
    if (isMuted || state.volume === 0) {
      const restore = prevVolume || 0.7;
      setVolume(restore);
      setIsMuted(false);
    } else {
      setPrevVolume(state.volume);
      setVolume(0);
      setIsMuted(true);
    }
  }, [isMuted, prevVolume, state.volume, setVolume]);
  const handleQueueReorder = useCallback(
    (fromIndex: number, toIndex: number) => reorderQueue(fromIndex, toIndex),
    [reorderQueue]
  );
  const handleQueueRemove = useCallback(
    (index: number) => removeFromQueue(index),
    [removeFromQueue]
  );
  const handlePlayFromQueue = useCallback(
    (index: number) => playFromQueue(index),
    [playFromQueue]
  );
  if (!state.currentTrack) return null;
  return (
    <AnimatePresence>
      <>
        <motion.div
          key="player-bar"
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          transition={{ type: "spring", damping: 25, stiffness: 300 }}
          className="fixed bottom-3 left-3 right-3 z-50 sm:bottom-4 sm:left-4 sm:right-4"
          style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
        >
        <div className="max-w-screen-xl mx-auto">
          <div className="glass-elevated rounded-2xl overflow-hidden">
            <div className="flex items-center gap-1 px-3 py-2 sm:gap-3 sm:px-4 sm:py-2.5">
              <div className="flex items-center gap-2 min-w-0 flex-1 sm:flex-none sm:w-52">
                {state.currentTrack.eraImage ? (
                  <img
                    src={state.currentTrack.eraImage}
                    alt=""
                    className="w-9 h-9 sm:w-11 sm:h-11 rounded-lg object-cover flex-shrink-0"
                    referrerPolicy="no-referrer"
                    crossOrigin="anonymous"
                  />
                ) : (
                  <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-lg bg-white/[0.08] flex-shrink-0" />
                )}
                <div className="min-w-0">
                  <p className="text-xs sm:text-sm font-semibold text-white truncate leading-snug">
                    {state.currentTrack.name}
                  </p>
                  <p className="text-[10px] sm:text-xs text-white/45 truncate mt-0.5">
                    {state.currentTrack.artistName || state.currentTrack.extra}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-0 sm:gap-0.5 flex-shrink-0">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={toggleShuffle}
                  className={`hover:bg-white/10 rounded-full w-8 h-8 sm:w-9 sm:h-9 transition-colors active:scale-90 ${state.isShuffled ? "text-white" : "text-white/30 hover:text-white"}`}
                  aria-label="Shuffle"
                  aria-pressed={state.isShuffled}
                >
                  <Shuffle className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={toggleRepeat}
                  className={`hover:bg-white/10 rounded-full w-8 h-8 sm:w-9 sm:h-9 transition-colors active:scale-90 ${state.repeatMode !== "off" ? "text-white" : "text-white/30 hover:text-white"}`}
                  aria-label={`Repeat: ${state.repeatMode}`}
                  aria-pressed={state.repeatMode !== "off"}
                >
                  {state.repeatMode === "one" ? (
                    <Repeat1 className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                  ) : (
                    <Repeat className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                  )}
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={playPrevious}
                  className="text-white/40 hover:text-white hover:bg-white/10 rounded-full w-8 h-8 sm:w-9 sm:h-9 active:scale-90"
                >
                  <SkipBack className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={togglePlayPause}
                  className="bg-white text-black hover:bg-white/90 rounded-full w-9 h-9 sm:w-10 sm:h-10 flex-shrink-0 active:scale-90"
                >
                  {state.isPlaying ? (
                    <Pause className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  ) : (
                    <Play className="w-3.5 h-3.5 sm:w-4 sm:h-4 ml-0.5" />
                  )}
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={playNext}
                  className="text-white/40 hover:text-white hover:bg-white/10 rounded-full w-8 h-8 sm:w-9 sm:h-9 active:scale-90"
                >
                  <SkipForward className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                </Button>
              </div>
              <div className="hidden sm:flex flex-1 items-center gap-2 min-w-0">
                <span className="text-xs text-white/30 tabular-nums w-8 text-right flex-shrink-0">
                  {formatTime(displayTime)}
                </span>
                <div className="relative flex-1 h-5 flex items-center group cursor-pointer">
                  <div className="absolute inset-x-0 h-1 bg-white/[0.12] rounded-full">
                    <div
                      className="absolute inset-y-0 left-0 bg-white/70 group-hover:bg-white rounded-full transition-colors"
                      style={{ width: `${progress}%` }}
                    />
                    <div
                      className="absolute top-1/2 w-3 h-3 bg-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-sm pointer-events-none"
                      style={{ left: `${progress}%`, transform: "translate(-50%, -50%)" }}
                    />
                  </div>
                  <input
                    type="range"
                    min="0"
                    max={state.duration || 0}
                    value={displayTime}
                    step="1"
                    onChange={(e) => setSeekPreview(parseFloat(e.target.value))}
                    onMouseUp={(e) => { seekTo(parseFloat((e.target as HTMLInputElement).value)); setSeekPreview(null); }}
                    onTouchEnd={(e) => { seekTo(parseFloat((e.target as HTMLInputElement).value)); setSeekPreview(null); }}
                    className="absolute inset-0 w-full opacity-0 cursor-pointer"
                    aria-label="Seek playback position"
                  />
                </div>
                <span className="text-xs text-white/30 tabular-nums w-8 flex-shrink-0">
                  {formatTime(state.duration)}
                </span>
              </div>
              <div className="hidden md:flex items-center gap-1.5 flex-shrink-0">
                <button
                  type="button"
                  onClick={handleVolumeToggle}
                  className="text-white/30 hover:text-white transition-colors p-1"
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
                  className="w-18 accent-white cursor-pointer opacity-60 hover:opacity-100 transition-opacity"
                  aria-label="Volume"
                />
              </div>
              <div className="flex items-center gap-0 sm:gap-0.5 flex-shrink-0">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setLyricsOpen(!lyricsOpen)}
                  className={`rounded-xl w-8 h-8 transition-colors ${
                    lyricsOpen ? "text-white hover:bg-white/10" : "text-white/30 hover:text-white hover:bg-white/10"
                  }`}
                  aria-label="Lyrics"
                >
                  <Mic2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setQueueModalOpen(true)}
                  className={`rounded-xl w-8 h-8 relative transition-colors ${
                    state.queue.length > 0 ? "text-white hover:bg-white/10" : "text-white/30 hover:text-white hover:bg-white/10"
                  }`}
                  aria-label="Queue"
                >
                  <ListMusic className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  {state.queue.length > 0 && (
                    <span className="absolute -top-1 -right-1 w-4 h-4 bg-white text-black text-[10px] font-bold rounded-full flex items-center justify-center leading-none">
                      {Math.min(state.queue.length, 99)}
                    </span>
                  )}
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={closePlayer}
                  className="text-white/25 hover:text-white hover:bg-white/10 rounded-xl w-8 h-8"
                  aria-label="Close player"
                >
                  <X className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                </Button>
              </div>
            </div>
            <div className="sm:hidden relative w-full h-1.5 bg-white/[0.1]">
              <div
                className="absolute inset-y-0 left-0 bg-white/60 transition-none"
                style={{ width: `${progress}%` }}
              />
              <input
                type="range"
                min="0"
                max={state.duration || 0}
                value={displayTime}
                step="1"
                onChange={(e) => setSeekPreview(parseFloat(e.target.value))}
                onMouseUp={(e) => { seekTo(parseFloat((e.target as HTMLInputElement).value)); setSeekPreview(null); }}
                onTouchEnd={(e) => { seekTo(parseFloat((e.target as HTMLInputElement).value)); setSeekPreview(null); }}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                aria-label="Seek"
              />
            </div>
          </div>
        </div>
        </motion.div>
        <QueueModal
        isOpen={queueModalOpen}
        onClose={() => setQueueModalOpen(false)}
        queue={state.queue}
        currentTrack={state.currentTrack}
        onReorder={handleQueueReorder}
        onRemove={handleQueueRemove}
        onPlayFromQueue={handlePlayFromQueue}
      />
      <AnimatePresence>
        {lyricsOpen && state.currentTrack && (
          <motion.div
            key="lyrics-panel"
            initial={{ opacity: 0, y: 10, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.97 }}
            transition={{ type: "spring", damping: 25, stiffness: 350 }}
            className="fixed bottom-24 right-3 z-[55] sm:bottom-20 sm:right-4 w-72 sm:w-80 h-72 sm:h-96 glass-elevated rounded-2xl flex flex-col overflow-hidden shadow-2xl"
          >
          <div className="flex items-center justify-between px-4 pt-3 pb-2 border-b border-white/[0.08]">
            <div className="flex items-center gap-2">
              <Mic2 className="w-3.5 h-3.5 text-white/50" />
              <h2 className="text-xs font-semibold text-white">Lyrics</h2>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setLyricsOpen(false)}
              className="text-white/40 hover:text-white hover:bg-white/10 h-6 w-6 rounded-lg"
            >
              <X className="w-3 h-3" />
            </Button>
          </div>
          <LyricsPanel />
          </motion.div>
        )}
      </AnimatePresence>
      </>
    </AnimatePresence>
  );
});
