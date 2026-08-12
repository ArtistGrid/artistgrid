import { memo, useRef, useEffect, useCallback } from "react";
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

interface Bar {
  x: number;
  y: number;
  w: number;
  h: number;
  r: number;
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
  const draggingRef = useRef(false);
  const progressRef = useRef(progress);
  const barsRef = useRef<Bar[] | null>(null);
  const barsKeyRef = useRef("");
  const drawRef = useRef<() => void>(() => {});

  useEffect(() => {
    if (!audioUrl || !trackId) {
      peaksRef.current = null;
      barsRef.current = null;
      barsKeyRef.current = "";
      return;
    }

    let cancelled = false;
    (async () => {
      const result = await waveformGenerator.getWaveform(audioUrl, trackId);
      if (cancelled || !result) return;
      peaksRef.current = result.peaks;
      barsRef.current = null;
      barsKeyRef.current = "";
      drawRef.current();
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
    const targetW = Math.round(w * dpr);
    const targetH = Math.round(h * dpr);
    if (canvas.width !== targetW || canvas.height !== targetH) {
      canvas.width = targetW;
      canvas.height = targetH;
      ctx.scale(dpr, dpr);
    }

    ctx.clearRect(0, 0, w, h);

    const peaks = peaksRef.current;
    if (!peaks || peaks.length === 0) {
      ctx.fillStyle = barColor;
      ctx.fillRect(0, h * 0.4, w, h * 0.2);
      return;
    }

    let bars = barsRef.current;
    const key = `${peaks.length}:${Math.round(w)}:${Math.round(h)}`;
    if (!bars || barsKeyRef.current !== key) {
      const numBars = Math.min(peaks.length, Math.floor(w / 2.5));
      const samplesPerBar = Math.max(1, Math.floor(peaks.length / numBars));
      const barWidth = Math.max(1, (w / numBars) * 0.65);
      const gap = (w / numBars) * 0.35;
      const centerY = h / 2;
      const newBars: Bar[] = [];

      for (let i = 0; i < numBars; i++) {
        let maxPeak = 0;
        const startIdx = i * samplesPerBar;
        const endIdx = Math.min(startIdx + samplesPerBar, peaks.length);
        for (let j = startIdx; j < endIdx; j++) {
          if (peaks[j] > maxPeak) maxPeak = peaks[j];
        }

        const barH = Math.max(2, maxPeak * h * 0.85);
        newBars.push({
          x: i * (barWidth + gap),
          y: centerY - barH / 2,
          w: barWidth,
          h: barH,
          r: Math.min(barWidth / 2, barH / 2),
        });
      }

      bars = newBars;
      barsRef.current = newBars;
      barsKeyRef.current = key;
    }

    const progressX = (progressRef.current / 100) * w;

    for (let i = 0; i < bars.length; i++) {
      const bar = bars[i];
      ctx.fillStyle = bar.x + bar.w <= progressX ? playedColor : barColor;
      ctx.beginPath();
      if (typeof ctx.roundRect === "function") {
        ctx.roundRect(bar.x, bar.y, bar.w, bar.h, bar.r);
      } else {
        ctx.rect(bar.x, bar.y, bar.w, bar.h);
      }
      ctx.fill();
    }

    if (showHandle) {
      const handleX = progressX;
      ctx.fillStyle = handleColor;
      ctx.shadowColor = "rgba(0,0,0,0.5)";
      ctx.shadowBlur = 4;
      ctx.beginPath();
      if (typeof ctx.roundRect === "function") {
        ctx.roundRect(handleX - 1, h / 2 - h * 0.4, 2.5, h * 0.8, 1);
      } else {
        ctx.rect(handleX - 1, h / 2 - h * 0.4, 2.5, h * 0.8);
      }
      ctx.fill();
      ctx.shadowBlur = 0;
    }
  }, [barColor, playedColor, handleColor, showHandle]);

  drawRef.current = draw;

  useEffect(() => {
    if (draggingRef.current) return;
    progressRef.current = progress;
    drawRef.current();
  }, [progress, draw]);

  const valueFromEvent = useCallback(
    (clientX: number): number => {
      const canvas = canvasRef.current;
      if (!canvas) return 0;
      const rect = canvas.getBoundingClientRect();
      const pct = Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100));
      return (pct / 100) * duration;
    },
    [duration]
  );

  const pctFromEvent = useCallback(
    (clientX: number): number => {
      const canvas = canvasRef.current;
      if (!canvas) return 0;
      const rect = canvas.getBoundingClientRect();
      return Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100));
    },
    []
  );

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      e.currentTarget.setPointerCapture(e.pointerId);
      draggingRef.current = true;
      progressRef.current = pctFromEvent(e.clientX);
      drawRef.current();
      onSeekStart(valueFromEvent(e.clientX));
    },
    [onSeekStart, valueFromEvent, pctFromEvent]
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (!draggingRef.current) return;
      progressRef.current = pctFromEvent(e.clientX);
      drawRef.current();
      onSeekStart(valueFromEvent(e.clientX));
    },
    [onSeekStart, valueFromEvent, pctFromEvent]
  );

  const handlePointerEnd = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (!draggingRef.current) return;
      const value = valueFromEvent(e.clientX);
      progressRef.current = pctFromEvent(e.clientX);
      drawRef.current();
      draggingRef.current = false;
      onSeekEnd(value);
    },
    [onSeekEnd, valueFromEvent, pctFromEvent]
  );

  return (
    <canvas
      ref={canvasRef}
      className={`w-full cursor-pointer select-none ${className}`}
      style={{ height: `${height}px`, touchAction: "none" }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerEnd}
      onPointerCancel={handlePointerEnd}
      onLostPointerCapture={handlePointerEnd}
    />
  );
});
