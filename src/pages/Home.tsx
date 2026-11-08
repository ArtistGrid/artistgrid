import { useState, useEffect, useCallback, useMemo, useDeferredValue, useRef, lazy, Suspense } from "react";
import { useNavigate } from "react-router-dom";
import { usePageMeta } from "@/src/hooks/use-page-meta";
import { usePlayer } from "../providers";
import type { Artist, ArtistFilterOptions } from "@/src/types";
import { getCachedData, isCacheExpired, setCachedData } from "@/src/lib/cache";
import {
  extractTrackerId,
  artistsEqual,
  getCleanArtistName,
  hashString,
  isAnnouncementDismissed,
  computeDismissalHash,
} from "@/src/lib/artist-utils";
import { fetchArtistsCsv, parseArtistsCsv } from "@/src/lib/artists";
import { DEFAULT_SHARE_IMAGE, HOME_DESCRIPTION, HOME_TITLE, SITE_ORIGIN } from "@/src/lib/seo";
import {
  LOCAL_STORAGE_KEYS,
  HOME_CACHE_EXPIRY,
  DEFAULT_FILTER_OPTIONS,
  ANNOUNCEMENT_MESSAGE,
  CUSTOM_REDIRECTS,
  SUFFIXES_TO_STRIP,
  trackEvent,
  ASSET_BASE,
} from "@/src/lib/home-constants";
import { useLocalStorage } from "@/src/hooks/use-local-storage";
import { safeSetItem } from "@/src/lib/storage";
import { useSettings } from "@/src/hooks/use-settings";
import { GallerySkeleton } from "@/src/components/home/skeletons";
import { ErrorMessage, NoResultsMessage } from "@/src/components/home/messages";
import { ArtistGridDisplay } from "@/src/components/home/artist-card";
import { FilterControls, HeaderActions, HomeHeaderCenter } from "@/src/components/home/header";
import { Footer } from "@/src/components/home/footer";
import { useHeaderSlots } from "@/src/components/layout";
const LazyAnnouncementModal = lazy(() =>
  import("@/src/components/home/modals").then((m) => ({ default: m.AnnouncementModal }))
);
const LazyDonationModal = lazy(() =>
  import("@/src/components/home/modals").then((m) => ({ default: m.DonationModal }))
);
const LazyInfoModal = lazy(() => import("@/src/components/home/modals").then((m) => ({ default: m.InfoModal })));
import { Dice6 } from "lucide-react";
import { Button } from "@/components/ui/button";
interface FuseLike {
  search(query: string): Array<{
    item: Artist;
  }>;
}
type FuseConstructor = new (
  list: Artist[],
  options: {
    keys: string[];
    threshold: number;
    ignoreLocation: boolean;
  }
) => FuseLike;
export default function ArtistGallery() {
  usePageMeta({
    title: HOME_TITLE,
    description: HOME_DESCRIPTION,
    image: DEFAULT_SHARE_IMAGE,
    url: `${SITE_ORIGIN}/`,
    noIndex: false,
  });
  const navigate = useNavigate();
  const { state: playerState } = usePlayer();
  const { settings } = useSettings();
  const [allArtists, setAllArtists] = useState<Artist[]>([]);
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [errorMessage, setErrorMessage] = useState("");
  const [visitorCount, setVisitorCount] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState(() => {
    const qParam = new URLSearchParams(window.location.search).get("q");
    if (qParam) return qParam;
    if (settings.behavior.rememberSearch) {
      return localStorage.getItem("artistgrid-search") || "";
    }
    return "";
  });
  const [activeModal, setActiveModal] = useState<null | "info" | "donate" | "announcement">(() => {
    const legacyHash = hashString(ANNOUNCEMENT_MESSAGE);
    const storedHash = localStorage.getItem(LOCAL_STORAGE_KEYS.MESSAGE_HASH);
    return isAnnouncementDismissed(storedHash, legacyHash) ? null : "announcement";
  });
  const [filterOptions, setFilterOptions] = useLocalStorage<ArtistFilterOptions>(
    LOCAL_STORAGE_KEYS.FILTER_OPTIONS,
    DEFAULT_FILTER_OPTIONS
  );
  const deferredQuery = useDeferredValue(searchQuery.trim());
  const [fuseModule, setFuseModule] = useState<FuseConstructor | null>(null);
  useEffect(() => {
    if (!fuseModule && deferredQuery) {
      let cancelled = false;
      import("fuse.js")
        .then((m) => {
          const cls = (m.default || m) as unknown as FuseConstructor;
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
  const hashProcessed = useRef(false);
  const prevQueryRef = useRef("");
  const hasCachedData = useRef(false);
  useEffect(() => {
    if (settings.behavior.rememberSearch) {
      safeSetItem("artistgrid-search", searchQuery);
    }
  }, [searchQuery, settings.behavior.rememberSearch]);
  const storeDismissalHash = useCallback(() => {
    void computeDismissalHash(ANNOUNCEMENT_MESSAGE)
      .then((h) => safeSetItem(LOCAL_STORAGE_KEYS.MESSAGE_HASH, h))
      .catch(() => {});
  }, []);
  const handleDismissAnnouncement = useCallback(() => {
    setActiveModal(null);
    storeDismissalHash();
  }, [storeDismissalHash]);
  const handleAnnouncementDonate = useCallback(() => {
    storeDismissalHash();
    setActiveModal("donate");
  }, [storeDismissalHash]);
  useEffect(() => {
    const storedHash = localStorage.getItem(LOCAL_STORAGE_KEYS.MESSAGE_HASH);
    if (storedHash && !storedHash.startsWith("v2:") && storedHash === hashString(ANNOUNCEMENT_MESSAGE)) {
      void computeDismissalHash(ANNOUNCEMENT_MESSAGE)
        .then((h) => safeSetItem(LOCAL_STORAGE_KEYS.MESSAGE_HASH, h))
        .catch(() => {});
    }
  }, []);
  useEffect(() => {
    if (deferredQuery && deferredQuery !== prevQueryRef.current) trackEvent("Search", { query: deferredQuery });
    prevQueryRef.current = deferredQuery;
  }, [deferredQuery]);
  useEffect(() => {
    const controller = new AbortController();
    const loadData = async () => {
      const cacheKey = LOCAL_STORAGE_KEYS.CSV_CACHE_LOCAL;
      const cached = getCachedData<Artist[]>(cacheKey);
      if (cached?.data?.length) {
        setAllArtists(cached.data);
        setStatus("success");
        hasCachedData.current = true;
      } else {
        setStatus("loading");
      }
      if (!isCacheExpired(cached, HOME_CACHE_EXPIRY) && cached?.data?.length) return;
      try {
        const text = await fetchArtistsCsv(controller.signal);
        const parsed = parseArtistsCsv(text);
        if (parsed.length === 0 && cached?.data?.length) {
          setStatus("success");
          return;
        }
        if (!cached?.data || !artistsEqual(parsed, cached.data)) {
          setCachedData(cacheKey, parsed);
          setAllArtists(parsed);
        }
        setStatus("success");
      } catch (e) {
        if (e instanceof Error && e.name === "AbortError") return;
        console.warn("Failed to fetch artists CSV:", e);
        if (!hasCachedData.current) {
          setErrorMessage("Could not load artist data.");
          setStatus("error");
        }
      }
    };
    let visitorTimeoutId: ReturnType<typeof setTimeout> | undefined;
    const loadVisitorCount = async () => {
      const timeoutController = new AbortController();
      const onOuterAbort = () => timeoutController.abort();
      controller.signal.addEventListener("abort", onOuterAbort, { once: true });
      visitorTimeoutId = setTimeout(() => timeoutController.abort(), 5000);
      try {
        const cached = sessionStorage.getItem("visitor-count");
        const cachedTime = sessionStorage.getItem("visitor-count-time");
        if (cached && cachedTime && Date.now() - Number(cachedTime) < 300000) {
          setVisitorCount(Number(cached));
          return;
        }
        const res = await fetch("https://121124.edideaur.works/artistgrid.cx/", { signal: timeoutController.signal });
        if (res.ok) {
          const parsed: unknown = await res.json();
          const count = Number(
            (
              parsed as {
                count?: unknown;
              } | null
            )?.count
          );
          if (Number.isFinite(count)) {
            setVisitorCount(count);
            sessionStorage.setItem("visitor-count", String(count));
            sessionStorage.setItem("visitor-count-time", String(Date.now()));
          }
        }
      } catch {
      } finally {
        clearTimeout(visitorTimeoutId);
        controller.signal.removeEventListener("abort", onOuterAbort);
      }
    };
    loadData();
    loadVisitorCount();
    return () => {
      clearTimeout(visitorTimeoutId);
      controller.abort();
    };
  }, []);
  const preloadedRef = useRef(false);
  useEffect(() => {
    if (allArtists.length === 0 || preloadedRef.current) return;
    preloadedRef.current = true;
    const preloadCount = Math.min(allArtists.length, 6);
    for (let i = 0; i < preloadCount; i++) {
      const artist = allArtists[i];
      const href = `${ASSET_BASE}/webp/${artist.imageFilename}`;
      const link = document.createElement("link");
      link.rel = "preload";
      link.as = "image";
      link.href = href;
      link.crossOrigin = "anonymous";
      if (i === 0) link.fetchPriority = "high";
      document.head.appendChild(link);
    }
  }, [allArtists]);
  const handleFilterChange = useCallback(
    (key: keyof ArtistFilterOptions, value: boolean) => {
      trackEvent("Filter Change", { filter: key, enabled: value });
      setFilterOptions((prev) => ({ ...prev, [key]: value }));
    },
    [setFilterOptions]
  );
  const artistsPassingFilters = useMemo(
    () =>
      allArtists.filter(
        (artist) =>
          (filterOptions.showWorking ? artist.isLinkWorking : true) &&
          (filterOptions.showUpdated ? artist.isUpdated : true) &&
          (filterOptions.showStarred ? artist.isStarred : true) &&
          (filterOptions.showAlts ? true : !artist.name.toLowerCase().includes("[alt"))
      ),
    [allArtists, filterOptions]
  );
  const fuse = useMemo(() => {
    if (!fuseModule) return null;
    try {
      return new fuseModule(artistsPassingFilters, { keys: ["name"], threshold: 0.35, ignoreLocation: true });
    } catch (err) {
      console.warn("Failed to instantiate Fuse:", err);
      return null;
    }
  }, [artistsPassingFilters, fuseModule]);
  const filteredArtists = useMemo(() => {
    if (!deferredQuery) return artistsPassingFilters;
    if (fuse) {
      try {
        const results = fuse.search(deferredQuery).map((r) => r.item);
        const matchedSet = new Set(results);
        const q = deferredQuery.toLowerCase();
        for (const artist of artistsPassingFilters) {
          if (!matchedSet.has(artist) && artist.name.toLowerCase().includes(q)) {
            results.push(artist);
          }
        }
        return results;
      } catch (err) {
        console.warn("Fuse search failed, falling back to substring filter:", err);
      }
    }
    const q = deferredQuery.toLowerCase();
    return artistsPassingFilters.filter((artist) => artist.name.toLowerCase().includes(q));
  }, [artistsPassingFilters, fuse, deferredQuery]);
  const handleArtistClick = useCallback(
    (artist: Artist) => {
      const trackerId = extractTrackerId(artist.url);
      trackEvent("Artist Click", { name: artist.name });
      if (trackerId) {
        navigate(`/sh/${trackerId}/?artist=${encodeURIComponent(getCleanArtistName(artist.name))}`);
      } else {
        window.open(artist.url, "_blank", "noopener,noreferrer");
      }
    },
    [navigate]
  );
  const handleSheetClick = useCallback(
    (url: string) => {
      trackEvent("Sheet Click", { url });
      const finalUrl = settings.behavior.sheetsHtmlview ? url.replace(/\/edit$/, "/htmlview") : url;
      window.open(finalUrl, "_blank", "noopener,noreferrer");
    },
    [settings.behavior.sheetsHtmlview]
  );
  useEffect(() => {
    if (status === "success" && !hashProcessed.current && window.location.hash) {
      const hash = window.location.hash.substring(1);
      let processedHash: string;
      try {
        processedHash = decodeURIComponent(hash).toLowerCase();
      } catch {
        processedHash = hash.toLowerCase();
      }
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
        } else processedHash = redirectTarget.toLowerCase();
      }
      const normalizedTarget = processedHash.replace(/[^a-z0-9]/g, "");
      if (normalizedTarget) {
        const targetArtist = allArtists.find(
          (artist) => artist.name.toLowerCase().replace(/[^a-z0-9]/g, "") === normalizedTarget
        );
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
  const handleRandomArtist = useCallback(() => {
    if (filteredArtists.length === 0) return;
    const random = filteredArtists[Math.floor(Math.random() * filteredArtists.length)];
    handleArtistClick(random);
  }, [filteredArtists, handleArtistClick]);
  const isFirstLoad = status === "loading" && !hasCachedData.current;
  const hasPlayerActive = !!playerState.currentTrack;
  const headerSlots = useHeaderSlots(
    <HomeHeaderCenter searchQuery={searchQuery} setSearchQuery={setSearchQuery} />,
    <>
      <Button
        variant="ghost"
        size="icon"
        onClick={handleRandomArtist}
        aria-label="Random artist"
        className="glass-flat rounded-xl text-white/50 hover:text-white h-10 w-10"
      >
        <Dice6 className="w-4 h-4" />
      </Button>
      <FilterControls options={filterOptions} onFilterChange={handleFilterChange} />
      <HeaderActions onInfoClick={openInfoModal} onDonateClick={openDonationModal} />
    </>
  );
  return (
    <div className={`overflow-x-hidden ${hasPlayerActive ? "pb-32" : "pb-8"}`}>
      {headerSlots}
      <Suspense fallback={null}>
        {activeModal === "announcement" && (
          <LazyAnnouncementModal
            isOpen={activeModal === "announcement"}
            onClose={handleDismissAnnouncement}
            message={ANNOUNCEMENT_MESSAGE}
            onDonate={handleAnnouncementDonate}
          />
        )}
        {activeModal === "donate" && (
          <LazyDonationModal
            key={String(activeModal === "donate")}
            isOpen={activeModal === "donate"}
            onClose={closeModal}
          />
        )}
        {activeModal === "info" && (
          <LazyInfoModal
            isOpen={activeModal === "info"}
            onClose={closeModal}
            visitorCount={visitorCount}
            onDonate={openDonationModal}
          />
        )}
      </Suspense>
      <h1 className="sr-only">ArtistGrid</h1>
      {isFirstLoad ? (
        <main className="max-w-7xl mx-auto p-4 sm:p-6">
          <GallerySkeleton />
        </main>
      ) : status === "error" && !hasCachedData.current ? (
        <ErrorMessage message={errorMessage} />
      ) : (
        <>
          <main className="max-w-7xl mx-auto px-4 sm:px-6 pt-4 sm:pt-6" aria-hidden={!!activeModal}>
            {filteredArtists.length > 0 ? (
              <ArtistGridDisplay
                artists={filteredArtists}
                onArtistClick={handleArtistClick}
                onSheetClick={handleSheetClick}
              />
            ) : (
              <NoResultsMessage searchQuery={searchQuery} />
            )}
          </main>
          <Footer
            displayedCount={filteredArtists.length}
            totalCount={allArtists.length}
            onDonateClick={openDonationModal}
            visitorCount={visitorCount}
          />
        </>
      )}
    </div>
  );
}
