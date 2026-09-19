import { useState, useEffect, useCallback, useMemo, Suspense, useRef, useDeferredValue } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useHeaderSlots } from "@/src/components/layout";
import { useSearchParams, useNavigate } from "react-router-dom";
import { usePageMeta } from "@/src/hooks/use-page-meta";
import type { Track, Era, TALeak, TrackerResponse } from "@/src/types";
import { usePlayer } from "../providers";
import { useToast } from "@/components/ui/use-toast";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useEraFonts } from "@/src/hooks/use-era-fonts";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Search,
  X,
  Filter,
  Share2,
  CircleSlash,
  Loader2,
  Radio,
  AlertTriangle,
  FolderDown,
  Settings,
  Heart,
  Music2,
  FileSpreadsheet,
  Layers,
} from "lucide-react";
import { fetchWithFallback, adaptV3Response, adaptV3FlatResponse, type V3Response } from "@/src/lib/api";
import { getCacheAsync, setCache } from "@/src/lib/tracker-cache";
import { resolvePlayableUrl, getTrackSource, isNetworkSource, transformUrlForOpening } from "@/src/lib/resolve-url";
import {
  generateTrackId,
  isUrl,
  getTrackUrl,
  getAllTrackUrls,
  getTrackDescription,
  encodeTrackForUrl,
  decodeTrackFromUrl,
  getGoogleSheetsUrl,
  getSourceDisplayName,
  SUPPORTED_SOURCES,
} from "@/src/lib/track-utils";
import { extractTrackerId, getSheetViewUrl, getCleanArtistName } from "@/src/lib/artist-utils";
import {
  flattenErasForSearch,
  searchTracks,
  FUSE_TRACK_OPTIONS,
  type TrackFuseConstructor,
} from "@/src/lib/track-search";
import { DiscordIcon } from "@/src/components/home/header";
import { DownloadProvider, useDownloadManager } from "@/src/components/download-manager";
import { ChunkErrorBoundary } from "@/src/components/error-boundary";
import { lazy } from "react";
const ArtGallery = lazy(() => import("@/src/components/art-gallery").then((m) => ({ default: m.ArtGallery })));
const ImageLightbox = lazy(() => import("@/src/components/art-gallery").then((m) => ({ default: m.ImageLightbox })));
const LastFMModal = lazy(() => import("@/src/components/lastfm-modal").then((m) => ({ default: m.LastFMModal })));
const YouTubePlayer = lazy(() =>
  import("@/src/components/youtube-player").then((m) => ({ default: m.YouTubePlayer }))
);
const FloatingVideoPlayer = lazy(() =>
  import("@/src/components/floating-video-player").then((m) => ({ default: m.FloatingVideoPlayer }))
);
import { useSettings } from "@/src/hooks/use-settings";
import { useTrackerData } from "@/src/hooks/use-tracker-data";
import { loadSettings } from "@/src/lib/settings";
import { useSettingsModal } from "@/src/components/settings-modal-context";
import {
  getFavourites,
  toggleFavourite,
  clearFavourites,
  getFavouritedTracks,
  toggleEraFavourite,
  isEraFavourited,
  exportAllFavourites,
  importFavourites,
} from "@/src/lib/favourites";
import { getCustomViews, type CustomView } from "@/src/lib/custom-views";
import { mergeTabData } from "@/src/lib/merge-tab-data";
import { syncImageUrl } from "@/src/lib/image-resolve";
import { forEachEraTrack, mergeAndCache, isVideoUrl, formatRelativeTime } from "@/src/lib/view-utils";
import { FallbackView, type FilterOptions, type PlayableTrackData } from "@/src/components/view/track-item";
const CustomViewManager = lazy(() =>
  import("@/src/components/view/custom-view-manager").then((m) => ({ default: m.CustomViewManager }))
);
const DownloadConfirmDialog = lazy(() =>
  import("@/src/components/view/download-confirm-dialog").then((m) => ({ default: m.DownloadConfirmDialog }))
);
const FavouritesTab = lazy(() =>
  import("@/src/components/view/favourites-tab").then((m) => ({ default: m.FavouritesTab }))
);
const FlatTrackList = lazy(() =>
  import("@/src/components/view/flat-track-card").then((m) => ({ default: m.FlatTrackList }))
);
import { EraCard } from "@/src/components/view/era-card";
const ART_TABS = ["Art"];
const SUPPORTED_SOURCES_SET = new Set(SUPPORTED_SOURCES);
function TrackerViewContent({
  trackerId: propTrackerId,
  initialTab: propInitialTab,
}: {
  trackerId?: string;
  initialTab?: string;
} = {}) {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { state: playerState, playTrack, addToQueue, queueNext, clearQueue, togglePlayPause, lastfm } = usePlayer();
  const downloadManager = useDownloadManager();
  const { settings } = useSettings();
  const { setSettingsOpen } = useSettingsModal();
  const [trackerId, setTrackerId] = useState(propTrackerId || searchParams.get("id") || "");
  const [inputValue, setInputValue] = useState(trackerId);
  const [artistNameFromUrl, setArtistNameFromUrl] = useState<string | null>(() => searchParams.get("artist"));
  const [searchQuery, setSearchQuery] = useState("");
  const deferredQuery = useDeferredValue(searchQuery.trim());
  const [fuseModule, setFuseModule] = useState<TrackFuseConstructor | null>(null);
  useEffect(() => {
    if (!fuseModule && deferredQuery) {
      let cancelled = false;
      import("fuse.js")
        .then((m) => {
          const cls = (m.default || m) as unknown as TrackFuseConstructor;
          if (!cancelled && typeof cls === "function") setFuseModule(() => cls);
        })
        .catch((err) => {
          console.warn("Failed to load fuse.js dynamically:", err);
        });
      return () => {
        cancelled = true;
      };
    }
  }, [deferredQuery, fuseModule]);
  const [expandedEras, setExpandedEras] = useState<Set<string>>(new Set());
  const [filters, setFilters] = useState<FilterOptions>({
    showPlayableOnly: false,
    qualityFilter: [],
    sourceFilter: [],
  });
  const trackerData = useTrackerData(setExpandedEras);
  const {
    data,
    setData,
    resolvedUrls,
    setResolvedUrls,
    status,
    setStatus,
    tabsList,
    setTabsList,
    currentTab,
    setCurrentTab,
    tabError,
    setTabError,
    tabEmpty,
    setTabEmpty,
    hasLoaded,
    setHasLoaded,
    credits,
    discord,
    baseEraImages,
    isPreloading,
    resolveProgress,
    tabSlugsRef,
    tabGidsRef,
    hasLoadedRef,
    abortRef,
    resolveUrls,
    fetchBaseEraImages,
    loadTrackerData,
  } = trackerData;
  const [lastfmModalOpen, setLastfmModalOpen] = useState(false);
  const [youtubeUrl, setYoutubeUrl] = useState<string | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
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
    items: Array<{
      track: TALeak;
      era: Era;
      playableUrl: string;
    }>;
  } | null>(null);
  const pendingTrackUrlRef = useRef<string | null>(null);
  const [favourites, setFavourites] = useState<string[]>(() => getFavourites(trackerId));
  const [customViews, setCustomViews] = useState<CustomView[]>(() => getCustomViews(trackerId));
  useEffect(() => {
    setFavourites(getFavourites(trackerId));
    setCustomViews(getCustomViews(trackerId));
    setActiveCustomView(null);
  }, [trackerId]);
  const [activeCustomView, setActiveCustomView] = useState<CustomView | null>(null);
  const isFavouritesTab = currentTab === "Favourites";
  const isCustomTab = currentTab === "Custom";
  const showTrackerContent =
    ((status === "success" || status === "tab-loading") && (data || tabError || tabEmpty)) || hasLoaded;
  const pageTabSlug =
    !isFavouritesTab && !isCustomTab && currentTab ? (tabSlugsRef.current[currentTab] ?? currentTab) : "";
  const pageTabPart = pageTabSlug ? `/${pageTabSlug}` : "";
  const displayTabs = useMemo(() => {
    const tabs = [...tabsList];
    if (!tabs.includes("Favourites")) tabs.push("Favourites");
    if (!tabs.includes("Custom")) tabs.push("Custom");
    return tabs;
  }, [tabsList]);
  const artistDisplayName = useMemo(() => artistNameFromUrl || "Unknown Artist", [artistNameFromUrl]);
  const cleanArtistName = useMemo(
    () => (artistNameFromUrl ? getCleanArtistName(artistNameFromUrl) : ""),
    [artistNameFromUrl]
  );
  usePageMeta({
    title: `ArtistGrid - ${artistNameFromUrl || "Tracker"}`,
    url: `https://artistgrid.cx/sh/${trackerId}${pageTabPart}?artist=${encodeURIComponent(cleanArtistName || "")}`,
  });
  const getEraImage = useCallback(
    (era: Era): string | undefined => {
      const raw = era.image || (era.name && baseEraImages[era.name]) || undefined;
      if (!raw) return undefined;
      return syncImageUrl(raw) || raw;
    },
    [baseEraImages]
  );
  const erasWithImages = useMemo(() => {
    if (!data?.eras) return null;
    const result: Record<string, Era> = {};
    for (const [key, era] of Object.entries(data.eras)) result[key] = { ...era, image: getEraImage(era) };
    return result;
  }, [data?.eras, getEraImage]);
  const eraFontList = useMemo(() => (data?.eras ? Object.values(data.eras).map((e) => e.font) : []), [data?.eras]);
  useEraFonts(eraFontList);
  const isArtTab = ART_TABS.some((t) => currentTab.toLowerCase().includes(t.toLowerCase()));
  const isFlat = !!data?.isFlat;
  const searchableItems = useMemo(() => {
    if (!erasWithImages) return [];
    return flattenErasForSearch(erasWithImages);
  }, [erasWithImages]);
  const fuseInstance = useMemo(() => {
    if (!fuseModule || searchableItems.length === 0) return null;
    try {
      return new fuseModule(searchableItems, FUSE_TRACK_OPTIONS);
    } catch (err) {
      console.warn("Failed to instantiate Fuse for tracks:", err);
      return null;
    }
  }, [fuseModule, searchableItems]);
  const matchingTrackSet = useMemo(() => {
    if (!deferredQuery) return null;
    return searchTracks(searchableItems, deferredQuery, fuseInstance);
  }, [deferredQuery, fuseInstance, searchableItems]);
  const filteredData = useMemo(() => {
    if (!erasWithImages) return null;
    if (isArtTab) return erasWithImages;
    const result: Record<string, Era> = {};
    for (const [key, era] of Object.entries(erasWithImages)) {
      if (!era.data) continue;
      const filteredCategories: Record<string, TALeak[]> = {};
      for (const [cat, tracks] of Object.entries(era.data)) {
        if (!Array.isArray(tracks)) continue;
        const sourceFilterSet = new Set(filters.sourceFilter);
        const filtered = tracks.filter((t) => {
          const allUrls = getAllTrackUrls(t);
          const source = allUrls.length ? getTrackSource(allUrls[0]) : "unknown";
          const isSupported = SUPPORTED_SOURCES_SET.has(source);
          const hasPlayableLink = allUrls.some((u) => resolvedUrls.get(u));
          if (filters.showPlayableOnly && !hasPlayableLink && !isSupported) return false;
          if (
            filters.qualityFilter.length > 0 &&
            !filters.qualityFilter.some((q) => (t.quality?.toLowerCase() || "").includes(q.toLowerCase()))
          )
            return false;
          if (filters.sourceFilter.length > 0 && !sourceFilterSet.has(source)) return false;
          if (matchingTrackSet && !matchingTrackSet.has(t)) return false;
          return true;
        });
        if (filtered.length > 0) filteredCategories[cat] = filtered;
      }
      if (Object.keys(filteredCategories).length > 0) result[key] = { ...era, data: filteredCategories };
    }
    return result;
  }, [erasWithImages, matchingTrackSet, filters, resolvedUrls, isArtTab]);
  const allPlayableTracks = useMemo((): PlayableTrackData[] => {
    if (!filteredData) return [];
    const tracks: PlayableTrackData[] = [];
    for (const era of Object.values(filteredData)) {
      if (!era.data) continue;
      for (const trackList of Object.values(era.data)) {
        if (!Array.isArray(trackList)) continue;
        for (const track of trackList) {
          const allUrls = getAllTrackUrls(track);
          let url: string | null = null;
          let playableUrl: string | null = null;
          for (const u of allUrls) {
            const resolved = resolvedUrls.get(u);
            if (resolved) {
              url = u;
              playableUrl = resolved;
              break;
            }
            if (!url) url = u;
          }
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
        const allUrls = getAllTrackUrls(track);
        let url: string | null = null;
        let playableUrl: string | null = null;
        for (const u of allUrls) {
          const resolved = resolvedUrls.get(u);
          if (resolved) {
            url = u;
            playableUrl = resolved;
            break;
          }
          if (!url) url = u;
        }
        if (!url || !playableUrl) return null;
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
      const id = setTimeout(
        () => highlightedTrackRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }),
        500
      );
      return () => clearTimeout(id);
    }
  }, [highlightedTrackUrl, data]);
  useEffect(() => {
    if (pendingTrackUrlRef.current && data && resolvedUrls.size > 0) {
      const trackUrl = pendingTrackUrlRef.current;
      pendingTrackUrlRef.current = null;
      forEachEraTrack(data.eras, (track, era) => {
        const allUrls = getAllTrackUrls(track);
        const matched = allUrls.find((u) => u === trackUrl);
        if (matched) {
          const playableUrl = resolvedUrls.get(matched);
          if (playableUrl) playTrack(createTrackObject(track, era, matched, playableUrl));
          return false;
        }
      });
    }
  }, [data, resolvedUrls, playTrack, createTrackObject]);
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
  }, [inputValue, navigate, toast, cleanArtistName]);
  const copyToClipboard = useCallback(async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      return false;
    }
  }, []);
  const handleShare = useCallback(async () => {
    const artistQs = cleanArtistName ? `?artist=${encodeURIComponent(cleanArtistName)}` : "";
    const tabSlug =
      !isFavouritesTab && !isCustomTab && currentTab ? (tabSlugsRef.current[currentTab] ?? currentTab) : "";
    const tabPart = tabSlug ? `/${tabSlug}` : "";
    const url = `${window.location.origin}/sh/${trackerId}${tabPart}${artistQs}`;
    if (await copyToClipboard(url)) {
      toast({ title: "Copied!", description: "Share link copied to clipboard" });
    } else {
      toast({ title: "Copy failed", description: "Clipboard is unavailable in this browser" });
    }
  }, [trackerId, currentTab, isFavouritesTab, isCustomTab, toast, cleanArtistName, tabSlugsRef, copyToClipboard]);
  const handleShareTrack = useCallback(
    async (trackUrl: string, trackName: string) => {
      const artistQs = cleanArtistName ? `&artist=${encodeURIComponent(cleanArtistName)}` : "";
      const tabSlug =
        !isFavouritesTab && !isCustomTab && currentTab ? (tabSlugsRef.current[currentTab] ?? currentTab) : "";
      const tabPart = tabSlug ? `/${tabSlug}` : "";
      const encodedTrack = encodeTrackForUrl(trackUrl);
      const shareUrl = `${window.location.origin}/sh/${trackerId}${tabPart}?track=${encodedTrack}${artistQs}`;
      if (await copyToClipboard(shareUrl)) {
        toast({ title: "Track link copied!", description: `Share link for "${trackName}" copied to clipboard` });
      } else {
        toast({ title: "Copy failed", description: "Clipboard is unavailable in this browser" });
      }
    },
    [trackerId, currentTab, isFavouritesTab, isCustomTab, toast, cleanArtistName, tabSlugsRef, copyToClipboard]
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
          if (name.trim().normalize("NFC") === normalized) {
            slug = s;
            break;
          }
        }
      }
      slug = slug ?? tabName;
      setResolvedUrls(new Map());
      setHighlightedTrackUrl(null);
      tabChangeInProgress.current = true;
      navigate(`/sh/${trackerId}/${slug}${artistQs}`, { replace: true });
      loadTrackerData(trackerId, slug, tabName);
    },
    [trackerId, currentTab, loadTrackerData, navigate, cleanArtistName, setCurrentTab, setResolvedUrls, tabSlugsRef]
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
            const cached = await getCacheAsync(trackerId, gid || slug);
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
        if (valid.length > 0 && valid[0].tabSlugs)
          tabSlugsRef.current = { ...tabSlugsRef.current, ...valid[0].tabSlugs };
        if (valid.length > 0 && valid[0].tabGids) tabGidsRef.current = { ...tabGidsRef.current, ...valid[0].tabGids };
      } catch (e) {
        if (controller.signal.aborted) return;
        console.error("[tracker] custom view load failed", e);
        setTabError(true);
        setStatus("success");
      }
    },
    [
      trackerId,
      setActiveCustomView,
      setResolvedUrls,
      setHighlightedTrackUrl,
      setStatus,
      setTabError,
      setTabEmpty,
      fetchBaseEraImages,
      abortRef,
      tabSlugsRef,
      tabGidsRef,
      setData,
      setCurrentTab,
      hasLoadedRef,
      setHasLoaded,
      setTabsList,
    ]
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
    if (getTrackSource(url) === "youtube") {
      setYoutubeUrl(url);
      return;
    }
    const s = loadSettings();
    if (s.behavior.openInNewTab) {
      window.open(transformUrlForOpening(url), "_blank", "noopener,noreferrer");
    } else {
      const w = 600,
        h = 700;
      const left = (screen.width - w) / 2;
      const top = (screen.height - h) / 2;
      window.open(
        transformUrlForOpening(url),
        "_blank",
        `width=${w},height=${h},left=${left},top=${top},noopener,noreferrer`
      );
    }
  }, []);
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
      toast({
        title: added
          ? `Favourited ${count} track${count !== 1 ? "s" : ""}`
          : `Removed ${count} track${count !== 1 ? "s" : ""} from favourites`,
      });
    },
    [trackerId, toast]
  );
  const handleClearFavourites = useCallback(() => {
    clearFavourites(trackerId);
    setFavourites([]);
    toast({ title: "Favourites cleared" });
  }, [trackerId, toast]);
  const importFileRef = useRef<HTMLInputElement>(null);
  const handleExportFavourites = useCallback(() => {
    try {
      const data = exportAllFavourites();
      if (Object.keys(data.trackers).length === 0) {
        toast({ title: "Nothing to export", description: "No favourites saved yet" });
        return;
      }
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `artistgrid-favourites-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(url), 5000);
    } catch {
      toast({ title: "Export failed", description: "Could not create the export file" });
    }
  }, [toast]);
  const handleImportFavourites = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      e.target.value = "";
      if (!file) return;
      try {
        const text = await file.text();
        const parsed: unknown = JSON.parse(text);
        const added = importFavourites(parsed, "merge");
        setFavourites(getFavourites(trackerId));
        toast({
          title: added > 0 ? `Imported ${added} favourite${added !== 1 ? "s" : ""}` : "Nothing new to import",
          description: added === 0 ? "All favourites in the file already exist" : undefined,
        });
      } catch {
        toast({ title: "Import failed", description: "That file doesn't look like a valid favourites export" });
      }
    },
    [trackerId, toast]
  );
  const handlePlayTrack = useCallback(
    async (rawTrack: TALeak, era: Era) => {
      const allUrls = getAllTrackUrls(rawTrack);
      if (allUrls.length === 0) return;
      const playingUrl = allUrls.find((u) => playerState.currentTrack?.url === u);
      if (playingUrl) {
        togglePlayPause();
        return;
      }
      let resolvedUrl: string | null = null;
      let chosenUrl: string | null = null;
      for (const u of allUrls) {
        const result = await resolvePlayableUrl(u);
        if (result) {
          resolvedUrl = result;
          chosenUrl = u;
          break;
        }
      }
      if (!resolvedUrl || !chosenUrl) {
        handleOpenUrl(allUrls[0]);
        return;
      }
      if (isVideoUrl(resolvedUrl)) {
        setVideoUrl(resolvedUrl);
        return;
      }
      const track = createTrackObject(rawTrack, era, chosenUrl, resolvedUrl);
      clearQueue();
      playTrack(track);
      const queueSource = isFavouritesTab ? favouriteTracks : allPlayableTracks;
      const currentIdx = queueSource.findIndex((t) => t.url === chosenUrl);
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
      const allUrls = getAllTrackUrls(rawTrack);
      if (allUrls.length === 0) return;
      let resolvedUrl: string | null = null;
      let chosenUrl: string | null = null;
      for (const u of allUrls) {
        const result = await resolvePlayableUrl(u);
        if (result) {
          resolvedUrl = result;
          chosenUrl = u;
          break;
        }
      }
      if (!resolvedUrl || !chosenUrl) {
        toast({ title: "Cannot queue", description: "Track is not playable" });
        return;
      }
      const track = createTrackObject(rawTrack, era, chosenUrl, resolvedUrl);
      if (mode === "next") queueNext(track);
      else addToQueue(track);
      toast({ title: mode === "next" ? "Playing next" : "Added to queue", description: track.name });
    },
    [addToQueue, queueNext, toast, createTrackObject]
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
      const allUrls = getAllTrackUrls(rawTrack);
      if (allUrls.length === 0) return;
      let playableUrl: string | null = null;
      for (const u of allUrls) {
        const cached = resolvedUrls.get(u);
        if (cached) {
          playableUrl = cached;
          break;
        }
      }
      if (!playableUrl) {
        for (const u of allUrls) {
          const result = await resolvePlayableUrl(u);
          if (result) {
            playableUrl = result;
            break;
          }
        }
      }
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
          if (!res.ok) throw new Error(`Download failed: HTTP ${res.status}`);
          const blob = await res.blob();
          const meta: {
            title?: string;
            artist?: string;
          } = {
            title: rawTrack.name || undefined,
            artist: artistDisplayName || undefined,
          };
          const enhanced = await embedMetadata(blob, meta);
          const blobUrl = URL.createObjectURL(enhanced);
          const link = document.createElement("a");
          link.href = blobUrl;
          link.download = filename;
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
    async (
      eraKey?: string,
      catKey?: string,
      prebuiltCandidates?: Array<{
        track: TALeak;
        era: Era;
        url: string;
      }>
    ) => {
      if (!data?.eras) return;
      const candidates =
        prebuiltCandidates ??
        (() => {
          const c: Array<{
            track: TALeak;
            era: Era;
            url: string;
          }> = [];
          if (eraKey && catKey) {
            const era = data.eras[eraKey];
            const catTracks = era?.data?.[catKey];
            if (Array.isArray(catTracks)) {
              for (const track of catTracks) {
                const allUrls = getAllTrackUrls(track);
                if (allUrls.length > 0) c.push({ track, era, url: allUrls[0] });
              }
            }
          } else {
            const erasToDownload = eraKey
              ? { [eraKey]: (filteredData ?? data.eras)[eraKey] ?? data.eras[eraKey] }
              : (filteredData ?? data.eras);
            forEachEraTrack(erasToDownload, (track, era) => {
              const allUrls = getAllTrackUrls(track);
              if (allUrls.length > 0) c.push({ track, era, url: allUrls[0] });
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
        setTimeout(() => {
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
        }, 500);
      };
      fireProbe();
      setTimeout(fireProbe, 100);
      const unresolvedUrls = candidates.reduce(
        (
          acc: string[],
          c: {
            track: TALeak;
            url: string;
          }
        ) => {
          for (const u of getAllTrackUrls(c.track)) {
            if (resolvedUrls.get(u) === undefined && isNetworkSource(getTrackSource(u)) && !acc.includes(u)) {
              acc.push(u);
            }
          }
          return acc;
        },
        []
      );
      let urlMap = resolvedUrls;
      if (unresolvedUrls.length > 0) {
        const freshlyResolved = await resolveUrls(unresolvedUrls);
        mergeAndCache(trackerId, tabGidsRef.current[currentTab] || currentTab, data, freshlyResolved);
        urlMap = new Map([...resolvedUrls, ...Object.entries(freshlyResolved)]);
      }
      const downloadItems = candidates
        .map(({ track, era }) => {
          for (const u of getAllTrackUrls(track)) {
            const playableUrl = urlMap.get(u);
            if (playableUrl) return { track, era, playableUrl };
          }
          return null;
        })
        .filter(
          (
            item
          ): item is {
            track: TALeak;
            era: Era;
            playableUrl: string;
          } => !!item && !!item.playableUrl
        );
      if (downloadItems.length === 0) {
        toast({ title: "No tracks to download", description: "No playable tracks found" });
        return;
      }
      const eraDisplayName = eraKey ? data.eras[eraKey]?.name : undefined;
      const catDisplayName = catKey && catKey.toLowerCase() !== "default" ? catKey : undefined;
      setDownloadConfirm({
        artistName: artistDisplayName,
        eraName: catDisplayName
          ? eraDisplayName
            ? `${eraDisplayName} › ${catDisplayName}`
            : catDisplayName
          : eraDisplayName,
        items: downloadItems,
      });
    },
    [data, filteredData, resolvedUrls, artistDisplayName, toast, resolveUrls, trackerId, currentTab, tabGidsRef]
  );
  const computeTrackState = useCallback(
    (track: TALeak) => {
      const allUrls = getAllTrackUrls(track);
      let url: string | null = null;
      let playableUrl: string | null = null;
      for (const u of allUrls) {
        const resolved = resolvedUrls.get(u);
        if (resolved) {
          url = u;
          playableUrl = resolved;
          break;
        }
        if (!url && SUPPORTED_SOURCES_SET.has(getTrackSource(u))) url = u;
      }
      if (!url) url = allUrls[0] || null;
      if (!playableUrl && url) playableUrl = resolvedUrls.get(url) || null;
      const source = url ? getTrackSource(url) : "unknown";
      const isSupported = SUPPORTED_SOURCES_SET.has(source);
      const isPlayable =
        !!playableUrl ||
        allUrls.some((u) => {
          const r = resolvedUrls.get(u);
          return !!r || (r === undefined && SUPPORTED_SOURCES_SET.has(getTrackSource(u)));
        });
      const isCurrentlyPlaying = url ? playerState.currentTrack?.url === url && playerState.isPlaying : false;
      const isCurrentTrack = url ? playerState.currentTrack?.url === url : false;
      const isHighlighted = url === highlightedTrackUrl;
      const description = getTrackDescription(track) || undefined;
      const shouldShowSource = source !== "unknown" && source !== "juicewrldapi";
      return {
        url,
        source,
        isSupported,
        playableUrl,
        isPlayable,
        isCurrentlyPlaying,
        isCurrentTrack,
        isHighlighted,
        description,
        shouldShowSource,
      };
    },
    [resolvedUrls, playerState.currentTrack, playerState.isPlaying, highlightedTrackUrl]
  );
  const confirmDownload = useCallback(() => {
    if (!downloadConfirm) return;
    downloadManager.startDownload(downloadConfirm);
    toast({
      title: "Download started",
      description: `Downloading ${downloadConfirm.items.length} tracks in background`,
    });
    setDownloadConfirm(null);
  }, [downloadConfirm, downloadManager, toast]);
  const qualities = useMemo(() => {
    if (!data?.eras) return [];
    const set = new Set<string>();
    forEachEraTrack(data.eras, (t) => {
      if (t.quality && !isUrl(t.quality)) set.add(t.quality);
    });
    return Array.from(set);
  }, [data]);
  const sources = useMemo(() => {
    if (!data?.eras) return [];
    const set = new Set<Track["source"]>();
    forEachEraTrack(data.eras, (t) => {
      for (const u of getAllTrackUrls(t)) set.add(getTrackSource(u));
    });
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
              const allUrls = getAllTrackUrls(t);
              if (
                allUrls.some((u) => {
                  const r = resolvedUrls.get(u);
                  return !!r || (r === undefined && SUPPORTED_SOURCES_SET.has(getTrackSource(u)));
                })
              )
                playable++;
            }
          }
        }
      }
    }
    return { total, playable, favourites: favourites.length };
  }, [data, resolvedUrls, favourites.length]);
  const headerSlots = useHeaderSlots(
    <div className="relative flex-1 min-w-0">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/55 pointer-events-none" />
      <Input
        type="text"
        placeholder="Tracker ID..."
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && handleLoad()}
        className="glass-flat rounded-xl w-full pl-9 pr-8 h-10 sm:h-11 text-sm text-white placeholder:text-white/50 border-0 focus-visible:ring-1 focus-visible:ring-white/30"
      />
      {inputValue && (
        <Button
          variant="ghost"
          size="icon"
          className="absolute right-1.5 top-1/2 -translate-y-1/2 h-7 w-7 text-white/55 hover:text-white hover:bg-transparent"
          onClick={() => setInputValue("")}
          aria-label="Clear input"
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
          aria-label="Share tracker"
        >
          <Share2 className="w-4 h-4" />
        </Button>
      )}
      {trackerId && (
        <Button
          variant="ghost"
          size="icon"
          onClick={() =>
            window.open(getSheetViewUrl(trackerId, settings.behavior.sheetsHtmlview), "_blank", "noopener,noreferrer")
          }
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
  if (status === "fallback")
    return <FallbackView sheetsUrl={getGoogleSheetsUrl(trackerId, settings.behavior.sheetsHtmlview)} />;
  const renderEraCards = (data: Record<string, Era>) =>
    Object.entries(data).map(([key, era]) => (
      <ChunkErrorBoundary
        key={key}
        fallback={<div className="glass rounded-2xl p-4 text-sm text-white/50">This era failed to render.</div>}
      >
        <EraCard
          eraKey={key}
          era={era}
          resolvedUrls={resolvedUrls}
          trackerId={trackerId}
          expandedEras={expandedEras}
          toggleEra={toggleEra}
          computeTrackState={computeTrackState}
          handlePlayTrack={handlePlayTrack}
          handleOpenUrl={handleOpenUrl}
          handleShareTrack={handleShareTrack}
          handlePlayNext={handlePlayNext}
          handleAddToQueue={handleAddToQueue}
          handleDownload={handleDownload}
          handleToggleFavourite={handleToggleFavourite}
          handleOpenOriginal={handleOpenOriginal}
          handleToggleEraFavourite={handleToggleEraFavourite}
          isEraFavourited={isEraFavourited}
          downloadTracker={downloadTracker}
          favourites={favourites}
          highlightedTrackRef={highlightedTrackRef}
        />
      </ChunkErrorBoundary>
    ));
  return (
    <motion.div
      className="min-h-screen bg-black pb-32 sm:pb-28"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
    >
      {headerSlots}
      {youtubeUrl && (
        <Suspense fallback={null}>
          <YouTubePlayer url={youtubeUrl} onClose={() => setYoutubeUrl(null)} />
        </Suspense>
      )}
      {videoUrl && (
        <Suspense fallback={null}>
          <FloatingVideoPlayer url={videoUrl} onClose={() => setVideoUrl(null)} />
        </Suspense>
      )}
      <Suspense fallback={null}>
        {lastfmModalOpen && (
          <LastFMModal
            isOpen={lastfmModalOpen}
            onClose={() => setLastfmModalOpen(false)}
            lastfm={lastfm}
            token={lastfmToken}
            setToken={setLastfmToken}
          />
        )}
        {lightboxImage && (
          <ImageLightbox
            src={lightboxImage.src}
            alt={lightboxImage.alt}
            originalUrl={lightboxImage.originalUrl}
            description={lightboxImage.description}
            onClose={() => setLightboxImage(null)}
          />
        )}
      </Suspense>
      {downloadConfirm && (
        <Suspense fallback={null}>
          <DownloadConfirmDialog
            trackCount={downloadConfirm.items.length}
            subtitle={downloadConfirm.eraName ?? downloadConfirm.artistName}
            onCancel={() => setDownloadConfirm(null)}
            onConfirm={confirmDownload}
          />
        </Suspense>
      )}
      <main className="max-w-7xl mx-auto px-3 sm:px-6 py-4 sm:py-6">
        {status === "idle" && (
          <div className="text-center py-16 sm:py-24">
            <h2 className="text-lg sm:text-xl font-semibold text-white/60 mb-2">Enter a Tracker ID to get started</h2>
            <p className="text-sm sm:text-base text-white/55">Tracker IDs are exactly 44 characters long</p>
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
              <div className="inline-flex items-center gap-2 text-white/55 text-sm">
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
        {showTrackerContent && (
          <>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
              <div>
                <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">{artistDisplayName}</h1>
                {credits && (
                  <p className="text-xs text-white/55 mt-0.5">
                    by {credits}
                    {discord && (
                      <a
                        href={discord}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label="Discord"
                        className="inline-flex items-center ml-1.5 text-white/55 hover:text-white/60 transition-colors align-middle"
                        title="Discord"
                      >
                        <DiscordIcon className="w-3 h-3" />
                      </a>
                    )}
                  </p>
                )}
                {!credits && discord && (
                  <a
                    href={discord}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="Discord"
                    className="inline-flex items-center text-xs text-white/55 hover:text-white/60 transition-colors mt-0.5"
                    title="Discord"
                  >
                    <DiscordIcon className="w-3.5 h-3.5 mr-1" />
                    Discord
                  </a>
                )}
                {data?.lastUpdated && (
                  <p className="text-xs text-white/50 mt-0.5">Last updated {formatRelativeTime(data.lastUpdated)}</p>
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
                    className={`px-3.5 py-1.5 rounded-full text-xs sm:text-sm font-medium transition-colors flex-shrink-0 flex items-center gap-1.5 ${currentTab === tab ? "bg-white text-black" : "glass-flat text-white/55 hover:text-white"}`}
                  >
                    {tab === "Favourites" && (
                      <Heart className={`w-3 h-3 ${favourites.length > 0 ? "fill-current" : ""}`} />
                    )}
                    {tab === "Custom" && <Layers className="w-3 h-3" />}
                    {tab}
                  </button>
                ))}
              </div>
            )}
            {!isArtTab && (
              <div className="flex flex-col gap-3 mb-4 sm:mb-6">
                <div className="relative w-full">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/55" />
                  <Input
                    type="text"
                    placeholder="Search tracks..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="glass-flat rounded-xl text-white pl-10 pr-10 h-10 text-sm border-0 focus-visible:ring-1 focus-visible:ring-white/30 placeholder:text-white/50"
                    data-global-search="1"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery("")}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-white/50 hover:text-white transition-colors"
                      aria-label="Clear search"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    {isPreloading ? (
                      <div className="flex items-center gap-2 text-xs sm:text-sm text-white/55">
                        <Loader2 className="w-3 sm:w-4 h-3 sm:h-4 animate-spin" />
                        <span>
                          {resolveProgress.current}/{resolveProgress.total}
                        </span>
                      </div>
                    ) : resolvedUrls.size > 0 ? (
                      <span className="text-xs sm:text-sm text-white/55">
                        {stats.playable}/{stats.total} playable
                        {stats.favourites > 0 && (
                          <span className="ml-2 text-red-400/70">• {stats.favourites} favourited</span>
                        )}
                      </span>
                    ) : null}
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="glass-flat rounded-xl text-white/50 hover:text-white h-9 w-9 sm:h-10 sm:w-10"
                        aria-label="Filter tracks"
                      >
                        <Filter className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent
                      align="end"
                      className="w-64 max-h-96 overflow-y-auto glass-elevated border-0 rounded-2xl text-white/80 p-1"
                    >
                      <DropdownMenuLabel className="text-white/55 text-xs font-medium uppercase tracking-wider px-2 py-1.5">
                        Filters
                      </DropdownMenuLabel>
                      <DropdownMenuSeparator className="bg-white/[0.08] my-1" />
                      <DropdownMenuCheckboxItem
                        checked={filters.showPlayableOnly}
                        onCheckedChange={(c: boolean | undefined) =>
                          setFilters((f: FilterOptions) => ({ ...f, showPlayableOnly: !!c }))
                        }
                        className="rounded-xl"
                      >
                        Show playable only
                      </DropdownMenuCheckboxItem>
                      <DropdownMenuSeparator className="bg-white/[0.08] my-1" />
                      <DropdownMenuLabel className="text-white/55 text-xs font-medium uppercase tracking-wider px-2 py-1.5">
                        Quality
                      </DropdownMenuLabel>
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
                      <DropdownMenuLabel className="text-white/55 text-xs font-medium uppercase tracking-wider px-2 py-1.5">
                        Source
                      </DropdownMenuLabel>
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
          </>
        )}
        <AnimatePresence mode="wait">
          {showTrackerContent ? (
            status === "tab-loading" ? (
              <motion.div
                key="tab-loading"
                className="flex justify-center py-12 sm:py-20"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
              >
                <Loader2 className="w-6 h-6 animate-spin text-white/55" />
              </motion.div>
            ) : isFavouritesTab ? (
              <Suspense fallback={null}>
                <FavouritesTab
                  favourites={favourites}
                  favouriteTracks={favouriteTracks}
                  isPreloading={isPreloading}
                  computeTrackState={computeTrackState}
                  handlePlayTrack={handlePlayTrack}
                  handleOpenUrl={handleOpenUrl}
                  handlePlayNext={handlePlayNext}
                  handleAddToQueue={handleAddToQueue}
                  handleDownload={handleDownload}
                  handleToggleFavourite={handleToggleFavourite}
                  handleOpenOriginal={handleOpenOriginal}
                  onDownloadAll={() => {
                    if (favouriteTracks.length === 0) return;
                    downloadTracker(
                      undefined,
                      undefined,
                      favouriteTracks.map(({ track, era, url }) => ({ track, era, url }))
                    );
                  }}
                  onExport={handleExportFavourites}
                  importFileRef={importFileRef}
                  onImportClick={() => importFileRef.current?.click()}
                  onImportFile={handleImportFavourites}
                  onClearAll={handleClearFavourites}
                  highlightedTrackRef={highlightedTrackRef}
                />
              </Suspense>
            ) : isCustomTab ? (
              <motion.div
                key="custom-view"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.2 }}
              >
                <Suspense fallback={null}>
                  <CustomViewManager
                    trackerId={trackerId}
                    customViews={customViews}
                    setCustomViews={setCustomViews}
                    activeCustomView={activeCustomView}
                    setActiveCustomView={setActiveCustomView}
                    onSelect={loadCustomView}
                    tabSlugs={tabSlugsRef.current}
                  />
                </Suspense>
                {activeCustomView && filteredData && Object.keys(filteredData).length > 0 && (
                  <div className="space-y-4 sm:space-y-5 mt-4">{renderEraCards(filteredData)}</div>
                )}
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
                <p className="text-sm sm:text-base text-white/55 mt-1">Try selecting another tab</p>
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
                <p className="text-sm sm:text-base text-neutral-500 mt-1">This tab doesn&apos;t have any tracks yet</p>
              </motion.div>
            ) : isArtTab && filteredData ? (
              <motion.div
                key="art"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
              >
                <Suspense fallback={null}>
                  <ArtGallery eras={filteredData} onImageClick={handleArtImageClick} />
                </Suspense>
              </motion.div>
            ) : isFlat && filteredData ? (
              <motion.div
                key="flat"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
              >
                <Suspense fallback={null}>
                  <FlatTrackList
                    tracks={flatTracks}
                    computeTrackState={computeTrackState}
                    handlePlayTrack={handlePlayTrack}
                    handleAddToQueue={handleAddToQueue}
                    handlePlayNext={handlePlayNext}
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
                </Suspense>
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
                {renderEraCards(filteredData)}
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
            )
          ) : null}
        </AnimatePresence>
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
function TrackerViewWithProvider({
  trackerId,
  initialTab,
}: {
  trackerId?: string;
  initialTab?: string;
} = {}) {
  return (
    <DownloadProvider>
      <TrackerViewContent trackerId={trackerId} initialTab={initialTab} />
    </DownloadProvider>
  );
}
export default function TrackerViewPage({
  trackerId,
  initialTab,
}: {
  trackerId?: string;
  initialTab?: string;
} = {}) {
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
