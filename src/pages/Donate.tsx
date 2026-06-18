import { useState, useCallback, lazy, Suspense } from "react";
import { useNavigate } from "react-router-dom";
import { QrCode, Copy as CopyIcon, ArrowLeft, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/use-toast";
import { DONATION_OPTIONS, trackEvent } from "@/src/lib/home-constants";

const QRCode = lazy(() => import("qrcode.react").then((mod) => ({ default: mod.QRCodeSVG })));

interface QrCodeData {
  value: string;
  uriScheme: string;
  name: string;
}

export default function Donate() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [activeQrCode, setActiveQrCode] = useState<QrCodeData | null>(null);

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
          <div className="flex flex-col gap-3">
            {DONATION_OPTIONS.URL.map((opt) => (
              <Button key={opt.name} asChild className="font-semibold rounded-lg w-full h-11">
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
      </div>

      {activeQrCode && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex flex-col items-center justify-center p-4 backdrop-blur-sm"
          onClick={() => setActiveQrCode(null)}
        >
          <div className="bg-white p-4 rounded-lg shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <Suspense fallback={<div className="w-[240px] h-[240px] rounded-lg bg-neutral-800 animate-pulse" />}>
              <QRCode
                value={activeQrCode.uriScheme ? `${activeQrCode.uriScheme}:${activeQrCode.value}` : activeQrCode.value}
                size={240}
                level="H"
              />
            </Suspense>
          </div>
          <p className="text-sm font-semibold text-white mt-4">{activeQrCode.name}</p>
          <p className="text-xs text-neutral-300 mt-2 break-all text-center px-4 font-mono max-w-sm">{activeQrCode.value}</p>
          <Button
            variant="ghost"
            className="mt-4 text-neutral-400 hover:text-white hover:bg-white/10 rounded-lg"
            onClick={() => setActiveQrCode(null)}
          >
            <X className="w-4 h-4 mr-2" />
            Close
          </Button>
        </div>
      )}
    </div>
  );
}
