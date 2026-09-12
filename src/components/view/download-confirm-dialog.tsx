import { AlertTriangle, Download, FolderDown } from "lucide-react";
import { Button } from "@/components/ui/button";
export interface DownloadConfirmDialogProps {
  trackCount: number;
  subtitle: string;
  onCancel: () => void;
  onConfirm: () => void;
}
export function DownloadConfirmDialog({ trackCount, subtitle, onCancel, onConfirm }: DownloadConfirmDialogProps) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onCancel}
        aria-label="Close download dialog"
        tabIndex={-1}
      />

      <div className="relative z-10 bg-neutral-950 border border-neutral-800 shadow-2xl rounded-2xl w-full max-w-sm animate-in fade-in-0 zoom-in-95 duration-200">
        <div className="p-6">
          <div className="flex items-start gap-3 mb-4">
            <div className="w-9 h-9 rounded-xl bg-neutral-800 flex items-center justify-center flex-shrink-0">
              <FolderDown className="w-4 h-4 text-neutral-300" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-white">
                Download {trackCount} track{trackCount !== 1 ? "s" : ""}
              </h2>
              <p className="text-sm text-neutral-400 mt-0.5">{subtitle}</p>
            </div>
          </div>
          <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-3.5 mb-5 space-y-2.5">
            <div className="flex gap-2 text-sm text-neutral-300">
              <AlertTriangle className="w-4 h-4 text-yellow-500 flex-shrink-0 mt-0.5" />
              <span>
                Your browser is asking for permission to download multiple files.{" "}
                <span className="text-white font-medium">Click Allow</span> in the popup before continuing.
              </span>
            </div>
            <div className="flex gap-2 text-sm text-neutral-400">
              <Download className="w-4 h-4 text-neutral-500 flex-shrink-0 mt-0.5" />
              <span>Large downloads are automatically split into 900 MB ZIP files.</span>
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              variant="ghost"
              className="flex-1 border border-neutral-800 text-neutral-400 hover:text-white hover:border-neutral-600"
              onClick={onCancel}
            >
              Cancel
            </Button>
            <Button className="flex-1 bg-white text-black hover:bg-neutral-200" onClick={onConfirm}>
              Start Download
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
