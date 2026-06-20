import { useCallback, lazy, Suspense } from "react";
import { QrCode, Copy as CopyIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/use-toast";
import { cn } from "@/lib/utils";
import { DONATION_OPTIONS, trackEvent } from "@/src/lib/home-constants";
const QRCode = lazy(() => import("qrcode.react").then((mod) => ({ default: mod.QRCodeSVG })));
interface QrCodeData {
  value: string;
  uriScheme: string;
  name: string;
}
interface CryptoDonationSectionProps {
  onShowQr: (data: QrCodeData) => void;
}
interface DonationContentProps {
  onShowQr: (data: QrCodeData) => void;
  urlButtonClassName?: string;
}
export { type QrCodeData };
export function DonationContent({ onShowQr, urlButtonClassName }: DonationContentProps) {
  return (
    <>
      <div className="flex flex-col gap-3">
        {DONATION_OPTIONS.URL.map((opt) => (
          <Button key={opt.name} asChild className={cn("font-semibold rounded-lg w-full", urlButtonClassName)}>
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
      <CryptoDonationSection onShowQr={onShowQr} />
    </>
  );
}
function CryptoDonationSection({ onShowQr }: CryptoDonationSectionProps) {
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
  const handleShowQr = useCallback(
    (option: (typeof DONATION_OPTIONS.CRYPTO)[0]) => {
      trackEvent("Show QR Code", { crypto: option.name });
      onShowQr({ ...option });
    },
    [onShowQr]
  );
  return (
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
  );
}
export function QrOverlay({ value, uriScheme, name, onClose }: QrCodeData & { onClose: () => void }) {
  return (
    <div className="bg-white p-4 rounded-lg shadow-2xl">
      <Suspense fallback={<div className="w-[240px] h-[240px] rounded-lg bg-neutral-800 animate-pulse" />}>
        <QRCode value={uriScheme ? `${uriScheme}:${value}` : value} size={240} level="H" />
      </Suspense>
      <p className="text-sm font-semibold text-neutral-900 mt-3 text-center">{name}</p>
      <p className="text-xs text-neutral-600 mt-1 break-all text-center font-mono">{value}</p>
    </div>
  );
}
