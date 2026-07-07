import { useState, useEffect, useCallback, useMemo, Suspense, useRef } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { motion, AnimatePresence } from "framer-motion";
import { useHeaderSlots } from "@/src/components/layout";
import { useSearchParams, useNavigate } from "react-router-dom";
import { usePageMeta } from "@/src/hooks/use-page-meta";
import type { Track, Era, TALeak, TrackerResponse, TrackSource } from "@/src/types";
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
  Settings,
  Heart,
  Trash2,
  Music2,
  FileSpreadsheet,
  Layers,
  Plus,
  Pencil,
  X as XIcon,
} from "lucide-react";
import { fetchWithFallback, adaptV3Response, adaptV3FlatResponse, type V3Response } from "@/src/lib/api";
import { getCache, setCache } from "@/src/lib/tracker-cache";
import { resolvePlayableUrl, getTrackSource, isNetworkSource, transformUrlForOpening } from "@/src/lib/resolve-url";
import {
  generateTrackId,
  isUrl,
  getTrackUrl,
  getTrackDescription,
  encodeTrackForUrl,
  decodeTrackFromUrl,
  getGoogleSheetsUrl,
  getSourceDisplayName,
  TRACKER_ID_LENGTH,
  SUPPORTED_SOURCES,
} from "@/src/lib/track-utils";
import { extractTrackerId, getSheetViewUrl, getCleanArtistName } from "@/src/lib/artist-utils";
import { DownloadProvider, useDownloadManager } from "@/src/components/download-manager";
import { ArtGallery, ImageLightbox } from "@/src/components/art-gallery";
import { LastFMModal } from "@/src/components/lastfm-modal";
import { YouTubePlayer } from "@/src/components/youtube-player";
import { useSettings } from "@/src/hooks/use-settings";
import { loadSettings } from "@/src/lib/settings";
import { useSettingsModal } from "@/src/App";
import { getFavourites, toggleFavourite, clearFavourites, getFavouritedTracks, toggleEraFavourite, isEraFavourited } from "@/src/lib/favourites";
import { getCustomViews, addCustomView, deleteCustomView, mergeTabData, type CustomView } from "@/src/lib/custom-views";
import {
  PlayButton,
  PauseButton,
  OpenLinkButton,
  TrackDescription,
  TrackItemActions,
  FallbackView,
  type FilterOptions,
  type PlayableTrackData,
} from "@/src/components/view/track-item";
import { CustomViewManager } from "@/src/components/view/custom-view-manager";
const ART_TABS = ["Art"];
const NON_PLAYABLE_TABS = ["Art", "Tracklists", "Misc"];
const SUPPORTED_SOURCES_SET = new Set(SUPPORTED_SOURCES);
function forEachEraTrack(eras: Record<string, Era>, cb: (track: TALeak, era: Era) => boolean | void): void {
  for (const era of Object.values(eras)) {
    if (!era.data) continue;
    for (const tracks of Object.values(era.data)) {
      if (!Array.isArray(tracks)) continue;
      for (const track of tracks) {
        if (cb(track, era) === false) return;
      }
    }
  }
}
function mergeAndCache(
  id: string,
  cacheKey: string | undefined,
  trackerData: TrackerResponse,
  newResolved: Record<string, string | null>
): void {
  const existing = getCache(id, cacheKey)?.resolvedUrls || {};
  setCache(id, trackerData, { ...existing, ...newResolved }, cacheKey);
}
function TrackerViewContent({ trackerId: propTrackerId, initialTab: propInitialTab }: { trackerId?: string; initialTab?: string } = {}) {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { state: playerState, playTrack, addToQueue, clearQueue, togglePlayPause, lastfm } = usePlayer();
  const downloadManager = useDownloadManager();
  const { settings } = useSettings();
  const { setSettingsOpen } = useSettingsModal();
  const [trackerId, setTrackerId] = useState(propTrackerId || searchParams.get("id") || "");
  const [inputValue, setInputValue] = useState(trackerId);
  const [artistNameFromUrl, setArtistNameFromUrl] = useState<string | null>(() => searchParams.get("artist"));
  const [data, setData] = useState<TrackerResponse | null>(null);
  const [baseEraImages, setBaseEraImages] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<"idle" | "loading" | "tab-loading" | "success" | "error" | "fallback">("idle");
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedEras, setExpandedEras] = useState<Set<string>>(new Set());
  const [filters, setFilters] = useState<FilterOptions>({ showPlayableOnly: false, qualityFilter: [], sourceFilter: [] });
  const [resolvedUrls, setResolvedUrls] = useState<Map<string, string | null>>(new Map());
  const [resolveProgress, setResolveProgress] = useState({ current: 0, total: 0 });
  const [isPreloading, setIsPreloading] = useState(false);
  const [currentTab, setCurrentTab] = useState<string>("");
  const [tabsList, setTabsList] = useState<string[]>([]);
  const tabSlugsRef = useRef<Record<string, string>>({});
  const tabGidsRef = useRef<Record<string, string>>({});
  const hasLoadedRef = useRef(false);
  const abortRef = useRef<AbortController | null>(null);
  const [tabError, setTabError] = useState(false);
  const [tabEmpty, setTabEmpty] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [lastfmModalOpen, setLastfmModalOpen] = useState(false);
  const [youtubeUrl, setYoutubeUrl] = useState<string | null>(null);
  const [lastfmToken, setLastfmToken] = useState<string | null>(null);
  const [lightboxImage, setLightboxImage] = useState<{
    src: string;
    alt: string;
    originalUrl: string;
    description?: string;
  } | null>(null);
  const [highlightedTrackUrl, setHighlightedTrackUrl] = useState<string | null>(null);
  const highlightedTrackRef = useRef<HTMLDivElement | null>(null);
  const [downloadConfirm, setDownloadConfirm] = useState<{
    artistName: string;
    eraName: string | undefined;
    items: Array<{ track: TALeak; era: Era; playableUrl: string }>;
  } | null>(null);
  const pendingTrackUrlRef = useRef<string | null>(null);
  const [favourites, setFavourites] = useState<string[]>(() => getFavourites(trackerId));
  const [customViews, setCustomViews] = useState<CustomView[]>(() => getCustomViews(trackerId));
  const [activeCustomView, setActiveCustomView] = useState<CustomView | null>(null);
  const isFavouritesTab = currentTab === "Favourites";
  const isCustomTab = currentTab === "Custom";
  const pageTabSlug = !isFavouritesTab && !isCustomTab && currentTab ? (tabSlugsRef.current[currentTab] ?? currentTab) : "";
  const pageTabPart = pageTabSlug ? `/${pageTabSlug}` : "";
  const displayTabs = useMemo(() => {
    const tabs = [...tabsList];
    if (!tabs.includes("Favourites")) tabs.push("Favourites");
    if (!tabs.includes("Custom")) tabs.push("Custom");
    return tabs;
  }, [tabsList]);
  const artistDisplayName = useMemo(() => artistNameFromUrl || "Unknown Artist", [artistNameFromUrl]);
  const cleanArtistName = useMemo(() => artistNameFromUrl ? getCleanArtistName(artistNameFromUrl) : "", [artistNameFromUrl]);
  usePageMeta({ title: `ArtistGrid - ${artistNameFromUrl || "Tracker"}`, url: `https://artistgrid.cx/sh/${trackerId}${pageTabPart}?artist=${encodeURIComponent(cleanArtistName || "")}` });
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
  const isArtTab = ART_TABS.some((t) => currentTab.toLowerCase().includes(t.toLowerCase()));
  const isFlat = !!data?.isFlat;
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
        const sourceFilterSet = new Set(filters.sourceFilter);
        const filtered = tracks.filter((t) => {
          const url = getTrackUrl(t);
          const source = url ? getTrackSource(url) : "unknown";
          const isSupported = url ? SUPPORTED_SOURCES_SET.has(source) : false;
          if (filters.showPlayableOnly && !(url && resolvedUrls.get(url)) && !isSupported) return false;
          if (
            filters.qualityFilter.length > 0 &&
            !filters.qualityFilter.some((q) => (t.quality?.toLowerCase() || "").includes(q.toLowerCase()))
          )
            return false;
          if (filters.sourceFilter.length > 0 && !sourceFilterSet.has(source)) return false;
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
  const flatTracks = useMemo(
    () =>
      isFlat && filteredData
        ? Object.values(filteredData).flatMap((era): TALeak[] =>
            era.data ? (Object.values(era.data).flat() as TALeak[]) : []
          )
        : [],
    [isFlat, filteredData]
  );
  const favouriteTracks = useMemo(() => {
    if (!data || favourites.length === 0) return [];
    return getFavouritedTracks(data, favourites)
      .map(({ track, era }) => {
        const url = getTrackUrl(track);
        if (!url) return null;
        const playableUrl = resolvedUrls.get(url) ?? null;
        if (!playableUrl) return null;
        return { track, era, url, playableUrl };
      })
      .filter((t): t is NonNullable<typeof t> => t !== null);
  }, [data, favourites, resolvedUrls]);
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
    if (id) {
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
      const id = setTimeout(() => highlightedTrackRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }), 500);
      return () => clearTimeout(id);
    }
  }, [highlightedTrackUrl, data]);
  useEffect(() => {
    if (pendingTrackUrlRef.current && data && resolvedUrls.size > 0) {
      const trackUrl = pendingTrackUrlRef.current;
      pendingTrackUrlRef.current = null;
      forEachEraTrack(data.eras, (track, era) => {
        const url = getTrackUrl(track);
        if (url === trackUrl) {
          const playableUrl = resolvedUrls.get(url);
          if (playableUrl) playTrack(createTrackObject(track, era, url, playableUrl));
          return false;
        }
      });
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
      const res = await fetchWithFallback(`/sh/${id}/`);
      if (res.ok) {
        const json: V3Response = await res.json();
        if (json?.eras) {
          const images: Record<string, string> = {};
          for (const era of json.eras) {
            if (era.cover_art) images[era.name] = era.cover_art;
          }
          setBaseEraImages(images);
        }
      }
    } catch {}
  }, []);
  const resolveUrls = useCallback(async (urls: string[]): Promise<Record<string, string | null>> => {
    if (urls.length === 0) return {};
    setIsPreloading(true);
    setResolveProgress({ current: 0, total: urls.length });
    const resolved: Record<string, string | null> = {};
    const batchSize = 10;
    const FLUSH_INTERVAL_MS = 200;
    let lastFlush = 0;
    for (let i = 0; i < urls.length; i += batchSize) {
      const batch = urls.slice(i, i + batchSize);
      const results = await Promise.all(batch.map(async (url) => ({ url, playable: await resolvePlayableUrl(url) })));
      for (const { url, playable } of results) resolved[url] = playable;
      const current = Math.min(i + batchSize, urls.length);
      const isLast = current >= urls.length;
      const now = Date.now();
      if (isLast || now - lastFlush >= FLUSH_INTERVAL_MS) {
        lastFlush = now;
        const snapshot = { ...resolved };
        setResolvedUrls((prev) => {
          const next = new Map(prev);
          for (const [url, playable] of Object.entries(snapshot)) next.set(url, playable);
          return next;
        });
        setResolveProgress({ current, total: urls.length });
      }
    }
    setIsPreloading(false);
    return resolved;
  }, []);
  const loadTrackerData = useCallback(
    async (id: string, tab?: string, overrideTabName?: string) => {
      abortRef.current?.abort();
      if (!tab) {
        setData(null);
        setResolvedUrls(new Map());
        setExpandedEras(new Set());
        setTabsList([]);
        tabSlugsRef.current = {};
        tabGidsRef.current = {};
      }
      setTabError(false);
      setTabEmpty(false);
      const gid = tab ? (tabGidsRef.current[overrideTabName || ""] || "") : "";
      const cacheKey = gid || tab;
      const cached = getCache(id, cacheKey);
      if (cached) {
        setData(cached.data);
        setResolvedUrls(new Map(Object.entries(cached.resolvedUrls)));
        if (tab) {
          const dn = overrideTabName || Object.entries(tabSlugsRef.current).find(([, s]) => s === tab)?.[0] || tab;
          setCurrentTab(dn);
        } else {
          setCurrentTab(cached.data.current_tab);
        }
        if (cached.data.tabs?.length) setTabsList(cached.data.tabs);
        if (cached.data.tabSlugs) tabSlugsRef.current = { ...tabSlugsRef.current, ...cached.data.tabSlugs };
        if (cached.data.tabGids) tabGidsRef.current = { ...tabGidsRef.current, ...cached.data.tabGids };
        setStatus("success");
        hasLoadedRef.current = true;
        setHasLoaded(true);
        return;
      }
      const controller = new AbortController();
      abortRef.current = controller;
      setStatus(tab && hasLoadedRef.current ? "tab-loading" : "loading");
      if (tab) fetchBaseEraImages(id);
      const fail = () => {
        if (controller.signal.aborted) return;
        if (tab) {
          setData(null);
          setTabError(true);
          setStatus("success");
        } else {
          setStatus("fallback");
        }
      };
      try {
        const gid = tabGidsRef.current[overrideTabName || ""] || "";
        const endpoint = tab ? (gid ? `/sh/${id}/gid/${gid}` : `/sh/${id}/tab/${encodeURIComponent(tab)}`) : `/sh/${id}/`;
        const res = await fetchWithFallback(endpoint, { signal: controller.signal });
        if (controller.signal.aborted) return;
        if (!res.ok) { fail(); return; }
        const v3: V3Response = await res.json();
        if (controller.signal.aborted) return;
        const hasFlatTracks = v3 && typeof v3 === "object" && Array.isArray(v3.tracks) && v3.tracks.length > 0;
        const hasEras = v3 && typeof v3 === "object" && Array.isArray(v3.eras) && v3.eras.length > 0;
        if (!hasFlatTracks && !hasEras) {
          if (tab) {
            setData(null);
            setTabEmpty(true);
            setStatus("success");
          } else {
            fail();
          }
          return;
        }
        const json = hasFlatTracks ? adaptV3FlatResponse(v3) : adaptV3Response(v3);
        setData(json);
        setCurrentTab(overrideTabName || json.current_tab);
        if (json.tabs?.length) setTabsList(json.tabs);
        if (json.tabSlugs) tabSlugsRef.current = { ...tabSlugsRef.current, ...json.tabSlugs };
        if (json.tabGids) tabGidsRef.current = { ...tabGidsRef.current, ...json.tabGids };
        setStatus("success");
        hasLoadedRef.current = true;
        setHasLoaded(true);
        setCache(id, json, {}, cacheKey);
        if (!NON_PLAYABLE_TABS.includes(json.current_tab)) {
          const freeUrls: string[] = [];
          forEachEraTrack(json.eras, (t) => {
            const url = getTrackUrl(t);
            if (url && !isNetworkSource(getTrackSource(url))) freeUrls.push(url);
          });
          if (freeUrls.length > 0) {
            resolveUrls(freeUrls).then((resolved) => mergeAndCache(id, cacheKey, json, resolved));
          }
        }
      } catch (e) {
        if (controller.signal.aborted) return;
        console.error("[tracker] load failed", e);
        fail();
      }
    },
    [fetchBaseEraImages, resolveUrls]
  );
  const tabChangeInProgress = useRef(false);
  useEffect(() => {
    if (!trackerId) return;
    if (tabChangeInProgress.current) {
      tabChangeInProgress.current = false;
      return;
    }
    if (propInitialTab) {
      loadTrackerData(trackerId, propInitialTab);
    } else {
      loadTrackerData(trackerId);
    }
  }, [trackerId, loadTrackerData, propInitialTab]);
