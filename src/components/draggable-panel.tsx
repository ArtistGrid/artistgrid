import { type ReactNode, useCallback, useEffect, useRef, useState } from "react";
import { GripHorizontal, X } from "lucide-react";
import { Button } from "@/components/ui/button";

export function DraggablePanel({
  label,
  onClose,
  children,
}: {
  label: string;
  onClose: () => void;
  children: ReactNode;
}) {
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

  return (
    <div
      className="fixed z-[80] glass-elevated rounded-2xl overflow-hidden shadow-2xl"
      style={{ left: pos.x, top: pos.y, width: 320 }}
    >
      <button
        type="button"
        aria-label="Drag to reposition player"
        className="w-full flex items-center gap-2 px-3 py-2 cursor-grab active:cursor-grabbing select-none border-b border-white/[0.08] bg-transparent"
        onMouseDown={onDragStart}
      >
        <GripHorizontal className="w-3.5 h-3.5 text-white/30" />
        <span className="text-xs font-medium text-white/50">{label}</span>
        <Button variant="ghost" size="icon" onClick={onClose} className="ml-auto h-6 w-6 text-white/30 hover:text-white hover:bg-white/10 rounded-lg">
          <X className="w-3 h-3" />
        </Button>
      </button>
      {children}
    </div>
  );
}
