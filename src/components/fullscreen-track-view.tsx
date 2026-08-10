import { memo, useCallback, useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Kawarp } from "@kawarp/core";
import VanillaTilt from "vanilla-tilt";

// vanilla-tilt's destroy() sets this.element = null, but a window resize / mouse
// listener bound earlier can still fire afterwards and crash on a null element.
// Make those instance methods no-ops once the element has been torn down.
const TILT_GUARDED_METHODS = [
  "update",
  "updateGlareSize",
  "updateElementPosition",
  "setTransition",
  "onWindowResize",
  "onMouseEnter",
  "onMouseLeave",
  "reset",
  "resetGlare",
] as const;
for (const method of TILT_GUARDED_METHODS) {
  const original = (VanillaTilt.prototype as unknown as Record<string, unknown>)[method];
  if (typeof original !== "function") continue;
  (VanillaTilt.prototype as unknown as Record<string, unknown>)[method] = function (...args: unknown[]) {
    if (!(this as { element?: unknown }).element) return;
    return (original as (...a: unknown[]) => unknown).apply(this, args);
  };
}
import { usePlayer } from "@/src/providers";
import { usePlayerTime } from "@/src/lib/player-time";
import { useVolume } from "@/src/hooks/use-volume";
import { VolumeControl } from "@/src/components/volume-control";
import { Button } from "@/components/ui/button";
import { WaveformSeekbar } from "@/src/components/waveform-seekbar";
import { X, SkipBack, SkipForward, Play, Pause, Shuffle, Repeat, Repeat1 } from "lucide-react";

const KAWARP_DEFAULTS = {
  warpIntensity: 1,
  blurPasses: 8,
  animationSpeed: 1,
  transitionDuration: 1000,
  saturation: 1.5,
  dithering: 0.008,
  scale: 1.25,
  tintColor: [0.08, 0.08, 0.12] as [number, number, number],
  tintIntensity: 0.3,
};

