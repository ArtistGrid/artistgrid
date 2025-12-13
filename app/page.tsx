// app/page.tsx
"use client";

import { useToast } from "@/components/ui/use-toast";
import { useState, useEffect, useCallback, useMemo, useDeferredValue, memo, useRef, FC, ReactNode } from "react";
import dynamic from "next/dynamic";
import Image from "next/image";
import { useRouter } from "next/navigation";
import Fuse from "fuse.js";
import { usePlayer } from "./providers";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuCheckboxItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { FileSpreadsheet, X, QrCode, Search, Filter, Info, CircleSlash, Copy as CopyIcon, HandCoins, Github, BarChart3, AlertTriangle } from "lucide-react";
import { API_BASE } from "./view/page";

declare global {
  interface Window {
    plausible?: (eventName: string, options?: { props?: Record<string, any> }) => void;
  }
}

const QRCode = dynamic(() => import("qrcode.react").then(mod => mod.QRCodeSVG), { ssr: false, loading: () => <div className="w-[240px] h-[240px] rounded-lg bg-neutral-800 animate-pulse" /> });

const ASSET_BASE = "https://assets.artistgrid.cx";
const LOCAL_STORAGE_KEYS = {
  USE_SHEET: "artistGridUseSheet",
  FILTER_OPTIONS: "artistGridFilterOptions",
  CSV_CACHE_REMOTE: "artistGridCsvCache_remote",
  CSV_CACHE_LOCAL: "artistGridCsvCache_local",
  TRENDS_CACHE: "artistGridTrendsCache",
  MESSAGE_HASH: "artistGridMessageHash"
};
const DATA_SOURCES = {
  BACKUP: "/backup.csv",
  LIVE: "https://sheets.artistgrid.cx/artists.csv",
  REMOTE_BACKUP: "https://artistgrid.cx/backup.csv"
};
const TRENDS_API = "https://trends.artistgrid.cx/";
const CACHE_EXPIRY = 1000 * 60 * 30;
const DONATION_OPTIONS = {
  URL: [
    { name: "PayPal", value: "https://paypal.me/eduardprigoana" },
    { name: "Patreon", value: "https://www.patreon.com/c/ArtistGrid" },
    { name: "Liberapay", value: "https://liberapay.com/ArtistGrid/" },
    { name: "Ko-fi", value: "https://ko-fi.com/artistgrid" }
  ],
  CRYPTO: [
    { name: "Bitcoin (BTC)", value: "bc1qn3ufzs4nk62lhfykx78atzjxx8hxptzmrm0ckr", uriScheme: "bitcoin" },
    { name: "Ethereum (ETH)", value: "0x0b39d5D190fDB127d13458bd2086cDf950D3034C", uriScheme: "ethereum" },
    { name: "Litecoin (LTC)", value: "ltc1q88kpywg3jxxg0jsx9c4e9d8gqs7p07fqptjgtv", uriScheme: "litecoin" },
    { name: "Monero (XMR)", value: "bc1qn3ufzs4nk62lhfykx78atzjxx8hxptzmrm0ckr", uriScheme: "monero" }
  ]
};
const CUSTOM_REDIRECTS: Record<string, string> = {
  ye: "Kanye West",
  drizzy: "Drake",
  carti: "Playboi Carti",
  kendrick: "Kendrick Lamar",
  discord: "https://discord.gg/RdBeMZ2m8S",
  github: "https://github.com/ArtistGrid"
};
const SUFFIXES_TO_STRIP = ["tracker"];

const ANNOUNCEMENT_MESSAGE = `# Welcome.

We've made some updates:

- **New Tab System**: Browse different categories like Released, Best Of, Art, and more
- **Art Gallery**: View album artwork and promotional materials
- **Share Tracks**: Share direct links to specific tracks with friends

Thank You.`;

function hashString(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return hash.toString(36);
}

interface Artist {
  name: string;
  url: string;
  imageFilename: string;
  isLinkWorking: boolean;
  isUpdated: boolean;
  isStarred: boolean;
}
interface FilterOptions {
  showWorking: boolean;
  showUpdated: boolean;
  showStarred: boolean;
  showAlts: boolean;
  sortByTrends: boolean;
}
interface QrCodeData {
  value: string;
  uriScheme: string;
  name: string;
}
interface CacheData<T> {
  data: T;
  timestamp: number;
}

const trackEvent = (eventName: string, props?: Record<string, any>) => {
  if (typeof window !== "undefined" && window.plausible) window.plausible(eventName, props ? { props } : undefined);
};

const DiscordIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" className={className} fill="currentColor">
    <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
  </svg>
);

function getCachedData<T>(key: string): CacheData<T> | null {
  if (typeof window === "undefined") return null;
  try {
    const cached = localStorage.getItem(key);
    if (!cached) return null;
    const entry: CacheData<T> = JSON.parse(cached);
    return entry;
  } catch {
    return null;
  }
}

function isCacheExpired<T>(cache: CacheData<T> | null): boolean {
  if (!cache) return true;
  return Date.now() - cache.timestamp > CACHE_EXPIRY;
}

