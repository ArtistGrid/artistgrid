"use client";
import { useToast } from "@/components/ui/use-toast";
import { useState, useEffect, useCallback, useMemo, useDeferredValue } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Copy as CopyIcon, Menu, X, QrCode, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import dynamic from "next/dynamic";
import Image from "next/image";
import Fuse from "fuse.js";

const QRCode = dynamic(async () => (await import("qrcode.react")).QRCodeSVG, {
  ssr: false,
  loading: () => <div className="w-[240px] h-[240px] rounded-lg bg-neutral-200 dark:bg-neutral-800" />,
});

const ASSET_BASE = "https://assets.artistgrid.cx";

interface Artist {
  name: string;
  url: string;
  imageFilename: string;
}

interface QrCodeData {
  value: string;
  uriScheme: string;
}

type UrlOption = { name: string; value: string; isUrl: true };
type CryptoOption = { name: string; value: string; uriScheme: string };
const donationOptions: (UrlOption | CryptoOption)[] = [
  { name: "PayPal", value: "https://paypal.me/eduardprigoana", isUrl: true },
  { name: "Patreon", value: "https://www.patreon.com/c/ArtistGrid", isUrl: true },
  { name: "Liberapay", value: "https://liberapay.com/ArtistGrid/", isUrl: true },
  { name: "Ko-fi", value: "https://ko-fi.com/artistgrid", isUrl: true },
  { name: "Bitcoin (BTC)", value: "bc1qn3ufzs4nk62lhfykx78atzjxx8hxptzmrm0ckr", uriScheme: "bitcoin" },
  { name: "Ethereum (ETH)", value: "0x0b39d5D190fDB127d13458bd2086cDf950D3034C", uriScheme: "ethereum" },
  { name: "Litecoin (LTC)", value: "ltc1q88kpywg3jxxg0jsx9c4e9d8gqs7p07fqptjgtv", uriScheme: "litecoin" },
  { name: "Monero (XMR)", value: "bc1qn3ufzs4nk62lhfykx78atzjxx8hxptzmrm0ckr", uriScheme: "monero" },
];

const urlOptions = donationOptions.filter((opt): opt is UrlOption => "isUrl" in opt) as UrlOption[];
const cryptoOptions = donationOptions.filter((opt): opt is CryptoOption => "uriScheme" in opt) as CryptoOption[];

const getImageFilename = (artistName: string): string =>
  artistName.toLowerCase().replace(/[^a-z0-9]/g, "") + ".webp";

const parseCSV = (csvText: string): Artist[] => {
  const lines = csvText.trim().split("\n");
  const items: { name: string; url: string }[] = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i]?.trim();
    if (!line) continue;
    const matches = line.match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g);
    if (!matches || matches.length < 2) continue;
    const name = matches[0].replace(/^"|"$/g, "").trim();
    const url = matches[1].replace(/^"|"$/g, "").trim();
    if (name && url) items.push({ name, url });
  }

  const nameCount: Record<string, number> = {};
  return items.map((artist) => {
    const base = artist.name;
    const count = nameCount[base] || 0;
    nameCount[base] = count + 1;
    let newName = base;
    if (count === 1) newName = `${base} [Alt]`;
    else if (count > 1) newName = `${base} [Alt #${count}]`;
    return { ...artist, name: newName, imageFilename: getImageFilename(newName) };
  });
};

