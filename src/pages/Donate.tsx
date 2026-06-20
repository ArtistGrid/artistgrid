import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DonationContent, QrOverlay, type QrCodeData } from "@/src/components/crypto-donation-section";

export default function Donate() {
  const navigate = useNavigate();
  const [activeQrCode, setActiveQrCode] = useState<QrCodeData | null>(null);
  const handleShowQr = useCallback((data: QrCodeData) => setActiveQrCode(data), []);

  return (
    <div className="min-h-screen bg-neutral-950 text-white">
      <div className="max-w-lg mx-auto px-4 py-8">
        <button
          type="button"
          onClick={() => navigate("/")}
          className="flex items-center gap-2 text-neutral-400 hover:text-white text-sm mb-8 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </button>

        <h1 className="text-3xl font-bold text-white text-center mb-2">Support ArtistGrid</h1>
        <p className="text-center text-sm text-neutral-400 mb-8">Your contributions help cover server costs.</p>

        <div className="space-y-6">
          <DonationContent onShowQr={handleShowQr} urlButtonClassName="h-11" />
        </div>
      </div>

      {activeQrCode && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center p-4">
          <button
            type="button"
            className="absolute inset-0 bg-black/90 backdrop-blur-sm"
            onClick={() => setActiveQrCode(null)}
            aria-label="Close QR code"
            tabIndex={-1}
          />
          <div className="relative z-10 flex flex-col items-center">
            <QrOverlay {...activeQrCode} onClose={() => setActiveQrCode(null)} />
            <Button
              variant="ghost"
              className="mt-4 text-neutral-400 hover:text-white hover:bg-white/10 rounded-lg"
              onClick={() => setActiveQrCode(null)}
            >
              <X className="w-4 h-4 mr-2" />
              Close
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
