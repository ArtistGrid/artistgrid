import { useState, useEffect, useCallback, useMemo, Suspense, useRef } from "react";
import { useSearchParams, useNavigate, Link } from "react-router-dom";
import type { Track, Era, TALeak, TrackerResponse } from "@/src/types";
import { usePlayer } from "../providers";
import { useToast } from "@/components/ui/use-toast";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Search,
  X,
  Play,
  Pause,
  Filter,
  Share2,
  ChevronDown,
  CircleSlash,
  ListPlus,
  MoreHorizontal,
  Download,
  ExternalLink,
  Loader2,
  Radio,
  Link as LinkIcon,
  AlertTriangle,
  Share,
  SkipForward,
  FolderDown,
} from "lucide-react";
import { fetchWithFallback } from "@/src/lib/api";
import { getCache, setCache } from "@/src/lib/tracker-cache";
import { resolvePlayableUrl, getTrackSource, transformUrlForOpening } from "@/src/lib/resolve-url";
import {
  generateTrackId,
  isUrl,
  getTrackUrl,
  getTrackDescription,
  isValidTrackerId,
  encodeTrackForUrl,
  decodeTrackFromUrl,
  getGoogleSheetsUrl,
  getSourceDisplayName,
  TRACKER_ID_LENGTH,
  SUPPORTED_SOURCES,
} from "@/src/lib/track-utils";
import { DownloadProvider, useDownloadManager } from "@/src/components/download-manager";
import { ArtGallery, ImageLightbox } from "@/src/components/art-gallery";
import { LastFMModal } from "@/src/components/lastfm-modal";
const ART_TABS = ["Art"];
const NON_PLAYABLE_TABS = ["Art", "Tracklists", "Misc"];
interface FilterOptions {
  showPlayableOnly: boolean;
  qualityFilter: string;
}
interface PlayableTrackData {
  track: TALeak;
  era: Era;
  url: string;
  playableUrl: string;
}
const FallbackView = ({ trackerId, sheetsUrl }: { trackerId: string; sheetsUrl: string }) => (
  <div className="min-h-screen bg-black flex items-center justify-center p-4">
    <div className="max-w-lg w-full bg-neutral-950 border border-neutral-800 rounded-xl p-6 sm:p-8 text-center">
      <AlertTriangle className="w-12 h-12 sm:w-16 sm:h-16 text-yellow-500 mx-auto mb-4 sm:mb-6" />
      <h1 className="text-xl sm:text-2xl font-bold text-white mb-3 sm:mb-4">Unable to Load Tracker</h1>
      <p className="text-sm sm:text-base text-neutral-400 mb-4 sm:mb-6">
        We couldn't load the tracker data from our API. You can view the original spreadsheet directly on Google Sheets.
      </p>
      <Button asChild className="bg-white text-black hover:bg-neutral-200 mb-4 sm:mb-6 w-full">
        <a href={sheetsUrl} target="_blank" rel="noopener noreferrer">
          <ExternalLink className="w-4 h-4 mr-2" />
          Open Original Spreadsheet
        </a>
      </Button>
      <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-3 sm:p-4 text-left">
        <p className="text-xs text-neutral-500 leading-relaxed">
          <strong className="text-neutral-400">Disclaimer:</strong> ArtistGrid is not affiliated with, endorsed by, or
          associated with Google, TrackerHub, or any artists whose content may appear in these trackers. We do not host,
          store, or distribute any copyrighted content.
        </p>
      </div>
      <div className="mt-4 sm:mt-6">
        <Link to="/" className="text-sm text-neutral-500 hover:text-white transition-colors">
          ← Back to Home
        </Link>
      </div>
    </div>
  </div>
);
function TrackerViewContent() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { state: playerState, playTrack, addToQueue, clearQueue, togglePlayPause, lastfm } = usePlayer();
  const downloadManager = useDownloadManager();
  const [trackerId, setTrackerId] = useState(searchParams.get("id") || "");
  const [inputValue, setInputValue] = useState(searchParams.get("id") || "");
  const [artistNameFromUrl, setArtistNameFromUrl] = useState<string | null>(searchParams.get("artist"));
  const [data, setData] = useState<TrackerResponse | null>(null);
  const [baseEraImages, setBaseEraImages] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error" | "fallback">("idle");
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedEras, setExpandedEras] = useState<Set<string>>(new Set());
  const [filters, setFilters] = useState<FilterOptions>({ showPlayableOnly: false, qualityFilter: "all" });
  const [resolvedUrls, setResolvedUrls] = useState<Map<string, string | null>>(new Map());
  const [resolveProgress, setResolveProgress] = useState({ current: 0, total: 0 });
  const [isPreloading, setIsPreloading] = useState(false);
  const [currentTab, setCurrentTab] = useState<string>("");
  const [lastfmModalOpen, setLastfmModalOpen] = useState(false);
  const [lastfmToken, setLastfmToken] = useState<string | null>(null);
  const [lightboxImage, setLightboxImage] = useState<{
    src: string;
    alt: string;
    originalUrl: string;
  } | null>(null);
  const [highlightedTrackUrl, setHighlightedTrackUrl] = useState<string | null>(null);
  const highlightedTrackRef = useRef<HTMLDivElement | null>(null);
  const pendingTrackUrlRef = useRef<string | null>(null);
  const artistDisplayName = useMemo(() => artistNameFromUrl || "Unknown Artist", [artistNameFromUrl]);
  const getEraImage = useCallback(
    (era: Era): string | undefined => {
      if (era.image) return era.image;
      if (era.name && baseEraImages[era.name]) return baseEraImages[era.name];
      return undefined;
    },
    [baseEraImages]
  );
  const erasWithImages = useMemo(() => {
    if (!data?.eras) return null;
    const result: Record<string, Era> = {};
    for (const [key, era] of Object.entries(data.eras)) result[key] = { ...era, image: getEraImage(era) };
    return result;
  }, [data?.eras, getEraImage]);
  const isArtTab = ART_TABS.includes(currentTab);
  const filteredData = useMemo(() => {
    if (!erasWithImages) return null;
    if (isArtTab) return erasWithImages;
    const result: Record<string, Era> = {};
    const query = searchQuery.toLowerCase();
    for (const [key, era] of Object.entries(erasWithImages)) {
      if (!era.data) continue;
      const filteredCategories: Record<string, TALeak[]> = {};
      for (const [cat, tracks] of Object.entries(era.data)) {
        if (!Array.isArray(tracks)) continue;
        const filtered = tracks.filter((t) => {
          const url = getTrackUrl(t);
          if (!url) return false;
          const source = getTrackSource(url);
          const isSupported = SUPPORTED_SOURCES.includes(source);
          if (filters.showPlayableOnly && !resolvedUrls.get(url) && !isSupported) return false;
          if (
            filters.qualityFilter !== "all" &&
            !(t.quality?.toLowerCase() || "").includes(filters.qualityFilter.toLowerCase())
          )
            return false;
          if (query) {
            const searchable = `${t.name || ""} ${t.extra || ""} ${getTrackDescription(t) || ""}`.toLowerCase();
            if (!searchable.includes(query)) return false;
          }
          return true;
        });
        if (filtered.length > 0) filteredCategories[cat] = filtered;
      }
      if (Object.keys(filteredCategories).length > 0) result[key] = { ...era, data: filteredCategories };
    }
    return result;
  }, [erasWithImages, searchQuery, filters, resolvedUrls, isArtTab]);
  const allPlayableTracks = useMemo((): PlayableTrackData[] => {
    if (!filteredData) return [];
    const tracks: PlayableTrackData[] = [];
    for (const era of Object.values(filteredData)) {
      if (!era.data) continue;
      for (const trackList of Object.values(era.data)) {
        if (!Array.isArray(trackList)) continue;
        for (const track of trackList) {
          const url = getTrackUrl(track);
          const playableUrl = url ? resolvedUrls.get(url) : null;
          if (url && playableUrl) tracks.push({ track, era, url, playableUrl });
        }
      }
    }
    return tracks;
  }, [filteredData, resolvedUrls]);
  const createTrackObject = useCallback(
    (rawTrack: TALeak, era: Era, url: string, playableUrl: string): Track => ({
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
      eraImage: getEraImage(era),
      eraName: era.name,
      artistName: artistDisplayName,
    }),
    [artistDisplayName, getEraImage]
  );
  useEffect(() => {
    const id = searchParams.get("id");
    const trackParam = searchParams.get("track");
    const artistParam = searchParams.get("artist");
    if (id && isValidTrackerId(id)) {
      setTrackerId(id);
      setInputValue(id);
    }
    if (artistParam) setArtistNameFromUrl(artistParam);
    if (trackParam) {
      const decodedUrl = decodeTrackFromUrl(trackParam);
      if (decodedUrl) {
        pendingTrackUrlRef.current = decodedUrl;
        setHighlightedTrackUrl(decodedUrl);
      }
    }
  }, [searchParams]);
  useEffect(() => {
    if (highlightedTrackRef.current && highlightedTrackUrl) {
      setTimeout(() => highlightedTrackRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }), 500);
    }
  }, [highlightedTrackUrl, data]);
  useEffect(() => {
    if (pendingTrackUrlRef.current && data && resolvedUrls.size > 0) {
      const trackUrl = pendingTrackUrlRef.current;
      pendingTrackUrlRef.current = null;
      for (const era of Object.values(data.eras)) {
        if (!era.data) continue;
        for (const tracks of Object.values(era.data)) {
          if (!Array.isArray(tracks)) continue;
          for (const track of tracks) {
            const url = getTrackUrl(track);
            if (url === trackUrl) {
              const playableUrl = resolvedUrls.get(url);
              if (playableUrl) playTrack(createTrackObject(track, era, url, playableUrl));
              return;
            }
          }
        }
      }
    }
  }, [data, resolvedUrls, playTrack, createTrackObject]);
  const fetchBaseEraImages = useCallback(async (id: string) => {
    try {
      const cached = getCache(id);
      if (cached?.data?.eras) {
        const images: Record<string, string> = {};
        for (const [key, era] of Object.entries(cached.data.eras)) {
          if (era.image) images[era.name || key] = era.image;
        }
        setBaseEraImages(images);
        return;
      }
      const res = await fetchWithFallback(`/get/${id}`);
      if (res.ok) {
        const json: TrackerResponse = await res.json();
        if (json?.eras) {
          const images: Record<string, string> = {};
          for (const [key, era] of Object.entries(json.eras)) {
            if (era.image) images[era.name || key] = era.image;
          }
          setBaseEraImages(images);
        }
      }
    } catch {}
  }, []);
  const preloadAllUrls = async (
    eras: Record<string, Era>,
    id: string,
    tab: string | undefined,
    trackerData: TrackerResponse
  ) => {
    const urls: string[] = [];
    for (const era of Object.values(eras)) {
      if (!era.data) continue;
      for (const tracks of Object.values(era.data)) {
        if (!Array.isArray(tracks)) continue;
        for (const t of tracks) {
          const url = getTrackUrl(t);
          if (url) urls.push(url);
        }
      }
    }
    if (urls.length === 0) return;
    setIsPreloading(true);
    setResolveProgress({ current: 0, total: urls.length });
    const resolved: Record<string, string | null> = {};
    const batchSize = 10;
    for (let i = 0; i < urls.length; i += batchSize) {
      const batch = urls.slice(i, i + batchSize);
      const results = await Promise.all(batch.map(async (url) => ({ url, playable: await resolvePlayableUrl(url) })));
      for (const { url, playable } of results) resolved[url] = playable;
      setResolvedUrls(new Map(Object.entries(resolved)));
      setResolveProgress({ current: Math.min(i + batchSize, urls.length), total: urls.length });
    }
    setCache(id, trackerData, resolved, tab);
    setIsPreloading(false);
  };
  const loadTrackerData = useCallback(
    async (id: string, tab?: string) => {
      setStatus("loading");
      if (tab) fetchBaseEraImages(id);
      const cached = getCache(id, tab);
      if (cached) {
        setData(cached.data);
        setResolvedUrls(new Map(Object.entries(cached.resolvedUrls)));
        setCurrentTab(cached.data.current_tab);
        setStatus("success");
        return;
      }
      try {
        const endpoint = tab ? `/get/${id}?tab=${encodeURIComponent(tab)}` : `/get/${id}`;
        const res = await fetchWithFallback(endpoint, { redirect: "manual" });
        if (res.type === "opaqueredirect") {
          setStatus("fallback");
          return;
        }
        if (!res.ok) {
          setStatus("fallback");
          return;
        }
        const json: TrackerResponse = await res.json();
        if (!json || typeof json !== "object" || !json.eras || Object.keys(json.eras).length === 0) {
          setStatus("fallback");
          return;
        }
        setData(json);
        setCurrentTab(json.current_tab);
        setStatus("success");
        if (!NON_PLAYABLE_TABS.includes(json.current_tab)) preloadAllUrls(json.eras, id, tab, json);
      } catch {
        setStatus("fallback");
      }
    },
    [fetchBaseEraImages]
  );
  useEffect(() => {
    if (!trackerId || !isValidTrackerId(trackerId)) return;
    loadTrackerData(trackerId);
  }, [trackerId, loadTrackerData]);
  const handleLoad = useCallback(() => {
    if (!isValidTrackerId(inputValue)) {
      toast({ title: "Invalid ID", description: `Tracker ID must be ${TRACKER_ID_LENGTH} characters` });
      return;
    }
    navigate(`/view?id=${inputValue}`);
  }, [inputValue, navigate, toast]);
  const handleShare = useCallback(() => {
    let url = `${window.location.origin}/view?id=${trackerId}`;
    if (artistNameFromUrl) url += `&artist=${encodeURIComponent(artistNameFromUrl)}`;
    navigator.clipboard.writeText(url);
    toast({ title: "Copied!", description: "Share link copied to clipboard" });
  }, [trackerId, artistNameFromUrl, toast]);
  const handleShareTrack = useCallback(
    (trackUrl: string, trackName: string) => {
      const encodedTrack = encodeTrackForUrl(trackUrl);
      let shareUrl = `${window.location.origin}/view?id=${trackerId}&track=${encodedTrack}`;
      if (artistNameFromUrl) shareUrl += `&artist=${encodeURIComponent(artistNameFromUrl)}`;
      if (currentTab && currentTab !== data?.tabs?.[0]) shareUrl += `&tab=${encodeURIComponent(currentTab)}`;
      navigator.clipboard.writeText(shareUrl);
      toast({ title: "Track link copied!", description: `Share link for "${trackName}" copied to clipboard` });
    },
    [trackerId, artistNameFromUrl, currentTab, data?.tabs, toast]
  );
  const handleTabChange = useCallback(
    (tab: string) => {
      if (!trackerId || tab === currentTab) return;
      setResolvedUrls(new Map());
      setHighlightedTrackUrl(null);
      loadTrackerData(trackerId, tab);
    },
    [trackerId, currentTab, loadTrackerData]
  );
  const toggleEra = useCallback((eraKey: string) => {
    setExpandedEras((prev) => {
      const next = new Set(prev);
      if (next.has(eraKey)) next.delete(eraKey);
      else next.add(eraKey);
      return next;
    });
  }, []);
  const handleOpenUrl = useCallback((url: string) => {
    window.open(transformUrlForOpening(url), "_blank", "noopener,noreferrer");
  }, []);
  const handlePlayTrack = useCallback(
    async (rawTrack: TALeak, era: Era) => {
      const url = getTrackUrl(rawTrack);
      if (!url) return;
      if (playerState.currentTrack?.url === url) {
        togglePlayPause();
        return;
      }
      const playableUrl = await resolvePlayableUrl(url);
      if (!playableUrl) {
        handleOpenUrl(url);
        return;
      }
      const track = createTrackObject(rawTrack, era, url, playableUrl);
      clearQueue();
      playTrack(track);
      const currentIdx = allPlayableTracks.findIndex((t) => t.url === url);
      if (currentIdx !== -1) {
        for (const t of allPlayableTracks.slice(currentIdx + 1))
          addToQueue(createTrackObject(t.track, t.era, t.url, t.playableUrl));
      }
    },
    [
      playTrack,
      playerState.currentTrack,
      togglePlayPause,
      handleOpenUrl,
      allPlayableTracks,
      addToQueue,
      clearQueue,
      createTrackObject,
    ]
  );
  const handlePlayNext = useCallback(
    async (rawTrack: TALeak, era: Era) => {
      const url = getTrackUrl(rawTrack);
      if (!url) return;
      const playableUrl = await resolvePlayableUrl(url);
      if (!playableUrl) {
        toast({ title: "Cannot queue", description: "Track is not playable" });
        return;
      }
      const track = createTrackObject(rawTrack, era, url, playableUrl);
      addToQueue(track);
      toast({ title: "Playing next", description: track.name });
    },
    [addToQueue, toast, createTrackObject]
  );
  const handleAddToQueue = useCallback(
    async (rawTrack: TALeak, era: Era) => {
      const url = getTrackUrl(rawTrack);
      if (!url) return;
      const playableUrl = await resolvePlayableUrl(url);
      if (!playableUrl) {
        toast({ title: "Cannot queue", description: "Track is not playable" });
        return;
      }
      const track = createTrackObject(rawTrack, era, url, playableUrl);
      addToQueue(track);
      toast({ title: "Added to queue", description: track.name });
    },
    [addToQueue, toast, createTrackObject]
  );
  const handleDownload = useCallback(
    async (rawTrack: TALeak) => {
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
    },
    [resolvedUrls, toast]
  );
  const handleOpenOriginal = useCallback(
    (rawTrack: TALeak) => {
      const url = getTrackUrl(rawTrack);
      if (url) handleOpenUrl(url);
    },
    [handleOpenUrl]
  );
  const handleArtImageClick = useCallback((url: string, name: string) => {
    const getDirectImageUrl = (u: string): string | null => {
      if (u.includes("ibb.co")) {
        const match = u.match(/ibb\.co\/([a-zA-Z0-9]+)/);
        if (match) return `https://i.ibb.co/${match[1]}/image.jpg`;
      }
      if (u.includes("imgur.com")) {
        const match = u.match(/imgur\.com\/([a-zA-Z0-9]+)/);
        if (match) return `https://i.imgur.com/${match[1]}.jpg`;
      }
      if (u.match(/\.(jpg|jpeg|png|gif|webp)$/i)) return u;
      return null;
    };
    const directUrl = getDirectImageUrl(url);
    if (directUrl) setLightboxImage({ src: directUrl, alt: name, originalUrl: url });
    else window.open(url, "_blank", "noopener,noreferrer");
  }, []);
  const downloadTracker = useCallback(
    (eraKey?: string) => {
      if (!data?.eras) return;
      const erasToDownload = eraKey ? { [eraKey]: data.eras[eraKey] } : data.eras;
      const downloadItems: Array<{
        track: TALeak;
        era: Era;
        playableUrl: string;
      }> = [];
      for (const era of Object.values(erasToDownload)) {
        if (!era.data) continue;
        for (const tracks of Object.values(era.data)) {
          if (!Array.isArray(tracks)) continue;
          for (const track of tracks) {
            const url = getTrackUrl(track);
            const playableUrl = url ? resolvedUrls.get(url) : null;
            if (url && playableUrl) downloadItems.push({ track, era, playableUrl });
          }
        }
      }
      if (downloadItems.length === 0) {
        toast({ title: "No tracks to download", description: "No playable tracks found" });
        return;
      }
      downloadManager.startDownload({
        artistName: artistDisplayName,
        eraName: eraKey ? data.eras[eraKey]?.name : undefined,
        items: downloadItems,
      });
      toast({ title: "Download started", description: `Downloading ${downloadItems.length} tracks in background` });
    },
    [data, resolvedUrls, artistDisplayName, downloadManager, toast]
  );
  const qualities = useMemo(() => {
    if (!data?.eras) return [];
    const set = new Set<string>();
    for (const era of Object.values(data.eras)) {
      if (!era.data) continue;
      for (const tracks of Object.values(era.data)) {
        if (!Array.isArray(tracks)) continue;
        for (const t of tracks) {
          if (t.quality && !isUrl(t.quality)) set.add(t.quality);
        }
      }
    }
    return Array.from(set);
  }, [data]);
  const stats = useMemo(() => {
    let total = 0,
      playable = 0;
    if (data?.eras) {
      for (const era of Object.values(data.eras)) {
        if (!era.data) continue;
        for (const tracks of Object.values(era.data)) {
          if (Array.isArray(tracks)) {
            total += tracks.length;
            for (const t of tracks) {
              const url = getTrackUrl(t);
              if (url && resolvedUrls.get(url)) playable++;
            }
          }
        }
      }
    }
    return { total, playable };
  }, [data, resolvedUrls]);
  if (status === "fallback") return <FallbackView trackerId={trackerId} sheetsUrl={getGoogleSheetsUrl(trackerId)} />;
  return (
    <div className="min-h-screen bg-black pb-32 sm:pb-24">
      <header className="sticky top-0 z-30 py-3 sm:py-4 bg-black/70 backdrop-blur-lg border-b border-neutral-900">
        <div className="max-w-7xl mx-auto flex items-center gap-2 sm:gap-4 px-3 sm:px-6">
          <Link
            to="/"
            className="text-xl sm:text-2xl font-bold bg-gradient-to-b from-neutral-50 to-neutral-400 bg-clip-text text-transparent flex-shrink-0"
          >
            ArtistGrid
          </Link>
          <div className="relative flex-1 min-w-0">
            <Search className="absolute left-3 sm:left-4 top-1/2 -translate-y-1/2 w-4 sm:w-5 h-4 sm:h-5 text-neutral-500 pointer-events-none" />
            <Input
              type="text"
              placeholder="Tracker ID..."
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleLoad()}
              className="bg-neutral-900 border-2 border-neutral-800 text-white placeholder:text-neutral-500 focus:border-white/50 rounded-lg sm:rounded-xl w-full pl-9 sm:pl-12 pr-8 sm:pr-10 h-10 sm:h-12 text-sm sm:text-base"
            />
            {inputValue && (
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-1 sm:right-2 top-1/2 -translate-y-1/2 h-7 w-7 sm:h-8 sm:w-8 text-neutral-500 hover:text-white"
                onClick={() => setInputValue("")}
              >
                <X className="w-4 h-4" />
              </Button>
            )}
          </div>
          <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
            {trackerId && (
              <Button
                variant="outline"
                size="icon"
                onClick={handleShare}
                className="bg-neutral-900 border-neutral-800 hover:bg-neutral-800 text-white h-9 w-9 sm:h-10 sm:w-10"
              >
                <Share2 className="w-4 h-4" />
              </Button>
            )}
            <Button
              variant="outline"
              size="icon"
              onClick={() => setLastfmModalOpen(true)}
              aria-label="Last.fm"
              className={`bg-neutral-900 border-neutral-800 hover:bg-neutral-800 h-9 w-9 sm:h-10 sm:w-10 ${lastfm.isAuthenticated ? "text-green-500 hover:text-green-400" : "text-white hover:text-white"}`}
            >
              <Radio className="w-4 sm:w-5 h-4 sm:h-5" />
            </Button>
            <Button
              onClick={handleLoad}
              className="bg-white text-black hover:bg-neutral-200 h-9 sm:h-10 px-3 sm:px-4 text-sm sm:text-base"
            >
              Load
            </Button>
          </div>
        </div>
      </header>
      <LastFMModal
        isOpen={lastfmModalOpen}
        onClose={() => setLastfmModalOpen(false)}
        lastfm={lastfm}
        token={lastfmToken}
        setToken={setLastfmToken}
      />
      {lightboxImage && (
        <ImageLightbox
          src={lightboxImage.src}
          alt={lightboxImage.alt}
          originalUrl={lightboxImage.originalUrl}
          onClose={() => setLightboxImage(null)}
        />
      )}
      <main className="max-w-7xl mx-auto px-3 sm:px-6 py-4 sm:py-6">
        {status === "idle" && (
          <div className="text-center py-12 sm:py-20">
            <h2 className="text-lg sm:text-xl font-semibold text-neutral-300 mb-2">
              Enter a Tracker ID to get started
            </h2>
            <p className="text-sm sm:text-base text-neutral-500">Tracker IDs are exactly 44 characters long</p>
          </div>
        )}
        {status === "loading" && (
          <div className="space-y-4 sm:space-y-6">
            <div className="text-center py-4">
              <div className="inline-flex items-center gap-2 text-neutral-400 text-sm sm:text-base">
                <Loader2 className="w-4 sm:w-5 h-4 sm:h-5 animate-spin" />
                <span>Loading tracker data...</span>
              </div>
            </div>
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="bg-neutral-950 border border-neutral-800 rounded-xl p-4 sm:p-5">
                <div className="flex items-center gap-3 sm:gap-4 mb-4">
                  <Skeleton className="w-12 h-12 sm:w-16 sm:h-16 rounded-xl bg-neutral-800" />
                  <div className="flex-1">
                    <Skeleton className="h-4 sm:h-5 w-1/3 bg-neutral-800 mb-2" />
                    <Skeleton className="h-3 sm:h-4 w-1/4 bg-neutral-800" />
                  </div>
                </div>
                <div className="space-y-2 sm:space-y-3">
                  {Array.from({ length: 3 }).map((_, j) => (
                    <Skeleton key={j} className="h-14 sm:h-16 bg-neutral-800 rounded-xl" />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
        {status === "error" && (
          <div className="flex items-center justify-center py-12 sm:py-20">
            <div className="text-center bg-neutral-900 border border-red-500/30 p-6 sm:p-8 rounded-xl max-w-md">
              <h2 className="text-lg sm:text-xl font-bold text-white mb-2">Error Loading Data</h2>
            </div>
          </div>
        )}
        {status === "success" && data && (
          <>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
              <h1 className="text-xl sm:text-2xl font-bold text-white">{artistDisplayName}</h1>
              {!isArtTab && stats.playable > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => downloadTracker()}
                  disabled={isPreloading}
                  className="bg-neutral-900 border-neutral-800 hover:bg-neutral-800 text-white self-start sm:self-auto"
                >
                  <FolderDown className="w-4 h-4 mr-2" />
                  Download All ({stats.playable})
                </Button>
              )}
            </div>
            {data.tabs && data.tabs.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-4 sm:mb-6 pb-3 sm:pb-4 border-b border-neutral-800">
                {data.tabs.map((tab) => (
                  <Button
                    key={tab}
                    variant={currentTab === tab ? "default" : "outline"}
                    size="sm"
                    onClick={() => handleTabChange(tab)}
                    className={`flex-shrink-0 text-xs sm:text-sm ${currentTab === tab ? "bg-white text-black hover:bg-neutral-200" : "bg-neutral-900 border-neutral-800 hover:bg-neutral-800 text-white"}`}
                  >
                    {tab}
                  </Button>
                ))}
              </div>
            )}
            {!isArtTab && (
              <div className="flex flex-col gap-3 mb-4 sm:mb-6">
                <div className="relative w-full">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" />
                  <Input
                    type="text"
                    placeholder="Search tracks..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="bg-neutral-900 border-neutral-800 text-white pl-10 h-10 rounded-lg text-sm"
                  />
                </div>
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    {isPreloading ? (
                      <div className="flex items-center gap-2 text-xs sm:text-sm text-neutral-400">
                        <Loader2 className="w-3 sm:w-4 h-3 sm:h-4 animate-spin" />
                        <span>
                          {resolveProgress.current}/{resolveProgress.total}
                        </span>
                      </div>
                    ) : resolvedUrls.size > 0 ? (
                      <span className="text-xs sm:text-sm text-neutral-500">
                        {stats.playable}/{stats.total} playable
                      </span>
                    ) : null}
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="outline"
                        size="icon"
                        className="bg-neutral-900 border-neutral-800 hover:bg-neutral-800 text-white h-9 w-9 sm:h-10 sm:w-10"
                      >
                        <Filter className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent
                      align="end"
                      className="w-56 bg-neutral-950 border-neutral-800 text-neutral-200"
                    >
                      <DropdownMenuLabel>Filters</DropdownMenuLabel>
                      <DropdownMenuSeparator className="bg-neutral-800" />
                      <DropdownMenuCheckboxItem
                        checked={filters.showPlayableOnly}
                        onCheckedChange={(c) => setFilters((f) => ({ ...f, showPlayableOnly: !!c }))}
                      >
                        Show playable only
                      </DropdownMenuCheckboxItem>
                      <DropdownMenuSeparator className="bg-neutral-800" />
                      <DropdownMenuLabel>Quality</DropdownMenuLabel>
                      <DropdownMenuCheckboxItem
                        checked={filters.qualityFilter === "all"}
                        onCheckedChange={() => setFilters((f) => ({ ...f, qualityFilter: "all" }))}
                      >
                        All qualities
                      </DropdownMenuCheckboxItem>
                      {qualities.map((q) => (
                        <DropdownMenuCheckboxItem
                          key={q}
                          checked={filters.qualityFilter === q}
                          onCheckedChange={() => setFilters((f) => ({ ...f, qualityFilter: q }))}
                        >
                          {q}
                        </DropdownMenuCheckboxItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            )}
            {isArtTab && filteredData ? (
              <ArtGallery eras={filteredData} onImageClick={handleArtImageClick} />
            ) : filteredData && Object.keys(filteredData).length > 0 ? (
              <div className="space-y-4 sm:space-y-6">
                {Object.entries(filteredData).map(([key, era]) => {
                  const eraPlayableCount = era.data
                    ? Object.values(era.data)
                        .flat()
                        .filter((t) => {
                          const url = getTrackUrl(t);
                          return url && resolvedUrls.get(url);
                        }).length
                    : 0;
                  return (
                    <div
                      key={key}
                      style={{
                        background: era.backgroundColor
                          ? `color-mix(in srgb, ${era.backgroundColor}, oklch(14.5% 0 0) 80%)`
                          : "oklch(14.5% 0 0)",
                      }}
                      className="border border-neutral-800 rounded-xl overflow-hidden"
                    >
                      <div className="flex items-center">
                        <button
                          style={{ color: "black" }}
                          className="flex-1 flex items-center gap-3 sm:gap-4 p-4 sm:p-5 text-left hover:bg-white/[0.02] transition-colors"
                          onClick={() => toggleEra(key)}
                        >
                          {era.image ? (
                            <img
                              src={era.image}
                              alt={era.name}
                              className="w-12 h-12 sm:w-16 sm:h-16 rounded-xl object-cover bg-neutral-800 flex-shrink-0"
                            />
                          ) : (
                            <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-xl bg-neutral-800 flex-shrink-0" />
                          )}
                          <div className="flex-1 min-w-0">
                            <h3
                              style={{
                                color: era.textColor
                                  ? `color-mix(in srgb, ${era.textColor}, rgb(255,255,255) 40%)`
                                  : "white",
                              }}
                              className="text-base sm:text-lg font-bold truncate"
                            >
                              {era.name || key}
                            </h3>
                            {era.extra && <p className="text-xs sm:text-sm text-neutral-500 truncate">{era.extra}</p>}
                          </div>
                          <ChevronDown
                            className={`w-5 h-5 text-neutral-500 transition-transform flex-shrink-0 ${expandedEras.has(key) ? "rotate-180" : ""}`}
                          />
                        </button>
                        {eraPlayableCount > 0 && (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="text-neutral-500 hover:text-white hover:bg-white/10 mr-2 h-9 w-9 sm:h-10 sm:w-10 flex-shrink-0"
                              >
                                <MoreHorizontal className="w-4 sm:w-5 h-4 sm:h-5" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent
                              align="end"
                              className="w-48 bg-neutral-950 border-neutral-800 text-neutral-200"
                            >
                              <DropdownMenuItem onClick={() => downloadTracker(key)} className="cursor-pointer">
                                <FolderDown className="w-4 h-4 mr-2" />
                                Download Era ({eraPlayableCount})
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </div>
                      {expandedEras.has(key) && (
                        <div className="px-3 pb-3 sm:px-5 sm:pb-5">
                          {era.description && (
                            <p className="text-xs sm:text-sm text-neutral-400 p-3 sm:p-4 bg-black/30 rounded-xl mb-3 sm:mb-5">
                              {era.description}
                            </p>
                          )}
                          {era.data &&
                            Object.entries(era.data).map(([cat, tracks]) => (
                              <div key={cat} className="mb-4 sm:mb-6 last:mb-0">
                                <h4 className="text-xs sm:text-sm font-semibold text-neutral-300 pb-2 sm:pb-3 mb-2 sm:mb-3 border-b border-neutral-800">
                                  {cat}
                                </h4>
                                <div className="space-y-1.5 sm:space-y-2">
                                  {(tracks as TALeak[]).map((track, i) => {
                                    const url = getTrackUrl(track);
                                    const source = url ? getTrackSource(url) : "unknown";
                                    const isSupported = SUPPORTED_SOURCES.includes(source);
                                    const playableUrl = url ? resolvedUrls.get(url) : null;
                                    const isPlayable = !!playableUrl || isSupported;
                                    const isCurrentlyPlaying =
                                      playerState.currentTrack?.url === url && playerState.isPlaying;
                                    const isCurrentTrack = playerState.currentTrack?.url === url;
                                    const isHighlighted = url === highlightedTrackUrl;
                                    const description = getTrackDescription(track);
                                    const shouldShowSource = source !== "unknown" && source !== "juicewrldapi";
                                    return (
                                      <div
                                        key={i}
                                        ref={isHighlighted ? highlightedTrackRef : null}
                                        className={`rounded-lg sm:rounded-xl transition-colors ${isHighlighted ? "bg-yellow-500/20 border border-yellow-500/50 ring-2 ring-yellow-500/30" : isCurrentTrack ? "bg-white/10 border border-white/20" : "bg-white/[0.02] hover:bg-white/[0.05] border border-transparent"}`}
                                      >
                                        <div className="flex items-center gap-2 sm:gap-3 p-2.5 sm:p-3">
                                          {isPlayable ? (
                                            <button
                                              onClick={() => handlePlayTrack(track, era)}
                                              className="w-9 h-9 sm:w-10 sm:h-10 flex-shrink-0 flex items-center justify-center rounded-full bg-white text-black hover:scale-110 transition-transform"
                                            >
                                              {isCurrentlyPlaying ? (
                                                <Pause className="w-3.5 sm:w-4 h-3.5 sm:h-4" />
                                              ) : (
                                                <Play className="w-3.5 sm:w-4 h-3.5 sm:h-4 ml-0.5" />
                                              )}
                                            </button>
                                          ) : (
                                            <button
                                              onClick={() => url && handleOpenUrl(url)}
                                              className="w-9 h-9 sm:w-10 sm:h-10 flex-shrink-0 flex items-center justify-center rounded-full bg-white text-black hover:scale-110 transition-transform"
                                            >
                                              <LinkIcon className="w-3.5 sm:w-4 h-3.5 sm:h-4" />
                                            </button>
                                          )}
                                          <div className="flex-1 min-w-0">
                                            <div className="font-semibold text-white text-xs sm:text-sm truncate">
                                              {track.name || "Unknown"}
                                            </div>
                                            <div className="flex flex-wrap items-center gap-1 sm:gap-2 mt-0.5 sm:mt-1">
                                              {track.extra && (
                                                <span className="text-xs text-neutral-500 truncate max-w-[120px] sm:max-w-none">
                                                  {track.extra}
                                                </span>
                                              )}
                                              <div className="flex items-center gap-1 sm:hidden">
                                                {track.type && track.type !== "Unknown" && track.type !== "N/A" && (
                                                  <span className="text-[10px] px-1.5 py-0.5 bg-white/5 rounded text-neutral-400">
                                                    {track.type}
                                                  </span>
                                                )}
                                                {track.track_length &&
                                                  track.track_length !== "N/A" &&
                                                  track.track_length !== "?:??" && (
                                                    <span className="text-[10px] px-1.5 py-0.5 bg-white/5 rounded text-neutral-400">
                                                      {track.track_length}
                                                    </span>
                                                  )}
                                              </div>
                                            </div>
                                          </div>
                                          <div className="hidden sm:flex items-center gap-2 flex-shrink-0">
                                            {shouldShowSource && (
                                              <span className="text-xs px-2 py-1 bg-white/5 rounded text-neutral-400">
                                                {getSourceDisplayName(source)}
                                              </span>
                                            )}
                                            {track.type && track.type !== "Unknown" && track.type !== "N/A" && (
                                              <span className="text-xs px-2 py-1 bg-white/5 rounded text-neutral-400">
                                                {track.type}
                                              </span>
                                            )}
                                            {track.quality && !isUrl(track.quality) && track.quality !== "N/A" && (
                                              <span className="text-xs px-2 py-1 bg-white/5 rounded text-neutral-400">
                                                {track.quality}
                                              </span>
                                            )}
                                            {track.track_length &&
                                              track.track_length !== "N/A" &&
                                              track.track_length !== "?:??" && (
                                                <span className="text-xs px-2 py-1 bg-white/5 rounded text-neutral-400">
                                                  {track.track_length}
                                                </span>
                                              )}
                                          </div>
                                          {url && (
                                            <Button
                                              variant="ghost"
                                              size="icon"
                                              onClick={() => handleOpenUrl(url)}
                                              className="text-neutral-500 hover:text-white hover:bg-white/10 w-7 h-7 sm:w-8 sm:h-8 rounded-lg flex-shrink-0"
                                            >
                                              <ExternalLink className="w-4 h-4" />
                                            </Button>
                                          )}
                                          <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                              <Button
                                                variant="ghost"
                                                size="icon"
                                                className="text-neutral-500 hover:text-white hover:bg-white/10 w-7 h-7 sm:w-8 sm:h-8 rounded-lg flex-shrink-0"
                                              >
                                                <MoreHorizontal className="w-4 h-4" />
                                              </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent
                                              align="end"
                                              className="w-48 bg-neutral-950 border-neutral-800 text-neutral-200"
                                            >
                                              {url && (
                                                <DropdownMenuItem
                                                  onClick={() => handleShareTrack(url, track.name || "Track")}
                                                  className="cursor-pointer"
                                                >
                                                  <Share className="w-4 h-4 mr-2" />
                                                  Share Track
                                                </DropdownMenuItem>
                                              )}
                                              {isPlayable && (
                                                <>
                                                  <DropdownMenuItem
                                                    onClick={() => handlePlayNext(track, era)}
                                                    className="cursor-pointer"
                                                  >
                                                    <SkipForward className="w-4 h-4 mr-2" />
                                                    Play Next
                                                  </DropdownMenuItem>
                                                  <DropdownMenuItem
                                                    onClick={() => handleAddToQueue(track, era)}
                                                    className="cursor-pointer"
                                                  >
                                                    <ListPlus className="w-4 h-4 mr-2" />
                                                    Add to Queue
                                                  </DropdownMenuItem>
                                                  <DropdownMenuSeparator className="bg-neutral-800" />
                                                  <DropdownMenuItem
                                                    onClick={() => handleDownload(track)}
                                                    className="cursor-pointer"
                                                  >
                                                    <Download className="w-4 h-4 mr-2" />
                                                    Download
                                                  </DropdownMenuItem>
                                                </>
                                              )}
                                              <DropdownMenuItem
                                                onClick={() => handleOpenOriginal(track)}
                                                className="cursor-pointer"
                                              >
                                                <ExternalLink className="w-4 h-4 mr-2" />
                                                Open Original URL
                                              </DropdownMenuItem>
                                            </DropdownMenuContent>
                                          </DropdownMenu>
                                        </div>
                                        {description && (
                                          <div className="px-2.5 pb-2.5 sm:px-3 sm:pb-3">
                                            <p className="text-[10px] sm:text-xs text-neutral-500 pl-11 sm:pl-[52px]">
                                              {description}
                                            </p>
                                          </div>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-12 sm:py-20 flex flex-col items-center">
                <CircleSlash className="w-12 h-12 sm:w-16 sm:h-16 text-neutral-700 mb-3 sm:mb-4" />
                <h3 className="text-base sm:text-lg font-medium text-neutral-300">No Tracks Found</h3>
                <p className="text-sm sm:text-base text-neutral-500 mt-1">
                  {searchQuery ? `No results for "${searchQuery}"` : "Try adjusting your filters"}
                </p>
              </div>
            )}
          </>
        )}
        <div className="mt-8 sm:mt-12 pt-4 sm:pt-6 border-b border-neutral-800">
          <div className="flex flex-col items-center gap-3 sm:gap-4 max-w-xl mx-auto">
            <div className="flex items-center justify-center gap-2 text-xs text-neutral-500 bg-neutral-900/50 px-3 sm:px-4 py-2 rounded-lg w-full">
              <AlertTriangle className="w-3 sm:w-4 h-3 sm:h-4 flex-shrink-0" />
              <span>ArtistGrid does not host any illegal content. All links point to third-party services.</span>
            </div>
            <p className="text-[10px] sm:text-xs text-neutral-600 text-center leading-relaxed px-2">
              ArtistGrid is not affiliated with, endorsed by, or associated with Google, TrackerHub, or any artists
              whose content may appear in these trackers. We do not host, store, or distribute any copyrighted content.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
function TrackerViewWithProvider() {
  return (
    <DownloadProvider>
      <TrackerViewContent />
    </DownloadProvider>
  );
}
export default function TrackerViewPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-black flex items-center justify-center">
          <div className="w-8 h-8 border-2 border-neutral-700 border-t-white rounded-full animate-spin" />
        </div>
      }
    >
      <TrackerViewWithProvider />
    </Suspense>
  );
}
