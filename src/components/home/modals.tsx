import { memo, useState, useCallback, lazy, Suspense } from "react";
import { QrCode, Copy as CopyIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/use-toast";
import { Modal } from "@/src/components/modal";
import { DONATION_OPTIONS, trackEvent } from "@/src/lib/home-constants";
const QRCode = lazy(() => import("qrcode.react").then((mod) => ({ default: mod.QRCodeSVG })));
interface QrCodeData {
  value: string;
  uriScheme: string;
  name: string;
}
export const AnnouncementModal = memo(
  ({ isOpen, onClose, message }: { isOpen: boolean; onClose: () => void; message: string }) => {
    const renderMarkdown = (text: string) => {
      return text.split("\n").map((line, i) => {
        if (line.startsWith("# "))
          return (
            <h2 key={i} className="text-xl font-bold text-white mb-4">
              {line.slice(2)}
            </h2>
          );
        if (line.startsWith("- **")) {
          const match = line.match(/- \*\*(.+?)\*\*: (.+)/);
          if (match)
            return (
              <p key={i} className="text-neutral-300 mb-2">
                • <strong className="text-white">{match[1]}</strong>: {match[2]}
              </p>
            );
        }
        if (line.trim() === "") return <br key={i} />;
        return (
          <p key={i} className="text-neutral-300 mb-2">
            {line}
          </p>
        );
      });
    };
    return (
      <Modal isOpen={isOpen} onClose={onClose} ariaLabel="Announcement">
        <div className="p-6 pt-12">
          {renderMarkdown(message)}
          <Button onClick={onClose} className="w-full mt-4 bg-white text-black hover:bg-neutral-200">
            Got it!
          </Button>
        </div>
      </Modal>
    );
  }
);
export const QrCodeOverlay = memo(({ qrCodeData, onClose }: { qrCodeData: QrCodeData; onClose: () => void }) => (
  <div
    className="absolute inset-0 z-10 bg-black/90 flex flex-col items-center justify-center p-4 rounded-xl backdrop-blur-sm"
    onClick={onClose}
  >
    <div className="bg-white p-4 rounded-lg shadow-2xl" onClick={(e) => e.stopPropagation()}>
      <Suspense fallback={<div className="w-[240px] h-[240px] rounded-lg bg-neutral-800 animate-pulse" />}>
        <QRCode value={qrCodeData.uriScheme ? `${qrCodeData.uriScheme}:${qrCodeData.value}` : qrCodeData.value} size={240} level="H" />
      </Suspense>
    </div>
    <p className="text-sm font-semibold text-white mt-4">{qrCodeData.name}</p>
    <p className="text-xs text-neutral-300 mt-2 break-all text-center px-4 font-mono">{qrCodeData.value}</p>
    <Button
      variant="ghost"
      className="mt-4 text-neutral-400 hover:text-white hover:bg-white/10 rounded-lg"
      onClick={onClose}
    >
      Close
    </Button>
  </div>
));
export const DonationModal = memo(({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) => {
  const [activeQrCode, setActiveQrCode] = useState<QrCodeData | null>(null);
  const [prevIsOpen, setPrevIsOpen] = useState(isOpen);
  if (prevIsOpen !== isOpen) {
    setPrevIsOpen(isOpen);
    if (!isOpen) setActiveQrCode(null);
  }
  const { toast } = useToast();
  const handleCopy = useCallback(
    (text: string, name: string) => {
      trackEvent("Copy Address", { crypto: name });
      navigator.clipboard.writeText(text).then(() => {
        toast({ title: "Copied!", description: `${name} address copied.` });
      });
    },
    [toast]
  );
  const handleShowQr = useCallback((option: (typeof DONATION_OPTIONS.CRYPTO)[0]) => {
    trackEvent("Show QR Code", { crypto: option.name });
    setActiveQrCode({ ...option });
  }, []);
  return (
    <Modal isOpen={isOpen} onClose={onClose} ariaLabel="Donation options">
      <div className="p-6">
        <h2 className="text-2xl font-bold text-white text-center mb-2">Support ArtistGrid</h2>
        <p className="text-center text-sm text-neutral-400 mb-6">Your contributions help cover server costs.</p>
        <div className="space-y-6 max-h-[70vh] overflow-y-auto no-scrollbar">
          <div className="flex flex-col gap-3">
            {DONATION_OPTIONS.URL.map((opt) => (
              <Button key={opt.name} asChild className="font-semibold rounded-lg w-full">
                <a href={opt.value} target="_blank" rel="noopener noreferrer">
                  {opt.name}
                </a>
              </Button>
            ))}
          </div>
          <div className="relative flex items-center">
            <div className="flex-grow border-t border-neutral-800" />
            <span className="flex-shrink mx-4 text-xs text-neutral-500 uppercase">Or Crypto</span>
            <div className="flex-grow border-t border-neutral-800" />
          </div>
          <div className="space-y-4">
            {DONATION_OPTIONS.CRYPTO.map((option) => (
              <div key={option.name}>
                <label className="text-sm font-medium text-neutral-300 mb-1 block">{option.name}</label>
                <div className="flex items-center gap-2">
                  <Input
                    readOnly
                    value={option.value}
                    className="bg-neutral-900 border-neutral-700 text-neutral-400 font-mono truncate text-xs rounded-lg"
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => handleShowQr(option)}
                    className="bg-neutral-900 border-neutral-700 text-neutral-300 hover:bg-neutral-800 hover:text-white flex-shrink-0 rounded-lg"
                    aria-label={`Show ${option.name} QR code`}
                  >
                    <QrCode className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => handleCopy(option.value, option.name)}
                    className="bg-neutral-900 border-neutral-700 text-neutral-300 hover:bg-neutral-800 hover:text-white flex-shrink-0 rounded-lg"
                    aria-label={`Copy ${option.name} address`}
                  >
                    <CopyIcon className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
        {activeQrCode && <QrCodeOverlay qrCodeData={activeQrCode} onClose={() => setActiveQrCode(null)} />}
      </div>
    </Modal>
  );
});
export const InfoModal = memo(
  ({
    isOpen,
    onClose,
    visitorCount,
    onDonate,
  }: {
    isOpen: boolean;
    onClose: () => void;
    visitorCount: number | null;
    onDonate: () => void;
  }) => (
    <Modal isOpen={isOpen} onClose={onClose} ariaLabel="About ArtistGrid">
      <div className="p-6 pt-12 text-center">
        <h2 className="text-xl font-bold text-white mb-4">About ArtistGrid</h2>
        <div className="text-neutral-300 space-y-4 text-sm sm:text-base">
          <p>
            Maintained by{" "}
            <a
              href="https://discord.com/users/454283756258197544"
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-white"
            >
              justAMZ
            </a>
            ,{" "}
            <a
              href="https://instagram.com/edideaur"
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-white"
            >
              edideaur
            </a>
            , and{" "}
            <a href="https://sad.ovh" target="_blank" rel="noopener noreferrer" className="underline hover:text-white">
              fucksophie
            </a>
            .
          </p>
          <p>
            Original trackers are in{" "}
            <a
              href="https://docs.google.com/spreadsheets/d/1XLlR7PnniA8WjLilQPu3Rhx1aLZ4MT2ysIeXp8XSYJA/htmlview"
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-white"
            >
              this Google Sheet
            </a>
            .
          </p>
          <p className="text-xs text-neutral-500">
            We are not affiliated with TrackerHub or any of the artists mentioned.
          </p>
          <div className="flex items-center justify-center gap-4 text-base pt-2">
            <a
              href="https://github.com/ArtistGrid"
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-white"
            >
              GitHub
            </a>
            <a
              href="https://discord.gg/RdBeMZ2m8S"
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-white"
            >
              Discord
            </a>
            <a
              href="https://plausible.canine.tools/artistgrid.cx/"
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-white"
            >
              Analytics
            </a>
            <button
              type="button"
              onClick={() => {
                onClose();
                onDonate();
              }}
              className="underline hover:text-white"
            >
              Donate
            </button>
          </div>
          {visitorCount !== null && (
            <p className="text-sm text-neutral-500 pt-4">You are visitor #{visitorCount.toLocaleString()}</p>
          )}
        </div>
      </div>
    </Modal>
  )
);