function setCachedData<T>(key: string, data: T) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(key, JSON.stringify({ data, timestamp: Date.now() }));
  } catch (e) {
    console.warn("Cache write failed:", e);
  }
}

const getImageFilename = (artistName: string): string => artistName.toLowerCase().replace(/[^a-z0-9]/g, "") + ".webp";

const getSheetViewUrl = (url: string): string => {
  const id = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/)?.[1];
  return id ? `https://docs.google.com/spreadsheets/d/${id}/edit` : url;
};

const extractTrackerId = (url: string): string | null => {
  const match = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]{44})/);
  return match ? match[1] : null;
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
    const [name, url, , isLinkWorkingStr, isUpdatedStr, isStarredStr] = matches;
    if (name && url) {
      const count = nameCount[name] || 0;
      nameCount[name] = count + 1;
      const newName = count === 0 ? name : `${name} [Alt${count > 1 ? ` #${count}` : ""}]`;
      items.push({
        name: newName,
        url,
        imageFilename: getImageFilename(newName),
        isLinkWorking: isLinkWorkingStr?.toLowerCase() === "yes",
        isUpdated: isUpdatedStr?.toLowerCase() === "yes",
        isStarred: isStarredStr?.toLowerCase() === "yes"
      });
    }
  }
  return items;
};

const artistsEqual = (a: Artist[], b: Artist[]): boolean => {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i].name !== b[i].name || a[i].url !== b[i].url) return false;
  }
  return true;
};

function useLocalStorage<T>(key: string, initialValue: T): [T, (value: T | ((val: T) => T)) => void] {
  const [storedValue, setStoredValue] = useState<T>(() => {
    if (typeof window === "undefined") return initialValue;
    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch {
      return initialValue;
    }
  });
  const setValue = (value: T | ((val: T) => T)) => {
    try {
      const valueToStore = value instanceof Function ? value(storedValue) : value;
      setStoredValue(valueToStore);
      if (typeof window !== "undefined") window.localStorage.setItem(key, JSON.stringify(valueToStore));
    } catch (e) {
      console.error(e);
    }
  };
  return [storedValue, setValue];
}

const useKeyPress = (targetKey: string, callback: () => void) => {
  const callbackRef = useRef(callback);
  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);
  useEffect(() => {
    const handler = ({ key }: KeyboardEvent) => {
      if (key === targetKey) callbackRef.current();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [targetKey]);
};

const Modal: FC<{ isOpen: boolean; onClose: () => void; children: ReactNode; ariaLabel: string }> = ({ isOpen, onClose, children, ariaLabel }) => {
  useKeyPress("Escape", onClose);
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4" onClick={onClose} role="dialog" aria-modal="true" aria-label={ariaLabel}>
      <div className="bg-neutral-950 border border-neutral-800 shadow-2xl rounded-xl w-full max-w-md relative animate-in fade-in-0 zoom-in-95" onClick={(e) => e.stopPropagation()}>
        <Button variant="ghost" size="icon" onClick={onClose} className="absolute top-3 right-3 text-neutral-500 hover:text-white h-8 w-8 rounded-lg">
          <X className="w-5 h-5" />
        </Button>
        {children}
      </div>
    </div>
  );
};

const AnnouncementModal = memo(({ isOpen, onClose, message }: { isOpen: boolean; onClose: () => void; message: string }) => {
  const renderMarkdown = (text: string) => {
    const lines = text.split("\n");
    return lines.map((line, i) => {
      if (line.startsWith("# ")) {
        return <h2 key={i} className="text-xl font-bold text-white mb-4">{line.slice(2)}</h2>;
      }
      if (line.startsWith("- **")) {
        const match = line.match(/- \*\*(.+?)\*\*: (.+)/);
        if (match) {
          return <p key={i} className="text-neutral-300 mb-2">• <strong className="text-white">{match[1]}</strong>: {match[2]}</p>;
        }
      }
      if (line.trim() === "") return <br key={i} />;
      return <p key={i} className="text-neutral-300 mb-2">{line}</p>;
    });
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} ariaLabel="Announcement">
      <div className="p-6 pt-12">
        {renderMarkdown(message)}
        <Button onClick={onClose} className="w-full mt-4 bg-white text-black hover:bg-neutral-200">Got it!</Button>
      </div>
    </Modal>
  );
});

const GallerySkeleton = memo(() => (
  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 sm:gap-6">
    {Array.from({ length: 18 }).map((_, i) => (
      <div key={i} className="bg-neutral-900 rounded-xl p-3">
        <Skeleton className="aspect-square w-full mb-3 bg-neutral-700 rounded-lg" />
        <Skeleton className="h-4 w-3/4 bg-neutral-700 rounded-md" />
      </div>
    ))}
  </div>
));

