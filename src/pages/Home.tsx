import { useState, useEffect, useCallback, useMemo, useDeferredValue, useRef } from "react";
import { useNavigate } from "react-router-dom";
import Fuse from "fuse.js";
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
  TRENDS_API,
  HOME_CACHE_EXPIRY,
  DEFAULT_FILTER_OPTIONS,
  ANNOUNCEMENT_MESSAGE,
  CUSTOM_REDIRECTS,
  SUFFIXES_TO_STRIP,
  trackEvent,
} from "@/src/lib/home-constants";
import { useLocalStorage } from "@/src/hooks/use-local-storage";
import { GallerySkeleton, HeaderSkeleton, ErrorMessage, NoResultsMessage } from "@/src/components/home/skeletons";
import { ArtistGridDisplay } from "@/src/components/home/artist-card";
import { Header } from "@/src/components/home/header";
import { Footer } from "@/src/components/home/footer";
import { AnnouncementModal, DonationModal, InfoModal } from "@/src/components/home/modals";
import { TripleBool } from "@/lib/utils";
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
  const navigate = useNavigate();
  const { state: playerState } = usePlayer();
  const { toast } = useToast();
  const [allArtists, setAllArtists] = useState<Artist[]>([]);
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [errorMessage, setErrorMessage] = useState("");
  const [visitorCount, setVisitorCount] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeModal, setActiveModal] = useState<null | "info" | "donate" | "announcement">(() => {
    const currentHash = hashString(ANNOUNCEMENT_MESSAGE);
    const storedHash = localStorage.getItem(LOCAL_STORAGE_KEYS.MESSAGE_HASH);
    return storedHash !== currentHash ? "announcement" : null;
  });
  const [trendsData, setTrendsData] = useState<Map<string, number>>(new Map());
  const [trendsLoaded, setTrendsLoaded] = useState(false);
  const [filterOptions, setFilterOptions] = useLocalStorage<ArtistFilterOptions>(
    LOCAL_STORAGE_KEYS.FILTER_OPTIONS,
    DEFAULT_FILTER_OPTIONS
  );
  const [useSheet, setUseSheet] = useLocalStorage<boolean>(LOCAL_STORAGE_KEYS.USE_SHEET, false);
  const deferredQuery = useDeferredValue(searchQuery.trim());
  const hashProcessed = useRef(false);
  const prevQueryRef = useRef("");
  const hasCachedData = useRef(false);
  const handleDismissAnnouncement = useCallback(() => {
    setActiveModal(null);
    localStorage.setItem(LOCAL_STORAGE_KEYS.MESSAGE_HASH, hashString(ANNOUNCEMENT_MESSAGE));
  }, []);
  useEffect(() => {
    if (deferredQuery && deferredQuery !== prevQueryRef.current) trackEvent("Search", { query: deferredQuery });
    prevQueryRef.current = deferredQuery;
  }, [deferredQuery]);
  useEffect(() => {
    const controller = new AbortController();
    const loadTrends = async () => {
      const cacheKey = LOCAL_STORAGE_KEYS.TRENDS_CACHE;
      const cached = getCachedData<{
        results: {
          name: string;
          visitors: number;
        }[];
      }>(cacheKey);
      if (cached?.data) {
        const map = new Map<string, number>();
        cached.data.results?.forEach((item) => map.set(item.name, item.visitors || 0));
        setTrendsData(map);
        setTrendsLoaded(true);
      }
      if (isCacheExpired(cached, HOME_CACHE_EXPIRY)) {
        try {
          const response = await fetch(TRENDS_API, { signal: controller.signal, cache: "no-store" });
          if (response.ok) {
            const data = await response.json();
            setCachedData(cacheKey, data);
            const map = new Map<string, number>();
            data.results?.forEach((item: { name: string; visitors: number }) => map.set(item.name, item.visitors || 0));
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
    return artists.toSorted((a, b) => {
      const aV = trends.get(a.name) || 0;
      const bV = trends.get(b.name) || 0;
      const getGroup = (artist: Artist, v: number) => {
        if (artist.isStarred && v > 0) return 1;
        if (artist.isStarred) return 2;
        if (v > 0) return 3;
        return 4;
      };
      const aG = getGroup(a, aV),
        bG = getGroup(b, bV);
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
      if (cached?.data?.length) {
        setAllArtists(cached.data);
        setStatus("success");
        hasCachedData.current = true;
      } else {
        setStatus("loading");
      }
      if (!isCacheExpired(cached, HOME_CACHE_EXPIRY) && cached?.data?.length) return;
      try {
        const response = await fetch(ARTISTS_CSV, { signal: controller.signal, cache: "no-store" });
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
            isLinkWorking: links_work === TripleBool.YES,
            isUpdated: updated === TripleBool.YES,
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
        const res = await fetch("https://121124.prigoana.com/artistgrid.cx/", { signal: controller.signal });
        if (res.ok) setVisitorCount(Number((await res.json()).count));
      } catch {}
    };
    loadData();
    loadVisitorCount();
    return () => controller.abort();
  }, [useSheet, toast]);
  useEffect(() => {
    hasCachedData.current = false;
  }, [useSheet]);
  const sortedArtists = useMemo(() => {
    if (!filterOptions.sortByTrends || !trendsLoaded || allArtists.length === 0) return allArtists;
    return sortArtistsByTrends(allArtists, trendsData);
  }, [allArtists, filterOptions.sortByTrends, trendsLoaded, trendsData, sortArtistsByTrends]);
  const handleFilterChange = useCallback(
    (key: keyof ArtistFilterOptions, value: boolean) => {
      trackEvent("Filter Change", { filter: key, enabled: value });
      setFilterOptions((prev) => ({ ...prev, [key]: value }));
    },
    [setFilterOptions]
  );
  const handleUseSheetChange = useCallback(
    (value: boolean) => {
      trackEvent("Data Source Change", { source: value ? "Remote CSV" : "Local Backup" });
      setUseSheet(value);
    },
    [setUseSheet]
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
    () => new Fuse(artistsPassingFilters, { keys: ["name"], threshold: 0.35, ignoreLocation: true }),
    [artistsPassingFilters]
  );
  const filteredArtists = useMemo(() => {
    if (!deferredQuery) return artistsPassingFilters;
    return fuse.search(deferredQuery).map((r) => r.item);
  }, [artistsPassingFilters, fuse, deferredQuery]);
  const handleArtistClick = useCallback(
    (artist: Artist) => {
      const trackerId = extractTrackerId(artist.url);
      trackEvent("Artist Click", { name: artist.name });
      if (trackerId) {
        navigate(`/view?id=${trackerId}&artist=${encodeURIComponent(getCleanArtistName(artist.name))}`);
      } else {
        window.open(artist.url, "_blank", "noopener,noreferrer");
      }
    },
    [navigate]
  );
  const handleSheetClick = useCallback((url: string) => {
    trackEvent("Sheet Click", { url });
    window.open(url, "_blank", "noopener,noreferrer");
  }, []);
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
  const isFirstLoad = status === "loading" && !hasCachedData.current;
  const hasPlayerActive = !!playerState.currentTrack;
  return (
    <div className={`overflow-x-hidden ${hasPlayerActive ? "pb-32" : "pb-8"}`}>
      <AnnouncementModal
        isOpen={activeModal === "announcement"}
        onClose={handleDismissAnnouncement}
        message={ANNOUNCEMENT_MESSAGE}
      />
      <DonationModal key={String(activeModal === "donate")} isOpen={activeModal === "donate"} onClose={closeModal} />
      <InfoModal
        isOpen={activeModal === "info"}
        onClose={closeModal}
        visitorCount={visitorCount}
        onDonate={openDonationModal}
      />
      {isFirstLoad ? (
        <>
          <HeaderSkeleton />
          <main className="max-w-7xl mx-auto p-4 sm:p-6">
            <GallerySkeleton />
          </main>
        </>
      ) : status === "error" && !hasCachedData.current ? (
        <ErrorMessage message={errorMessage} />
      ) : (
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
