import { memo, useRef, useEffect, useCallback, useState } from "react";
import { waveformGenerator } from "../../js/waveform.js";

interface WaveformSeekbarProps {
  audioUrl: string | null;
  trackId: string | null;
  progress: number;
  duration: number;
  onSeekStart: (value: number) => void;
  onSeekEnd: (value: number) => void;
  className?: string;
  height?: number;
  barColor?: string;
  playedColor?: string;
  handleColor?: string;
  showHandle?: boolean;
}

export const WaveformSeekbar = memo(function WaveformSeekbar({
  audioUrl,
  trackId,
  progress,
  duration,
  onSeekStart,
  onSeekEnd,
  className = "",
  height = 40,
  barColor = "rgba(255,255,255,0.15)",
  playedColor = "rgba(255,255,255,0.7)",
  handleColor = "#fff",
  showHandle = true,
}: WaveformSeekbarProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const peaksRef = useRef<Float32Array | null>(null);
  const [hasWaveform, setHasWaveform] = useState(false);

  useEffect(() => {
    if (!audioUrl || !trackId) {
      peaksRef.current = null;
      setHasWaveform(false);
      return;
    }

    let cancelled = false;
    (async () => {
      const result = await waveformGenerator.getWaveform(audioUrl, trackId);
      if (cancelled || !result) return;
      peaksRef.current = result.peaks;
      setHasWaveform(true);
    })();

    return () => { cancelled = true; };
  }, [audioUrl, trackId]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      ctx.scale(dpr, dpr);
    }

    ctx.clearRect(0, 0, w, h);

    const peaks = peaksRef.current;
    if (!peaks || peaks.length === 0) {
      ctx.fillStyle = barColor;
      ctx.fillRect(0, h * 0.4, w, h * 0.2);
      return;
    }

    const numBars = Math.min(peaks.length, Math.floor(w / 2.5));
    const samplesPerBar = Math.max(1, Math.floor(peaks.length / numBars));
    const barWidth = Math.max(1, (w / numBars) * 0.65);
    const gap = (w / numBars) * 0.35;
    const centerY = h / 2;
    const progressX = (progress / 100) * w;

    for (let i = 0; i < numBars; i++) {
      let maxPeak = 0;
      const startIdx = i * samplesPerBar;
      const endIdx = Math.min(startIdx + samplesPerBar, peaks.length);
      for (let j = startIdx; j < endIdx; j++) {
        if (peaks[j] > maxPeak) maxPeak = peaks[j];
      }

      const barH = Math.max(2, maxPeak * h * 0.85);
      const x = i * (barWidth + gap);
      const y = centerY - barH / 2;

      ctx.fillStyle = x + barWidth <= progressX ? playedColor : barColor;
      const radius = Math.min(barWidth / 2, barH / 2);
      ctx.beginPath();
      if (typeof ctx.roundRect === "function") {
        ctx.roundRect(x, y, barWidth, barH, radius);
      } else {
        ctx.rect(x, y, barWidth, barH);
      }
      ctx.fill();
    }

    if (showHandle) {
      const handleX = progressX;
      ctx.fillStyle = handleColor;
      ctx.shadowColor = "rgba(0,0,0,0.5)";
      ctx.shadowBlur = 4;
      ctx.beginPath();
      ctx.roundRect(handleX - 1, centerY - h * 0.4, 2.5, h * 0.8, 1);
      ctx.fill();
      ctx.shadowBlur = 0;
    }
  }, [progress, barColor, playedColor, handleColor, showHandle]);

  useEffect(() => {
    draw();
  }, [draw]);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const pct = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
      onSeekStart((pct / 100) * duration);
    },
    [duration, onSeekStart]
  );

  const handlePointerUp = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const pct = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
      onSeekEnd((pct / 100) * duration);
    },
    [duration, onSeekEnd]
  );

  return (
    <canvas
      ref={canvasRef}
      className={`w-full cursor-pointer ${className}`}
      style={{ height: `${height}px` }}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
    />
  );
});