const HeaderSkeleton = memo(() => (
  <header className="sticky top-0 z-30 py-4 bg-black/70 backdrop-blur-lg border-b border-neutral-900 mb-8">
    <div className="max-w-7xl mx-auto flex items-center gap-4 px-4 sm:px-6">
      <h1 className="text-2xl font-bold bg-gradient-to-b from-neutral-50 to-neutral-400 bg-clip-text text-transparent hidden sm:block">ArtistGrid</h1>
      <Skeleton className="h-12 flex-1 rounded-xl bg-neutral-800" />
      <Skeleton className="h-10 w-10 rounded-lg bg-neutral-800" />
    </div>
  </header>
));

const ErrorMessage = memo(({ message }: { message: string }) => (
  <div className="min-h-screen bg-black flex items-center justify-center p-4">
    <div className="text-center bg-neutral-900 border border-red-500/30 p-8 rounded-xl max-w-md">
      <h1 className="text-2xl font-bold text-white mb-2">Error Loading Artists</h1>
      <p className="text-neutral-400">{message}</p>
    </div>
  </div>
));

const NoResultsMessage = memo(({ searchQuery }: { searchQuery: string }) => (
  <div className="text-center py-20 flex flex-col items-center">
    <CircleSlash className="w-16 h-16 text-neutral-700 mb-4" />
    <p className="text-lg font-medium text-neutral-300">No Artists Found</p>
    <p className="text-neutral-500 mt-1">
      {searchQuery ? `Your search for "${searchQuery}" didn't return any results.` : "Try adjusting your filters."}
    </p>
  </div>
));

const ArtistCard = memo(function ArtistCard({ isTested, artist, priority, onClick, onSheetClick }: { isTested: boolean, artist: Artist; priority: boolean; onClick: (artist: Artist) => void; onSheetClick: (url: string) => void }) {
  const trackerId = useMemo(() => extractTrackerId(artist.url), [artist.url]);
  return (
    <div
      role="link"
      tabIndex={0}
      className={
        (isTested
          ? "border-yellow-500 hover:border-yellow-200/30"
          : "border-neutral-800 hover:border-white/30")
        + " bg-neutral-950 border hover:bg-neutral-900 hover:-translate-y-1 group rounded-xl overflow-hidden cursor-pointer transition-all duration-300 hover:shadow-[0_0_30px_rgba(255,255,255,0.12)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-black focus-visible:ring-white"}
      onClick={() => onClick(artist)}
      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && onClick(artist)}
    >
      <div className="flex flex-col h-full">
        <div className="relative aspect-square w-full bg-neutral-900 overflow-hidden">
          <Image
            src={`${ASSET_BASE}/${artist.imageFilename}`}
            alt={artist.name}
            fill
            sizes="(max-width: 640px) 50vw, (max-width: 768px) 33vw, (max-width: 1024px) 25vw, (max-width: 1280px) 20vw, 16vw"
            className="object-cover transition-transform duration-300 group-hover:scale-105"
            priority={priority}
            quality={70}
            draggable={false}
          />
        </div>
        <div className="flex items-start justify-between p-3">
          <h3 className="font-semibold text-white text-sm leading-tight flex-1 mr-2">{artist.name}</h3>
          {trackerId && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onSheetClick(getSheetViewUrl(artist.url));
              }}
              className="flex-shrink-0 p-1 -m-1 rounded-md text-neutral-500 group-hover:text-white transition-colors"
              aria-label={`Open sheet for ${artist.name}`}
            >
              <FileSpreadsheet className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
});

const ArtistGridDisplay = memo(({ testedTrackers, artists, onArtistClick, onSheetClick }: { testedTrackers: string[], artists: Artist[]; onArtistClick: (artist: Artist) => void; onSheetClick: (url: string) => void }) => (
  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 sm:gap-6">
    {artists.map((artist, i) => (
      <div key={artist.imageFilename} className="animate-in fade-in-0 slide-in-from-bottom-4 duration-500" style={{ animationDelay: `${Math.min(i, 50) * 20}ms` }}>
        <ArtistCard isTested={testedTrackers.includes(extractTrackerId(artist.url || "") || "")} artist={artist} priority={i < 18} onClick={onArtistClick} onSheetClick={onSheetClick} />
      </div>
    ))}
  </div>
));

