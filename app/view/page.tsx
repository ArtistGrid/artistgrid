// app/view/page.tsx
"use client";

import { useState, useEffect, useCallback, useMemo, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { usePlayer } from "@/app/providers";
import { useToast } from "@/components/ui/use-toast";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuCheckboxItem, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { Search, X, Play, Pause, Filter, Share2, ChevronDown, CircleSlash, ListPlus, MoreHorizontal, Download, ExternalLink, Loader2 } from "lucide-react";

export const API_BASE = "https://tracker.israeli.ovh";
const KRAKENFILES_API = "https://info.artistgrid.cx/kf/?id=";
const IMGUR_API = "https://info.artistgrid.cx/imgur/?id=";
const TRACKER_ID_LENGTH = 44;
const CACHE_KEY_PREFIX = "artistgrid_tracker_";
const CACHE_EXPIRY = 1000 * 60 * 60 * 24;

interface Track {
  id: string;
  name: string;
  extra: string;
  url: string;
  playableUrl: string | null;
  source: "pillows" | "froste" | "krakenfiles" | "imgur" | "unknown";
  quality?: string;
  trackLength?: string;
  type?: string;
  description?: string;
  eraImage?: string;
  eraName?: string;
  artistName?: string;
}

export interface Era {
  name: string;
  extra?: string;
  timeline?: string;
  fileInfo?: string[];
  image?: string;
  description?: string;
  data?: Record<string, TALeak[]>;
}

export interface TALeak {
  name: string;
  extra?: string;
  description?: string;
  track_length?: string;
  leak_date?: string;
  file_date?: string;
  type?: string;
  available_length?: string;
  quality?: string;
  url?: string;
  urls?: string[] | undefined;
}


export interface TrackerResponse {
  name: string | null | undefined,
  tabs: string[],
  current_tab: string,
  eras: Record<string, Era>,
}
interface FilterOptions {
  showPlayableOnly: boolean;
  qualityFilter: string;
}

interface CacheEntry {
  data: any;
  timestamp: number;
  resolvedUrls: Record<string, string | null>;
}

function getCache(trackerId: string): CacheEntry | null {
  if (typeof window === "undefined") return null;
  try {
    const cached = localStorage.getItem(`${CACHE_KEY_PREFIX}${trackerId}`);
    if (!cached) return null;
    const entry: CacheEntry = JSON.parse(cached);
    if (Date.now() - entry.timestamp > CACHE_EXPIRY) {
      localStorage.removeItem(`${CACHE_KEY_PREFIX}${trackerId}`);
      return null;
    }
    return entry;
  } catch { return null; }
}

function setCache(trackerId: string, data: any, resolvedUrls: Record<string, string | null>) {
  if (typeof window === "undefined") return;
  try {
    const entry: CacheEntry = { data, timestamp: Date.now(), resolvedUrls };
    localStorage.setItem(`${CACHE_KEY_PREFIX}${trackerId}`, JSON.stringify(entry));
  } catch (e) { console.warn("Cache write failed:", e); }
}

function generateTrackId(url: string): string {
  let hash = 0;
  for (let i = 0; i < url.length; i++) {
    hash = ((hash << 5) - hash) + url.charCodeAt(i);
    hash = hash & hash;
  }
  return "tk" + Math.abs(hash).toString(36);
}

function isUrl(str: string | null | undefined): boolean {
  if (!str || typeof str !== "string") return false;
  return str.startsWith("http://") || str.startsWith("https://");
}

function normalizePillowsUrl(url: string): string {
  return url.replace(/pillowcase\.su/g, "pillows.su");
}

function extractKrakenId(url: string): string | null {
  const match = url.match(/krakenfiles\.com\/view\/([a-zA-Z0-9]+)/);
  return match ? match[1] : null;
}

function extractImgurId(url: string): string | null {
  const match = url.match(/imgur\.gg\/([a-zA-Z0-9]+)/);
  return match ? match[1] : null;
}

function getTrackSource(url: string): Track["source"] {
  const normalized = normalizePillowsUrl(url);
  if (normalized.includes("pillows.su/f/")) return "pillows";
  if (normalized.includes("music.froste.lol/song/")) return "froste";
  if (normalized.includes("krakenfiles.com/view/")) return "krakenfiles";
  if (normalized.includes("imgur.gg/")) return "imgur";
  return "unknown";
}

async function resolvePlayableUrl(url: string): Promise<string | null> {
  const normalized = normalizePillowsUrl(url);
  const source = getTrackSource(normalized);
  switch (source) {
    case "pillows": {
      const match = normalized.match(/pillows\.su\/f\/([a-f0-9]+)/);
      return match ? `https://api.pillows.su/api/download/${match[1]}` : null;
    }
    case "froste": {
      const match = normalized.match(/music\.froste\.lol\/song\/([a-f0-9]+)/);
      return match ? `https://music.froste.lol/song/${match[1]}/download` : null;
    }
    case "krakenfiles": {
      const id = extractKrakenId(normalized);
      if (!id) return null;
      try {
        const res = await fetch(`${KRAKENFILES_API}${id}`);
        const data = await res.json();
        return data.success ? data.m4a : null;
      } catch { return null; }
    }
    case "imgur": {
      const id = extractImgurId(normalized);
      if (!id) return null;
      try {
        const res = await fetch(`${IMGUR_API}${id}`);
        const data = await res.json();
        return data.success ? data.mp3 : null;
      } catch { return null; }
    }
    default: return null;
  }
}

function getTrackUrl(track: any): string | null {
  if (track.url && isUrl(track.url)) return normalizePillowsUrl(track.url);
  if (track.quality && isUrl(track.quality)) return normalizePillowsUrl(track.quality);
  if (track.available_length && isUrl(track.available_length)) return normalizePillowsUrl(track.available_length);
  return null;
}

function getTrackDescription(track: any): string | null {
  return track.description || track.notes || track.info || null;
}

function isValidTrackerId(id: string): boolean {
  if (!id || typeof id !== "string") return false;
  return id.trim().length === TRACKER_ID_LENGTH && /^[a-zA-Z0-9_-]+$/.test(id.trim());
}

function TrackerViewContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { toast } = useToast();
  const { state: playerState, playTrack, addToQueue, togglePlayPause } = usePlayer();
  const [trackerId, setTrackerId] = useState(searchParams.get("id") || "");
  const [inputValue, setInputValue] = useState(searchParams.get("id") || "");
  const [data, setData] = useState<Record<string, Era> | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedEras, setExpandedEras] = useState<Set<string>>(new Set());
  const [filters, setFilters] = useState<FilterOptions>({ showPlayableOnly: false, qualityFilter: "all" });
  const [resolvedUrls, setResolvedUrls] = useState<Map<string, string | null>>(new Map());
  const [resolveProgress, setResolveProgress] = useState({ current: 0, total: 0 });
  const [isPreloading, setIsPreloading] = useState(false);
  const [artistName, setArtistName] = useState<string>("");

  useEffect(() => {
    const id = searchParams.get("id");
    if (id && isValidTrackerId(id)) {
      setTrackerId(id);
      setInputValue(id);
    }
  }, [searchParams]);

  useEffect(() => {
    if (!trackerId || !isValidTrackerId(trackerId)) return;
    const controller = new AbortController();
    const load = async () => {
      setStatus("loading");
      const cached = getCache(trackerId);
      if (cached) {
        setData(cached.data);
        setResolvedUrls(new Map(Object.entries(cached.resolvedUrls)));
        setStatus("success");
        const firstEra = Object.keys(cached.data)[0];
        if (firstEra) setExpandedEras(new Set([firstEra]));
        return;
      }
      try {
        const res = await fetch(`${API_BASE}/get/${trackerId}`, { signal: controller.signal, redirect: "manual" });
        if(res.type == "opaqueredirect") {
          location.href = `${API_BASE}/get/${trackerId}`;
          return;
        }
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json: TrackerResponse = await res.json();
        if (!json || typeof json !== "object" || Object.keys(json).length === 0) throw new Error("Empty response");
        setData(json.eras);
        setStatus("success");
        setArtistName(json.name || "");
        const firstEra = Object.keys(json)[0];
        if (firstEra) setExpandedEras(new Set([firstEra]));
        preloadAllUrls(json.eras, trackerId);
      } catch (e: any) {
        if (e.name === "AbortError") return;
        setErrorMessage(e.message);
        setStatus("error");
      }
    };
    load();
    return () => controller.abort();
  }, [trackerId]);

  const preloadAllUrls = async (apiData: Record<string, Era>, id: string) => {
    const urls: string[] = [];
    Object.values(apiData).forEach((era) => {
      if (!era.data) return;
      Object.values(era.data).forEach((tracks) => {
        if (!Array.isArray(tracks)) return;
        tracks.forEach((t) => {
          const url = getTrackUrl(t);
          if (url) urls.push(url);
        });
      });
    });
    if (urls.length === 0) return;
    setIsPreloading(true);
    setResolveProgress({ current: 0, total: urls.length });
    const resolved: Record<string, string | null> = {};
    const batchSize = 10;
    for (let i = 0; i < urls.length; i += batchSize) {
      const batch = urls.slice(i, i + batchSize);
      const results = await Promise.all(batch.map(async (url) => ({ url, playable: await resolvePlayableUrl(url) })));
      results.forEach(({ url, playable }) => { resolved[url] = playable; });
      setResolvedUrls(new Map(Object.entries(resolved)));
      setResolveProgress({ current: Math.min(i + batchSize, urls.length), total: urls.length });
    }
    setCache(id, apiData, resolved);
    setIsPreloading(false);
  };

  const handleLoad = useCallback(() => {
    if (!isValidTrackerId(inputValue)) {
      toast({ title: "Invalid ID", description: `Tracker ID must be ${TRACKER_ID_LENGTH} characters` });
      return;
    }
    router.push(`/view?id=${inputValue}`);
  }, [inputValue, router, toast]);

  const handleShare = useCallback(() => {
    const url = `${window.location.origin}/view?id=${trackerId}${artistName ? `&name=${encodeURIComponent(artistName)}` : ""}`;
    navigator.clipboard.writeText(url);
    toast({ title: "Copied!", description: "Share link copied to clipboard" });
  }, [trackerId, artistName, toast]);

  const toggleEra = useCallback((eraKey: string) => {
    setExpandedEras((prev) => {
      const next = new Set(prev);
      if (next.has(eraKey)) next.delete(eraKey);
      else next.add(eraKey);
      return next;
    });
  }, []);

  const handlePlayTrack = useCallback(async (rawTrack: any, era: Era) => {
    const url = getTrackUrl(rawTrack);
    if (!url) return;
    if (playerState.currentTrack?.url === url) {
      togglePlayPause();
      return;
    }
    let playableUrl = resolvedUrls.get(url);
    if (playableUrl === undefined) playableUrl = await resolvePlayableUrl(url);
    if (!playableUrl) {
      window.open(url, "_blank", "noopener,noreferrer");
      return;
    }
    const track: Track = {
      id: generateTrackId(url),
      name: rawTrack.name || "Unknown",
      extra: rawTrack.extra || "",
      url,
      playableUrl,
      source: getTrackSource(url),
      quality: rawTrack.quality && !isUrl(rawTrack.quality) ? rawTrack.quality : undefined,
      trackLength: rawTrack.track_length,
      type: rawTrack.type,
      description: getTrackDescription(rawTrack) || undefined,
      eraImage: era.image,
      eraName: era.name,
      artistName: artistName || undefined,
    };
    playTrack(track);
  }, [resolvedUrls, playTrack, playerState.currentTrack, togglePlayPause, artistName]);

  const handleAddToQueue = useCallback(async (rawTrack: any, era: Era) => {
    const url = getTrackUrl(rawTrack);
    if (!url) return;
    let playableUrl = resolvedUrls.get(url);
    if (playableUrl === undefined) playableUrl = await resolvePlayableUrl(url);
    if (!playableUrl) {
      toast({ title: "Cannot queue", description: "Track is not playable" });
      return;
    }
    const track: Track = {
      id: generateTrackId(url),
      name: rawTrack.name || "Unknown",
      extra: rawTrack.extra || "",
      url,
      playableUrl,
      source: getTrackSource(url),
      eraImage: era.image,
      eraName: era.name,
      artistName: artistName || undefined,
    };
    addToQueue(track);
    toast({ title: "Added to queue", description: track.name });
  }, [resolvedUrls, addToQueue, toast, artistName]);

  const handleDownload = useCallback(async (rawTrack: any) => {
    const url = getTrackUrl(rawTrack);
    if (!url) return;
    let playableUrl = resolvedUrls.get(url);
    if (playableUrl === undefined) playableUrl = await resolvePlayableUrl(url);
    if (!playableUrl) {
      toast({ title: "Cannot download", description: "No playable URL available" });
      return;
    }
    const link = document.createElement("a");
    link.href = playableUrl;
    link.download = `${rawTrack.name || "track"}.mp3`;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, [resolvedUrls, toast]);

  const handleOpenOriginal = useCallback((rawTrack: any) => {
    const url = getTrackUrl(rawTrack);
    if (url) window.open(url, "_blank", "noopener,noreferrer");
  }, []);

  const filteredData = useMemo(() => {
    if (!data) return null;
    const result: Record<string, Era> = {};
    const query = searchQuery.toLowerCase();
    Object.entries(data).forEach(([key, era]) => {
      if (!era.data) return;
      const filteredCategories: Record<string, any[]> = {};
      Object.entries(era.data).forEach(([cat, tracks]) => {
        if (!Array.isArray(tracks)) return;
        const filtered = tracks.filter((t) => {
          const url = getTrackUrl(t);
          if (!url) return false;
          if (filters.showPlayableOnly && !resolvedUrls.get(url)) return false;
          if (filters.qualityFilter !== "all" && !(t.quality?.toLowerCase() || "").includes(filters.qualityFilter.toLowerCase())) return false;
          if (query) {
            const searchable = `${t.name || ""} ${t.extra || ""} ${getTrackDescription(t) || ""}`.toLowerCase();
            if (!searchable.includes(query)) return false;
          }
          return true;
        });
        if (filtered.length > 0) filteredCategories[cat] = filtered;
      });
      if (Object.keys(filteredCategories).length > 0) result[key] = { ...era, data: filteredCategories };
    });
    return result;
  }, [data, searchQuery, filters, resolvedUrls]);

  const qualities = useMemo(() => {
    if (!data) return [];
    const set = new Set<string>();
    Object.values(data).forEach((era) => {
      if (!era.data) return;
      Object.values(era.data).forEach((tracks) => {
        if (!Array.isArray(tracks)) return;
        tracks.forEach((t) => { if (t.quality && !isUrl(t.quality)) set.add(t.quality); });
      });
    });
    return Array.from(set);
  }, [data]);

  const stats = useMemo(() => {
    let total = 0, playable = 0;
    if (data) {
      Object.values(data).forEach((era) => {
        if (!era.data) return;
        Object.values(era.data).forEach((tracks) => {
          if (Array.isArray(tracks)) {
            total += tracks.length;
            tracks.forEach((t) => {
              const url = getTrackUrl(t);
              if (url && resolvedUrls.get(url)) playable++;
            });
          }
        });
      });
    }
    return { total, playable };
  }, [data, resolvedUrls]);

  return (
    <div className="min-h-screen bg-black pb-24">
      <header className="sticky top-0 z-30 py-4 bg-black/70 backdrop-blur-lg border-b border-neutral-900">
        <div className="max-w-7xl mx-auto flex items-center gap-4 px-4 sm:px-6">
          <Link href="/" className="text-2xl font-bold bg-gradient-to-b from-neutral-50 to-neutral-400 bg-clip-text text-transparent hidden sm:block">ArtistGrid</Link>
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-500 pointer-events-none" />
            <Input type="text" placeholder="Paste tracker ID (44 characters)..." value={inputValue} onChange={(e) => setInputValue(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleLoad()} className="bg-neutral-900 border-2 border-neutral-800 text-white placeholder:text-neutral-500 focus:border-white/50 rounded-xl w-full pl-12 pr-10 h-12" />
            {inputValue && <Button variant="ghost" size="icon" className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 text-neutral-500 hover:text-white" onClick={() => setInputValue("")}><X className="w-4 h-4" /></Button>}
          </div>
          {trackerId && <Button variant="outline" size="icon" onClick={handleShare} className="bg-neutral-900 border-neutral-800 hover:bg-neutral-800 text-white"><Share2 className="w-4 h-4" /></Button>}
          <Button onClick={handleLoad} className="bg-white text-black hover:bg-neutral-200">Load</Button>
        </div>
      </header>
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        {status === "idle" && (
          <div className="text-center py-20">
            <h2 className="text-xl font-semibold text-neutral-300 mb-2">Enter a Tracker ID to get started</h2>
            <p className="text-neutral-500">Tracker IDs are exactly 44 characters long</p>
          </div>
        )}
        {status === "loading" && (
          <div className="space-y-6">
            <div className="text-center py-4"><div className="inline-flex items-center gap-2 text-neutral-400"><Loader2 className="w-5 h-5 animate-spin" /><span>Loading tracker data...</span></div></div>
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="bg-neutral-950 border border-neutral-800 rounded-xl p-5">
                <div className="flex items-center gap-4 mb-4"><Skeleton className="w-16 h-16 rounded-xl bg-neutral-800" /><div className="flex-1"><Skeleton className="h-5 w-1/3 bg-neutral-800 mb-2" /><Skeleton className="h-4 w-1/4 bg-neutral-800" /></div></div>
                <div className="space-y-3">{Array.from({ length: 3 }).map((_, j) => <Skeleton key={j} className="h-16 bg-neutral-800 rounded-xl" />)}</div>
              </div>
            ))}
          </div>
        )}
        {status === "error" && (
          <div className="flex items-center justify-center py-20">
            <div className="text-center bg-neutral-900 border border-red-500/30 p-8 rounded-xl max-w-md">
              <h2 className="text-xl font-bold text-white mb-2">Error Loading Data</h2>
              <p className="text-neutral-400">{errorMessage}</p>
            </div>
          </div>
        )}
        {status === "success" && data && (
          <>
            {artistName && <h1 className="text-2xl font-bold text-white mb-6">{artistName}</h1>}
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 mb-6">
              <div className="relative flex-1 w-full">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" />
                <Input type="text" placeholder="Search tracks..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="bg-neutral-900 border-neutral-800 text-white pl-10 h-10 rounded-lg" />
              </div>
              <div className="flex items-center gap-3">
                {isPreloading ? (
                  <div className="flex items-center gap-2 text-sm text-neutral-400"><Loader2 className="w-4 h-4 animate-spin" /><span>{resolveProgress.current}/{resolveProgress.total}</span></div>
                ) : resolvedUrls.size > 0 ? (
                  <span className="text-sm text-neutral-500">{stats.playable}/{stats.total} playable</span>
                ) : null}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild><Button variant="outline" size="icon" className="bg-neutral-900 border-neutral-800 hover:bg-neutral-800 text-white"><Filter className="w-4 h-4" /></Button></DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56 bg-neutral-950 border-neutral-800 text-neutral-200">
                    <DropdownMenuLabel>Filters</DropdownMenuLabel>
                    <DropdownMenuSeparator className="bg-neutral-800" />
                    <DropdownMenuCheckboxItem checked={filters.showPlayableOnly} onCheckedChange={(c) => setFilters(f => ({ ...f, showPlayableOnly: !!c }))}>Show playable only</DropdownMenuCheckboxItem>
                    <DropdownMenuSeparator className="bg-neutral-800" />
                    <DropdownMenuLabel>Quality</DropdownMenuLabel>
                    <DropdownMenuCheckboxItem checked={filters.qualityFilter === "all"} onCheckedChange={() => setFilters(f => ({ ...f, qualityFilter: "all" }))}>All qualities</DropdownMenuCheckboxItem>
                    {qualities.map((q) => <DropdownMenuCheckboxItem key={q} checked={filters.qualityFilter === q} onCheckedChange={() => setFilters(f => ({ ...f, qualityFilter: q }))}>{q}</DropdownMenuCheckboxItem>)}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
            {filteredData && Object.keys(filteredData).length > 0 ? (
              <div className="space-y-6">
                {Object.entries(filteredData).map(([key, era]) => (
                  <div key={key} className="bg-neutral-950 border border-neutral-800 rounded-xl overflow-hidden">
                    <button className="w-full flex items-center gap-4 p-5 text-left hover:bg-white/[0.02] transition-colors" onClick={() => toggleEra(key)}>
                      {era.image ? <img src={era.image} alt={era.name} className="w-16 h-16 rounded-xl object-cover bg-neutral-800" /> : <div className="w-16 h-16 rounded-xl bg-neutral-800" />}
                      <div className="flex-1 min-w-0">
                        <h3 className="text-lg font-bold text-white">{era.name || key}</h3>
                        {era.extra && <p className="text-sm text-neutral-500">{era.extra}</p>}
                      </div>
                      <ChevronDown className={`w-5 h-5 text-neutral-500 transition-transform ${expandedEras.has(key) ? "rotate-180" : ""}`} />
                    </button>
                    {expandedEras.has(key) && (
                      <div className="px-5 pb-5">
                        {era.description && <p className="text-sm text-neutral-400 p-4 bg-black/30 rounded-xl mb-5">{era.description}</p>}
                        {Object.entries(era.data).map(([cat, tracks]) => (
                          <div key={cat} className="mb-6 last:mb-0">
                            <h4 className="text-sm font-semibold text-neutral-300 pb-3 mb-3 border-b border-neutral-800">{cat}</h4>
                            <div className="space-y-2">
                              {(tracks as any[]).map((track, i) => {
                                const url = getTrackUrl(track);
                                const playableUrl = url ? resolvedUrls.get(url) : null;
                                const isPlayable = !!playableUrl;
                                const isCurrentlyPlaying = playerState.currentTrack?.url === url && playerState.isPlaying;
                                const isCurrentTrack = playerState.currentTrack?.url === url;
                                const description = getTrackDescription(track);
                                return (
                                  <div key={i} className={`rounded-xl transition-colors ${isCurrentTrack ? "bg-white/10 border border-white/20" : "bg-white/[0.02] hover:bg-white/[0.05] border border-transparent"}`}>
                                    <div className="flex items-center gap-3 p-3">
                                      <button onClick={() => handlePlayTrack(track, era)} className={`w-10 h-10 flex-shrink-0 flex items-center justify-center rounded-full hover:scale-110 transition-transform ${isPlayable ? "bg-white text-black" : "bg-neutral-700 text-neutral-400"}`}>
                                        {isCurrentlyPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
                                      </button>
                                      <div className="flex-1 min-w-0">
                                        <div className="font-semibold text-white text-sm truncate">{track.name || "Unknown"}</div>
                                        {track.extra && <div className="text-xs text-neutral-500 truncate">{track.extra}</div>}
                                      </div>
                                      <div className="hidden sm:flex items-center gap-2 flex-shrink-0">
                                        {track.type && track.type !== "Unknown" && track.type !== "N/A" && <span className="text-xs px-2 py-1 bg-white/5 rounded text-neutral-400">{track.type}</span>}
                                        {track.quality && !isUrl(track.quality) && track.quality !== "N/A" && <span className="text-xs px-2 py-1 bg-white/5 rounded text-neutral-400">{track.quality}</span>}
                                        {track.track_length && track.track_length !== "N/A" && track.track_length !== "?:??" && <span className="text-xs px-2 py-1 bg-white/5 rounded text-neutral-400">{track.track_length}</span>}
                                      </div>
                                      <DropdownMenu>
                                        <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="text-neutral-500 hover:text-white hover:bg-white/10 w-8 h-8 rounded-lg"><MoreHorizontal className="w-4 h-4" /></Button></DropdownMenuTrigger>
                                        <DropdownMenuContent align="end" className="w-48 bg-neutral-950 border-neutral-800 text-neutral-200">
                                          {isPlayable && <DropdownMenuItem onClick={() => handleAddToQueue(track, era)} className="cursor-pointer"><ListPlus className="w-4 h-4 mr-2" />Add to Queue</DropdownMenuItem>}
                                          {isPlayable && <DropdownMenuItem onClick={() => handleDownload(track)} className="cursor-pointer"><Download className="w-4 h-4 mr-2" />Download</DropdownMenuItem>}
                                          <DropdownMenuItem onClick={() => handleOpenOriginal(track)} className="cursor-pointer"><ExternalLink className="w-4 h-4 mr-2" />Open Original URL</DropdownMenuItem>
                                        </DropdownMenuContent>
                                      </DropdownMenu>
                                    </div>
                                    {description && <div className="px-3 pb-3"><p className="text-xs text-neutral-500 pl-[52px]">{description}</p></div>}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-20 flex flex-col items-center">
                <CircleSlash className="w-16 h-16 text-neutral-700 mb-4" />
                <h3 className="text-lg font-medium text-neutral-300">No Tracks Found</h3>
                <p className="text-neutral-500 mt-1">{searchQuery ? `No results for "${searchQuery}"` : "Try adjusting your filters"}</p>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}

export default function TrackerViewPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-black flex items-center justify-center"><div className="w-8 h-8 border-2 border-neutral-700 border-t-white rounded-full animate-spin" /></div>}>
      <TrackerViewContent />
    </Suspense>
  );
}