function formatTime(seconds: number): string {
  if (!seconds || isNaN(seconds)) return "0:00";
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

interface FullscreenTrackViewProps {
  isOpen: boolean;
  onClose: () => void;
}

export const FullscreenTrackView = memo(function FullscreenTrackView({ isOpen, onClose }: FullscreenTrackViewProps) {
  const { state, togglePlayPause, seekTo, setVolume, playNext, playPrevious, toggleShuffle, toggleRepeat } =
    usePlayer();
  const [seekPreview, setSeekPreview] = useState<number | null>(null);
  const { currentTime, duration } = usePlayerTime();
  const displayTime = seekPreview ?? currentTime;
  const progress = duration ? (displayTime / duration) * 100 : 0;
  const { isMuted, handleVolumeToggle, handleVolumeChange } = useVolume(state.volume, setVolume);
  const tiltRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const kawarpRef = useRef<Kawarp | null>(null);

  // Init / destroy Kawarp — stable, never recreated
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Reuse existing instance (handles React strict mode double-mount)
    let kawarp = kawarpRef.current;
    if (!kawarp) {
      // WebGL can fail on iOS (context loss / texture limits). If creation
      // throws, degrade gracefully instead of crashing the fullscreen view.
      try {
        kawarp = new Kawarp(canvas, { ...KAWARP_DEFAULTS });
        kawarpRef.current = kawarp;
      } catch {}
    }
    if (!kawarp) return;

    const stop = () => {
      try {
        kawarp!.stop();
      } catch {}
    };

    const onContextLost = (e: Event) => {
      // WebGL context is gone (memory pressure, backgrounding, other tabs).
      // Stop the render loop so it stops trying to create textures/framebuffers,
      // and reset the instance so a later re-mount re-creates it cleanly.
      e.preventDefault();
      stop();
      kawarpRef.current = null;
    };

    let stopped = false;
    const resize = () => {
      if (stopped || !canvasRef.current) return;
      const w = window.innerWidth;
      const h = window.innerHeight;
      if (canvasRef.current.width !== w) canvasRef.current.width = w;
      if (canvasRef.current.height !== h) canvasRef.current.height = h;
      try {
        kawarp!.resize();
      } catch {}
    };

    resize();
    window.addEventListener("resize", resize);
    canvas.addEventListener("webglcontextlost", onContextLost);
    try {
      kawarp.start();
    } catch {}

    return () => {
      stopped = true;
      window.removeEventListener("resize", resize);
      canvas.removeEventListener("webglcontextlost", onContextLost);
      stop();
      try {
        kawarp!.dispose();
      } catch {}
      kawarpRef.current = null;
    };
  }, []);

  // Load image when src changes
  useEffect(() => {
    const src = state.currentTrack?.eraImage;
    const kawarp = kawarpRef.current;
    if (!kawarp) return;

    if (src) {
      kawarp.loadImage(src).catch(() => {});
    }
  }, [state.currentTrack?.eraImage]);

  useEffect(() => {
    if (!isOpen || !tiltRef.current) return;
    const el = tiltRef.current;
    VanillaTilt.init(el, {
      max: 15,
      speed: 400,
      glare: true,
      "max-glare": 0.3,
      scale: 1.02,
    });
    return () => {
      const tilt = el as unknown as {
        vanillaTilt?: {
          destroy: () => void;
          removeEventListeners?: () => void;
        };
      };
      const inst = tilt.vanillaTilt;
      if (!inst) return;
      // VanillaTilt.destroy() throws if the element is already null and then
      // never reaches removeEventListeners(), leaking its window resize/mouse
      // listeners. Detach them first (removeEventListeners only touches
      // elementListener + window, safe even when element is null).
      try {
        inst.removeEventListeners?.();
      } catch {}
      try {
        inst.destroy();
      } catch {}
      try {
        (el as unknown as { vanillaTilt?: null }).vanillaTilt = null;
      } catch {}
    };
  }, [isOpen]);

  const handleSeekStart = useCallback((value: number) => {
    setSeekPreview(value);
  }, []);

  const handleSeekEnd = useCallback(
    (value: number) => {
      seekTo(value);
      setSeekPreview(null);
    },
    [seekTo]
  );

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  if (!state.currentTrack) return null;

  return (
    <>
      {/* Kawarp canvas — always mounted, visibility toggled via CSS */}
      <div className="fixed inset-0 z-[100] pointer-events-none" style={{ visibility: isOpen ? "visible" : "hidden" }}>
        <canvas ref={canvasRef} style={{ display: "block", width: "100%", height: "100%" }} />
        <div className="absolute inset-0 bg-black/40" />
      </div>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            key="fullscreen-track-view"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="fixed inset-0 z-[101]"
          >
            {/* Close button */}
            <button
              type="button"
              onClick={onClose}
              className="absolute top-4 right-4 sm:top-6 sm:right-6 z-20 text-white/60 hover:text-white hover:bg-white/10 h-10 w-10 rounded-full flex items-center justify-center transition-colors"
              aria-label="Close fullscreen view"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Content */}
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center px-6 sm:px-12 pb-8 pt-16">
              {/* Album art with tilt */}
              <div
                ref={tiltRef}
                onClick={onClose}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onClose();
                  }
                }}
                role="button"
                tabIndex={0}
                aria-label="Close fullscreen view"
                className="mb-6 sm:mb-8 w-48 h-48 sm:w-64 sm:h-64 lg:w-80 lg:h-80 rounded-2xl overflow-hidden shadow-2xl flex-shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
                style={{ transformStyle: "preserve-3d" }}
              >
                {state.currentTrack.eraImage ? (
                  <img
                    src={state.currentTrack.eraImage}
                    alt={state.currentTrack.name}
                    className="w-full h-full object-cover pointer-events-none"
                    referrerPolicy="no-referrer"
                    crossOrigin="anonymous"
                    decoding="async"
                  />
                ) : (
                  <div className="w-full h-full bg-white/[0.08] flex items-center justify-center pointer-events-none">
                    <Play className="w-16 h-16 text-white/20" />
                  </div>
                )}
              </div>

              {/* Track info */}
              <div className="text-center mb-6 sm:mb-8 w-full max-w-lg">
                <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-white truncate mb-1">
                  {state.currentTrack.name}
                </h1>
                <p className="text-sm sm:text-base text-white/60 truncate">
                  {state.currentTrack.artistName || state.currentTrack.extra}
                </p>
                {state.currentTrack.eraName && (
                  <p className="text-xs sm:text-sm text-white/40 mt-1 truncate">{state.currentTrack.eraName}</p>
                )}
              </div>

              {/* Seek bar */}
              <div className="w-full max-w-lg mb-4 sm:mb-6">
                <WaveformSeekbar
                  audioUrl={state.currentTrack?.playableUrl ?? null}
                  trackId={state.currentTrack?.id ?? null}
                  progress={progress}
                  duration={duration}
                  onSeekStart={handleSeekStart}
                  onSeekEnd={handleSeekEnd}
                  height={48}
                  className="w-full"
                />
                <div className="flex justify-between mt-1">
                  <span className="text-xs text-white/40 tabular-nums">{formatTime(displayTime)}</span>
                  <span className="text-xs text-white/40 tabular-nums">{formatTime(duration)}</span>
                </div>
              </div>

              {/* Controls */}
              <div className="flex items-center gap-3 sm:gap-4">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={toggleShuffle}
                  className={`hover:bg-white/10 rounded-full w-10 h-10 sm:w-12 sm:h-12 transition-colors active:scale-90 ${
                    state.isShuffled ? "text-white" : "text-white/40 hover:text-white"
                  }`}
                  aria-label="Shuffle"
                  aria-pressed={state.isShuffled}
                >
                  <Shuffle className="w-4 h-4 sm:w-5 sm:h-5" />
                </Button>

                <Button
                  variant="ghost"
                  size="icon"
                  onClick={playPrevious}
                  className="text-white/60 hover:text-white hover:bg-white/10 rounded-full w-11 h-11 sm:w-14 sm:h-14 active:scale-90"
                  aria-label="Previous track"
                >
                  <SkipBack className="w-5 h-5 sm:w-6 sm:h-6" />
                </Button>

                <Button
                  variant="ghost"
                  size="icon"
                  onClick={togglePlayPause}
                  className="bg-white text-black hover:bg-white/90 rounded-full w-14 h-14 sm:w-16 sm:h-16 flex-shrink-0 active:scale-90"
                  aria-label={state.isPlaying ? "Pause" : "Play"}
                >
                  {state.isPlaying ? (
                    <Pause className="w-6 h-6 sm:w-7 sm:h-7" />
                  ) : (
                    <Play className="w-6 h-6 sm:w-7 sm:h-7 ml-0.5" />
                  )}
                </Button>

                <Button
                  variant="ghost"
                  size="icon"
                  onClick={playNext}
                  className="text-white/60 hover:text-white hover:bg-white/10 rounded-full w-11 h-11 sm:w-14 sm:h-14 active:scale-90"
                  aria-label="Next track"
                >
                  <SkipForward className="w-5 h-5 sm:w-6 sm:h-6" />
                </Button>

                <Button
                  variant="ghost"
                  size="icon"
                  onClick={toggleRepeat}
                  className={`hover:bg-white/10 rounded-full w-10 h-10 sm:w-12 sm:h-12 transition-colors active:scale-90 ${
                    state.repeatMode !== "off" ? "text-white" : "text-white/40 hover:text-white"
                  }`}
                  aria-label={`Repeat: ${state.repeatMode}`}
                  aria-pressed={state.repeatMode !== "off"}
                >
                  {state.repeatMode === "one" ? (
                    <Repeat1 className="w-4 h-4 sm:w-5 sm:h-5" />
                  ) : (
                    <Repeat className="w-4 h-4 sm:w-5 sm:h-5" />
                  )}
                </Button>
              </div>

              {/* Volume (desktop only) */}
              <VolumeControl
                volume={state.volume}
                isMuted={isMuted}
                onToggleMute={handleVolumeToggle}
                onVolumeChange={handleVolumeChange}
                className="hidden sm:flex items-center gap-3 mt-6"
                buttonClassName="text-white/40 hover:text-white transition-colors"
                rangeClassName="w-24 accent-white cursor-pointer opacity-60 hover:opacity-100 transition-opacity"
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
});