const FilterControls = memo(({ options, onFilterChange, useSheet, onUseSheetChange }: { options: FilterOptions; onFilterChange: (key: keyof FilterOptions, value: boolean) => void; useSheet: boolean; onUseSheetChange: (value: boolean) => void }) => (
  <DropdownMenu>
    <DropdownMenuTrigger asChild>
      <Button variant="outline" size="icon" className="bg-neutral-900 border-neutral-800 hover:bg-neutral-800 text-white" aria-label="Filter options">
        <Filter className="w-4 h-4" />
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end" className="w-64 bg-neutral-950 border-neutral-800 text-neutral-200">
      <DropdownMenuLabel>Display Options</DropdownMenuLabel>
      <DropdownMenuSeparator className="bg-neutral-800" />
      <DropdownMenuCheckboxItem checked={options.showWorking} onCheckedChange={(c) => onFilterChange("showWorking", !!c)}>Show working links only</DropdownMenuCheckboxItem>
      <DropdownMenuCheckboxItem checked={options.showUpdated} onCheckedChange={(c) => onFilterChange("showUpdated", !!c)}>Show updated trackers only</DropdownMenuCheckboxItem>
      <DropdownMenuCheckboxItem checked={options.showStarred} onCheckedChange={(c) => onFilterChange("showStarred", !!c)}>Show starred trackers only</DropdownMenuCheckboxItem>
      <DropdownMenuCheckboxItem checked={options.showAlts} onCheckedChange={(c) => onFilterChange("showAlts", !!c)}>Show alt trackers</DropdownMenuCheckboxItem>
      <DropdownMenuSeparator className="bg-neutral-800" />
      <DropdownMenuLabel>Sorting</DropdownMenuLabel>
      <DropdownMenuCheckboxItem checked={options.sortByTrends} onCheckedChange={(c) => onFilterChange("sortByTrends", !!c)}>Sort by popularity</DropdownMenuCheckboxItem>
      <DropdownMenuSeparator className="bg-neutral-800" />
      <DropdownMenuLabel>Data Source</DropdownMenuLabel>
      <DropdownMenuCheckboxItem checked={useSheet} onCheckedChange={onUseSheetChange}>Use remote CSV</DropdownMenuCheckboxItem>
    </DropdownMenuContent>
  </DropdownMenu>
));

const HeaderActions = memo(({ onInfoClick, onDonateClick }: { onInfoClick: () => void; onDonateClick: () => void }) => (
  <div className="flex items-center gap-2">
    <Button
      variant="outline"
      size="icon"
      onClick={() => {
        trackEvent("Header Click", { button: "Discord" });
        window.open("https://discord.gg/RdBeMZ2m8S", "_blank", "noopener,noreferrer");
      }}
      aria-label="Discord"
      className="bg-neutral-900 border-neutral-800 hover:bg-neutral-800 text-white hover:text-white"
    >
      <DiscordIcon className="w-5 h-5" />
    </Button>
    <Button
      variant="outline"
      size="icon"
      onClick={onDonateClick}
      aria-label="Donate"
      className="bg-neutral-900 border-neutral-800 hover:bg-neutral-800 text-white hover:text-white"
    >
      <HandCoins className="w-5 h-5" />
    </Button>
    <Button
      variant="outline"
      size="icon"
      onClick={onInfoClick}
      aria-label="About"
      className="bg-neutral-900 border-neutral-800 hover:bg-neutral-800 text-white hover:text-white"
    >
      <Info className="w-5 h-5" />
    </Button>
  </div>
));

const Header = memo(({ searchQuery, setSearchQuery, filterOptions, onFilterChange, onInfoClick, onDonateClick, useSheet, onUseSheetChange }: {
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  filterOptions: FilterOptions;
  onFilterChange: (k: keyof FilterOptions, v: boolean) => void;
  onInfoClick: () => void;
  onDonateClick: () => void;
  useSheet: boolean;
  onUseSheetChange: (v: boolean) => void;
}) => (
  <header className="sticky top-0 z-30 py-4 bg-black/70 backdrop-blur-lg border-b border-neutral-900 mb-8">
    <div className="max-w-7xl mx-auto flex items-center gap-4 px-4 sm:px-6">
      <h1 className="text-2xl font-bold bg-gradient-to-b from-neutral-50 to-neutral-400 bg-clip-text text-transparent hidden sm:block">ArtistGrid</h1>
      <div className="sm:hidden">
        <HeaderActions onInfoClick={onInfoClick} onDonateClick={onDonateClick} />
      </div>
      <div className="relative flex-1">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-500 pointer-events-none" />
        <Input
          type="text"
          placeholder="Search artists..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="bg-neutral-900 border-2 border-neutral-800 text-white placeholder:text-neutral-500 focus:border-white/50 rounded-xl w-full pl-12 pr-10 h-12"
          aria-label="Search artists"
        />
        {searchQuery && (
          <Button
            variant="ghost"
            size="icon"
            className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 text-neutral-500 hover:text-white"
            onClick={() => setSearchQuery("")}
            aria-label="Clear search"
          >
            <X className="w-4 h-4" />
          </Button>
        )}
      </div>
      <div className="flex items-center gap-2">
        <FilterControls options={filterOptions} onFilterChange={onFilterChange} useSheet={useSheet} onUseSheetChange={onUseSheetChange} />
        <div className="hidden sm:flex">
          <HeaderActions onInfoClick={onInfoClick} onDonateClick={onDonateClick} />
        </div>
      </div>
    </div>
  </header>
));