const normalizeUrl = (url: string) => {
  const m = url.match(/https:\/\/docs\.google\.com\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  return m ? `https://trackerhub.cx/sh/${m[1]}` : url;
};

const InfoContent = ({
  isModal,
  visitorCount,
  onDonate,
}: {
  isModal: boolean;
  visitorCount: number | null;
  onDonate: () => void;
}) => (
  <div className={isModal ? "bg-neutral-950 border-2 border-neutral-800 p-6 max-w-2xl rounded-2xl" : ""}>
    <h2 className="text-2xl font-bold text-white text-center mb-4">About ArtistGrid</h2>
    <div className="text-neutral-300 space-y-4 text-sm sm:text-base">
      <p>
        This website is owned & maintained by{" "}
        <a
          href="https://discord.com/users/454283756258197544"
          target="_blank"
          rel="noopener noreferrer"
          className="underline hover:text-white transition-colors"
        >
          justAMZ
        </a>{" "}
        and{" "}
        <a
          href="https://prigoana.com"
          target="_blank"
          rel="noopener noreferrer"
          className="underline hover:text-white transition-colors"
        >
          eduardprigoana
        </a>
        . All original trackers can be found in{" "}
        <a
          href="https://docs.google.com/spreadsheets/d/1zoOIaNbBvfuL3sS3824acpqGxOdSZSIHM8-nI9C-Vfc/htmlview"
          target="_blank"
          rel="noopener noreferrer"
          className="underline hover:text-white transition-colors"
        >
          this Google Sheet
        </a>
        .
      </p>
      <p>
        Note: If a tracker doesn't load or has little content, visit the link above. We are not affiliated with
        TrackerHub or the artists listed here.
      </p>
      <div className="flex items-center justify-center gap-2 text-base">
        <a
          href="https://github.com/ArtistGrid"
          target="_blank"
          rel="noopener noreferrer"
          className="underline hover:text-white transition-colors"
        >
          GitHub
        </a>
        <span className="text-neutral-600">|</span>
        <a
          href="https://discord.gg/RdBeMZ2m8S"
          target="_blank"
          rel="noopener noreferrer"
          className="underline hover:text-white transition-colors"
        >
          Discord
        </a>
        <span className="text-neutral-600">|</span>
        <button onClick={onDonate} className="underline hover:text-white transition-colors">
          Donate
        </button>
      </div>
      {visitorCount !== null && (
        <p className="text-sm text-neutral-500 text-center pt-2">
          You are visitor #{visitorCount.toLocaleString()}
        </p>
      )}
    </div>
  </div>
);

export default function ArtistGallery() {
  const [artists, setArtists] = useState<Artist[]>([]);
  const [visitorCount, setVisitorCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showInfoModal, setShowInfoModal] = useState(false);
  const [showDonationModal, setShowDonationModal] = useState(false);
  const [activeQrCode, setActiveQrCode] = useState<QrCodeData | null>(null);

  const [searchQuery, setSearchQuery] = useState("");
  const deferredQuery = useDeferredValue(searchQuery.trim());

  const { toast } = useToast();

  // Visitor count (separate, non-blocking)
  useEffect(() => {
    const ac = new AbortController();
    fetch("https://111224.artistgrid.cx/artistgrid.cx/", { signal: ac.signal })
      .then((res) => (res.ok ? res.json() : Promise.reject("Failed to load counter")))
      .then((data) => setVisitorCount(Number(data.count) || null))
      .catch(() => {});
    return () => ac.abort();
  }, []);

  // Load artists with fallback
  useEffect(() => {
    let mounted = true;
    const ac = new AbortController();

    const load = async () => {
      try {
        const response = await fetch("https://sheets.artistgrid.cx/artists.csv", {
          signal: ac.signal,
          cache: "no-store",
        });
        if (!response.ok) throw new Error("Failed to fetch artist data. The service may be temporarily unavailable.");
        const text = await response.text();
        if (!mounted) return;
        const parsed = parseCSV(text);
        setArtists(parsed);
      } catch (err) {
        try {
          const local = await fetch("/backup.csv", { signal: ac.signal, cache: "force-cache" });
          if (!local.ok) throw new Error("Failed to load backup artist data.");
          const text = await local.text();
          if (!mounted) return;
          setArtists(parseCSV(text));
        } catch (backupErr) {
          if (!mounted) return;
          setError(
            backupErr instanceof Error ? backupErr.message : "An unknown error occurred while loading data."
          );
        }
      } finally {
        if (mounted) setLoading(false);
      }
    };

    load();
    return () => {
      mounted = false;
      ac.abort();
    };
  }, []);

  // Build Fuse index once per artists change
  const fuse = useMemo(
    () =>
      new Fuse(artists, {
        keys: ["name"],
        threshold: 0.34,
        ignoreLocation: true,
      }),
    [artists]
  );

  // Derived filtered list (no extra state or effect)
  const filteredArtists = useMemo(() => {
    if (!deferredQuery) return artists;
    return fuse.search(deferredQuery).map((r) => r.item);
  }, [artists, fuse, deferredQuery]);

  // Key handling for modals
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (activeQrCode) setActiveQrCode(null);
      else if (showDonationModal) setShowDonationModal(false);
      else if (showInfoModal) setShowInfoModal(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [activeQrCode, showDonationModal, showInfoModal]);

  const handleArtistClick = useCallback((url: string) => {
    window.open(normalizeUrl(url), "_blank", "noopener,noreferrer");
  }, []);

  const handleCopy = useCallback(
    (text: string, name?: string) => {
      navigator.clipboard.writeText(text).then(() => {
        toast({
          title: "Copied!",
          description: name ? `${name} address copied to clipboard.` : "URL copied to clipboard.",
        });
      });
    },
    [toast]
  );

  const handleCopyArtistUrl = useCallback(
    (e: React.MouseEvent, url: string) => {
      e.stopPropagation();
      const fullUrl = normalizeUrl(url);
      navigator.clipboard.writeText(fullUrl).then(() => {
        (e.currentTarget as HTMLElement)?.animate?.(
          [{ transform: "scale(1)" }, { transform: "scale(1.2)" }, { transform: "scale(1)" }],
          { duration: 200, easing: "ease-in-out" }
        );
        toast({ title: "Copied!", description: "URL copied to clipboard." });
      });
    },
    [toast]
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-black p-4 sm:p-6">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 sm:gap-6">
            {Array.from({ length: 18 }).map((_, i) => (
              <Card key={i} className="bg-neutral-900 border-neutral-800 rounded-lg">
                <CardContent className="p-3">
                  <Skeleton className="aspect-square w-full mb-3 bg-neutral-700 rounded-md animate-pulse" />
                  <Skeleton className="h-4 w-3/4 bg-neutral-700 rounded-full animate-pulse" />
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-4">
        <div className="text-center bg-neutral-900 border border-red-500/30 p-8 rounded-lg">
          <h1 className="text-2xl font-bold text-white mb-2">Error Loading Artists</h1>
          <p className="text-neutral-400">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white p-4 sm:p-6">
      {/* Info toggle button (desktop) */}
      <button
        onClick={() => setShowInfoModal((s) => !s)}
        className="fixed top-4 left-4 sm:top-6 sm:left-6 z-50 p-3 bg-neutral-900 border border-neutral-700 text-neutral-300 hover:bg-neutral-800 hover:text-white hover:border-neutral-600 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-black focus-visible:ring-white transition-all rounded-full hidden sm:flex"
        aria-label={showInfoModal ? "Close info modal" : "Open info menu"}
      >
        {showInfoModal ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
      </button>

      {showInfoModal && (
        <div
          className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm transition-opacity duration-300 ease-in-out hidden sm:block"
          onClick={() => setShowInfoModal(false)}
        >
          <div className="mx-4 mt-4" onClick={(e) => e.stopPropagation()}>
            <InfoContent
              isModal
              visitorCount={visitorCount}
              onDonate={() => {
                setShowInfoModal(false);
                setShowDonationModal(true);
              }}
            />
          </div>
        </div>
      )}

      {/* Donation Modal */}
      {showDonationModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 transition-opacity duration-300 ease-in-out"
          onClick={() => {
            setShowDonationModal(false);
            setActiveQrCode(null);
          }}
        >
          <div
            className="bg-neutral-950 border-2 border-neutral-800 rounded-2xl w-full max-w-md p-6 relative"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => {
                setShowDonationModal(false);
                setActiveQrCode(null);
              }}
              className="absolute top-3 right-3 text-neutral-500 hover:text-white transition-colors"
              aria-label="Close donation popup"
            >
              <X className="w-6 h-6" />
            </button>
            <h2 className="text-2xl font-bold text-white text-center mb-2">Donate</h2>
            <div className="space-y-6 max-h-[70vh] overflow-y-auto pr-2">
              <div className="grid grid-cols-2 gap-4">
                {urlOptions.map((option) => (
                  <a
                    href={option.value}
                    target="_blank"
                    rel="noopener noreferrer"
                    key={option.name}
                    className={option.name === "Ko-fi" ? "col-span-1" : ""}
                  >
                    <Button className="w-full bg-white text-black hover:bg-neutral-200 font-semibold">
                      {option.name}
                    </Button>
                  </a>
                ))}
              </div>
              <div className="relative flex items-center">
                <div className="flex-grow border-t border-neutral-800" />
                <span className="flex-shrink mx-4 text-xs text-neutral-500 uppercase">Or</span>
                <div className="flex-grow border-t border-neutral-800" />
              </div>
              <div className="space-y-4">
                {cryptoOptions.map((option) => (
                  <div key={option.name}>
                    <label className="text-sm font-medium text-neutral-300 mb-1 block">{option.name}</label>
                    <div className="flex items-center gap-2">
                      <Input
                        readOnly
                        value={option.value}
                        className="bg-neutral-900 border-neutral-700 text-neutral-400 font-mono truncate"
                      />
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => setActiveQrCode({ value: option.value, uriScheme: option.uriScheme })}
                        className="bg-neutral-900 border-neutral-700 text-neutral-300 hover:bg-neutral-800 hover:text-white flex-shrink-0"
                        aria-label={`Show ${option.name} QR code`}
                      >
                        <QrCode className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => handleCopy(option.value, option.name)}
                        className="bg-neutral-900 border-neutral-700 text-neutral-300 hover:bg-neutral-800 hover:text-white flex-shrink-0"
                        aria-label={`Copy ${option.name} address`}
                      >
                        <CopyIcon className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {activeQrCode && (
              <div
                className="absolute inset-0 z-10 bg-black/90 flex flex-col items-center justify-center p-4 rounded-xl backdrop-blur-sm"
                onClick={(e) => {
                  e.stopPropagation();
                  setActiveQrCode(null);
                }}
              >
                <div className="bg-white p-4 rounded-lg shadow-2xl">
                  <QRCode
                    value={`${activeQrCode.uriScheme}:${activeQrCode.value}`}
                    size={240}
                    bgColor="#ffffff"
                    fgColor="#000000"
                    level="H"
                  />
                </div>
                <p className="text-sm text-neutral-300 mt-4 break-all text-center px-4 font-mono">
                  {activeQrCode.value}
                </p>
                <Button
                  variant="ghost"
                  className="mt-4 text-neutral-400 hover:text-white hover:bg-white/10"
                  onClick={() => setActiveQrCode(null)}
                >
                  Close
                </Button>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="max-w-7xl mx-auto">
        <header className="mb-8 text-center">
          <h1 className="text-4xl sm:text-5xl font-bold text-white mb-6">TrackerHub Artist Grid</h1>
          <div className="relative max-w-lg mx-auto">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-500" />
            <Input
              type="text"
              placeholder="Search artists..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-neutral-900 border-2 border-neutral-800 text-white placeholder:text-neutral-500 focus:border-white focus:ring-0 transition-colors duration-200 rounded-full w-full pl-12 pr-4 py-3"
              aria-label="Search artists"
            />
          </div>
        </header>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 sm:gap-6">
          {filteredArtists.map((artist, i) => (
            <Card
              key={artist.imageFilename}
              className="bg-neutral-950 border border-neutral-800 hover:border-neutral-700 hover:bg-neutral-900 hover:-translate-y-1 transition-all duration-300 cursor-pointer group rounded-xl overflow-hidden"
              onClick={() => handleArtistClick(artist.url)}
            >
              <CardContent className="p-0 flex flex-col h-full">
                <div className="relative aspect-square w-full bg-neutral-900 overflow-hidden">
                  <Image
                    src={`${ASSET_BASE}/${artist.imageFilename}`}
                    alt={artist.name}
                    fill
                    sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, (max-width: 1280px) 25vw, (max-width: 1536px) 20vw, 16vw"
                    className="object-cover transition-transform duration-300 group-hover:scale-105"
                    priority={i < 8}
                    quality={70}
                    draggable={false}
                  />
                </div>
                <div className="flex items-start justify-between p-3">
                  <h3 className="font-semibold text-white text-sm leading-tight flex-1 mr-2">{artist.name}</h3>
                  <button
                    onClick={(e) => handleCopyArtistUrl(e, artist.url)}
                    aria-label={`Copy URL for ${artist.name}`}
                    className="flex-shrink-0"
                  >
                    <CopyIcon className="w-4 h-4 text-neutral-500 group-hover:text-white transition-colors" />
                  </button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {filteredArtists.length === 0 && !loading && (
          <div className="text-center py-16">
            <p className="text-neutral-400">No artists found for "{searchQuery}".</p>
          </div>
        )}

        {/* Mobile footer info */}
        <footer className="mt-16 sm:hidden">
          <div className="bg-neutral-950 border-2 border-neutral-800 p-6 rounded-2xl">
            <InfoContent
              isModal={false}
              visitorCount={visitorCount}
              onDonate={() => setShowDonationModal(true)}
            />
          </div>
        </footer>
      </div>
    </div>
  );
}