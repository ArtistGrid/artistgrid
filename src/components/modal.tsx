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
      className="fixed inset-0 z-50 m-0 p-0 w-full h-full max-w-none max-h-none bg-transparent backdrop:bg-black/70 backdrop:backdrop-blur-sm"
    >
      <button
        type="button"
        className="absolute inset-0 w-full h-full cursor-default"
        onClick={onClose}
        tabIndex={-1}
        aria-hidden="true"
      />
      <div className="relative z-10 flex items-center justify-center w-full h-full p-4">
        <div className="bg-neutral-950 border border-neutral-800 shadow-2xl rounded-xl w-full max-w-md relative animate-in fade-in-0 zoom-in-95">
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
    </dialog>
  );
};