const InfoModal = memo(({ isOpen, onClose, visitorCount, onDonate }: { isOpen: boolean; onClose: () => void; visitorCount: number | null; onDonate: () => void }) => (
  <Modal isOpen={isOpen} onClose={onClose} ariaLabel="About ArtistGrid">
    <div className="p-6 pt-12 text-center">
      <h2 className="text-xl font-bold text-white mb-4">About ArtistGrid</h2>
      <div className="text-neutral-300 space-y-4 text-sm sm:text-base">
        <p>
          Maintained by{" "}
          <a href="https://instagram.com/edideaur" target="_blank" rel="noopener noreferrer" className="underline hover:text-white">edideaur</a>,{" "}
          <a href="https://discord.com/users/454283756258197544" target="_blank" rel="noopener noreferrer" className="underline hover:text-white">JustAMZ</a>, and{" "}
          <a href="https://sad.ovh" target="_blank" rel="noopener noreferrer" className="underline hover:text-white">fucksophie</a>.
        </p>
        <p>
          Original trackers are in{" "}
          <a href="https://docs.google.com/spreadsheets/d/1XLlR7PnniA8WjLilQPu3Rhx1aLZ4MT2ysIeXp8XSYJA/htmlview" target="_blank" rel="noopener noreferrer" className="underline hover:text-white">this Google Sheet</a>.
        </p>
        <p className="text-xs text-neutral-500">We are not affiliated with TrackerHub or the artists.</p>
        <div className="flex items-center justify-center gap-4 text-base pt-2">
          <a href="https://github.com/ArtistGrid" target="_blank" rel="noopener noreferrer" className="underline hover:text-white">GitHub</a>
          <a href="https://discord.gg/RdBeMZ2m8S" target="_blank" rel="noopener noreferrer" className="underline hover:text-white">Discord</a>
          <a href="https://plausible.canine.tools/artistgrid.cx/" target="_blank" rel="noopener noreferrer" className="underline hover:text-white">Analytics</a>
          <button onClick={() => { onClose(); onDonate(); }} className="underline hover:text-white">Donate</button>
        </div>
        {visitorCount !== null && (
          <p className="text-sm text-neutral-500 pt-4">You are visitor #{visitorCount.toLocaleString()}</p>
        )}
      </div>
    </div>
  </Modal>
));

const QrCodeOverlay = memo(({ qrCodeData, onClose }: { qrCodeData: QrCodeData; onClose: () => void }) => (
  <div className="absolute inset-0 z-10 bg-black/90 flex flex-col items-center justify-center p-4 rounded-xl backdrop-blur-sm" onClick={onClose}>
    <div className="bg-white p-4 rounded-lg shadow-2xl" onClick={(e) => e.stopPropagation()}>
      <QRCode value={`${qrCodeData.uriScheme}:${qrCodeData.value}`} size={240} level="H" />
    </div>
    <p className="text-sm font-semibold text-white mt-4">{qrCodeData.name}</p>
    <p className="text-xs text-neutral-300 mt-2 break-all text-center px-4 font-mono">{qrCodeData.value}</p>
    <Button variant="ghost" className="mt-4 text-neutral-400 hover:text-white hover:bg-white/10 rounded-lg" onClick={onClose}>Close</Button>
  </div>
));

