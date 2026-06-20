import { type ReactNode, type FC, useRef, useEffect } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
export const Modal: FC<{
  isOpen: boolean;
  onClose: () => void;
  children: ReactNode;
  ariaLabel: string;
}> = ({ isOpen, onClose, children, ariaLabel }) => {
  const dialogRef = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (isOpen && !dialog.open) dialog.showModal();
    else if (!isOpen && dialog.open) dialog.close();
  }, [isOpen]);
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const handleCancel = (e: Event) => { e.preventDefault(); onClose(); };
    dialog.addEventListener("cancel", handleCancel);
    return () => dialog.removeEventListener("cancel", handleCancel);
  }, [onClose]);
  return (
    <dialog
      ref={dialogRef}
      aria-label={ariaLabel}
      className="fixed inset-0 z-50 m-0 p-0 w-full h-full max-w-none max-h-none bg-transparent backdrop:bg-black/60 backdrop:backdrop-blur-md"
    >
      <button
        type="button"
        className="absolute inset-0 w-full h-full cursor-default"
        onClick={onClose}
        tabIndex={-1}
        aria-hidden="true"
      />
      <div className="relative z-10 flex items-center justify-center w-full h-full p-4">
        <div className="glass-elevated rounded-2xl w-full max-w-md relative animate-in fade-in-0 zoom-in-95 duration-200">
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="absolute top-3 right-3 text-white/40 hover:text-white hover:bg-white/10 h-8 w-8 rounded-xl"
          >
            <X className="w-4 h-4" />
          </Button>
          {children}
        </div>
      </div>
    </dialog>
  );
};
