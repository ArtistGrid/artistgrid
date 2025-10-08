// app/page.tsx 
"use client";

import { useToast } from "@/components/ui/use-toast";
import { useState, useEffect, useCallback, useMemo, useDeferredValue, memo, useRef, FC, ReactNode } from "react";
import dynamic from "next/dynamic";
import Image from "next/image";
import Fuse from "fuse.js";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuCheckboxItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { FileSpreadsheet, X, QrCode, Search, Filter, Info, CircleSlash, Copy as CopyIcon, HandCoins } from "lucide-react";

const QRCode = dynamic(() => import("qrcode.react").then(mod => mod.QRCodeSVG), {
  ssr: false,
  loading: () => <div className="w-[240px] h-[240px] rounded-lg bg-neutral-200 dark:bg-neutral-800 animate-pulse" />,
});

const ASSET_BASE = "https://assets.artistgrid.cx";
const LOCAL_STORAGE_KEYS = {
  USE_SHEET: 'artistGridUseSheet',
  FILTER_OPTIONS: 'artistGridFilterOptions',
};
const DATA_SOURCES = {
  LIVE: "https://sheets.artistgrid.cx/artists.csv",
  BACKUP: "/backup.csv",
  REMOTE_BACKUP: "https://artistgrid.cx/backup.csv",
};
const DONATION_OPTIONS = {
  URL: [
    { name: "PayPal", value: "https://paypal.me/eduardprigoana", isUrl: true }, { name: "Patreon", value: "https://www.patreon.com/c/ArtistGrid", isUrl: true }, { name: "Liberapay", value: "https://liberapay.com/ArtistGrid/", isUrl: true }, { name: "Ko-fi", value: "https://ko-fi.com/artistgrid", isUrl: true },
  ],
  CRYPTO: [
    { name: "Bitcoin (BTC)", value: "bc1qn3ufzs4nk62lhfykx78atzjxx8hxptzmrm0ckr", uriScheme: "bitcoin" }, { name: "Ethereum (ETH)", value: "0x0b39d5D190fDB127d13458bd2086cDf950D3034C", uriScheme: "ethereum" }, { name: "Litecoin (LTC)", value: "ltc1q88kpywg3jxxg0jsx9c4e9d8gqs7p07fqptjgtv", uriScheme: "litecoin" }, { name: "Monero (XMR)", value: "bc1qn3ufzs4nk62lhfykx78atzjxx8hxptzmrm0ckr", uriScheme: "monero" },
  ]
};

interface Artist { name: string; url: string; imageFilename: string; isLinkWorking: boolean; isUpdated: boolean; isStarred: boolean; }
interface FilterOptions { showWorking: boolean; showUpdated: boolean; showStarred: boolean; showAlts: boolean; }
interface QrCodeData { value: string; uriScheme: string; name: string; }

