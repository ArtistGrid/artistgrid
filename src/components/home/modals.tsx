import { memo, useState, useCallback, lazy, Suspense } from "react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/src/components/modal";
import { DonationContent, type QrCodeData } from "@/src/components/crypto-donation-section";
const QRCode = lazy(() => import("qrcode.react").then((mod) => ({ default: mod.QRCodeSVG })));

function MarkdownContent({ text }: { text: string }) {
  return (
    <>
      {text.split("\n").map((line) => {
        if (line.startsWith("# "))
          return (
            <h2 key={`h-${line}`} className="text-xl font-bold text-white mb-4">
              {line.slice(2)}
            </h2>
          );
        if (line.startsWith("- **")) {
          const match = line.match(/- \*\*(.+?)\*\*: (.+)/);
          if (match)
            return (
              <p key={`b-${match[1]}`} className="text-neutral-300 mb-2">
                • <strong className="text-white">{match[1]}</strong>: {match[2]}
              </p>
            );
        }
        if (line.trim() === "") return null;
        return (
          <p key={`p-${line}`} className="text-neutral-300 mb-2">
            {line}
          </p>
        );
      })}
    </>
  );
}

export const AnnouncementModal = memo(
  ({ isOpen, onClose, message, onDonate }: { isOpen: boolean; onClose: () => void; message: string; onDonate?: () => void }) => (
    <Modal isOpen={isOpen} onClose={onClose} ariaLabel="Announcement">
      <div className="p-6 pt-12">
        <MarkdownContent text={message} />
        {onDonate && (
          <button
            type="button"
            onClick={onDonate}
            className="text-neutral-300 underline underline-offset-2 decoration-neutral-500 hover:text-white hover:decoration-white transition-colors mb-2"
          >
            Please consider donating.
          </button>
        )}
        <Button onClick={onClose} className="w-full mt-4 bg-white text-black hover:bg-neutral-200">
          Got it!
        </Button>
      </div>
    </Modal>
  )
);

const QrCodeOverlay = memo(({ qrCodeData, onClose }: { qrCodeData: QrCodeData; onClose: () => void }) => (
  <div className="absolute inset-0 z-10 flex flex-col items-center justify-center p-4 rounded-xl">
    <button
      type="button"
      className="absolute inset-0 bg-black/90 backdrop-blur-sm rounded-xl cursor-default"
      onClick={onClose}
      aria-label="Close QR code"
      tabIndex={-1}
    />
    <div className="relative z-10 flex flex-col items-center">
      <div className="bg-white p-4 rounded-lg shadow-2xl">
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
  </div>
));

export const DonationModal = memo(({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) => {
  const [activeQrCode, setActiveQrCode] = useState<QrCodeData | null>(null);
  const handleShowQr = useCallback((data: QrCodeData) => setActiveQrCode(data), []);
  const handleCloseQr = useCallback(() => setActiveQrCode(null), []);
  return (
    <Modal isOpen={isOpen} onClose={onClose} ariaLabel="Donation options">
      <div className="p-6">
        <h2 className="text-2xl font-bold text-white text-center mb-2">Support ArtistGrid</h2>
        <p className="text-center text-sm text-neutral-400 mb-6">Your contributions help cover server costs.</p>
        <div className="space-y-6 max-h-[70vh] overflow-y-auto no-scrollbar">
          <DonationContent onShowQr={handleShowQr} />
        </div>
        {activeQrCode && <QrCodeOverlay qrCodeData={activeQrCode} onClose={handleCloseQr} />}
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
              href="https://instagram.com/edideaur"
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-white"
            >
              edideaur
            </a>.
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