const handleLoad = useCallback(() => {
    if (!inputValue.trim()) {
      toast({ title: "Invalid input", description: "Enter a tracker ID or Google Sheets link" });
      return;
    }
    let resolvedUrl = inputValue.trim();
    if (!resolvedUrl.includes("/")) {
      resolvedUrl = `https://docs.google.com/spreadsheets/d/${resolvedUrl}/edit`;
    }
    try {
      new URL(resolvedUrl);
    } catch {
      toast({ title: "Invalid input", description: "Enter a valid Google Sheets link or tracker ID" });
      return;
    }
    const trackerId = extractTrackerId(resolvedUrl);
    if (!trackerId) {
      toast({ title: "Invalid input", description: "Could not extract tracker ID from URL" });
      return;
    }
    const artistQs = cleanArtistName ? `?artist=${encodeURIComponent(cleanArtistName)}` : "";
    navigate(`/sh/${trackerId}${artistQs}`);
  }, [inputValue, navigate, toast, artistNameFromUrl]);
  const handleShare = useCallback(() => {
    const artistQs = cleanArtistName ? `?artist=${encodeURIComponent(cleanArtistName)}` : "";
    const tabSlug = !isFavouritesTab && !isCustomTab && currentTab ? (tabSlugsRef.current[currentTab] ?? currentTab) : "";
    const tabPart = tabSlug ? `/${tabSlug}` : "";
    const url = `${window.location.origin}/sh/${trackerId}${tabPart}${artistQs}`;
    navigator.clipboard.writeText(url);
    toast({ title: "Copied!", description: "Share link copied to clipboard" });
  }, [trackerId, artistNameFromUrl, currentTab, isFavouritesTab, isCustomTab, toast]);
  const handleShareTrack = useCallback(
    (trackUrl: string, trackName: string) => {
      const artistQs = cleanArtistName ? `&artist=${encodeURIComponent(cleanArtistName)}` : "";
      const tabSlug = !isFavouritesTab && !isCustomTab && currentTab ? (tabSlugsRef.current[currentTab] ?? currentTab) : "";
      const tabPart = tabSlug ? `/${tabSlug}` : "";
      const encodedTrack = encodeTrackForUrl(trackUrl);
      const shareUrl = `${window.location.origin}/sh/${trackerId}${tabPart}?track=${encodedTrack}${artistQs}`;
      navigator.clipboard.writeText(shareUrl);
      toast({ title: "Track link copied!", description: `Share link for "${trackName}" copied to clipboard` });
    },
    [trackerId, artistNameFromUrl, currentTab, isFavouritesTab, isCustomTab, toast]
  );
  const handleTabChange = useCallback(
    (tabName: string) => {
      if (!trackerId || tabName === currentTab) return;
      const artistQs = cleanArtistName ? `?artist=${encodeURIComponent(cleanArtistName)}` : "";
      if (tabName === "Favourites") {
        setCurrentTab("Favourites");
        navigate(`/sh/${trackerId}${artistQs}`, { replace: true });
        return;
      }
      if (tabName === "Custom") {
        setCurrentTab("Custom");
        navigate(`/sh/${trackerId}${artistQs}`, { replace: true });
        return;
      }
      let slug = tabSlugsRef.current[tabName];
      if (!slug) {
        const normalized = tabName.trim().normalize("NFC");
        for (const [name, s] of Object.entries(tabSlugsRef.current)) {
          if (name.trim().normalize("NFC") === normalized) { slug = s; break; }
        }
      }
      slug = slug ?? tabName;
      setResolvedUrls(new Map());
      setHighlightedTrackUrl(null);
      tabChangeInProgress.current = true;
      navigate(`/sh/${trackerId}/${slug}${artistQs}`, { replace: true });
      loadTrackerData(trackerId, slug, tabName);
    },
    [trackerId, currentTab, loadTrackerData, navigate, artistNameFromUrl]
  );
  const loadCustomView = useCallback(
    async (view: CustomView) => {
      if (!trackerId) return;
      setActiveCustomView(view);
      setResolvedUrls(new Map());
      setHighlightedTrackUrl(null);
      setStatus("tab-loading");
      setTabError(false);
      setTabEmpty(false);
      fetchBaseEraImages(trackerId);
      const controller = new AbortController();
      abortRef.current = controller;
      try {
        const responses = await Promise.all(
          view.tabs.map(async (tabName) => {
            const slug = tabSlugsRef.current[tabName] ?? tabName;
            const gid = tabGidsRef.current[tabName] || "";
            const cached = getCache(trackerId, gid || slug);
            if (cached) return cached.data;
            const endpoint = gid ? `/sh/${trackerId}/gid/${gid}` : `/sh/${trackerId}/tab/${encodeURIComponent(slug)}`;
            const res = await fetchWithFallback(endpoint, { signal: controller.signal });
            if (!res.ok) return null;
            const v3: V3Response = await res.json();
            const hasFlatTracks = v3 && typeof v3 === "object" && Array.isArray(v3.tracks) && v3.tracks.length > 0;
            const hasEras = v3 && typeof v3 === "object" && Array.isArray(v3.eras) && v3.eras.length > 0;
            if (!hasFlatTracks && !hasEras) return null;
            const json = hasFlatTracks ? adaptV3FlatResponse(v3) : adaptV3Response(v3);
            setCache(trackerId, json, {}, gid || slug);
            return json;
          })
        );
        if (controller.signal.aborted) return;
        const valid = responses.filter((r): r is TrackerResponse => r !== null);
        if (valid.length === 0) {
          setData(null);
          setTabEmpty(true);
          setStatus("success");
          return;
        }
        const merged = mergeTabData(valid);
        setData(merged);
        setCurrentTab("Custom");
        setStatus("success");
        hasLoadedRef.current = true;
        setHasLoaded(true);
        if (valid.length > 0 && valid[0].tabs?.length) setTabsList(valid[0].tabs);
        if (valid.length > 0 && valid[0].tabSlugs) tabSlugsRef.current = { ...tabSlugsRef.current, ...valid[0].tabSlugs };
        if (valid.length > 0 && valid[0].tabGids) tabGidsRef.current = { ...tabGidsRef.current, ...valid[0].tabGids };
      } catch (e) {
        if (controller.signal.aborted) return;
        console.error("[tracker] custom view load failed", e);
        setTabError(true);
        setStatus("success");
      }
    },
    [trackerId]
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
    if (getTrackSource(url) === "froste") {
      toast({ title: "froste.lol (file host for this song) has shut down :/" });
      return;
    }
    if (getTrackSource(url) === "youtube") {
      setYoutubeUrl(url);
      return;
    }
    const s = loadSettings();
    if (s.behavior.openInNewTab) {
      window.open(transformUrlForOpening(url), "_blank", "noopener,noreferrer");
    } else {
      const w = 600, h = 700;
      const left = (screen.width - w) / 2;
      const top = (screen.height - h) / 2;
      window.open(transformUrlForOpening(url), "_blank", `width=${w},height=${h},left=${left},top=${top},noopener,noreferrer`);
    }
  }, [toast]);
  const handleToggleFavourite = useCallback(
    (trackUrl: string) => {
      const added = toggleFavourite(trackerId, trackUrl);
      setFavourites(getFavourites(trackerId));
      toast({ title: added ? "Added to favourites" : "Removed from favourites" });
    },
    [trackerId, toast]
  );
  const handleToggleEraFavourite = useCallback(
    (era: Era) => {
      const added = toggleEraFavourite(trackerId, era);
      setFavourites(getFavourites(trackerId));
      const count = era.data ? Object.values(era.data).flat().length : 0;
      toast({ title: added ? `Favourited ${count} track${count !== 1 ? "s" : ""}` : `Removed ${count} track${count !== 1 ? "s" : ""} from favourites` });
    },
    [trackerId, toast]
  );
  const handleClearFavourites = useCallback(() => {
    clearFavourites(trackerId);
    setFavourites([]);
    toast({ title: "Favourites cleared" });
  }, [trackerId, toast]);
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
      const queueSource = isFavouritesTab ? favouriteTracks : allPlayableTracks;
      const currentIdx = queueSource.findIndex((t) => t.url === url);
      if (currentIdx !== -1) {
        for (const t of queueSource.slice(currentIdx + 1))
          addToQueue(createTrackObject(t.track, t.era, t.url, t.playableUrl));
      }
    },
    [
      playTrack,
      playerState.currentTrack,
      togglePlayPause,
      handleOpenUrl,
      allPlayableTracks,
      favouriteTracks,
      isFavouritesTab,
      addToQueue,
      clearQueue,
      createTrackObject,
    ]
  );
  const handleQueueTrack = useCallback(
    async (rawTrack: TALeak, era: Era, mode: "next" | "queue") => {
      const url = getTrackUrl(rawTrack);
      if (!url) return;
      const playableUrl = await resolvePlayableUrl(url);
      if (!playableUrl) {
        toast({ title: "Cannot queue", description: "Track is not playable" });
        return;
      }
      const track = createTrackObject(rawTrack, era, url, playableUrl);
      addToQueue(track);
      toast({ title: mode === "next" ? "Playing next" : "Added to queue", description: track.name });
    },
    [addToQueue, toast, createTrackObject]
  );
  const handlePlayNext = useCallback(
    (rawTrack: TALeak, era: Era) => handleQueueTrack(rawTrack, era, "next"),
    [handleQueueTrack]
  );
  const handleAddToQueue = useCallback(
    (rawTrack: TALeak, era: Era) => handleQueueTrack(rawTrack, era, "queue"),
    [handleQueueTrack]
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
      const s = loadSettings();
      let filename: string;
      if (s.downloads.useOgFilename) {
        try {
          const urlPath = new URL(playableUrl).pathname;
          const basename = decodeURIComponent(urlPath.split("/").pop() || "");
          filename = basename || `${rawTrack.name || "track"}.mp3`;
        } catch {
          filename = `${rawTrack.name || "track"}.mp3`;
        }
      } else {
        filename = `${rawTrack.name || "track"}.mp3`;
      }
      if (s.downloads.embedMetadata) {
        try {
          toast({ title: "Preparing download...", description: "Embedding metadata" });
          const { embedMetadata } = await import("@/src/lib/ffmpeg-metadata");
          const res = await fetch(playableUrl);
          const blob = await res.blob();
          const meta: { title?: string; artist?: string } = {
            title: rawTrack.name || undefined,
            artist: artistDisplayName || undefined,
          };
          const enhanced = await embedMetadata(blob, meta);
          const blobUrl = URL.createObjectURL(enhanced);
          const link = document.createElement("a");
          link.href = blobUrl;
          link.download = filename;
          link.target = "_blank";
          link.rel = "noopener noreferrer";
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          setTimeout(() => URL.revokeObjectURL(blobUrl), 5000);
          return;
        } catch (e) {
          console.error("Metadata embedding failed, falling back to direct download:", e);
          toast({ title: "Metadata failed", description: "Downloading without metadata" });
        }
      }
      const link = document.createElement("a");
      link.href = playableUrl;
      link.download = filename;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    },
    [resolvedUrls, toast, artistDisplayName]
  );
  const handleOpenOriginal = useCallback(
    (rawTrack: TALeak) => {
      const url = getTrackUrl(rawTrack);
      if (url) handleOpenUrl(url);
    },
    [handleOpenUrl]
  );
  const handleArtImageClick = useCallback((imageUrl: string, name: string, description?: string, linkUrl?: string) => {
    setLightboxImage({ src: imageUrl, alt: name, originalUrl: linkUrl || imageUrl, description });
  }, []);
  const downloadTracker = useCallback(
    async (eraKey?: string, catKey?: string, prebuiltCandidates?: Array<{ track: TALeak; era: Era; url: string }>) => {
      if (!data?.eras) return;
      const candidates = prebuiltCandidates ?? (() => {
        const c: Array<{ track: TALeak; era: Era; url: string }> = [];
        if (eraKey && catKey) {
          const era = data.eras[eraKey];
          const catTracks = era?.data?.[catKey];
          if (Array.isArray(catTracks)) {
            for (const track of catTracks) {
              const url = getTrackUrl(track);
              if (url) c.push({ track, era, url });
            }
          }
        } else {
          const erasToDownload = eraKey ? { [eraKey]: data.eras[eraKey] } : data.eras;
          forEachEraTrack(erasToDownload, (track, era) => {
            const url = getTrackUrl(track);
            if (url) c.push({ track, era, url });
          });
        }
        return c;
      })();
      if (candidates.length === 0) {
        toast({ title: "No tracks to download", description: "No playable tracks found" });
        return;
      }
      const fireProbe = () => {
        const blob = new Blob([], { type: "application/octet-stream" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "agrid-permission.bin";
        a.style.cssText = "display:none";
        document.body.appendChild(a);
        a.click();
        setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 500);
      };
      fireProbe();
      setTimeout(fireProbe, 100);
      const unresolvedUrls = candidates.reduce((acc: string[], c: { url: string }) => {
        const url = c.url;
        if (resolvedUrls.get(url) === undefined && isNetworkSource(getTrackSource(url))) {
          acc.push(url);
        }
        return acc;
      }, []);
      let urlMap = resolvedUrls;
      if (unresolvedUrls.length > 0) {
        const freshlyResolved = await resolveUrls(unresolvedUrls);
        mergeAndCache(trackerId, tabGidsRef.current[currentTab] || currentTab, data, freshlyResolved);
        urlMap = new Map([...resolvedUrls, ...Object.entries(freshlyResolved)]);
      }
      const downloadItems = candidates
        .map(({ track, era, url }) => ({ track, era, playableUrl: urlMap.get(url) }))
        .filter((item): item is { track: TALeak; era: Era; playableUrl: string } => !!item.playableUrl);
      if (downloadItems.length === 0) {
        toast({ title: "No tracks to download", description: "No playable tracks found" });
        return;
      }
      const eraDisplayName = eraKey ? data.eras[eraKey]?.name : undefined;
      const catDisplayName = catKey && catKey.toLowerCase() !== "default" ? catKey : undefined;
      setDownloadConfirm({
        artistName: artistDisplayName,
        eraName: catDisplayName
          ? eraDisplayName ? `${eraDisplayName} › ${catDisplayName}` : catDisplayName
          : eraDisplayName,
        items: downloadItems,
      });
    },
    [data, resolvedUrls, artistDisplayName, toast, resolveUrls, trackerId, currentTab]
  );
  const computeTrackState = useCallback((track: TALeak) => {
    const url = getTrackUrl(track);
    const source = url ? getTrackSource(url) : "unknown";
    const isSupported = SUPPORTED_SOURCES_SET.has(source);
    const resolvedEntry = url ? resolvedUrls.get(url) : undefined;
    const playableUrl = resolvedEntry || null;
    const isPlayable = !!playableUrl || (isSupported && resolvedEntry === undefined);
    const isCurrentlyPlaying = playerState.currentTrack?.url === url && playerState.isPlaying;
    const isCurrentTrack = playerState.currentTrack?.url === url;
    const isHighlighted = url === highlightedTrackUrl;
    const description = getTrackDescription(track) || undefined;
    const shouldShowSource = source !== "unknown" && source !== "juicewrldapi";
    return { url, source, isSupported, playableUrl, isPlayable, isCurrentlyPlaying, isCurrentTrack, isHighlighted, description, shouldShowSource };
  }, [resolvedUrls, playerState.currentTrack, playerState.isPlaying, highlightedTrackUrl]);
  const confirmDownload = useCallback(() => {
    if (!downloadConfirm) return;
    downloadManager.startDownload(downloadConfirm);
    toast({ title: "Download started", description: `Downloading ${downloadConfirm.items.length} tracks in background` });
    setDownloadConfirm(null);
  }, [downloadConfirm, downloadManager, toast]);
  const qualities = useMemo(() => {
    if (!data?.eras) return [];
    const set = new Set<string>();
    forEachEraTrack(data.eras, (t) => { if (t.quality && !isUrl(t.quality)) set.add(t.quality); });
    return Array.from(set);
  }, [data]);
  const sources = useMemo(() => {
    if (!data?.eras) return [];
    const set = new Set<Track["source"]>();
    forEachEraTrack(data.eras, (t) => { const url = getTrackUrl(t); if (url) set.add(getTrackSource(url)); });
    return Array.from(set).sort();
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
    return { total, playable, favourites: favourites.length };
  }, [data, resolvedUrls, favourites.length]);
  const headerSlots = useHeaderSlots(
    <div className="relative flex-1 min-w-0">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30 pointer-events-none" />
      <Input
        type="text"
        placeholder="Tracker ID..."
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && handleLoad()}
        className="glass-flat rounded-xl w-full pl-9 pr-8 h-10 sm:h-11 text-sm text-white placeholder:text-white/25 border-0 focus-visible:ring-1 focus-visible:ring-white/30"
      />
      {inputValue && (
        <Button
          variant="ghost"
          size="icon"
          className="absolute right-1.5 top-1/2 -translate-y-1/2 h-7 w-7 text-white/30 hover:text-white hover:bg-transparent"
          onClick={() => setInputValue("")}
        >
          <X className="w-3.5 h-3.5" />
        </Button>
      )}
    </div>,
    <div className="flex items-center gap-1 sm:gap-1.5">
      {trackerId && (
        <Button
          variant="ghost"
          size="icon"
          onClick={handleShare}
          className="glass-flat rounded-xl text-white/50 hover:text-white h-9 w-9 sm:h-10 sm:w-10"
        >
          <Share2 className="w-4 h-4" />
        </Button>
      )}
      {trackerId && (
        <Button
          variant="ghost"
          size="icon"
          onClick={() => window.open(getSheetViewUrl(trackerId, settings.behavior.sheetsHtmlview), "_blank", "noopener,noreferrer")}
          className="glass-flat rounded-xl text-white/50 hover:text-white h-9 w-9 sm:h-10 sm:w-10"
          aria-label="Open Google Sheet"
        >
          <FileSpreadsheet className="w-4 h-4" />
        </Button>
      )}
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setLastfmModalOpen(true)}
        aria-label="Last.fm"
        className={`glass-flat rounded-xl h-9 w-9 sm:h-10 sm:w-10 ${lastfm.isAuthenticated ? "text-green-400" : "text-white/50 hover:text-white"}`}
      >
        <Radio className="w-4 h-4" />
      </Button>
      <Button
        onClick={handleLoad}
        className="bg-white text-black hover:bg-white/90 rounded-xl h-9 sm:h-10 px-3 sm:px-4 text-sm font-medium"
      >
        Load
      </Button>
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setSettingsOpen(true)}
        aria-label="Settings"
        className="glass-flat rounded-xl text-white/50 hover:text-white h-9 w-9 sm:h-10 sm:w-10"
      >
        <Settings className="w-4 h-4" />
      </Button>
    </div>
  );
  if (status === "fallback") return <FallbackView sheetsUrl={getGoogleSheetsUrl(trackerId, settings.behavior.sheetsHtmlview)} />;
  return (
    <motion.div
      className="min-h-screen bg-black pb-32 sm:pb-28"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
    >
      {headerSlots}
      {youtubeUrl && <YouTubePlayer url={youtubeUrl} onClose={() => setYoutubeUrl(null)} />}
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
          description={lightboxImage.description}
          onClose={() => setLightboxImage(null)}
        />
      )}
      {downloadConfirm && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <button
            type="button"
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => setDownloadConfirm(null)}
            aria-label="Close download dialog"
            tabIndex={-1}
          />
          <div className="relative z-10 bg-neutral-950 border border-neutral-800 shadow-2xl rounded-2xl w-full max-w-sm animate-in fade-in-0 zoom-in-95 duration-200">
            <div className="p-6">
              <div className="flex items-start gap-3 mb-4">
                <div className="w-9 h-9 rounded-xl bg-neutral-800 flex items-center justify-center flex-shrink-0">
                  <FolderDown className="w-4 h-4 text-neutral-300" />
                </div>
                <div>
                  <h2 className="text-base font-semibold text-white">
                    Download {downloadConfirm.items.length} track{downloadConfirm.items.length !== 1 ? "s" : ""}
                  </h2>
                  <p className="text-sm text-neutral-400 mt-0.5">
                    {downloadConfirm.eraName ?? downloadConfirm.artistName}
                  </p>
                </div>
              </div>
              <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-3.5 mb-5 space-y-2.5">
                <div className="flex gap-2 text-sm text-neutral-300">
                  <AlertTriangle className="w-4 h-4 text-yellow-500 flex-shrink-0 mt-0.5" />
                  <span>
                    Your browser is asking for permission to download multiple files.{" "}
                    <span className="text-white font-medium">Click Allow</span> in the popup before continuing.
                  </span>
                </div>
                <div className="flex gap-2 text-sm text-neutral-400">
                  <Download className="w-4 h-4 text-neutral-500 flex-shrink-0 mt-0.5" />
                  <span>Large downloads are automatically split into 900 MB ZIP files.</span>
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  className="flex-1 border border-neutral-800 text-neutral-400 hover:text-white hover:border-neutral-600"
                  onClick={() => setDownloadConfirm(null)}
                >
                  Cancel
                </Button>
                <Button
                  className="flex-1 bg-white text-black hover:bg-neutral-200"
                  onClick={confirmDownload}
                >
                  Start Download
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
      <main className="max-w-7xl mx-auto px-3 sm:px-6 py-4 sm:py-6">
        {status === "idle" && (
          <div className="text-center py-16 sm:py-24">
            <h2 className="text-lg sm:text-xl font-semibold text-white/60 mb-2">
              Enter a Tracker ID to get started
            </h2>
            <p className="text-sm sm:text-base text-white/30">Tracker IDs are exactly 44 characters long</p>
          </div>
        )}
        {status === "loading" && (
          <motion.div
            className="space-y-4 sm:space-y-5"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3 }}
          >
            <div className="text-center py-4">
              <div className="inline-flex items-center gap-2 text-white/40 text-sm">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Loading tracker data...</span>
              </div>
            </div>
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="glass rounded-2xl p-4 sm:p-5">
                <div className="flex items-center gap-3 sm:gap-4 mb-4">
                  <Skeleton className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl bg-white/[0.08]" />
                  <div className="flex-1">
                    <Skeleton className="h-4 sm:h-5 w-1/3 bg-white/[0.08] mb-2 rounded-lg" />
                    <Skeleton className="h-3 sm:h-4 w-1/4 bg-white/[0.06] rounded-lg" />
                  </div>
                </div>
                <div className="space-y-2 sm:space-y-2.5">
                  {Array.from({ length: 3 }).map((_, j) => (
                    <Skeleton key={j} className="h-13 sm:h-14 bg-white/[0.05] rounded-xl" />
                  ))}
                </div>
              </div>
            ))}
          </motion.div>
        )}
        {status === "error" && (
          <div className="flex items-center justify-center py-12 sm:py-20">
            <div className="glass-elevated rounded-2xl p-6 sm:p-8 text-center max-w-md w-full">
              <h2 className="text-lg sm:text-xl font-bold text-white mb-2">Error Loading Data</h2>
            </div>
          </div>
        )}
        {((status === "success" || status === "tab-loading") && (data || tabError || tabEmpty) || hasLoaded) && (
          <>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
              <div>
                <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">{artistDisplayName}</h1>
                {data?.credits && (
                  <p className="text-xs text-white/30 mt-0.5">
                    by {data.credits}
                    {data.discord && (
                      <a
                        href={data.discord}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center ml-1.5 text-white/30 hover:text-white/60 transition-colors align-middle"
                        title="Discord"
                      >
                        <svg viewBox="0 0 24 24" fill="currentColor" className="w-3 h-3">
                          <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
                        </svg>
                      </a>
                    )}
                  </p>
                )}
                {!data?.credits && data?.discord && (
                  <a
                    href={data.discord}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center text-xs text-white/30 hover:text-white/60 transition-colors mt-0.5"
                    title="Discord"
                  >
                    <svg viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5 mr-1">
                      <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
                    </svg>
                    Discord
                  </a>
                )}
              </div>
              {!isArtTab && stats.playable > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => downloadTracker()}
                  disabled={isPreloading}
                  className="glass-flat rounded-xl text-white/60 hover:text-white self-start sm:self-auto"
                >
                  <FolderDown className="w-3.5 h-3.5 mr-2" />
                  Download All ({stats.playable})
                </Button>
              )}
            </div>
            {displayTabs.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-4 sm:mb-6 pb-3 sm:pb-4 border-b border-white/[0.07]">
                {displayTabs.map((tab) => (
                  <button
                    type="button"
                    key={tab}
                    onClick={() => handleTabChange(tab)}
                    className={`px-3.5 py-1.5 rounded-full text-xs sm:text-sm font-medium transition-all flex-shrink-0 flex items-center gap-1.5 ${
                      currentTab === tab
                        ? "bg-white text-black"
                        : "glass-flat text-white/40 hover:text-white"
                    }`}
                  >
                    {tab === "Favourites" && <Heart className={`w-3 h-3 ${favourites.length > 0 ? "fill-current" : ""}`} />}
                    {tab === "Custom" && <Layers className="w-3 h-3" />}
                    {tab}
                  </button>
                ))}
              </div>
            )}
            {!isArtTab && (
              <div className="flex flex-col gap-3 mb-4 sm:mb-6">
                <div className="relative w-full">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                  <Input
                    type="text"
                    placeholder="Search tracks..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="glass-flat rounded-xl text-white pl-10 h-10 text-sm border-0 focus-visible:ring-1 focus-visible:ring-white/30 placeholder:text-white/25"
                  />
                </div>
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    {isPreloading ? (
                      <div className="flex items-center gap-2 text-xs sm:text-sm text-white/40">
                        <Loader2 className="w-3 sm:w-4 h-3 sm:h-4 animate-spin" />
                        <span>
                          {resolveProgress.current}/{resolveProgress.total}
                        </span>
                      </div>
                    ) : resolvedUrls.size > 0 ? (
                      <span className="text-xs sm:text-sm text-white/30">
                        {stats.playable}/{stats.total} playable
                        {stats.favourites > 0 && <span className="ml-2 text-red-400/70">• {stats.favourites} favourited</span>}
                      </span>
                    ) : null}
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="glass-flat rounded-xl text-white/50 hover:text-white h-9 w-9 sm:h-10 sm:w-10"
                      >
                        <Filter className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent
                      align="end"
                      className="w-64 max-h-96 overflow-y-auto glass-elevated border-0 rounded-2xl text-white/80 p-1"
                    >
                      <DropdownMenuLabel className="text-white/40 text-xs font-medium uppercase tracking-wider px-2 py-1.5">Filters</DropdownMenuLabel>
                      <DropdownMenuSeparator className="bg-white/[0.08] my-1" />
                       <DropdownMenuCheckboxItem
                         checked={filters.showPlayableOnly}
                         onCheckedChange={(c: boolean | undefined) => setFilters((f: FilterOptions) => ({ ...f, showPlayableOnly: !!c }))}
                         className="rounded-xl"
                       >
                        Show playable only
                      </DropdownMenuCheckboxItem>
                      <DropdownMenuSeparator className="bg-white/[0.08] my-1" />
                      <DropdownMenuLabel className="text-white/40 text-xs font-medium uppercase tracking-wider px-2 py-1.5">Quality</DropdownMenuLabel>
                       <DropdownMenuCheckboxItem
                         checked={filters.qualityFilter.length === 0}
                         onCheckedChange={() => setFilters((f: FilterOptions) => ({ ...f, qualityFilter: [] }))}
                         className="rounded-xl"
                       >
                        All qualities
                      </DropdownMenuCheckboxItem>
                      {qualities.map((q) => (
                        <DropdownMenuCheckboxItem
                          key={q}
                          checked={filters.qualityFilter.includes(q)}
                          onCheckedChange={() =>
                            setFilters((f: FilterOptions) => ({
                              ...f,
                              qualityFilter: f.qualityFilter.includes(q)
                                ? f.qualityFilter.filter((x: string) => x !== q)
                                : [...f.qualityFilter, q],
                            }))
                          }
                          className="rounded-xl"
                        >
                          {q}
                        </DropdownMenuCheckboxItem>
                      ))}
                      <DropdownMenuSeparator className="bg-white/[0.08] my-1" />
                      <DropdownMenuLabel className="text-white/40 text-xs font-medium uppercase tracking-wider px-2 py-1.5">Source</DropdownMenuLabel>
                       <DropdownMenuCheckboxItem
                         checked={filters.sourceFilter.length === 0}
                         onCheckedChange={() => setFilters((f: FilterOptions) => ({ ...f, sourceFilter: [] }))}
                         className="rounded-xl"
                       >
                        All sources
                      </DropdownMenuCheckboxItem>
                      {sources.map((s) => (
                        <DropdownMenuCheckboxItem
                          key={s}
                          checked={filters.sourceFilter.includes(s)}
                          onCheckedChange={() =>
                            setFilters((f: FilterOptions) => ({
                              ...f,
                              sourceFilter: f.sourceFilter.includes(s)
                                ? f.sourceFilter.filter((x: Track["source"]) => x !== s)
                                : [...f.sourceFilter, s],
                            }))
                          }
                          className="rounded-xl"
                        >
                           {getSourceDisplayName(s)}
                        </DropdownMenuCheckboxItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            )}
            <AnimatePresence mode="wait">
              {status === "tab-loading" ? (
                <motion.div
                  key="tab-loading"
                  className="flex justify-center py-12 sm:py-20"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.15 }}
                >
                  <Loader2 className="w-6 h-6 animate-spin text-white/40" />
                </motion.div>
              ) : tabError ? (
                <motion.div
                  key="tab-error"
                  className="text-center py-12 sm:py-20 flex flex-col items-center"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.25 }}
                >
                <AlertTriangle className="w-12 h-12 sm:w-14 sm:h-14 text-yellow-400/70 mb-3 sm:mb-4" />
                <h3 className="text-base sm:text-lg font-medium text-white/60">Failed to load this tab</h3>
                <p className="text-sm sm:text-base text-white/30 mt-1">Try selecting another tab</p>
              </motion.div>
            ) : tabEmpty ? (
              <motion.div
                key="tab-empty"
                className="text-center py-12 sm:py-20 flex flex-col items-center"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.25 }}
              >
                <Music2 className="w-12 h-12 sm:w-14 sm:h-14 text-neutral-700 mb-3 sm:mb-4" />
                <h3 className="text-base sm:text-lg font-medium text-white/60">No Tracks in This Tab</h3>
                <p className="text-sm sm:text-base text-white/30 mt-1">This tab doesn't have any tracks yet</p>
              </motion.div>
            ) : isFavouritesTab ? (
              <motion.div
                key="favourites"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.2 }}
              >
                {favourites.length > 0 && (
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-sm text-white/40">{favourites.length} favourite{favourites.length !== 1 ? "s" : ""}</span>
                    <div className="flex items-center gap-2">
                      <Button variant="ghost" size="sm" onClick={() => {
                        if (favouriteTracks.length === 0) return;
                        const candidates = favouriteTracks.map(({ track, era, url }) => ({ track, era, url }));
                        downloadTracker(undefined, undefined, candidates);
                      }} disabled={isPreloading || favouriteTracks.length === 0} className="text-white/30 hover:text-white">
                        <FolderDown className="w-3.5 h-3.5 mr-1.5" />
                        Download
                      </Button>
                      <Button variant="ghost" size="sm" onClick={handleClearFavourites} className="text-white/30 hover:text-red-400">
                        <Trash2 className="w-3.5 h-3.5 mr-1.5" />
                        Clear All
                      </Button>
                    </div>
                  </div>
                )}
                {favouriteTracks.length > 0 ? (
                  <div className="space-y-1.5 sm:space-y-2">
                    {favouriteTracks.map((t, i) => {
                      const { url, source, isPlayable, isCurrentlyPlaying, isCurrentTrack, isHighlighted, description, shouldShowSource, playableUrl } = computeTrackState(t.track);
                      return (
                        <div
                          key={`fav-${i}`}
                          ref={isHighlighted ? highlightedTrackRef : null}
                          className={`rounded-xl transition-all ${isHighlighted ? "bg-yellow-400/15 border border-yellow-400/40 ring-2 ring-yellow-400/20" : isCurrentTrack ? "bg-white/[0.08] border border-white/[0.15]" : "glass-flat"}`}
                        >
                          <div className="flex items-center gap-2 sm:gap-3 p-2.5 sm:p-3">
                            {isPlayable
                              ? isCurrentlyPlaying
                                ? <PauseButton onPlay={() => handlePlayTrack(t.track, t.era)} />
                                : <PlayButton onPlay={() => handlePlayTrack(t.track, t.era)} />
                              : <OpenLinkButton onOpenLink={() => url && handleOpenUrl(url)} />
                            }
                            <div className="flex-1 min-w-0">
                              <div className="font-semibold text-white text-xs sm:text-sm truncate">
                                {t.track.name || "Unknown"}
                              </div>
                              <div className="flex flex-wrap items-center gap-1 sm:gap-2 mt-0.5">
                                {t.era.name && (
                                  <span className="text-[10px] px-1.5 py-0.5 rounded font-medium flex-shrink-0 glass-flat text-white/50">
                                    {t.era.name}
                                  </span>
                                )}
                                {t.track.extra && <span className="text-xs text-neutral-500 truncate">{t.track.extra}</span>}
                              </div>
                            </div>
                            <TrackItemActions track={t.track} source={source} shouldShowSource={shouldShowSource} url={url} onOpenUrl={url ? () => handleOpenUrl(url) : () => {}} isFavourited={true} onToggleFavourite={url ? () => handleToggleFavourite(url) : undefined}>
                              {isPlayable && (
                                <>
                                  <DropdownMenuItem onClick={() => handlePlayTrack(t.track, t.era)} className="cursor-pointer"><Play className="w-4 h-4 mr-2" />Play</DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => handleAddToQueue(t.track, t.era)} className="cursor-pointer"><SkipForward className="w-4 h-4 mr-2" />Play Next</DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => handleAddToQueue(t.track, t.era)} className="cursor-pointer"><ListPlus className="w-4 h-4 mr-2" />Add to Queue</DropdownMenuItem>
                                  <DropdownMenuSeparator className="bg-neutral-800" />
                                  <DropdownMenuItem onClick={() => handleDownload(t.track)} className="cursor-pointer"><Download className="w-4 h-4 mr-2" />Download</DropdownMenuItem>
                                </>
                              )}
                              <DropdownMenuItem onClick={() => handleOpenOriginal(t.track)} className="cursor-pointer"><ExternalLink className="w-4 h-4 mr-2" />Open Original URL</DropdownMenuItem>
                            </TrackItemActions>
                          </div>
                          <TrackDescription description={description} />
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-12 sm:py-20 flex flex-col items-center">
                    <Heart className="w-12 h-12 sm:w-16 sm:h-16 text-neutral-700 mb-3 sm:mb-4" />
                    <h3 className="text-base sm:text-lg font-medium text-neutral-300">No Favourites Yet</h3>
                    <p className="text-sm sm:text-base text-neutral-500 mt-1">
                      Tap the heart icon on any track to add it here
                    </p>
                  </div>
                )}
              </motion.div>
            ) : isCustomTab ? (
              <motion.div
                key="custom-view"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.2 }}
              >
                <CustomViewManager
                  trackerId={trackerId}
                  customViews={customViews}
                  setCustomViews={setCustomViews}
                  activeCustomView={activeCustomView}
                  setActiveCustomView={setActiveCustomView}
                  onSelect={loadCustomView}
                  tabsList={tabsList}
                  tabSlugs={tabSlugsRef.current}
                />
                {activeCustomView && filteredData && Object.keys(filteredData).length > 0 && (
                  <div className="space-y-4 sm:space-y-5 mt-4">
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
                          className="rounded-2xl overflow-hidden border border-white/[0.1]"
                          style={{
                            background: era.backgroundColor
                              ? `color-mix(in srgb, ${era.backgroundColor}, oklch(10% 0 0) 82%)`
                              : "rgba(255,255,255,0.055)",
                            backdropFilter: "blur(8px)",
                            WebkitBackdropFilter: "blur(8px)",
                            boxShadow: "inset 0 1px 0 rgba(255,255,255,0.1), 0 4px 20px rgba(0,0,0,0.3)",
                          }}
                        >
                          <div className="flex items-center">
                            <button
                              type="button"
                              className="flex-1 flex items-center gap-3 sm:gap-4 p-4 sm:p-5 text-left hover:bg-white/[0.03] transition-colors"
                              onClick={() => toggleEra(key)}
                            >
                              {era.image ? (
                                <img
                                  src={era.image}
                                  alt={era.name}
                                  className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl object-contain flex-shrink-0"
                                  style={{
                                    background: era.backgroundColor
                                      ? `color-mix(in srgb, ${era.backgroundColor}, oklch(10% 0 0) 70%)`
                                      : "rgba(255,255,255,0.07)",
                                  }}
                                  referrerPolicy="no-referrer"
                                  crossOrigin="anonymous"
                                />
                              ) : (
                                <div
                                  className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl flex-shrink-0"
                                  style={{
                                    background: era.backgroundColor
                                      ? `color-mix(in srgb, ${era.backgroundColor}, oklch(10% 0 0) 70%)`
                                      : "rgba(255,255,255,0.07)",
                                  }}
                                />
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
                                <p className="text-xs sm:text-sm text-white/40">
                                  {era.extra && <>{era.extra} · </>}
                                  {era.data ? Object.values(era.data).reduce((n, arr) => n + arr.length, 0) : 0} songs
                                  {eraPlayableCount > 0 && <> | {eraPlayableCount} playable</>}
                                </p>
                              </div>
                              <ChevronDown
                                className={`w-4 h-4 text-white/30 transition-transform flex-shrink-0 ${expandedEras.has(key) ? "rotate-180" : ""}`}
                              />
                            </button>
                            {eraPlayableCount > 0 && (
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="text-white/30 hover:text-white hover:bg-white/10 mr-2 h-9 w-9 flex-shrink-0 rounded-xl"
                                  >
                                    <MoreHorizontal className="w-4 h-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent
                                  align="end"
                                  className="w-48 glass-elevated border-0 rounded-2xl text-white/80 p-1"
                                >
                                  <DropdownMenuItem onClick={() => handleToggleEraFavourite(era)} className="cursor-pointer rounded-xl">
                                    <Heart className={`w-4 h-4 mr-2 ${isEraFavourited(trackerId, era) ? "fill-current text-red-400" : ""}`} />
                                    {isEraFavourited(trackerId, era) ? "Unfavourite Era" : "Favourite Era"}
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator className="bg-neutral-800" />
                                  <DropdownMenuItem onClick={() => downloadTracker(key)} className="cursor-pointer rounded-xl">
                                    <FolderDown className="w-4 h-4 mr-2" />
                                    Download Era ({eraPlayableCount})
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            )}
                          </div>
                          <AnimatePresence initial={false}>
                            {expandedEras.has(key) && (
                              <motion.div
                                key={`era-content-${key}`}
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: "auto", opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
                                className="overflow-hidden"
                              >
                                <div className="px-3 pb-3 sm:px-5 sm:pb-5">
                                  {era.description && (
                                    <p className="text-xs sm:text-sm text-white/45 p-3 sm:p-4 bg-black/20 rounded-xl mb-3 sm:mb-5">
                                      {era.description}
                                    </p>
                                  )}
                                  {era.era_dates && era.era_dates.length > 0 && (
                                    <div className="mb-3 px-1">
                                      {era.era_dates.map((ed, i) => (
                                        <p key={i} className="text-[10px] sm:text-xs text-white/40 mb-0.5 last:mb-0">
                                          {ed.date}{ed.event ? ` — ${ed.event}` : ""}
                                        </p>
                                      ))}
                                    </div>
                                  )}
                                  {era.data &&
                                    Object.entries(era.data).map(([cat, tracks]) => (
                                      <div key={cat} className="mb-4 sm:mb-5 last:mb-0">
                                        {cat.toLowerCase() !== "default" && (
                                          <div className="flex items-center justify-between pb-2 sm:pb-3 mb-2 sm:mb-3 border-b border-white/[0.08]">
                                            <h4 className="text-xs sm:text-sm font-semibold text-white/50">{cat}</h4>
                                            {(tracks as TALeak[]).some(t => { const u = getTrackUrl(t); return u ? !!resolvedUrls.get(u) : false; }) && (
                                              <button
                                                type="button"
                                                onClick={() => downloadTracker(key, cat)}
                                                className="text-white/25 hover:text-white transition-colors p-1 -m-1 flex-shrink-0"
                                                title={`Download ${cat}`}
                                              >
                                                <FolderDown className="w-3.5 h-3.5" />
                                              </button>
                                            )}
                                          </div>
                                        )}
                                        <div className="space-y-1.5 sm:space-y-2">
                                          {(tracks as TALeak[]).map((track, i) => {
                                            const trackKey = `custom-${key}-${cat}-${i}`;
                                            const { url, source, isPlayable, isCurrentlyPlaying, isCurrentTrack, isHighlighted, description, shouldShowSource, playableUrl } = computeTrackState(track);
                                            return (
                                              <div
                                                key={trackKey}
                                                ref={isHighlighted ? highlightedTrackRef : null}
                                                className={`rounded-xl transition-all ${isHighlighted ? "bg-yellow-400/15 border border-yellow-400/40 ring-2 ring-yellow-400/20" : isCurrentTrack ? "bg-white/[0.08] border border-white/[0.15]" : "glass-flat"}`}
                                              >
                                                <div className="flex items-center gap-2 sm:gap-3 p-2.5 sm:p-3">
                                                  {isPlayable
                                                    ? isCurrentlyPlaying
                                                      ? <PauseButton onPlay={() => handlePlayTrack(track, era)} />
                                                      : <PlayButton onPlay={() => handlePlayTrack(track, era)} />
                                                    : <OpenLinkButton onOpenLink={() => url && handleOpenUrl(url)} />
                                                  }
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
                                                        {track.art_used && (
                                                          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] sm:text-[10px] font-medium bg-emerald-500/15 text-emerald-400">
                                                            ✓ Used
                                                          </span>
                                                        )}
                                                      </div>
                                                    </div>
                                                  </div>
                                                  <TrackItemActions track={track} source={source} shouldShowSource={shouldShowSource} url={url} onOpenUrl={url ? () => handleOpenUrl(url) : () => {}} isFavourited={url ? favourites.includes(url) : false} onToggleFavourite={url ? () => handleToggleFavourite(url) : undefined}>
                                                    {url && (
                                                      <DropdownMenuItem onClick={() => handleShareTrack(url, track.name || "Track")} className="cursor-pointer">
                                                        <Share className="w-4 h-4 mr-2" />
                                                        Share Track
                                                      </DropdownMenuItem>
                                                    )}
                                                    {isPlayable && (
                                                      <>
                                                        <DropdownMenuItem onClick={() => handlePlayNext(track, era)} className="cursor-pointer">
                                                          <SkipForward className="w-4 h-4 mr-2" />
                                                          Play Next
                                                        </DropdownMenuItem>
                                                        <DropdownMenuItem onClick={() => handleAddToQueue(track, era)} className="cursor-pointer">
                                                          <ListPlus className="w-4 h-4 mr-2" />
                                                          Add to Queue
                                                        </DropdownMenuItem>
                                                        <DropdownMenuSeparator className="bg-neutral-800" />
                                                        <DropdownMenuItem onClick={() => handleDownload(track)} className="cursor-pointer">
                                                          <Download className="w-4 h-4 mr-2" />
                                                          Download
                                                        </DropdownMenuItem>
                                                      </>
                                                    )}
                                                    <DropdownMenuSeparator className="bg-neutral-800" />
                                                    {url && (
                                                      <DropdownMenuItem onClick={() => handleToggleFavourite(url)} className="cursor-pointer">
                                                        <Heart className={`w-4 h-4 mr-2 ${favourites.includes(url) ? "fill-current text-red-400" : ""}`} />
                                                        {favourites.includes(url) ? "Unfavourite" : "Favourite"}
                                                      </DropdownMenuItem>
                                                    )}
                                                    <DropdownMenuItem onClick={() => handleOpenOriginal(track)} className="cursor-pointer">
                                                      <ExternalLink className="w-4 h-4 mr-2" />
                                                      Open Original URL
                                                    </DropdownMenuItem>
                                                  </TrackItemActions>
                                                </div>
                                                <TrackDescription description={description} />
                                              </div>
                                            );
                                          })}
                                        </div>
                                      </div>
                                    ))}
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      );
                    })}
                  </div>
                )}
              </motion.div>
            ) : isArtTab && filteredData ? (
              <motion.div
                key="art"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
              >
                <ArtGallery eras={filteredData} onImageClick={handleArtImageClick} />
              </motion.div>
            ) : isFlat && filteredData ? (
              <motion.div
                key="flat"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
              >
              {flatTracks.length > 200 ? (
                <FlatTrackList
                  tracks={flatTracks}
                  computeTrackState={computeTrackState}
                  handlePlayTrack={handlePlayTrack}
                  handleAddToQueue={handleAddToQueue}
                  handleOpenUrl={handleOpenUrl}
                  handleOpenOriginal={handleOpenOriginal}
                  handleToggleFavourite={handleToggleFavourite}
                  handleDownload={handleDownload}
                  favourites={favourites}
                  highlightedTrackRef={highlightedTrackRef}
                  createTrackObject={createTrackObject}
                  clearQueue={clearQueue}
                  playTrack={playTrack}
                />
              ) : (
                <div className="space-y-1.5 sm:space-y-2">
                  {flatTracks.map((t, i) => {
                    const flatKey = `flat-${i}`;
                    const { url, source, isPlayable, isCurrentlyPlaying, isCurrentTrack, isHighlighted, description, shouldShowSource, playableUrl } = computeTrackState(t);
                    const fakeEra: Era = { name: t.eraName ?? "", backgroundColor: t.eraColor, textColor: t.eraTextColor };
                    return (
                      <div
                        key={flatKey}
                        ref={isHighlighted ? highlightedTrackRef : null}
                        className={`rounded-xl transition-all ${isHighlighted ? "bg-yellow-400/15 border border-yellow-400/40 ring-2 ring-yellow-400/20" : isCurrentTrack ? "bg-white/[0.08] border border-white/[0.15]" : "glass-flat"}`}
                      >
                        <div className="flex items-center gap-2 sm:gap-3 p-2.5 sm:p-3">
                          {isPlayable
                            ? isCurrentlyPlaying
                              ? <PauseButton onPlay={() => handlePlayTrack(t, fakeEra)} />
                              : <PlayButton onPlay={() => handlePlayTrack(t, fakeEra)} />
                            : <OpenLinkButton onOpenLink={() => url && handleOpenUrl(url)} />
                          }
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-semibold text-white text-xs sm:text-sm truncate">{t.name || "Unknown"}</span>
                            </div>
                            <div className="flex flex-wrap items-center gap-1 sm:gap-2 mt-0.5">
                              {t.eraName && (
                                <span
                                  className="text-[10px] px-1.5 py-0.5 rounded font-medium flex-shrink-0"
                                  style={{
                                    background: t.eraColor ? `color-mix(in srgb, ${t.eraColor}, oklch(14.5% 0 0) 70%)` : "rgb(38 38 38)",
                                    color: t.eraTextColor ? `color-mix(in srgb, ${t.eraTextColor}, rgb(255,255,255) 30%)` : "rgb(163 163 163)",
                                  }}
                                >
                                  {t.eraName}
                                </span>
                              )}
                              {t.extra && <span className="text-xs text-neutral-500 truncate">{t.extra}</span>}
                            </div>
                          </div>
                          <TrackItemActions track={t} source={source} shouldShowSource={shouldShowSource} url={url} onOpenUrl={url ? () => handleOpenUrl(url) : () => {}} isFavourited={url ? favourites.includes(url) : false} onToggleFavourite={url ? () => handleToggleFavourite(url) : undefined}>
                              {isPlayable && (
                                <>
                                  <DropdownMenuItem onClick={() => handlePlayTrack(t, fakeEra)} className="cursor-pointer"><Play className="w-4 h-4 mr-2" />Play</DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => { const pt = createTrackObject(t, fakeEra, url!, playableUrl!); clearQueue(); playTrack(pt); }} className="cursor-pointer"><Radio className="w-4 h-4 mr-2" />Play Track Only</DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => handleAddToQueue(t, fakeEra)} className="cursor-pointer"><SkipForward className="w-4 h-4 mr-2" />Play Next</DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => handleAddToQueue(t, fakeEra)} className="cursor-pointer"><ListPlus className="w-4 h-4 mr-2" />Add to Queue</DropdownMenuItem>
                                  <DropdownMenuSeparator className="bg-neutral-800" />
                                  <DropdownMenuItem onClick={() => handleDownload(t)} className="cursor-pointer"><Download className="w-4 h-4 mr-2" />Download</DropdownMenuItem>
                                </>
                              )}
                              <DropdownMenuSeparator className="bg-neutral-800" />
                              {url && (
                                <DropdownMenuItem onClick={() => handleToggleFavourite(url)} className="cursor-pointer">
                                  <Heart className={`w-4 h-4 mr-2 ${favourites.includes(url) ? "fill-current text-red-400" : ""}`} />
                                  {favourites.includes(url) ? "Unfavourite" : "Favourite"}
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuItem onClick={() => handleOpenOriginal(t)} className="cursor-pointer"><ExternalLink className="w-4 h-4 mr-2" />Open Original URL</DropdownMenuItem>
                          </TrackItemActions>
                        </div>
                        <TrackDescription description={description} />
                      </div>
                    );
                  })}
                </div>
              )}
              </motion.div>
            ) : filteredData && Object.keys(filteredData).length > 0 ? (
              <motion.div
                key="era-grouped"
                className="space-y-4 sm:space-y-5"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
              >
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
                      className="rounded-2xl overflow-hidden border border-white/[0.1]"
                      style={{
                        background: era.backgroundColor
                          ? `color-mix(in srgb, ${era.backgroundColor}, oklch(10% 0 0) 82%)`
                          : "rgba(255,255,255,0.055)",
                        backdropFilter: "blur(8px)",
                        WebkitBackdropFilter: "blur(8px)",
                        boxShadow: "inset 0 1px 0 rgba(255,255,255,0.1), 0 4px 20px rgba(0,0,0,0.3)",
                      }}
                    >
                      <div className="flex items-center">
                        <button
                          type="button"
                          className="flex-1 flex items-center gap-3 sm:gap-4 p-4 sm:p-5 text-left hover:bg-white/[0.03] transition-colors"
                          onClick={() => toggleEra(key)}
                        >
                           {era.image ? (
                            <img
                              src={era.image}
                              alt={era.name}
                              className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl object-contain flex-shrink-0"
                              style={{
                                background: era.backgroundColor
                                  ? `color-mix(in srgb, ${era.backgroundColor}, oklch(10% 0 0) 70%)`
                                  : "rgba(255,255,255,0.07)",
                              }}
                              referrerPolicy="no-referrer"
                              crossOrigin="anonymous"
                            />
                          ) : (
                            <div
                              className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl flex-shrink-0"
                              style={{
                                background: era.backgroundColor
                                  ? `color-mix(in srgb, ${era.backgroundColor}, oklch(10% 0 0) 70%)`
                                  : "rgba(255,255,255,0.07)",
                              }}
                            />
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
                            <p className="text-xs sm:text-sm text-white/40">
                              {era.extra && <>{era.extra} · </>}
                              {era.data ? Object.values(era.data).reduce((n, arr) => n + arr.length, 0) : 0} songs
                              {eraPlayableCount > 0 && <> | {eraPlayableCount} playable</>}
                            </p>
                          </div>
                          <ChevronDown
                            className={`w-4 h-4 text-white/30 transition-transform flex-shrink-0 ${expandedEras.has(key) ? "rotate-180" : ""}`}
                          />
                        </button>
                        {eraPlayableCount > 0 && (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="text-white/30 hover:text-white hover:bg-white/10 mr-2 h-9 w-9 flex-shrink-0 rounded-xl"
                              >
                                <MoreHorizontal className="w-4 h-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent
                              align="end"
                              className="w-48 glass-elevated border-0 rounded-2xl text-white/80 p-1"
                            >
                              <DropdownMenuItem onClick={() => handleToggleEraFavourite(era)} className="cursor-pointer rounded-xl">
                                <Heart className={`w-4 h-4 mr-2 ${isEraFavourited(trackerId, era) ? "fill-current text-red-400" : ""}`} />
                                {isEraFavourited(trackerId, era) ? "Unfavourite Era" : "Favourite Era"}
                              </DropdownMenuItem>
                              <DropdownMenuSeparator className="bg-neutral-800" />
                              <DropdownMenuItem onClick={() => downloadTracker(key)} className="cursor-pointer rounded-xl">
                                <FolderDown className="w-4 h-4 mr-2" />
                                Download Era ({eraPlayableCount})
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </div>
                      <AnimatePresence initial={false}>
                        {expandedEras.has(key) && (
                          <motion.div
                            key={`era-content-${key}`}
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
                            className="overflow-hidden"
                          >
                            <div className="px-3 pb-3 sm:px-5 sm:pb-5">
                          {era.description && (
                            <p className="text-xs sm:text-sm text-white/45 p-3 sm:p-4 bg-black/20 rounded-xl mb-3 sm:mb-5">
                              {era.description}
                            </p>
                          )}
                          {era.era_dates && era.era_dates.length > 0 && (
                            <div className="mb-3 px-1">
                              {era.era_dates.map((ed, i) => (
                                <p key={i} className="text-[10px] sm:text-xs text-white/40 mb-0.5 last:mb-0">
                                  {ed.date}{ed.event ? ` — ${ed.event}` : ""}
                                </p>
                              ))}
                            </div>
                          )}
                          {era.data &&
                            Object.entries(era.data).map(([cat, tracks]) => (
                              <div key={cat} className="mb-4 sm:mb-5 last:mb-0">
                                {cat.toLowerCase() !== "default" && (
                                  <div className="flex items-center justify-between pb-2 sm:pb-3 mb-2 sm:mb-3 border-b border-white/[0.08]">
                                    <h4 className="text-xs sm:text-sm font-semibold text-white/50">{cat}</h4>
                                    {(tracks as TALeak[]).some(t => { const u = getTrackUrl(t); return u ? !!resolvedUrls.get(u) : false; }) && (
                                      <button
                                        type="button"
                                        onClick={() => downloadTracker(key, cat)}
                                        className="text-white/25 hover:text-white transition-colors p-1 -m-1 flex-shrink-0"
                                        title={`Download ${cat}`}
                                      >
                                        <FolderDown className="w-3.5 h-3.5" />
                                      </button>
                                    )}
                                  </div>
                                )}
                                <div className="space-y-1.5 sm:space-y-2">
                                  {(tracks as TALeak[]).map((track, i) => {
                                    const trackKey = `${key}-${cat}-${i}`;
                                    const { url, source, isPlayable, isCurrentlyPlaying, isCurrentTrack, isHighlighted, description, shouldShowSource, playableUrl } = computeTrackState(track);
                                    return (
                                      <div
                                        key={trackKey}
                                        ref={isHighlighted ? highlightedTrackRef : null}
                                        className={`rounded-xl transition-all ${isHighlighted ? "bg-yellow-400/15 border border-yellow-400/40 ring-2 ring-yellow-400/20" : isCurrentTrack ? "bg-white/[0.08] border border-white/[0.15]" : "glass-flat"}`}
                                      >
                                        <div className="flex items-center gap-2 sm:gap-3 p-2.5 sm:p-3">
                                          {isPlayable
                                            ? isCurrentlyPlaying
                                              ? <PauseButton onPlay={() => handlePlayTrack(track, era)} />
                                              : <PlayButton onPlay={() => handlePlayTrack(track, era)} />
                                            : <OpenLinkButton onOpenLink={() => url && handleOpenUrl(url)} />
                                          }
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
                                                {track.art_used && (
                                                  <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] sm:text-[10px] font-medium bg-emerald-500/15 text-emerald-400">
                                                    ✓ Used
                                                  </span>
                                                )}
                                              </div>
                                            </div>
                                          </div>
                                          <TrackItemActions track={track} source={source} shouldShowSource={shouldShowSource} url={url} onOpenUrl={url ? () => handleOpenUrl(url) : () => {}} isFavourited={url ? favourites.includes(url) : false} onToggleFavourite={url ? () => handleToggleFavourite(url) : undefined}>
                                              {url && (
                                                <DropdownMenuItem onClick={() => handleShareTrack(url, track.name || "Track")} className="cursor-pointer">
                                                  <Share className="w-4 h-4 mr-2" />
                                                  Share Track
                                                </DropdownMenuItem>
                                              )}
                                              {isPlayable && (
                                                <>
                                                  <DropdownMenuItem onClick={() => handlePlayNext(track, era)} className="cursor-pointer">
                                                    <SkipForward className="w-4 h-4 mr-2" />
                                                    Play Next
                                                  </DropdownMenuItem>
                                                  <DropdownMenuItem onClick={() => handleAddToQueue(track, era)} className="cursor-pointer">
                                                    <ListPlus className="w-4 h-4 mr-2" />
                                                    Add to Queue
                                                  </DropdownMenuItem>
                                                  <DropdownMenuSeparator className="bg-neutral-800" />
                                                  <DropdownMenuItem onClick={() => handleDownload(track)} className="cursor-pointer">
                                                    <Download className="w-4 h-4 mr-2" />
                                                    Download
                                                  </DropdownMenuItem>
                                                </>
                                              )}
                                              <DropdownMenuSeparator className="bg-neutral-800" />
                                              {url && (
                                                <DropdownMenuItem onClick={() => handleToggleFavourite(url)} className="cursor-pointer">
                                                  <Heart className={`w-4 h-4 mr-2 ${favourites.includes(url) ? "fill-current text-red-400" : ""}`} />
                                                  {favourites.includes(url) ? "Unfavourite" : "Favourite"}
                                                </DropdownMenuItem>
                                              )}
                                              <DropdownMenuItem onClick={() => handleOpenOriginal(track)} className="cursor-pointer">
                                                <ExternalLink className="w-4 h-4 mr-2" />
                                                Open Original URL
                                              </DropdownMenuItem>
                                          </TrackItemActions>
                                        </div>
                                        <TrackDescription description={description} />
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            ))}
                          </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  );
                })}
              </motion.div>
            ) : (
              <motion.div
                key="empty"
                className="text-center py-12 sm:py-20 flex flex-col items-center"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.2 }}
              >
                <CircleSlash className="w-12 h-12 sm:w-16 sm:h-16 text-neutral-700 mb-3 sm:mb-4" />
                <h3 className="text-base sm:text-lg font-medium text-neutral-300">No Tracks Found</h3>
                <p className="text-sm sm:text-base text-neutral-500 mt-1">
                  {searchQuery ? `No results for "${searchQuery}"` : "Try adjusting your filters"}
                </p>
              </motion.div>
            )}
            </AnimatePresence>
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
    </motion.div>
  );
}
interface FlatTrackListProps {
  tracks: TALeak[];
  computeTrackState: (t: TALeak) => { url: string | null; source: TrackSource; isPlayable: boolean; isCurrentlyPlaying: boolean; isCurrentTrack: boolean; isHighlighted: boolean; description: string | undefined; shouldShowSource: boolean; playableUrl: string | null };
  handlePlayTrack: (t: TALeak, era: Era) => void;
  handleAddToQueue: (t: TALeak, era: Era) => void;
  handleOpenUrl: (url: string) => void;
  handleOpenOriginal: (t: TALeak) => void;
  handleToggleFavourite: (url: string) => void;
  handleDownload: (t: TALeak) => void;
  favourites: string[];
  highlightedTrackRef: React.RefObject<HTMLDivElement | null>;
  createTrackObject: (t: TALeak, era: Era, url: string, playableUrl: string) => any;
  clearQueue: () => void;
  playTrack: (t: any) => void;
}
function FlatTrackList({ tracks, computeTrackState, handlePlayTrack, handleAddToQueue, handleOpenUrl, handleOpenOriginal, handleToggleFavourite, handleDownload, favourites, highlightedTrackRef, createTrackObject, clearQueue, playTrack }: FlatTrackListProps) {
  const parentRef = useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({
    count: tracks.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 56,
    overscan: 15,
  });
  return (
    <div ref={parentRef} className="h-[calc(100vh-220px)] overflow-auto rounded-xl">
      <div style={{ height: virtualizer.getTotalSize(), width: "100%", position: "relative" }}>
        {virtualizer.getVirtualItems().map((virtualRow) => {
          const t = tracks[virtualRow.index];
          const { url, source, isPlayable, isCurrentlyPlaying, isCurrentTrack, isHighlighted, description, shouldShowSource, playableUrl } = computeTrackState(t);
          const fakeEra: Era = { name: t.eraName ?? "", backgroundColor: t.eraColor, textColor: t.eraTextColor };
          return (
            <div
              key={virtualRow.key}
              ref={(node) => {
                virtualizer.measureElement(node);
                if (isHighlighted) (highlightedTrackRef as any).current = node;
              }}
              data-index={virtualRow.index}
              style={{ position: "absolute", top: 0, left: 0, width: "100%", transform: `translateY(${virtualRow.start}px)` }}
              className={`rounded-xl transition-all ${isHighlighted ? "bg-yellow-400/15 border border-yellow-400/40 ring-2 ring-yellow-400/20" : isCurrentTrack ? "bg-white/[0.08] border border-white/[0.15]" : "glass-flat"}`}
            >
              <div className="flex items-center gap-2 sm:gap-3 p-2.5 sm:p-3">
                {isPlayable
                  ? isCurrentlyPlaying
                    ? <PauseButton onPlay={() => handlePlayTrack(t, fakeEra)} />
                    : <PlayButton onPlay={() => handlePlayTrack(t, fakeEra)} />
                  : <OpenLinkButton onOpenLink={() => url && handleOpenUrl(url)} />
                }
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="font-semibold text-white text-xs sm:text-sm truncate">{t.name || "Unknown"}</span>
                  </div>
                  <div className="flex flex-wrap items-center gap-1 sm:gap-2 mt-0.5">
                    {t.eraName && (
                      <span
                        className="text-[10px] px-1.5 py-0.5 rounded font-medium flex-shrink-0"
                        style={{
                          background: t.eraColor ? `color-mix(in srgb, ${t.eraColor}, oklch(14.5% 0 0) 70%)` : "rgb(38 38 38)",
                          color: t.eraTextColor ? `color-mix(in srgb, ${t.eraTextColor}, rgb(255,255,255) 30%)` : "rgb(163 163 163)",
                        }}
                      >
                        {t.eraName}
                      </span>
                    )}
                    {t.extra && <span className="text-xs text-neutral-500 truncate">{t.extra}</span>}
                  </div>
                </div>
                <TrackItemActions track={t} source={source} shouldShowSource={shouldShowSource} url={url} onOpenUrl={url ? () => handleOpenUrl(url) : () => {}} isFavourited={url ? favourites.includes(url) : false} onToggleFavourite={url ? () => handleToggleFavourite(url) : undefined}>
                    {isPlayable && (
                      <>
                        <DropdownMenuItem onClick={() => handlePlayTrack(t, fakeEra)} className="cursor-pointer"><Play className="w-4 h-4 mr-2" />Play</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => { const pt = createTrackObject(t, fakeEra, url!, playableUrl!); clearQueue(); playTrack(pt); }} className="cursor-pointer"><Radio className="w-4 h-4 mr-2" />Play Track Only</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleAddToQueue(t, fakeEra)} className="cursor-pointer"><SkipForward className="w-4 h-4 mr-2" />Play Next</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleAddToQueue(t, fakeEra)} className="cursor-pointer"><ListPlus className="w-4 h-4 mr-2" />Add to Queue</DropdownMenuItem>
                        <DropdownMenuSeparator className="bg-neutral-800" />
                        <DropdownMenuItem onClick={() => handleDownload(t)} className="cursor-pointer"><Download className="w-4 h-4 mr-2" />Download</DropdownMenuItem>
                      </>
                    )}
                    <DropdownMenuSeparator className="bg-neutral-800" />
                    {url && (
                      <DropdownMenuItem onClick={() => handleToggleFavourite(url)} className="cursor-pointer">
                        <Heart className={`w-4 h-4 mr-2 ${favourites.includes(url) ? "fill-current text-red-400" : ""}`} />
                        {favourites.includes(url) ? "Unfavourite" : "Favourite"}
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuItem onClick={() => handleOpenOriginal(t)} className="cursor-pointer"><ExternalLink className="w-4 h-4 mr-2" />Open Original URL</DropdownMenuItem>
                </TrackItemActions>
              </div>
              <TrackDescription description={description} />
            </div>
          );
        })}
      </div>
    </div>
  );
}
function TrackerViewWithProvider({ trackerId, initialTab }: { trackerId?: string; initialTab?: string } = {}) {
  return (
    <DownloadProvider>
      <TrackerViewContent trackerId={trackerId} initialTab={initialTab} />
    </DownloadProvider>
  );
}
export default function TrackerViewPage({ trackerId, initialTab }: { trackerId?: string; initialTab?: string } = {}) {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-black flex items-center justify-center">
          <div className="w-8 h-8 border-2 border-neutral-700 border-t-white rounded-full animate-spin" />
        </div>
      }
    >
      <TrackerViewWithProvider trackerId={trackerId} initialTab={initialTab} />
    </Suspense>
  );
}