const getImageFilename = (artistName: string): string => artistName.toLowerCase().replace(/[^a-z0-9]/g, "") + ".webp";
const normalizeUrl = (url: string): string => {
  const googleSheetId = url.match(new RegExp("https://docs\\.google\\.com/spreadsheets/d/([a-zA-Z0-9-_]+)"))?.[1];
  return googleSheetId ? `https://trackerhub.cx/sh/${googleSheetId}` : url;
};
const parseCSV = (csvText: string): Artist[] => {
  const lines = csvText.trim().split("\n");
  const items: Artist[] = [];
  const nameCount: Record<string, number> = {};
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i]?.trim();
    if (!line) continue;
    const matches = line.match(/(".*?"|[^",]+)(?=\s*,|\s*$)/g)?.map(v => v.replace(/^"|"$/g, "").trim()) || [];
    if (matches.length < 6) continue;
    const [name, url, _credit, isLinkWorkingStr, isUpdatedStr, isStarredStr] = matches;
    if (name && url) {
      const count = nameCount[name] || 0;
      nameCount[name] = count + 1;
      const newName = count === 0 ? name : count === 1 ? `${name} [Alt]` : `${name} [Alt #${count}]`;
      items.push({
        name: newName, url, imageFilename: getImageFilename(newName),
        isLinkWorking: isLinkWorkingStr?.toLowerCase() === 'yes', isUpdated: isUpdatedStr?.toLowerCase() === 'yes', isStarred: isStarredStr?.toLowerCase() === 'yes',
      });
    }
  }
  return items;
};

function useLocalStorage<T>(key: string, initialValue: T): [T, (value: T | ((val: T) => T)) => void] {
  const [storedValue, setStoredValue] = useState<T>(() => {
    if (typeof window === 'undefined') return initialValue;
    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch (error) {
      console.error(error);
      return initialValue;
    }
  });

  const setValue = (value: T | ((val: T) => T)) => {
    try {
      const valueToStore = value instanceof Function ? value(storedValue) : value;
      setStoredValue(valueToStore);
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(key, JSON.stringify(valueToStore));
      }
    } catch (error) {
      console.error(error);
    }
  };

  return [storedValue, setValue];
}
const useIsMobile = () => {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => { setIsMobile(/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)); }, []);
  return isMobile;
};
const useKeyPress = (targetKey: string, callback: () => void) => {
  const callbackRef = useRef(callback);
  useEffect(() => { callbackRef.current = callback; }, [callback]);
  useEffect(() => {
    const handler = (event: KeyboardEvent) => { if (event.key === targetKey) { event.preventDefault(); callbackRef.current(); } };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [targetKey]);
};

const Modal: FC<{ isOpen: boolean; onClose: () => void; children: ReactNode; ariaLabel: string; }> = ({ isOpen, onClose, children, ariaLabel }) => {
  useKeyPress("Escape", onClose);
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" onClick={onClose} role="dialog" aria-modal="true" aria-label={ariaLabel} data-state={isOpen ? "open" : "closed"}>
      <div className="bg-neutral-950 border border-neutral-800 shadow-2xl shadow-black/30 rounded-xl w-full max-w-md relative data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-top-[2%] data-[state=open]:slide-in-from-top-[2%]" onClick={(e) => e.stopPropagation()} data-state={isOpen ? "open" : "closed"}>
        <Button variant="ghost" size="icon" onClick={onClose} className="absolute top-3 right-3 text-neutral-500 hover:text-white transition-colors h-8 w-8 rounded-lg" aria-label="Close popup"><X className="w-5 h-5" /></Button>
        {children}
      </div>
    </div>
  );
};
const GallerySkeleton = memo(() => (
  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 sm:gap-6">{Array.from({ length: 18 }).map((_, i) => (<div key={i} className="bg-neutral-900 border-neutral-800 rounded-xl p-3"><Skeleton className="aspect-square w-full mb-3 bg-neutral-700 rounded-lg" /><Skeleton className="h-4 w-3/4 bg-neutral-700 rounded-md" /></div>))}</div>
));
const HeaderSkeleton = memo(() => (
    <header className="sticky top-0 z-30 py-4 bg-black/70 backdrop-blur-lg border-b border-neutral-900 mb-8">
        <div className="max-w-7xl mx-auto flex items-center gap-4 px-4 sm:px-6">
            <h1 className="text-2xl font-bold bg-gradient-to-b from-neutral-50 to-neutral-400 bg-clip-text text-transparent hidden sm:block">ArtistGrid</h1>
            <div className="sm:hidden flex items-center gap-2"><Skeleton className="h-10 w-10 rounded-lg bg-neutral-800" /><Skeleton className="h-10 w-10 rounded-lg bg-neutral-800" /></div>
            <Skeleton className="h-12 flex-1 rounded-xl bg-neutral-800" />
            <div className="flex items-center gap-2">
                <Skeleton className="h-10 w-10 rounded-lg bg-neutral-800" />
                <div className="hidden sm:flex items-center gap-2"><Skeleton className="h-10 w-10 rounded-lg bg-neutral-800" /><Skeleton className="h-10 w-10 rounded-lg bg-neutral-800" /></div>
            </div>
        </div>
    </header>
));
const ErrorMessage = memo(({ message }: { message: string }) => (
  <div className="min-h-screen bg-black flex items-center justify-center p-4"><div className="text-center bg-neutral-900 border border-red-500/30 p-8 rounded-xl max-w-md"><h1 className="text-2xl font-bold text-white mb-2">Error Loading Artists</h1><p className="text-neutral-400">{message}</p></div></div>
));
const NoResultsMessage = memo(({ searchQuery }: { searchQuery: string }) => (
  <div className="text-center py-20 animate-in fade-in-0 duration-500 flex flex-col items-center"><CircleSlash className="w-16 h-16 text-neutral-700 mb-4" /><p className="text-lg font-medium text-neutral-300">No Artists Found</p><p className="text-neutral-500 mt-1">{searchQuery ? `Your search for "${searchQuery}" didn't return any results.` : "Try adjusting your filters."}</p></div>
));
const ArtistCard = memo(function ArtistCard({ artist, priority, onClick }: { artist: Artist; priority: boolean; onClick: (url: string) => void; }) {
  const googleSheetUrl = useMemo(() => {
    const googleSheetId = artist.url.match(new RegExp("https://docs\\.google\\.com/spreadsheets/d/([a-zA-Z0-9-_]+)"))?.[1];
    return googleSheetId ? `https://docs.google.com/spreadsheets/d/${googleSheetId}/htmlview` : null;
  }, [artist.url]);

  return (
    <div role="link" tabIndex={0} className="bg-neutral-950 border border-neutral-800 hover:border-white/30 hover:bg-neutral-900 hover:-translate-y-1 group rounded-xl overflow-hidden cursor-pointer transition-all duration-300 ease-out hover:shadow-[0_0_30px_rgba(255,255,255,0.12)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-black focus-visible:ring-white" onClick={() => onClick(artist.url)} onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && onClick(artist.url)}>
      <div className="p-0 flex flex-col h-full">
        <div className="relative aspect-square w-full bg-neutral-900 overflow-hidden">
          <Image src={`${ASSET_BASE}/${artist.imageFilename}`} alt={artist.name} fill sizes="(max-width: 640px) 50vw, (max-width: 768px) 33vw, (max-width: 1024px) 25vw, (max-width: 1280px) 20vw, 16vw" className="object-cover transition-transform duration-300 ease-out group-hover:scale-105" priority={priority} quality={70} draggable={false} />
        </div>
        <div className="flex items-start justify-between p-3">
          <h3 className="font-semibold text-white text-sm leading-tight flex-1 mr-2">{artist.name}</h3>
          {googleSheetUrl && (<a href={googleSheetUrl} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} aria-label={`Open original Google Sheet for ${artist.name}`} className="flex-shrink-0 p-1 -m-1 rounded-md text-neutral-500 group-hover:text-white transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white"><FileSpreadsheet className="w-4 h-4" /></a>)}
        </div>
      </div>
    </div>
  );
});
const ArtistGridDisplay = memo(({ artists, onArtistClick }: { artists: Artist[], onArtistClick: (url: string) => void }) => (
  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 sm:gap-6">{artists.map((artist, i) => (<div key={artist.imageFilename} className="animate-in fade-in-0 slide-in-from-bottom-4 duration-500" style={{ animationDelay: `${Math.min(i, 50) * 20}ms` }}><ArtistCard artist={artist} priority={i < 18} onClick={onArtistClick} /></div>))}</div>
));
const FilterControls = memo(({ options, onFilterChange, useSheet, setUseSheet }: { options: FilterOptions; onFilterChange: (key: keyof FilterOptions, value: boolean) => void; useSheet: boolean; setUseSheet: (value: boolean) => void; }) => (
  <DropdownMenu><DropdownMenuTrigger asChild><Button variant="outline" size="icon" aria-label="Filter artists" className="bg-neutral-900 border-neutral-800 hover:bg-neutral-800 hover:border-neutral-700 text-white hover:text-white"><Filter className="w-4 h-4" /></Button></DropdownMenuTrigger><DropdownMenuContent align="end" className="w-64 bg-neutral-950 border-neutral-800 text-neutral-200"><DropdownMenuLabel>Display Options</DropdownMenuLabel><DropdownMenuSeparator className="bg-neutral-800" /><DropdownMenuCheckboxItem checked={options.showWorking} onCheckedChange={(c) => onFilterChange('showWorking', !!c)}>Show working links only</DropdownMenuCheckboxItem><DropdownMenuCheckboxItem checked={options.showUpdated} onCheckedChange={(c) => onFilterChange('showUpdated', !!c)}>Show updated trackers only</DropdownMenuCheckboxItem><DropdownMenuCheckboxItem checked={options.showStarred} onCheckedChange={(c) => onFilterChange('showStarred', !!c)}>Show starred trackers only</DropdownMenuCheckboxItem><DropdownMenuCheckboxItem checked={options.showAlts} onCheckedChange={(c) => onFilterChange('showAlts', !!c)}>Show alt trackers</DropdownMenuCheckboxItem><DropdownMenuSeparator className="bg-neutral-800" /><DropdownMenuLabel>Data Source</DropdownMenuLabel><DropdownMenuCheckboxItem checked={useSheet} onCheckedChange={setUseSheet}>Use remote CSV</DropdownMenuCheckboxItem></DropdownMenuContent></DropdownMenu>
));
const HeaderActions = memo(({ onInfoClick, onDonateClick }: { onInfoClick: () => void; onDonateClick: () => void; }) => (
  <div className="flex items-center gap-2"><Button variant="outline" size="icon" onClick={onDonateClick} aria-label="Donate" className="bg-neutral-900 border-neutral-800 hover:bg-neutral-800 hover:border-neutral-700 text-white hover:text-white"><HandCoins className="w-5 h-5" /></Button><Button variant="outline" size="icon" onClick={onInfoClick} aria-label="About ArtistGrid" className="bg-neutral-900 border-neutral-800 hover:bg-neutral-800 hover:border-neutral-700 text-white hover:text-white"><Info className="w-5 h-5" /></Button></div>
));
const Header = memo(({ searchQuery, setSearchQuery, filterOptions, onFilterChange, onInfoClick, onDonateClick, useSheet, setUseSheet }: { searchQuery: string; setSearchQuery: (q: string) => void; filterOptions: FilterOptions; onFilterChange: (k: keyof FilterOptions, v: boolean) => void; onInfoClick: () => void; onDonateClick: () => void; useSheet: boolean; setUseSheet: (v: boolean) => void; }) => (
  <header className="sticky top-0 z-30 py-4 bg-black/70 backdrop-blur-lg border-b border-neutral-900 mb-8">
    <div className="max-w-7xl mx-auto flex items-center gap-4 px-4 sm:px-6">
      <h1 className="text-2xl font-bold bg-gradient-to-b from-neutral-50 to-neutral-400 bg-clip-text text-transparent hidden sm:block">ArtistGrid</h1>
      <div className="sm:hidden"><HeaderActions onInfoClick={onInfoClick} onDonateClick={onDonateClick} /></div>
      <div className="relative flex-1">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-500 pointer-events-none" />
        <Input type="text" placeholder="Search artists..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="bg-neutral-900 border-2 border-neutral-800 text-white placeholder:text-neutral-500 focus:border-white/50 focus:ring-2 focus:ring-white/20 transition-all duration-300 rounded-xl w-full pl-12 pr-10 py-3" aria-label="Search artists" />
        {searchQuery && (<Button variant="ghost" size="icon" className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 rounded-lg text-neutral-500 hover:text-white hover:bg-neutral-700" onClick={() => setSearchQuery("")} aria-label="Clear search"><X className="w-4 h-4" /></Button>)}
      </div>
      <div className="flex items-center gap-2">
        <FilterControls options={filterOptions} onFilterChange={onFilterChange} useSheet={useSheet} setUseSheet={setUseSheet} />
        <div className="hidden sm:flex"><HeaderActions onInfoClick={onInfoClick} onDonateClick={onDonateClick} /></div>
      </div>
    </div>
  </header>
));
const InfoModal = memo(({ isOpen, onClose, visitorCount, onDonate }: { isOpen: boolean; onClose: () => void; visitorCount: number | null; onDonate: () => void; }) => (
  <Modal isOpen={isOpen} onClose={onClose} ariaLabel="About ArtistGrid"><div className="p-6 pt-12 text-center"><h2 className="text-xl font-bold text-white mb-4">About ArtistGrid</h2><div className="text-neutral-300 space-y-4 text-sm sm:text-base"><p>Maintained by & <a href="https://prigoana.com" target="_blank" rel="noopener noreferrer" className="underline hover:text-white transition-colors">edideaur</a>.</p><p>Original trackers are in <a href="https://docs.google.com/spreadsheets/d/1XLlR7PnniA8WjLilQPu3Rhx1aLZ4MT2ysIeXp8XSYJA/htmlview" target="_blank" rel="noopener noreferrer" className="underline hover:text-white transition-colors">this Google Sheet</a>.</p><p className="text-xs text-neutral-500">We are not affiliated with TrackerHub or the artists.</p><div className="flex items-center justify-center gap-4 text-base pt-2"><a href="https://github.com/ArtistGrid" target="_blank" rel="noopener noreferrer" className="underline hover:text-white transition-colors">GitHub</a><a href="https://discord.gg/RdBeMZ2m8S" target="_blank" rel="noopener noreferrer" className="underline hover:text-white transition-colors">Discord</a><button onClick={() => { onClose(); onDonate(); }} className="underline hover:text-white transition-colors">Donate</button></div>{visitorCount !== null && (<p className="text-sm text-neutral-500 pt-4">You are visitor #{visitorCount.toLocaleString()}</p>)}</div></div></Modal>
));
const QrCodeOverlay = memo(({ qrCodeData, onClose }: { qrCodeData: QrCodeData; onClose: () => void; }) => (
  <div className="absolute inset-0 z-10 bg-black/90 flex flex-col items-center justify-center p-4 rounded-xl backdrop-blur-sm" onClick={onClose}><div className="bg-white p-4 rounded-lg shadow-2xl" onClick={(e) => e.stopPropagation()}><QRCode value={`${qrCodeData.uriScheme}:${qrCodeData.value}`} size={240} level="H" /></div><p className="text-sm font-semibold text-white mt-4">{qrCodeData.name}</p><p className="text-xs text-neutral-300 mt-2 break-all text-center px-4 font-mono">{qrCodeData.value}</p><Button variant="ghost" className="mt-4 text-neutral-400 hover:text-white hover:bg-white/10 rounded-lg" onClick={onClose}>Close</Button></div>
));
const DonationModal = memo(({ isOpen, onClose }: { isOpen: boolean; onClose: () => void; }) => {
  const [activeQrCode, setActiveQrCode] = useState<QrCodeData | null>(null);
  const { toast } = useToast();
  const handleCopy = useCallback((text: string, name: string) => { navigator.clipboard.writeText(text).then(() => { toast({ title: "Copied!", description: `${name} address copied to clipboard.`, }); }); }, [toast]);
  const closeQrCode = useCallback(() => setActiveQrCode(null), []);
  useEffect(() => { if (!isOpen) { setActiveQrCode(null); } }, [isOpen]);
  return (<Modal isOpen={isOpen} onClose={onClose} ariaLabel="Donation options"><div className="p-6"><h2 className="text-2xl font-bold text-white text-center mb-2">Support ArtistGrid</h2><p className="text-center text-sm text-neutral-400 mb-6">Your contributions help cover server costs.</p><div className="space-y-6 max-h-[70vh] overflow-y-auto pr-2 -mr-2"><div className="grid grid-cols-2 gap-3">{DONATION_OPTIONS.URL.map((opt) => (<Button key={opt.name} asChild className="font-semibold rounded-lg"><a href={opt.value} target="_blank" rel="noopener noreferrer" className="w-full">{opt.name}</a></Button>))}</div><div className="relative flex items-center"><div className="flex-grow border-t border-neutral-800" /><span className="flex-shrink mx-4 text-xs text-neutral-500 uppercase">Or Crypto</span><div className="flex-grow border-t border-neutral-800" /></div><div className="space-y-4">{DONATION_OPTIONS.CRYPTO.map((option) => (<div key={option.name}><label className="text-sm font-medium text-neutral-300 mb-1 block">{option.name}</label><div className="flex items-center gap-2"><Input readOnly value={option.value} className="bg-neutral-900 border-neutral-700 text-neutral-400 font-mono truncate text-xs rounded-lg" /><Button variant="outline" size="icon" onClick={() => setActiveQrCode({ ...option })} className="bg-neutral-900 border-neutral-700 text-neutral-300 hover:bg-neutral-800 hover:text-white flex-shrink-0 rounded-lg" aria-label={`Show ${option.name} QR code`}><QrCode className="h-4 w-4" /></Button><Button variant="outline" size="icon" onClick={() => handleCopy(option.value, option.name)} className="bg-neutral-900 border-neutral-700 text-neutral-300 hover:bg-neutral-800 hover:text-white flex-shrink-0 rounded-lg" aria-label={`Copy ${option.name} address`}><CopyIcon className="h-4 w-4" /></Button></div></div>))}</div></div>{activeQrCode && <QrCodeOverlay qrCodeData={activeQrCode} onClose={closeQrCode} />}</div></Modal>);
});

export default function ArtistGallery() {
  const [allArtists, setAllArtists] = useState<Artist[]>([]);
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [errorMessage, setErrorMessage] = useState("");
  const [visitorCount, setVisitorCount] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeModal, setActiveModal] = useState<null | "info" | "donate">(null);

  const defaultFilters: FilterOptions = { showWorking: true, showUpdated: true, showStarred: false, showAlts: false };
  const [filterOptions, setFilterOptions] = useLocalStorage<FilterOptions>(LOCAL_STORAGE_KEYS.FILTER_OPTIONS, defaultFilters);
  const [useSheet, setUseSheet] = useLocalStorage<boolean>(LOCAL_STORAGE_KEYS.USE_SHEET, false);
  
  const deferredQuery = useDeferredValue(searchQuery.trim());
  const isMobile = useIsMobile();
  
  useEffect(() => {
    const controller = new AbortController();
    const { signal } = controller;

    const loadData = async () => {
      setStatus("loading");
      const urlsToTry = useSheet ? [DATA_SOURCES.LIVE, DATA_SOURCES.REMOTE_BACKUP, DATA_SOURCES.BACKUP] : [DATA_SOURCES.BACKUP, DATA_SOURCES.LIVE, DATA_SOURCES.REMOTE_BACKUP];
      for (const url of urlsToTry) {
        try {
          const response = await fetch(url, { signal, cache: "no-store" });
          if (!response.ok) throw new Error(`Status ${response.status}`);
          const csvText = await response.text();
          setAllArtists(parseCSV(csvText));
          setStatus("success");
          return;
        } catch (error) {
          if (error instanceof Error && error.name === 'AbortError') return;
          console.warn(`Failed to fetch from ${url}:`, error);
        }
      }
      setErrorMessage("Could not load artist data from any available source.");
      setStatus("error");
    };

    const loadVisitorCount = async () => {
      try {
        const res = await fetch("https://121124.prigoana.com/artistgrid.cx/", { signal });
        if (res.ok) setVisitorCount(Number((await res.json()).count));
      } catch (err) {
        if (err instanceof Error && err.name !== 'AbortError') console.warn("Visitor count fetch failed:", err);
      }
    };
    
    loadData();
    loadVisitorCount();
    
    return () => controller.abort();
  }, [useSheet]);

  const handleFilterChange = useCallback((key: keyof FilterOptions, value: boolean) => {
    setFilterOptions(prev => ({ ...prev, [key]: value }));
  }, [setFilterOptions]);

  const artistsPassingFilters = useMemo(() => allArtists.filter(artist => 
    (filterOptions.showWorking ? artist.isLinkWorking : true) &&
    (filterOptions.showUpdated ? artist.isUpdated : true) &&
    (filterOptions.showStarred ? artist.isStarred : true) &&
    (filterOptions.showAlts ? true : !artist.name.toLowerCase().includes("[alt"))
  ), [allArtists, filterOptions]);

  const fuse = useMemo(() => new Fuse(artistsPassingFilters, { keys: ["name"], threshold: 0.35, ignoreLocation: true }), [artistsPassingFilters]);

  const filteredArtists = useMemo(() => {
    if (!deferredQuery) return artistsPassingFilters;
    return fuse.search(deferredQuery).map((r) => r.item);
  }, [artistsPassingFilters, fuse, deferredQuery]);

  const handleArtistClick = useCallback((url: string) => {
    const finalUrl = normalizeUrl(url);
    if (isMobile) window.location.href = finalUrl; else window.open(finalUrl, "_blank", "noopener,noreferrer");
  }, [isMobile]);

  const closeModal = useCallback(() => setActiveModal(null), []);
  const openInfoModal = useCallback(() => setActiveModal('info'), []);
  const openDonationModal = useCallback(() => setActiveModal('donate'), []);

  const renderContent = () => {
    switch (status) {
      case "loading":
        return (
          <>
            <HeaderSkeleton />
            <main className="max-w-7xl mx-auto p-4 sm:p-6"><GallerySkeleton /></main>
          </>
        );
      case "error":
        return <ErrorMessage message={errorMessage} />;
      case "success":
        return (
          <>
            <Header 
              searchQuery={searchQuery} setSearchQuery={setSearchQuery} filterOptions={filterOptions}
              onFilterChange={handleFilterChange} onInfoClick={openInfoModal} onDonateClick={openDonationModal}
              useSheet={useSheet} setUseSheet={setUseSheet}
            />
            <main className="max-w-7xl mx-auto px-4 sm:px-6" aria-hidden={!!activeModal}>
              {filteredArtists.length > 0 ? (
                <ArtistGridDisplay artists={filteredArtists} onArtistClick={handleArtistClick} />
              ) : (
                <NoResultsMessage searchQuery={searchQuery} />
              )}
            </main>
          </>
        );
    }
  };

  return (
    <div className="min-h-screen bg-black text-white pb-8">
      <DonationModal isOpen={activeModal === "donate"} onClose={closeModal} />
      <InfoModal isOpen={activeModal === "info"} onClose={closeModal} visitorCount={visitorCount} onDonate={openDonationModal} />
      {renderContent()}
    </div>
  );
}