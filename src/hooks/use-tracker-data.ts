import { useCallback, useRef, useState } from "react";
import { getCache, setCache } from "@/src/lib/tracker-cache";
import { resolvePlayableUrl, getTrackSource, isNetworkSource } from "@/src/lib/resolve-url";
import { forEachEraTrack, mergeAndCache } from "@/src/lib/view-utils";
import {
  fetchWithFallback,
  adaptV3Response,
  adaptV3FlatResponse,
  type V3Response,
} from "@/src/lib/api";
import { getAllTrackUrls } from "@/src/lib/track-utils";
import type { TrackerResponse } from "@/src/types";

const NON_PLAYABLE_TABS = ["Art", "Tracklists", "Misc"];

export function useTrackerData(setExpandedEras: (value: Set<string> | ((prev: Set<string>) => Set<string>)) => void) {
  const [data, setData] = useState<TrackerResponse | null>(null);
  const [baseEraImages, setBaseEraImages] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<
    "idle" | "loading" | "tab-loading" | "success" | "error" | "fallback"
  >("idle");
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
      const virtualTabs = ["Favourites", "Custom"];
      const tabName = overrideTabName || tab;
      if (tab && virtualTabs.includes(tabName || tab)) {
        setCurrentTab(tabName || tab);
        return;
      }
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
            for (const u of getAllTrackUrls(t)) {
              if (!isNetworkSource(getTrackSource(u)) && !freeUrls.includes(u)) freeUrls.push(u);
            }
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

  return {
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
    baseEraImages,
    setBaseEraImages,
    isPreloading,
    setIsPreloading,
    resolveProgress,
    setResolveProgress,
    tabSlugsRef,
    tabGidsRef,
    hasLoadedRef,
    abortRef,
    resolveUrls,
    fetchBaseEraImages,
    loadTrackerData,
  };
}