const DonationModal = memo(({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) => {
  const [activeQrCode, setActiveQrCode] = useState<QrCodeData | null>(null);
  const { toast } = useToast();

  const handleCopy = useCallback((text: string, name: string) => {
    trackEvent("Copy Address", { crypto: name });
    navigator.clipboard.writeText(text).then(() => {
      toast({ title: "Copied!", description: `${name} address copied.` });
    });
  }, [toast]);

  const handleShowQr = useCallback((option: typeof DONATION_OPTIONS.CRYPTO[0]) => {
    trackEvent("Show QR Code", { crypto: option.name });
    setActiveQrCode({ ...option });
  }, []);

  useEffect(() => {
    if (!isOpen) setActiveQrCode(null);
  }, [isOpen]);

  return (
    <Modal isOpen={isOpen} onClose={onClose} ariaLabel="Donation options">
      <div className="p-6">
        <h2 className="text-2xl font-bold text-white text-center mb-2">Support ArtistGrid</h2>
        <p className="text-center text-sm text-neutral-400 mb-6">Your contributions help cover server costs.</p>
        <div className="space-y-6 max-h-[70vh] overflow-y-auto pr-2 -mr-2">
          <div className="grid grid-cols-2 gap-3">
            {DONATION_OPTIONS.URL.map((opt) => (
              <Button key={opt.name} asChild className="font-semibold rounded-lg">
                <a href={opt.value} target="_blank" rel="noopener noreferrer">{opt.name}</a>
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
                  <Input readOnly value={option.value} className="bg-neutral-900 border-neutral-700 text-neutral-400 font-mono truncate text-xs rounded-lg" />
                  <Button variant="outline" size="icon" onClick={() => handleShowQr(option)} className="bg-neutral-900 border-neutral-700 text-neutral-300 hover:bg-neutral-800 hover:text-white flex-shrink-0 rounded-lg" aria-label={`Show ${option.name} QR code`}>
                    <QrCode className="h-4 w-4" />
                  </Button>
                  <Button variant="outline" size="icon" onClick={() => handleCopy(option.value, option.name)} className="bg-neutral-900 border-neutral-700 text-neutral-300 hover:bg-neutral-800 hover:text-white flex-shrink-0 rounded-lg" aria-label={`Copy ${option.name} address`}>
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

const Footer = memo(({ displayedCount, totalCount, onDonateClick, visitorCount }: { displayedCount: number; totalCount: number; onDonateClick: () => void; visitorCount: number | null }) => (
  <footer className="max-w-7xl mx-auto px-4 sm:px-6 py-8 mt-12 border-t border-neutral-800">
    <div className="flex flex-col items-center gap-6">
      <p className="text-sm text-neutral-400">{displayedCount} of {totalCount} trackers displayed</p>
      <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-3">
        <a href="https://github.com/ArtistGrid" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm text-neutral-400 hover:text-white transition-colors">
          <Github className="w-4 h-4" />
          <span>GitHub</span>
        </a>
        <a href="https://discord.gg/RdBeMZ2m8S" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm text-neutral-400 hover:text-white transition-colors">
          <DiscordIcon className="w-4 h-4" />
          <span>Discord</span>
        </a>
        <a href="https://plausible.canine.tools/artistgrid.cx/" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm text-neutral-400 hover:text-white transition-colors">
          <BarChart3 className="w-4 h-4" />
          <span>Analytics</span>
        </a>
        <button onClick={onDonateClick} className="flex items-center gap-2 text-sm text-neutral-400 hover:text-white transition-colors">
          <HandCoins className="w-4 h-4" />
          <span>Donate</span>
        </button>
      </div>
      <div className="text-center space-y-3 pt-4 border-t border-neutral-800 w-full">
        <p className="text-sm text-neutral-300">
          Maintained by{" "}
          <a href="https://instagram.com/edideaur" target="_blank" rel="noopener noreferrer" className="underline hover:text-white">edideaur</a>,{" "}
          <a href="https://discord.com/users/454283756258197544" target="_blank" rel="noopener noreferrer" className="underline hover:text-white">JustAMZ</a>, and{" "}
          <a href="https://sad.ovh" target="_blank" rel="noopener noreferrer" className="underline hover:text-white">fucksophie</a>.
        </p>
        <p className="text-sm text-neutral-400">
          Original trackers are in{" "}
          <a href="https://docs.google.com/spreadsheets/d/1XLlR7PnniA8WjLilQPu3Rhx1aLZ4MT2ysIeXp8XSYJA/htmlview" target="_blank" rel="noopener noreferrer" className="underline hover:text-white">this Google Sheet</a>.
        </p>
        <p className="text-xs text-neutral-500">We are not affiliated with TrackerHub or the artists.</p>
        {visitorCount !== null && (
          <p className="text-sm text-neutral-500 pt-2">You are visitor #{visitorCount.toLocaleString()}</p>
        )}
      </div>
      <div className="flex items-center gap-2 text-xs text-neutral-500 bg-neutral-900/50 px-4 py-2 rounded-lg">
        <AlertTriangle className="w-4 h-4" />
        <span>ArtistGrid does not host any illegal content. All links point to third-party services.</span>
      </div>
    </div>
  </footer>
));

function getCleanArtistName(name: string): string {
  let cleanName = name.trim();
  const altMatch = cleanName.match(/^(.+?)\s*\[Alt.*?\]$/i);
  if (altMatch) {
    cleanName = altMatch[1].trim();
  }
  return cleanName;
}

export default function ArtistGallery() {
  const router = useRouter();
  const { state: playerState } = usePlayer();
  const [allArtists, setAllArtists] = useState<Artist[]>([]);
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [errorMessage, setErrorMessage] = useState("");
  const [visitorCount, setVisitorCount] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeModal, setActiveModal] = useState<null | "info" | "donate" | "announcement">(null);
  const [trendsData, setTrendsData] = useState<Map<string, number>>(new Map());
  const [trendsLoaded, setTrendsLoaded] = useState(false);
  const [testedTrackers, setTestedTrackers] = useState<string[]>([]);

  const defaultFilters: FilterOptions = { showWorking: false, showUpdated: false, showStarred: false, showAlts: true, sortByTrends: true };
  const [filterOptions, setFilterOptions] = useLocalStorage<FilterOptions>(LOCAL_STORAGE_KEYS.FILTER_OPTIONS, defaultFilters);
  const [useSheet, setUseSheet] = useLocalStorage<boolean>(LOCAL_STORAGE_KEYS.USE_SHEET, false);

  const deferredQuery = useDeferredValue(searchQuery.trim());
  const hashProcessed = useRef(false);
  const prevQueryRef = useRef("");
  const initialSortApplied = useRef(false);
  const originalOrder = useRef<Artist[]>([]);
  const hasCachedData = useRef(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const currentHash = hashString(ANNOUNCEMENT_MESSAGE);
      const storedHash = localStorage.getItem(LOCAL_STORAGE_KEYS.MESSAGE_HASH);
      if (storedHash !== currentHash) {
        setActiveModal("announcement");
      }
    }
  }, []);

  const handleDismissAnnouncement = useCallback(() => {
    setActiveModal(null);
    if (typeof window !== "undefined") {
      const currentHash = hashString(ANNOUNCEMENT_MESSAGE);
      localStorage.setItem(LOCAL_STORAGE_KEYS.MESSAGE_HASH, currentHash);
    }
  }, []);

  useEffect(() => {
    const load = async () => {
      const working = await fetch(API_BASE + "/tested");
      if (!working.ok) return;
      setTestedTrackers(await working.json())
    }
    load()
  }, [])

  useEffect(() => {
    if (deferredQuery && deferredQuery !== prevQueryRef.current) {
      trackEvent("Search", { query: deferredQuery });
    }
    prevQueryRef.current = deferredQuery;
  }, [deferredQuery]);

  useEffect(() => {
    const controller = new AbortController();

    const loadTrends = async () => {
      const cacheKey = LOCAL_STORAGE_KEYS.TRENDS_CACHE;
      const cached = getCachedData<{ results: { name: string; visitors: number }[] }>(cacheKey);

      if (cached?.data) {
        const map = new Map<string, number>();
        cached.data.results?.forEach((item) => map.set(item.name, item.visitors || 0));
        setTrendsData(map);
        setTrendsLoaded(true);
      }

      if (isCacheExpired(cached)) {
        try {
          const response = await fetch(TRENDS_API, { signal: controller.signal, cache: "no-store" });
          if (response.ok) {
            const data = await response.json();
            setCachedData(cacheKey, data);
            const map = new Map<string, number>();
            data.results?.forEach((item: any) => map.set(item.name, item.visitors || 0));
            setTrendsData(map);
          }
        } catch (e) {
          if (e instanceof Error && e.name !== "AbortError") console.warn("Failed to load trends:", e);
        }
      }
      setTrendsLoaded(true);
    };

    loadTrends();
    return () => controller.abort();
  }, []);

  const sortArtistsByTrends = useCallback((artists: Artist[], trends: Map<string, number>): Artist[] => {
    return [...artists].sort((a, b) => {
      const aV = trends.get(a.name) || 0;
      const bV = trends.get(b.name) || 0;
      const getGroup = (artist: Artist, v: number) => {
        if (artist.isStarred && v > 0) return 1;
        if (artist.isStarred) return 2;
        if (v > 0) return 3;
        return 4;
      };
      const aG = getGroup(a, aV);
      const bG = getGroup(b, bV);
      if (aG !== bG) return aG - bG;
      if ((aG === 1 || aG === 3) && aV !== bV) return bV - aV;
      return a.name.localeCompare(b.name);
    });
  }, []);

  useEffect(() => {
    const controller = new AbortController();

    const loadData = async () => {
      const cacheKey = useSheet ? LOCAL_STORAGE_KEYS.CSV_CACHE_REMOTE : LOCAL_STORAGE_KEYS.CSV_CACHE_LOCAL;
      const cached = getCachedData<Artist[]>(cacheKey);

      if (cached?.data && cached.data.length > 0) {
        originalOrder.current = cached.data;
        setAllArtists(cached.data);
        setStatus("success");
        hasCachedData.current = true;
      } else {
        setStatus("loading");
      }

      if (isCacheExpired(cached) || !cached?.data) {
        const urlsToTry = useSheet
          ? [DATA_SOURCES.LIVE, DATA_SOURCES.REMOTE_BACKUP, DATA_SOURCES.BACKUP]
          : [DATA_SOURCES.BACKUP, DATA_SOURCES.LIVE, DATA_SOURCES.REMOTE_BACKUP];

        for (const url of urlsToTry) {
          try {
            const response = await fetch(url, { signal: controller.signal, cache: "no-store" });
            if (!response.ok) throw new Error(`Status ${response.status}`);
            const parsed = parseCSV(await response.text());

            if (!cached?.data || !artistsEqual(parsed, cached.data)) {
              setCachedData(cacheKey, parsed);
              originalOrder.current = parsed;
              setAllArtists(parsed);
            }
            setStatus("success");
            return;
          } catch (e) {
            if (e instanceof Error && e.name === "AbortError") return;
            console.warn(`Failed to fetch from ${url}:`, e);
          }
        }

        if (!hasCachedData.current) {
          setErrorMessage("Could not load artist data.");
          setStatus("error");
        }
      }
    };

    const loadVisitorCount = async () => {
      try {
        const res = await fetch("https://121124.prigoana.com/artistgrid.cx/", { signal: controller.signal });
        if (res.ok) setVisitorCount(Number((await res.json()).count));
      } catch {}
    };

    loadData();
    loadVisitorCount();

    return () => controller.abort();
  }, [useSheet]);

  useEffect(() => {
    if (status === "success" && trendsLoaded && !initialSortApplied.current && filterOptions.sortByTrends && allArtists.length > 0) {
      initialSortApplied.current = true;
      setAllArtists(sortArtistsByTrends(allArtists, trendsData));
    }
  }, [status, trendsLoaded, sortArtistsByTrends, trendsData, filterOptions.sortByTrends, allArtists]);

  useEffect(() => {
    if (status === "success" && trendsLoaded && originalOrder.current.length > 0) {
      if (filterOptions.sortByTrends) {
        setAllArtists(sortArtistsByTrends(originalOrder.current, trendsData));
      } else {
        setAllArtists([...originalOrder.current]);
      }
    }
  }, [filterOptions.sortByTrends, status, trendsLoaded, sortArtistsByTrends, trendsData]);

  useEffect(() => {
    initialSortApplied.current = false;
    hasCachedData.current = false;
  }, [useSheet]);

  const handleFilterChange = useCallback((key: keyof FilterOptions, value: boolean) => {
    trackEvent("Filter Change", { filter: key, enabled: value });
    setFilterOptions(prev => ({ ...prev, [key]: value }));
  }, [setFilterOptions]);

  const handleUseSheetChange = useCallback((value: boolean) => {
    trackEvent("Data Source Change", { source: value ? "Remote CSV" : "Local Backup" });
    setUseSheet(value);
  }, [setUseSheet]);

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

  const handleArtistClick = useCallback((artist: Artist) => {
    const trackerId = extractTrackerId(artist.url);
    trackEvent("Artist Click", { name: artist.name });
    if (trackerId) {
      const cleanName = getCleanArtistName(artist.name);
      router.push(`/view?id=${trackerId}&artist=${encodeURIComponent(cleanName)}`);
    } else {
      window.open(artist.url, "_blank", "noopener,noreferrer");
    }
  }, [router]);

  const handleSheetClick = useCallback((url: string) => {
    trackEvent("Sheet Click", { url });
    window.open(url, "_blank", "noopener,noreferrer");
  }, []);

  useEffect(() => {
    if (status === "success" && !hashProcessed.current && typeof window !== "undefined" && window.location.hash) {
      const hash = window.location.hash.substring(1);
      let processedHash = decodeURIComponent(hash).toLowerCase();

      for (const suffix of SUFFIXES_TO_STRIP) {
        if (processedHash.endsWith(suffix)) {
          processedHash = processedHash.slice(0, -suffix.length);
          break;
        }
      }

      const redirectTarget = CUSTOM_REDIRECTS[processedHash];
      if (redirectTarget) {
        if (redirectTarget.startsWith("http")) {
          window.location.href = redirectTarget;
          hashProcessed.current = true;
          return;
        } else {
          processedHash = redirectTarget.toLowerCase();
        }
      }

      const normalizedTarget = processedHash.replace(/[^a-z0-9]/g, "");
      if (normalizedTarget) {
        const targetArtist = allArtists.find(artist => artist.name.toLowerCase().replace(/[^a-z0-9]/g, "") === normalizedTarget);
        if (targetArtist) {
          trackEvent("Hash Redirect", { artist: targetArtist.name });
          handleArtistClick(targetArtist);
          hashProcessed.current = true;
        }
      }
    }
  }, [status, allArtists, handleArtistClick]);

  const closeModal = useCallback(() => setActiveModal(null), []);
  const openInfoModal = useCallback(() => {
    trackEvent("Header Click", { button: "Info" });
    setActiveModal("info");
  }, []);
  const openDonationModal = useCallback(() => {
    trackEvent("Header Click", { button: "Donate" });
    setActiveModal("donate");
  }, []);

  const isFirstLoad = status === "loading" && !hasCachedData.current;
  const hasPlayerActive = !!playerState.currentTrack;

  const renderContent = () => {
    if (isFirstLoad) {
      return (
        <>
          <HeaderSkeleton />
          <main className="max-w-7xl mx-auto p-4 sm:p-6">
            <GallerySkeleton />
          </main>
        </>
      );
    }

    if (status === "error" && !hasCachedData.current) {
      return <ErrorMessage message={errorMessage} />;
    }
    return (
      <>
        <Header
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          filterOptions={filterOptions}
          onFilterChange={handleFilterChange}
          onInfoClick={openInfoModal}
          onDonateClick={openDonationModal}
          useSheet={useSheet}
          onUseSheetChange={handleUseSheetChange}
        />
        <main className="max-w-7xl mx-auto px-4 sm:px-6" aria-hidden={!!activeModal}>
          {filteredArtists.length > 0 ? (
            <ArtistGridDisplay testedTrackers={testedTrackers} artists={filteredArtists} onArtistClick={handleArtistClick} onSheetClick={handleSheetClick} />
          ) : (
            <NoResultsMessage searchQuery={searchQuery} />
          )}
        </main>
        <Footer displayedCount={filteredArtists.length} totalCount={allArtists.length} onDonateClick={openDonationModal} visitorCount={visitorCount} />
      </>
    );
  };

  return (
    <div className={`overflow-x-hidden ${hasPlayerActive ? "pb-24" : "pb-8"}`}>
      <AnnouncementModal isOpen={activeModal === "announcement"} onClose={handleDismissAnnouncement} message={ANNOUNCEMENT_MESSAGE} />
      <DonationModal isOpen={activeModal === "donate"} onClose={closeModal} />
      <InfoModal isOpen={activeModal === "info"} onClose={closeModal} visitorCount={visitorCount} onDonate={openDonationModal} />
      {renderContent()}
    </div>
  );
}
