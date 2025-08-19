"use client";
import { useToast } from "@/components/ui/use-toast";
import { useState, useEffect, useCallback, useMemo, useDeferredValue, memo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { FileSpreadsheet, Menu, X, QrCode, Search, Filter, Info, CircleSlash, Copy as CopyIcon } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import dynamic from "next/dynamic";
import Image from "next/image";
import Fuse from "fuse.js";

const QRCode = dynamic(async () => (await import("qrcode.react")).QRCodeSVG, {
  ssr: false,
  loading: () => <div className="w-[240px] h-[240px] rounded-lg bg-neutral-200 dark:bg-neutral-800 animate-pulse" />,
});

const ASSET_BASE = "https://assets.artistgrid.cx";

interface Artist {
  name: string;
  url: string;
  imageFilename: string;
  linksWork: boolean;
  updated: boolean;
  best: boolean;
}

interface FilterOptions {
  showWorking: boolean;
  showUpdated: boolean;
  showStarred: boolean;
}

interface QrCodeData {
  value: string;
  uriScheme: string;
  name: string;
}

type UrlOption = { name: string; value: string; isUrl: true };
type CryptoOption = { name: string; value: string; uriScheme: string };
type DonationOption = UrlOption | CryptoOption;

const donationOptions: DonationOption[] = [
  { name: "PayPal", value: "https://paypal.me/eduardprigoana", isUrl: true },
  { name: "Patreon", value: "https://www.patreon.com/c/ArtistGrid", isUrl: true },
  { name: "Liberapay", value: "https://liberapay.com/ArtistGrid/", isUrl: true },
  { name: "Ko-fi", value: "https://ko-fi.com/artistgrid", isUrl: true },
  { name: "Bitcoin (BTC)", value: "bc1qn3ufzs4nk62lhfykx78atzjxx8hxptzmrm0ckr", uriScheme: "bitcoin" },
  { name: "Ethereum (ETH)", value: "0x0b39d5D190fDB127d13458bd2086cDf950D3034C", uriScheme: "ethereum" },
  { name: "Litecoin (LTC)", value: "ltc1q88kpywg3jxxg0jsx9c4e9d8gqs7p07fqptjgtv", uriScheme: "litecoin" },
  { name: "Monero (XMR)", value: "bc1qn3ufzs4nk62lhfykx78atzjxx8hxptzmrm0ckr", uriScheme: "monero" },
];

const urlOptions = donationOptions.filter((opt): opt is UrlOption => "isUrl" in opt);
const cryptoOptions = donationOptions.filter((opt): opt is CryptoOption => "uriScheme" in opt);

const getImageFilename = (artistName: string): string => artistName.toLowerCase().replace(/[^a-z0-9]/g, "") + ".webp";
const parseCSV = (csvText: string): Artist[] => {
  const lines = csvText.trim().split("\n");
  const items: Artist[] = [];
  const nameCount: Record<string, number> = {};
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i]?.trim();
    if (!line) continue;
    const matches = line.match(/(".*?"|[^",]+)(?=\s*,|\s*$)/g)?.map(v => v.replace(/^"|"$/g, "").trim()) || [];
    if (matches.length < 6) continue;
    const [name, url, _credit, linksWorkStr, updatedStr, bestStr] = matches;
    if (name && url) {
      const count = nameCount[name] || 0;
      nameCount[name] = count + 1;
      const newName = count === 0 ? name : count === 1 ? `${name} [Alt]` : `${name} [Alt #${count}]`;
      items.push({ name: newName, url, imageFilename: getImageFilename(newName), linksWork: (linksWorkStr || "").toLowerCase() === 'yes', updated: (updatedStr || "").toLowerCase() === 'yes', best: (bestStr || "").toLowerCase() === 'yes', });
    }
  }
  return items;
};
const normalizeUrl = (url: string): string => {
  const googleSheetId = url.match(/https:\/\/docs\.google\.com\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/)?.[1];
  return googleSheetId ? `https://trackerhub.cx/sh/${googleSheetId}` : url;
};
const useIsMobile = () => {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => { setIsMobile(/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)); }, []);
  return isMobile;
};
const useKeyPress = (targetKey: string, callback: () => void) => {
  useEffect(() => {
    const handler = (event: KeyboardEvent) => { if (event.key === targetKey) callback(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [targetKey, callback]);
};

const Header = ({
  searchQuery,
  setSearchQuery,
  isSmallScreen
}: {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  isSmallScreen: boolean;
}) => (
  <header className="mb-8 text-center">
    <h1 className="text-4xl sm:text-5xl font-bold mb-6 bg-gradient-to-b from-neutral-50 to-neutral-300 bg-clip-text text-transparent">
      {isSmallScreen ? "Artist Grid" : "TrackerHub Artist Grid"}
    </h1>
    <div className="relative max-w-lg mx-auto">
      <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-500 pointer-events-none" />
      <Input
        type="text"
        placeholder="Search artists..."
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        className="bg-neutral-900 border-2 border-neutral-800 text-white placeholder:text-neutral-500 focus:border-white/50 focus:ring-2 focus:ring-white/20 transition-all duration-300 rounded-full w-full pl-12 pr-10 py-3"
        aria-label="Search artists"
      />
      {searchQuery && (
        <Button
          variant="ghost"
          size="icon"
          className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full text-neutral-500 hover:text-white hover:bg-neutral-700"
          onClick={() => setSearchQuery("")}
          aria-label="Clear search"
        >
          <X className="w-4 h-4" />
        </Button>
      )}
    </div>
  </header>
);

const GallerySkeleton = () => (
    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-5 xl:grid-cols-6 gap-4 sm:gap-6">
    {Array.from({ length: 18 }).map((_, i) => (
      <Card key={i} className="bg-neutral-900 border-neutral-800 rounded-xl">
        <CardContent className="p-3">
          <Skeleton className="aspect-square w-full mb-3 bg-neutral-700 rounded-md animate-pulse" />
          <Skeleton className="h-4 w-3/4 bg-neutral-700 rounded-full animate-pulse" />
        </CardContent>
      </Card>
    ))}
  </div>
);

const ErrorMessage = ({ message }: { message: string }) => (
    <div className="min-h-screen bg-black flex items-center justify-center p-4">
    <div className="text-center bg-neutral-900 border border-red-500/30 p-8 rounded-lg max-w-md">
      <h1 className="text-2xl font-bold text-white mb-2">Error Loading Artists</h1>
      <p className="text-neutral-400">{message}</p>
    </div>
  </div>
);

const ArtistCard = memo(function ArtistCard({
  artist,
  priority,
  onClick,
}: {
  artist: Artist;
  priority: boolean;
  onClick: (url: string) => void;
}) {
  const googleSheetId = artist.url.match(/https:\/\/docs\.google\.com\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/)?.[1];
  const googleSheetUrl = googleSheetId ? `https://docs.google.com/spreadsheets/d/${googleSheetId}/htmlview` : null;

  return (
    <div
      role="link"
      tabIndex={0}
      className="bg-neutral-950 border border-neutral-800 hover:border-white/30 hover:bg-neutral-900 hover:-translate-y-1 group rounded-xl overflow-hidden cursor-pointer
                 transition-all duration-300 ease-out 
                 hover:shadow-[0_0_25px_rgba(255,255,255,0.08)]
                 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-black focus-visible:ring-white"
      onClick={() => onClick(artist.url)}
      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && onClick(artist.url)}
    >
      <div className="p-0 flex flex-col h-full">
        <div className="relative aspect-square w-full bg-neutral-900 overflow-hidden">
          <Image
            src={`${ASSET_BASE}/${artist.imageFilename}`}
            alt={artist.name}
            fill
            sizes="(max-width: 640px) 50vw, (max-width: 768px) 33vw, (max-width: 1024px) 25vw, (max-width: 1280px) 20vw, 16vw"
            className="object-cover transition-transform duration-300 ease-out group-hover:scale-105"
            priority={priority}
            quality={70}
            draggable={false}
          />
        </div>
        <div className="flex items-start justify-between p-3">
          <h3 className="font-semibold text-white text-sm leading-tight flex-1 mr-2">{artist.name}</h3>
          {googleSheetUrl && (
            <a
              href={googleSheetUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              aria-label={`Open original Google Sheet for ${artist.name}`}
              className="flex-shrink-0 p-1 -m-1 rounded-full text-neutral-500 group-hover:text-white transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white"
            >
              <FileSpreadsheet className="w-4 h-4" />
            </a>
          )}
        </div>
      </div>
    </div>
  );
});

const Modal = ({ isOpen, onClose, children, ariaLabel, }: { isOpen: boolean; onClose: () => void; children: React.ReactNode; ariaLabel: string; }) => {
  useKeyPress("Escape", onClose);
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0"
      onClick={onClose} role="dialog" aria-modal="true" aria-label={ariaLabel} data-state={isOpen ? "open" : "closed"} >
      <div className="bg-neutral-950 border-2 border-neutral-800 rounded-2xl w-full max-w-md relative data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-top-[2%] data-[state=open]:slide-in-from-top-[2%]"
        onClick={(e) => e.stopPropagation()} data-state={isOpen ? "open" : "closed"} >
        <Button variant="ghost" size="icon" onClick={onClose} className="absolute top-3 right-3 text-neutral-500 hover:text-white transition-colors h-8 w-8 rounded-full" aria-label="Close popup" >
          <X className="w-5 h-5" />
        </Button>
        {children}
      </div>
    </div>
  );
};

const InfoContent = ({ visitorCount, onDonate, }: { visitorCount: number | null; onDonate: () => void; }) => (
    <>
    <h2 className="text-xl font-bold text-white text-center mb-4 flex items-center justify-center gap-2.5">
        <Info className="w-5 h-5"/>
        About ArtistGrid
    </h2>
    <div className="text-neutral-300 space-y-4 text-sm sm:text-base px-2">
      <p>Maintained by <a href="https://discord.com/users/454283756258197544" target="_blank" rel="noopener noreferrer" className="underline hover:text-white transition-colors">justAMZ</a> & <a href="https://prigoana.com" target="_blank" rel="noopener noreferrer" className="underline hover:text-white transition-colors">eduardprigoana</a>. Original trackers are in <a href="https://docs.google.com/spreadsheets/d/1XLlR7PnniA8WjLilQPu3Rhx1aLZ4MT2ysIeXp8XSYJA/htmlview" target="_blank" rel="noopener noreferrer" className="underline hover:text-white transition-colors">this Google Sheet</a>.</p>
      <p>Note: If a tracker doesn't load, visit the link above. We are not affiliated with TrackerHub or the artists.</p>
      <div className="flex items-center justify-center gap-2 text-base pt-2">
        <a href="https://github.com/ArtistGrid" target="_blank" rel="noopener noreferrer" className="underline hover:text-white transition-colors">GitHub</a>
        <span className="text-neutral-600">|</span>
        <a href="https://discord.gg/RdBeMZ2m8S" target="_blank" rel="noopener noreferrer" className="underline hover:text-white transition-colors">Discord</a>
        <span className="text-neutral-600">|</span>
        <button onClick={onDonate} className="underline hover:text-white transition-colors">Donate</button>
      </div>
      {visitorCount !== null && (<p className="text-sm text-neutral-500 text-center pt-2">You are visitor #{visitorCount.toLocaleString()}</p>)}
    </div>
  </>
);

const DonationModal = ({ isOpen, onClose, }: { isOpen: boolean; onClose: () => void; }) => {
  const [activeQrCode, setActiveQrCode] = useState<QrCodeData | null>(null);
  const { toast } = useToast();
  const handleCopy = useCallback((text: string, name: string) => { navigator.clipboard.writeText(text).then(() => { toast({ title: "Copied!", description: `${name} address copied to clipboard.`, }); }); }, [toast]);
  useEffect(() => { if (!isOpen) { setActiveQrCode(null); } }, [isOpen]);
  return (<Modal isOpen={isOpen} onClose={onClose} ariaLabel="Donation options"><div className="p-6"><h2 className="text-2xl font-bold text-white text-center mb-6">Support ArtistGrid</h2><div className="space-y-6 max-h-[70vh] overflow-y-auto pr-2 -mr-2"><div className="grid grid-cols-2 gap-3">{urlOptions.map((opt) => (<Button key={opt.name} asChild className="font-semibold"><a href={opt.value} target="_blank" rel="noopener noreferrer" className="w-full">{opt.name}</a></Button>))}</div><div className="relative flex items-center"><div className="flex-grow border-t border-neutral-800" /><span className="flex-shrink mx-4 text-xs text-neutral-500 uppercase">Or Crypto</span><div className="flex-grow border-t border-neutral-800" /></div><div className="space-y-4">{cryptoOptions.map((option) => (<div key={option.name}><label className="text-sm font-medium text-neutral-300 mb-1 block">{option.name}</label><div className="flex items-center gap-2"><Input readOnly value={option.value} className="bg-neutral-900 border-neutral-700 text-neutral-400 font-mono truncate text-xs" /><Button variant="outline" size="icon" onClick={() => setActiveQrCode({ ...option })} className="bg-neutral-900 border-neutral-700 text-neutral-300 hover:bg-neutral-800 hover:text-white flex-shrink-0" aria-label={`Show ${option.name} QR code`}><QrCode className="h-4 w-4" /></Button><Button variant="outline" size="icon" onClick={() => handleCopy(option.value, option.name)} className="bg-neutral-900 border-neutral-700 text-neutral-300 hover:bg-neutral-800 hover:text-white flex-shrink-0" aria-label={`Copy ${option.name} address`}><CopyIcon className="h-4 w-4" /></Button></div></div>))}</div></div>{activeQrCode && (<div className="absolute inset-0 z-10 bg-black/90 flex flex-col items-center justify-center p-4 rounded-xl backdrop-blur-sm" onClick={() => setActiveQrCode(null)}><div className="bg-white p-4 rounded-lg shadow-2xl" onClick={(e) => e.stopPropagation()}><QRCode value={`${activeQrCode.uriScheme}:${activeQrCode.value}`} size={240} level="H" /></div><p className="text-sm font-semibold text-white mt-4">{activeQrCode.name}</p><p className="text-xs text-neutral-300 mt-2 break-all text-center px-4 font-mono">{activeQrCode.value}</p><Button variant="ghost" className="mt-4 text-neutral-400 hover:text-white hover:bg-white/10" onClick={() => setActiveQrCode(null)}>Close</Button></div>)}</div></Modal>);
};

const SettingsAndInfoModal = ({ isOpen, onClose, filterOptions, onFilterChange, visitorCount, onDonate }: { isOpen: boolean; onClose: () => void; filterOptions: FilterOptions; onFilterChange: (key: keyof FilterOptions, value: boolean) => void; visitorCount: number | null; onDonate: () => void; }) => (
    <Modal isOpen={isOpen} onClose={onClose} ariaLabel="Menu and Settings">
        <div className="p-6 space-y-8">
            <div>
                <h2 className="text-xl font-bold text-white text-center mb-4 flex items-center justify-center gap-2.5">
                    <Filter className="w-5 h-5"/>
                    Filters
                </h2>
                <div className="space-y-4 bg-neutral-900 p-4 rounded-lg border border-neutral-800">
                    <div className="flex items-center justify-between">
                        <Label htmlFor="working-links" className="text-neutral-300 cursor-pointer">Show only trackers with working links</Label>
                        <Switch id="working-links" checked={filterOptions.showWorking} onCheckedChange={(checked) => onFilterChange('showWorking', checked)} className="data-[state=checked]:bg-neutral-300 data-[state=unchecked]:bg-neutral-700"/>
                    </div>
                    <div className="flex items-center justify-between">
                        <Label htmlFor="updated-trackers" className="text-neutral-300 cursor-pointer">Show only updated trackers</Label>
                        <Switch id="updated-trackers" checked={filterOptions.showUpdated} onCheckedChange={(checked) => onFilterChange('showUpdated', checked)} className="data-[state=checked]:bg-neutral-300 data-[state=unchecked]:bg-neutral-700"/>
                    </div>
                    <div className="flex items-center justify-between">
                        <Label htmlFor="starred-trackers" className="text-neutral-300 cursor-pointer">Show only starred trackers</Label>
                        <Switch id="starred-trackers" checked={filterOptions.showStarred} onCheckedChange={(checked) => onFilterChange('showStarred', checked)} className="data-[state=checked]:bg-neutral-300 data-[state=unchecked]:bg-neutral-700"/>
                    </div>
                </div>
            </div>
            <hr className="border-neutral-800/50"/>
            <InfoContent visitorCount={visitorCount} onDonate={onDonate}/>
        </div>
    </Modal>
);

export default function ArtistGallery() {
  const [allArtists, setAllArtists] = useState<Artist[]>([]);
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [errorMessage, setErrorMessage] = useState("");
  const [visitorCount, setVisitorCount] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeModal, setActiveModal] = useState<null | "menu" | "donate">(null);
  const [filterOptions, setFilterOptions] = useState<FilterOptions>({ showWorking: true, showUpdated: true, showStarred: false, });
  const [windowWidth, setWindowWidth] = useState(0);

  const deferredQuery = useDeferredValue(searchQuery.trim());
  const isMobile = useIsMobile();
  const isSmallScreen = windowWidth < 640;

  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    handleResize();
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const fetchArtists = async () => {
      try {
        const response = await fetch("https://artistgrid.cx/backup.csv", { cache: "no-store", signal: controller.signal });
        if (!response.ok) throw new Error("Primary data source failed.");
        const text = await response.text();
        setAllArtists(parseCSV(text));
        setStatus("success");
      } catch (err) {
        console.warn("Primary fetch failed, trying backup:", err);
        try {
          const backupResponse = await fetch("/backup.csv", { cache: "force-cache", signal: controller.signal });
          if (!backupResponse.ok) throw new Error("Backup data source failed.");
          const backupText = await backupResponse.text();
          setAllArtists(parseCSV(backupText));
          setStatus("success");
        } catch (backupErr) {
          console.error("Backup fetch failed:", backupErr);
          setErrorMessage(backupErr instanceof Error ? backupErr.message : "An unknown error occurred.");
          setStatus("error");
        }
      }
    };
    fetchArtists();
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    fetch("https://111224.artistgrid.cx/artistgrid.cx/", { signal: controller.signal })
      .then((res) => res.ok ? res.json() : null).then((data) => data && setVisitorCount(Number(data.count)))
      .catch((err) => console.warn("Visitor count fetch failed:", err));
    return () => controller.abort();
  }, []);

  const handleFilterChange = (key: keyof FilterOptions, value: boolean) => { setFilterOptions(prev => ({ ...prev, [key]: value })); };
  const artistsPassingFilters = useMemo(() => allArtists.filter(artist => {
      if (filterOptions.showWorking && !artist.linksWork) return false;
      if (filterOptions.showUpdated && !artist.updated) return false;
      if (filterOptions.showStarred && !artist.best) return false;
      return true;
  }), [allArtists, filterOptions]);
  const fuse = useMemo(() => new Fuse(artistsPassingFilters, { keys: ["name"], threshold: 0.35, ignoreLocation: true }), [artistsPassingFilters]);
  const filteredArtists = useMemo(() => {
    if (!deferredQuery) return artistsPassingFilters;
    return fuse.search(deferredQuery).map((r) => r.item);
  }, [artistsPassingFilters, fuse, deferredQuery]);
  const handleArtistClick = useCallback((url: string) => {
    const finalUrl = normalizeUrl(url);
    if (isMobile) window.location.href = finalUrl; else window.open(finalUrl, "_blank", "noopener,noreferrer");
  }, [isMobile]);

  if (status === "loading") { return <div className="min-h-screen bg-black p-4 sm:p-6"><div className="max-w-7xl mx-auto"><GallerySkeleton /></div></div>; }
  if (status === "error") { return <ErrorMessage message={errorMessage} />; }

  return (
    <div className="min-h-screen bg-black text-white">
      <DonationModal isOpen={activeModal === "donate"} onClose={() => setActiveModal(null)} />
      <SettingsAndInfoModal isOpen={activeModal === "menu"} onClose={() => setActiveModal(null)} filterOptions={filterOptions} onFilterChange={handleFilterChange} visitorCount={visitorCount} onDonate={() => setActiveModal("donate")} />
      <button onClick={() => setActiveModal(activeModal === "menu" ? null : "menu")}
        className="fixed top-4 left-4 sm:top-6 sm:left-6 z-40 p-3 bg-neutral-900/80 backdrop-blur-sm border border-neutral-700 text-neutral-300 hover:bg-neutral-800 hover:text-white hover:border-neutral-600 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-black focus-visible:ring-white transition-all rounded-full"
        aria-label={activeModal === "menu" ? "Close menu" : "Open menu"} >
        {activeModal === "menu" ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
      </button>

      <main className="p-4 sm:p-6" aria-hidden={!!activeModal}>
        <div className="max-w-7xl mx-auto">
          <Header searchQuery={searchQuery} setSearchQuery={setSearchQuery} isSmallScreen={isSmallScreen} />
          
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-5 xl:grid-cols-6 gap-4 sm:gap-6">
            {filteredArtists.map((artist, i) => (
              <div key={artist.imageFilename} className="animate-in fade-in-0 slide-in-from-bottom-4 duration-500" style={{ animationDelay: `${i * 25}ms` }}>
                <ArtistCard artist={artist} priority={i < 12} onClick={handleArtistClick} />
              </div>
            ))}
          </div>

          {filteredArtists.length === 0 && (
            <div className="text-center py-20 animate-in fade-in-0 duration-500 flex flex-col items-center">
              <CircleSlash className="w-16 h-16 text-neutral-700 mb-4"/>
              <p className="text-lg font-medium text-neutral-300">No Artists Found</p>
              <p className="text-neutral-500 mt-1">
                {searchQuery ? `Your search for "${searchQuery}" didn't return any results.` : "Try adjusting your filters."}
              </p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}