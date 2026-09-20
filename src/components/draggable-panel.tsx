import { type ReactNode, useCallback, useEffect, useRef, useState } from "react";
import { GripHorizontal, X } from "lucide-react";
import { Button } from "@/components/ui/button";
const PANEL_WIDTH = 320;
const PANEL_HEIGHT_MIN = 220;
function clampPos(
  x: number,
  y: number
): {
  x: number;
  y: number;
} {
  const maxX = Math.max(0, window.innerWidth - PANEL_WIDTH);
  const maxY = Math.max(0, window.innerHeight - PANEL_HEIGHT_MIN);
  return {
    x: Math.min(Math.max(0, x), maxX),
    y: Math.min(Math.max(0, y), maxY),
  };
}
export function DraggablePanel({
  label,
  onClose,
  children,
}: {
  label: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const dragState = useRef<{
    startX: number;
    startY: number;
    origX: number;
    origY: number;
  } | null>(null);
  const [pos, setPos] = useState<{
    x: number;
    y: number;
  }>(() => clampPos(window.innerWidth - 352, window.innerHeight - 260));
  const posRef = useRef(pos);
  useEffect(() => {
    posRef.current = pos;
  }, [pos]);
  useEffect(() => {
    const reclamp = () => setPos((p) => clampPos(p.x, p.y));
    window.addEventListener("resize", reclamp);
    return () => window.removeEventListener("resize", reclamp);
  }, []);
  const onMouseMoveRef = useRef<(e: MouseEvent) => void>(() => {});
  const onMouseUpRef = useRef<() => void>(() => {});
  useEffect(() => {
    onMouseMoveRef.current = (e: MouseEvent) => {
      if (!dragState.current) return;
      const dx = e.clientX - dragState.current.startX;
      const dy = e.clientY - dragState.current.startY;
      setPos(clampPos(dragState.current.origX + dx, dragState.current.origY + dy));
    };
    onMouseUpRef.current = () => {
      dragState.current = null;
    };
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
  return (
    <div
      className="fixed z-[80] glass-elevated rounded-2xl overflow-hidden shadow-2xl"
      style={{ left: pos.x, top: pos.y, width: PANEL_WIDTH }}
    >
      <div className="w-full flex items-center border-b border-white/[0.08] bg-transparent">
        <button
          type="button"
          aria-label="Drag to reposition player. Use arrow keys to move."
          className="flex-1 flex items-center gap-2 px-3 py-2 cursor-grab active:cursor-grabbing select-none text-left bg-transparent border-0"
          onMouseDown={onDragStart}
          onKeyDown={(e) => {
            const step = e.shiftKey ? 32 : 8;
            if (e.key === "ArrowLeft") {
              e.preventDefault();
              setPos((p) => clampPos(p.x - step, p.y));
            } else if (e.key === "ArrowRight") {
              e.preventDefault();
              setPos((p) => clampPos(p.x + step, p.y));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setPos((p) => clampPos(p.x, p.y - step));
            } else if (e.key === "ArrowDown") {
              e.preventDefault();
              setPos((p) => clampPos(p.x, p.y + step));
            }
          }}
        >
          <GripHorizontal className="w-3.5 h-3.5 text-white/30" />
          <span className="text-xs font-medium text-white/50">{label}</span>
        </button>
        <div className="pr-2">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="h-6 w-6 text-white/30 hover:text-white hover:bg-white/10 rounded-lg"
            aria-label="Close player"
          >
            <X className="w-3 h-3" />
          </Button>
        </div>
      </div>
      {children}
    </div>
  );
}
