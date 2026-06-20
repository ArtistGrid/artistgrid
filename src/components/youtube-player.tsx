import { useCallback, useEffect, useRef, useState } from "react";
import { X, GripHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";

function extractYouTubeId(url: string): string | null {
  const match = url.match(
    /(?:youtube\.com\/(?:watch\?(?:.*&)?v=|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/
  );
  return match ? match[1] : null;
}

export function YouTubePlayer({ url, onClose }: { url: string; onClose: () => void }) {
  const videoId = extractYouTubeId(url);
  const dragState = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(null);
  const [pos, setPos] = useState<{ x: number; y: number }>(() => ({
    x: window.innerWidth - 352,
    y: window.innerHeight - 260,
  }));
  const posRef = useRef(pos);
  posRef.current = pos;

  const onMouseMoveRef = useRef<(e: MouseEvent) => void>(() => {});
  const onMouseUpRef = useRef<() => void>(() => {});

  onMouseMoveRef.current = useCallback((e: MouseEvent) => {
    if (!dragState.current) return;
    const dx = e.clientX - dragState.current.startX;
    const dy = e.clientY - dragState.current.startY;
    setPos({
      x: Math.max(0, Math.min(window.innerWidth - 320, dragState.current.origX + dx)),
      y: Math.max(0, Math.min(window.innerHeight - 220, dragState.current.origY + dy)),
    });
  }, []);

  onMouseUpRef.current = useCallback(() => {
    dragState.current = null;
  }, []);

  useEffect(() => {
    const move = (e: MouseEvent) => onMouseMoveRef.current(e);
    const up = () => onMouseUpRef.current();
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
    return () => {
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
    };
  }, []);

  const onDragStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    dragState.current = { startX: e.clientX, startY: e.clientY, origX: posRef.current.x, origY: posRef.current.y };
  }, []);

  if (!videoId) return null;

  return (
    <div
      className="fixed z-[80] glass-elevated rounded-2xl overflow-hidden shadow-2xl"
      style={{ left: pos.x, top: pos.y, width: 320 }}
    >
      <button
        type="button"
        aria-label="Drag to reposition player"
        className="w-full flex items-center justify-between px-3 py-2 cursor-grab active:cursor-grabbing select-none border-b border-white/[0.08] bg-transparent"
        onMouseDown={onDragStart}
      >
        <div className="flex items-center gap-2">
          <GripHorizontal className="w-3.5 h-3.5 text-white/30" />
          <span className="text-xs font-medium text-white/50">YouTube</span>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={onClose}
          className="h-6 w-6 text-white/30 hover:text-white hover:bg-white/10 rounded-lg"
        >
          <X className="w-3 h-3" />
        </Button>
      </button>
      <iframe
        src={`https://www.youtube.com/embed/${videoId}?autoplay=1`}
        width="320"
        height="180"
        allow="autoplay; encrypted-media; fullscreen"
        allowFullScreen
        sandbox="allow-scripts allow-popups allow-presentation"
        className="block"
        title="YouTube video"
      />
    </div>
  );
}
