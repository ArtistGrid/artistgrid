import { type ReactNode, type FC } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useKeyPress } from "@/src/hooks/use-key-press";
export const Modal: FC<{
  isOpen: boolean;
  onClose: () => void;
  children: ReactNode;
  ariaLabel: string;
}> = ({ isOpen, onClose, children, ariaLabel }) => {
  useKeyPress("Escape", onClose);
  if (!isOpen) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={ariaLabel}
    >
      <div
        className="bg-neutral-950 border border-neutral-800 shadow-2xl rounded-xl w-full max-w-md relative animate-in fade-in-0 zoom-in-95"
        onClick={(e) => e.stopPropagation()}
      >
        <Button
          variant="ghost"
          size="icon"
          onClick={onClose}
          className="absolute top-3 right-3 text-neutral-500 hover:text-white h-8 w-8 rounded-lg"
        >
          <X className="w-5 h-5" />
        </Button>
        {children}
      </div>
    </div>
  );
};
