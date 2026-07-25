import { useState, useEffect, useCallback, useMemo, useDeferredValue, useRef, lazy, Suspense } from "react";
import { useNavigate } from "react-router-dom";
import { usePageMeta } from "@/src/hooks/use-page-meta";
import { usePlayer } from "../providers";
import { useToast } from "@/components/ui/use-toast";
import type { Artist, ArtistFilterOptions } from "@/src/types";
import { getCachedData, isCacheExpired, setCachedData } from "@/src/lib/cache";
import {
  extractTrackerId,
  artistsEqual,
  getImageFilename,
  getCleanArtistName,
  hashString,
} from "@/src/lib/artist-utils";
import {
  LOCAL_STORAGE_KEYS,
  ARTISTS_CSV,

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
const LazyAnnouncementModal = lazy(() => import("@/src/components/home/modals").then((m) => ({ default: m.AnnouncementModal })));
const LazyDonationModal = lazy(() => import("@/src/components/home/modals").then((m) => ({ default: m.DonationModal })));
const LazyInfoModal = lazy(() => import("@/src/components/home/modals").then((m) => ({ default: m.InfoModal })));
import { TRIPLE_BOOL_YES } from "@/lib/utils";
import { Dice6 } from "lucide-react";
import { Button } from "@/components/ui/button";
function parseCSVRow(line: string): string[] {
  const fields: string[] = [];
  let cur = "";
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      if (inQ && line[i + 1] === '"') { cur += '"'; i++; }
      else inQ = !inQ;
    } else if (c === ',' && !inQ) {
      fields.push(cur); cur = "";
    } else {
      cur += c;
    }
  }
  fields.push(cur);
  return fields;
}
export default function ArtistGallery() {
  usePageMeta({ title: "ArtistGrid", description: "Discover and track unreleased music from your favorite artists.", url: "https://artistgrid.cx/" });
  const navigate = useNavigate();
  const { state: playerState } = usePlayer();
  const { toast } = useToast();
  const { settings } = useSettings();
  const [allArtists, setAllArtists] = useState<Artist[]>([]);
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [errorMessage, setErrorMessage] = useState("");
  const [visitorCount, setVisitorCount] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState(() => {
    if (settings.behavior.rememberSearch) {
      return localStorage.getItem("artistgrid-search") || "";
    }
    return "";
  });
  const [activeModal, setActiveModal] = useState<null | "info" | "donate" | "announcement">(() => {
    const currentHash = hashString(ANNOUNCEMENT_MESSAGE);
    const storedHash = localStorage.getItem(LOCAL_STORAGE_KEYS.MESSAGE_HASH);
    return storedHash !== currentHash ? "announcement" : null;
  });

  const [filterOptions, setFilterOptions] = useLocalStorage<ArtistFilterOptions>(
    LOCAL_STORAGE_KEYS.FILTER_OPTIONS,
    DEFAULT_FILTER_OPTIONS
  );
  const deferredQuery = useDeferredValue(searchQuery.trim());
  const [fuseModule, setFuseModule] = useState<typeof import("fuse.js").default | null>(null);
  useEffect(() => {
    if (!fuseModule && deferredQuery) {
      let cancelled = false;
      import("fuse.js").then((m) => {
        if (!cancelled) setFuseModule(m.default);
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
  const handleDismissAnnouncement = useCallback(() => {
    setActiveModal(null);
    safeSetItem(LOCAL_STORAGE_KEYS.MESSAGE_HASH, hashString(ANNOUNCEMENT_MESSAGE));
  }, []);
  const handleAnnouncementDonate = useCallback(() => {
    safeSetItem(LOCAL_STORAGE_KEYS.MESSAGE_HASH, hashString(ANNOUNCEMENT_MESSAGE));
    setActiveModal("donate");
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
        const response = await fetch(ARTISTS_CSV, { signal: controller.signal });
        if (!response.ok) throw new Error(`Status ${response.status}`);
        const text = await response.text();
        const rows = text.split("\n");
        const headers = parseCSVRow(rows[0]);
        const nameIdx = headers.indexOf("name");
        const urlIdx = headers.indexOf("url");
        const linksWorkIdx = headers.indexOf("links_work");
        const updatedIdx = headers.indexOf("updated");
        const bestIdx = headers.indexOf("best");
        const parsed: Artist[] = [];
        const nameCount: Record<string, number> = {};
        for (let i = 1; i < rows.length; i++) {
          const row = rows[i].trim();
          if (!row) continue;
          const fields = parseCSVRow(row);
          const name = fields[nameIdx];
          const url = fields[urlIdx];
          if (!name || !url) continue;
          const links_work = Number(fields[linksWorkIdx]);
          const updated = Number(fields[updatedIdx]);
          const best = fields[bestIdx]?.trim() === "true";
          const count = nameCount[name] || 0;
          nameCount[name] = count + 1;
          const newName = count === 0 ? name : `${name} [Alt${count > 1 ? ` #${count}` : ""}]`;
          parsed.push({
            name: newName,
            url,
            imageFilename: getImageFilename(newName),
            isLinkWorking: links_work === TRIPLE_BOOL_YES,
            isUpdated: updated === TRIPLE_BOOL_YES,
            isStarred: best,
          });
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
    const loadVisitorCount = async () => {
      try {
        const res = await fetch("https://121124.edideaur.works/artistgrid.cx/", { signal: controller.signal });
        if (res.ok) setVisitorCount(Number((await res.json()).count));
      } catch {}
    };
    loadData();
    loadVisitorCount();
    return () => controller.abort();
  }, []);

  // Warm the browser cache for the first row of artist images as soon as the
  // directory is known. The LCP element is the first card image; preloading it
  // lets the download overlap with the rest of app boot instead of waiting for
  // React to render the grid.
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
  const sortedArtists = allArtists;
  const handleFilterChange = useCallback(
    (key: keyof ArtistFilterOptions, value: boolean) => {
      trackEvent("Filter Change", { filter: key, enabled: value });
      setFilterOptions((prev) => ({ ...prev, [key]: value }));
    },
    [setFilterOptions]
  );
  const artistsPassingFilters = useMemo(
    () =>
      sortedArtists.filter(
        (artist) =>
          (filterOptions.showWorking ? artist.isLinkWorking : true) &&
          (filterOptions.showUpdated ? artist.isUpdated : true) &&
          (filterOptions.showStarred ? artist.isStarred : true) &&
          (filterOptions.showAlts ? true : !artist.name.toLowerCase().includes("[alt"))
      ),
    [sortedArtists, filterOptions]
  );
  const fuse = useMemo(
    () =>
      fuseModule
        ? new fuseModule(artistsPassingFilters, { keys: ["name"], threshold: 0.35, ignoreLocation: true })
        : null,
    [artistsPassingFilters, fuseModule]
  );
  const filteredArtists = useMemo(() => {
    if (!deferredQuery) return artistsPassingFilters;
    if (!fuse) return artistsPassingFilters;
    return fuse.search(deferredQuery).map((r) => r.item);
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
  const handleSheetClick = useCallback((url: string) => {
    trackEvent("Sheet Click", { url });
    const finalUrl = settings.behavior.sheetsHtmlview ? url.replace(/\/edit$/, "/htmlview") : url;
    window.open(finalUrl, "_blank", "noopener,noreferrer");
  }, [settings.behavior.sheetsHtmlview]);
  useEffect(() => {
    if (status === "success" && !hashProcessed.current && window.location.hash) {
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
        <LazyAnnouncementModal
          isOpen={activeModal === "announcement"}
          onClose={handleDismissAnnouncement}
          message={ANNOUNCEMENT_MESSAGE}
          onDonate={handleAnnouncementDonate}
        />
        <LazyDonationModal key={String(activeModal === "donate")} isOpen={activeModal === "donate"} onClose={closeModal} />
        <LazyInfoModal
          isOpen={activeModal === "info"}
          onClose={closeModal}
          visitorCount={visitorCount}
          onDonate={openDonationModal}
        />
      </Suspense>
      {isFirstLoad ? (
        <main className="max-w-7xl mx-auto p-4 sm:p-6">
          <GallerySkeleton />
        </main>
      ) : status === "error" && !hasCachedData.current ? (
        <ErrorMessage message={errorMessage} />
      ) : (
        <>
          <main className="max-w-7xl mx-auto px-4 sm:px-6 pt-6 sm:pt-8" aria-hidden={!!activeModal}>
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
