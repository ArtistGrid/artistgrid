import { useCallback, useEffect, useRef, useState } from "react";
import { getCacheAsync, setCache } from "@/src/lib/tracker-cache";
import { resolvePlayableUrl, getTrackSource, isNetworkSource } from "@/src/lib/resolve-url";
import { forEachEraTrack, mergeAndCache } from "@/src/lib/view-utils";
import {
  fetchWithFallback,
  adaptV3Response,
  adaptV3FlatResponse,
  discardTrackerPrefetch,
  type V3Response,
} from "@/src/lib/api";
import { isValidV3Response } from "@/src/lib/v3-validation";
import { getAllTrackUrls } from "@/src/lib/track-utils";
import type { TrackerResponse } from "@/src/types";
const NON_PLAYABLE_TABS = ["Art", "Tracklists", "Misc"];
export function useTrackerData(setExpandedEras: (value: Set<string> | ((prev: Set<string>) => Set<string>)) => void) {
  const [data, setData] = useState<TrackerResponse | null>(null);
  const [baseEraImages, setBaseEraImages] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<"idle" | "loading" | "tab-loading" | "success" | "error" | "fallback">("idle");
  const [resolvedUrls, setResolvedUrls] = useState<Map<string, string | null>>(new Map());
  const [resolveProgress, setResolveProgress] = useState({ current: 0, total: 0 });
  const [isPreloading, setIsPreloading] = useState(false);
  const [currentTab, setCurrentTab] = useState<string>("");
  const [tabsList, setTabsList] = useState<string[]>([]);
  const tabSlugsRef = useRef<Record<string, string>>({});
  const tabGidsRef = useRef<Record<string, string>>({});
  const hasLoadedRef = useRef(false);
  const abortRef = useRef<AbortController | null>(null);
  const trackerIdRef = useRef("");
  const generationRef = useRef(0);
  const resolutionRunRef = useRef(0);
  const mountedRef = useRef(false);
  const settledRef = useRef<{ id: string; data: TrackerResponse; resolvedUrls: Map<string, string | null> } | null>(
    null
  );
  const [tabError, setTabError] = useState(false);
  const [tabEmpty, setTabEmpty] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [credits, setCredits] = useState<string | null>(null);
  const [discord, setDiscord] = useState<string | null>(null);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      generationRef.current++;
      abortRef.current?.abort();
    };
  }, []);
  useEffect(() => {
    if (status === "success" && data) {
      settledRef.current = { id: trackerIdRef.current, data, resolvedUrls };
    }
  }, [data, resolvedUrls, status]);
  const cancelTrackerLoad = useCallback(() => {
    generationRef.current++;
    resolutionRunRef.current++;
    abortRef.current?.abort();
    setIsPreloading(false);
    const settled = settledRef.current;
    if (settled && settled.id === trackerIdRef.current) {
      setData(settled.data);
      setResolvedUrls(new Map(settled.resolvedUrls));
      setTabError(false);
      setTabEmpty(false);
      setStatus("success");
    } else setStatus(hasLoadedRef.current ? "success" : "idle");
  }, []);
  const fetchBaseEraImages = useCallback(async (id: string, signal?: AbortSignal) => {
    const generation = generationRef.current;
    const active = () =>
      mountedRef.current && !signal?.aborted && generation === generationRef.current && id === trackerIdRef.current;
    try {
      const cached = await getCacheAsync(id);
      if (!active()) return;
      if (cached?.data?.eras) {
        const images: Record<string, string> = {};
        for (const [key, era] of Object.entries(cached.data.eras)) {
          if (era.image) images[era.name || key] = era.image;
        }
        setBaseEraImages(images);
        return;
      }
      const res = await fetchWithFallback(`/sh/${id}/`, { signal });
      if (res.ok) {
        const json: V3Response = await res.json();
        if (!active()) return;
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
  const captureMeta = useCallback((json: TrackerResponse | null | undefined) => {
    if (!json) return;
    if (json.credits) setCredits(json.credits);
    if (json.discord) setDiscord(json.discord);
  }, []);
  const resolveUrls = useCallback(
    async (urls: string[], signal?: AbortSignal): Promise<Record<string, string | null>> => {
      if (urls.length === 0) return {};
      const generation = generationRef.current;
      const run = ++resolutionRunRef.current;
      const active = () => mountedRef.current && !signal?.aborted && generation === generationRef.current;
      setIsPreloading(true);
      setResolveProgress({ current: 0, total: urls.length });
      const resolved: Record<string, string | null> = {};
      const batchSize = 10;
      const FLUSH_INTERVAL_MS = 200;
      let lastFlush = 0;
      try {
        for (let i = 0; i < urls.length; i += batchSize) {
          if (signal?.aborted) break;
          const batch = urls.slice(i, i + batchSize);
          const results = await Promise.all(
            batch.map(async (url) => ({ url, playable: await resolvePlayableUrl(url) }))
          );
          if (signal?.aborted) break;
          for (const { url, playable } of results) resolved[url] = playable;
          const current = Math.min(i + batchSize, urls.length);
          const isLast = current >= urls.length;
          const now = Date.now();
          if (active() && (isLast || now - lastFlush >= FLUSH_INTERVAL_MS)) {
            lastFlush = now;
            const snapshot = { ...resolved };
            setResolvedUrls((prev) => {
              if (!active()) return prev;
              const next = new Map(prev);
              for (const [url, playable] of Object.entries(snapshot)) next.set(url, playable);
              return next;
            });
            if (run === resolutionRunRef.current) setResolveProgress({ current, total: urls.length });
          }
        }
      } finally {
        if (active() && run === resolutionRunRef.current) setIsPreloading(false);
      }
      return resolved;
    },
    []
  );
  const loadTrackerData = useCallback(
    async (id: string, tab?: string, overrideTabName?: string) => {
      const virtualTabs = ["Favourites", "Custom"];
      const tabName = overrideTabName || tab;
      const applyCachedData = (
        cached: NonNullable<Awaited<ReturnType<typeof getCacheAsync>>>,
        tab: string | undefined,
        overrideTabName: string | undefined
      ) => {
        settledRef.current = { id, data: cached.data, resolvedUrls: new Map(Object.entries(cached.resolvedUrls)) };
        setData(cached.data);
        setResolvedUrls(new Map(Object.entries(cached.resolvedUrls)));
        captureMeta(cached.data);
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
      };
      const applySuccessData = (
        id: string,
        cacheKey: string | undefined,
        json: TrackerResponse,
        overrideTabName: string | undefined
      ) => {
        settledRef.current = { id, data: json, resolvedUrls: new Map() };
        setData(json);
        captureMeta(json);
        setCurrentTab(overrideTabName || json.current_tab);
        if (json.tabs?.length) setTabsList(json.tabs);
        if (json.tabSlugs) tabSlugsRef.current = { ...tabSlugsRef.current, ...json.tabSlugs };
        if (json.tabGids) tabGidsRef.current = { ...tabGidsRef.current, ...json.tabGids };
        setStatus("success");
        hasLoadedRef.current = true;
        setHasLoaded(true);
        setCache(id, json, {}, cacheKey);
        const preparePlayableUrls = () => {
          if (!active() || NON_PLAYABLE_TABS.includes(json.current_tab)) return;
          const freeUrls = new Set<string>();
          forEachEraTrack(json.eras, (t) => {
            for (const u of getAllTrackUrls(t)) {
              if (!isNetworkSource(getTrackSource(u))) freeUrls.add(u);
            }
          });
          if (freeUrls.size > 0) {
            resolveUrls([...freeUrls], controller.signal)
              .then((resolved) => {
                if (active()) mergeAndCache(id, cacheKey, json, resolved);
              })
              .catch(() => {});
          }
        };
        if (typeof requestAnimationFrame === "function") {
          requestAnimationFrame(() => requestAnimationFrame(preparePlayableUrls));
        } else setTimeout(preparePlayableUrls, 0);
      };
      const hasPayload = (v3: V3Response): boolean =>
        (v3 && typeof v3 === "object" && Array.isArray(v3.tracks) && v3.tracks.length > 0) ||
        (v3 && typeof v3 === "object" && Array.isArray(v3.eras) && v3.eras.length > 0);
      if (tab && virtualTabs.includes(tabName || tab)) {
        cancelTrackerLoad();
        setCurrentTab(tabName || tab);
        return;
      }
      abortRef.current?.abort();
      const generation = ++generationRef.current;
      resolutionRunRef.current++;
      const controller = new AbortController();
      abortRef.current = controller;
      const active = () => mountedRef.current && !controller.signal.aborted && generation === generationRef.current;
      const trackerChanged = trackerIdRef.current !== id;
      trackerIdRef.current = id;
      setIsPreloading(false);
      if (!tab || trackerChanged) {
        setData(null);
        setResolvedUrls(new Map());
        setBaseEraImages({});
        setCredits(null);
        setDiscord(null);
        setExpandedEras(new Set());
        setTabsList([]);
        tabSlugsRef.current = {};
        tabGidsRef.current = {};
        hasLoadedRef.current = false;
        setHasLoaded(false);
      }
      setTabError(false);
      setTabEmpty(false);
      let tabNameForGid = overrideTabName || "";
      if (tab && !tabNameForGid) {
        for (const [name, slug] of Object.entries(tabSlugsRef.current)) {
          if (slug === tab) {
            tabNameForGid = name;
            break;
          }
        }
      }
      const gid = tab ? tabGidsRef.current[tabNameForGid] || "" : "";
      const cacheKey = gid || tab;
      setStatus(tab && hasLoadedRef.current ? "tab-loading" : "loading");
      if (tab) void fetchBaseEraImages(id, controller.signal);
      const cached = await getCacheAsync(id, cacheKey);
      if (!active()) return;
      if (cached) {
        discardTrackerPrefetch(id);
        applyCachedData(cached, tab, overrideTabName);
        return;
      }
      const endpoint = tab ? (gid ? `/sh/${id}/gid/${gid}` : `/sh/${id}/tab/${encodeURIComponent(tab)}`) : `/sh/${id}/`;
      const fail = () => {
        if (!active()) return;
        if (tab) {
          setData(null);
          setTabError(true);
          setStatus("success");
        } else {
          setStatus("fallback");
        }
      };
      try {
        const res = await fetchWithFallback(endpoint, { signal: controller.signal });
        if (!active()) return;
        if (!res.ok) {
          fail();
          return;
        }
        const rawPayload: unknown = await res.json();
        if (!active()) return;
        if (!isValidV3Response(rawPayload)) {
          console.warn("[tracker] V3 payload failed schema validation; decoding best-effort");
        }
        const v3 = rawPayload as V3Response;
        if (!active()) return;
        if (!hasPayload(v3)) {
          if (tab) {
            setData(null);
            setTabEmpty(true);
            setStatus("success");
          } else {
            fail();
          }
          return;
        }
        const json =
          v3 && typeof v3 === "object" && Array.isArray(v3.tracks) && v3.tracks.length > 0
            ? adaptV3FlatResponse(v3)
            : adaptV3Response(v3);
        applySuccessData(id, cacheKey, json, overrideTabName);
      } catch (e) {
        if (!active()) return;
        console.error("[tracker] load failed", e);
        fail();
      }
    },
    [cancelTrackerLoad, captureMeta, fetchBaseEraImages, resolveUrls, setExpandedEras]
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
    cancelTrackerLoad,
  };
}
