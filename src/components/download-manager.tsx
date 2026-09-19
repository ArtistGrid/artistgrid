import * as t from "io-ts";
import { isLeft } from "fp-ts/Either";
import { assertDownloadManagerContract } from "@/src/lib/contracts";
import { useState, useEffect, useCallback, useRef, useMemo, createContext, use, type ReactNode } from "react";
import { Archive, CheckCircle2, Download, Loader2, Maximize2, Minimize2, RotateCcw, X, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import type { Era, TALeak } from "@/src/types";
import { loadSettings } from "@/src/lib/settings";
import { logError } from "@/src/lib/logger";
import { safeSetItem } from "@/src/lib/storage";
import { stripEmojis } from "@/lib/utils";
const CONCURRENT_DOWNLOADS = 3;
const ZIP_CHUNK_SIZE = 900 * 1024 * 1024;
const MAX_RETRY_ATTEMPTS = 2;
const JOBS_STORAGE_KEY = "artistgrid-downloads:v1";
const MAX_RESTORED_ITEMS = 200;
const StoredItemCodec = t.intersection([
  t.interface({ id: t.string, playableUrl: t.string }),
  t.partial({
    trackName: t.string,
    eraName: t.string,
    status: t.string,
    progress: t.number,
    retryCount: t.number,
  }),
]);
const StoredJobCodec = t.intersection([
  t.interface({ id: t.string, items: t.array(StoredItemCodec) }),
  t.partial({ name: t.string, artistName: t.string, eraName: t.string }),
]);
interface DownloadItem {
  id: string;
  trackName: string;
  eraName: string;
  playableUrl: string;
  status: "pending" | "downloading" | "completed" | "failed";
  progress: number;
  retryCount: number;
  bytesLoaded?: number;
  bytesTotal?: number;
}
interface DownloadJob {
  id: string;
  name: string;
  artistName: string;
  eraName?: string;
  items: DownloadItem[];
  status: "active" | "completed" | "failed";
  completedCount: number;
  failedCount: number;
  zipBlob?: Blob;
  isCreatingZip?: boolean;
  forceZip?: boolean;
}
interface DownloadQueueItem {
  jobId: string;
  itemId: string;
  playableUrl: string;
  trackName: string;
  artistName: string;
  eraName: string;
  retryCount: number;
}
export interface DownloadContextType {
  jobs: DownloadJob[];
  isMinimized: boolean;
  setIsMinimized: (v: boolean) => void;
  startDownload: (params: {
    artistName: string;
    eraName?: string;
    items: Array<{
      track: TALeak;
      era: Era;
      playableUrl: string;
    }>;
  }) => void;
  clearCompleted: () => void;
  dismissJob: (jobId: string) => void;
  retryFailed: (jobId: string, itemId?: string) => void;
  downloadAsIs: (jobId: string) => void;
}
const DownloadContext = createContext<DownloadContextType | null>(null);
export function useDownloadManager() {
  const ctx = use(DownloadContext);
  if (!ctx) throw new Error("useDownloadManager must be used within DownloadProvider");
  if (!assertDownloadManagerContract(ctx)) {
    throw new Error("DownloadManager context does not satisfy its runtime contract");
  }
  return ctx;
}
function patchJobItem(prev: DownloadJob[], jobId: string, itemId: string, patch: Partial<DownloadItem>): DownloadJob[] {
  return prev.map((job) => {
    if (job.id !== jobId) return job;
    return { ...job, items: job.items.map((i) => (i.id === itemId ? { ...i, ...patch } : i)) };
  });
}
function withRecountedTotals(job: DownloadJob): DownloadJob {
  return {
    ...job,
    completedCount: job.items.filter((i) => i.status === "completed").length,
    failedCount: job.items.filter((i) => i.status === "failed").length,
  };
}
function parseStoredJobs(raw: string): DownloadJob[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  const arrayResult = t.UnknownArray.decode(parsed);
  if (isLeft(arrayResult)) return [];
  const jobs: DownloadJob[] = [];
  let restoredCount = 0;
  for (const entry of arrayResult.right) {
    if (restoredCount >= MAX_RESTORED_ITEMS) break;
    const jobResult = StoredJobCodec.decode(entry);
    if (isLeft(jobResult)) continue;
    const storedJob = jobResult.right;
    const restoredItems: DownloadItem[] = [];
    for (const storedItem of storedJob.items) {
      if (restoredCount >= MAX_RESTORED_ITEMS) break;
      restoredItems.push({
        id: storedItem.id,
        trackName: storedItem.trackName ?? "Unknown",
        eraName: storedItem.eraName ?? "Unknown Era",
        playableUrl: storedItem.playableUrl,
        status: "pending",
        progress: 0,
        retryCount: 0,
      });
      restoredCount++;
    }
    if (restoredItems.length > 0) {
      jobs.push({
        id: storedJob.id,
        name: storedJob.name ?? "Restored download",
        artistName: storedJob.artistName ?? "",
        eraName: storedJob.eraName,
        items: restoredItems,
        status: "active",
        completedCount: 0,
        failedCount: 0,
      });
    }
  }
  return jobs;
}
function sanitizeFilename(name: string): string {
  const settings = loadSettings();
  const cleaned = settings.behavior.showEmojis ? name : stripEmojis(name);
  return (
    cleaned
      .replace(/[<>:"/\\|?*]/g, "_")
      .replace(/\s+/g, " ")
      .trim() || "unknown"
  );
}
const AUDIO_EXTENSIONS = ["mp3", "m4a", "ogg", "wav", "flac", "opus", "aac", "weba", "webm"] as const;
export function getFileExtension(url: string, contentType?: string): string {
  if (contentType) {
    if (contentType.includes("audio/mpeg") || contentType.includes("audio/mp3")) return "mp3";
    if (contentType.includes("audio/mp4") || contentType.includes("audio/m4a")) return "m4a";
    if (contentType.includes("audio/ogg") || contentType.includes("audio/opus"))
      return contentType.includes("opus") ? "opus" : "ogg";
    if (contentType.includes("audio/wav")) return "wav";
    if (contentType.includes("audio/flac")) return "flac";
  }
  let pathname = url;
  try {
    pathname = new URL(url).pathname;
  } catch {}
  const match = pathname.toLowerCase().match(/\.([a-z0-9]+)$/);
  const ext = match?.[1];
  if (ext && (AUDIO_EXTENSIONS as readonly string[]).includes(ext)) return ext;
  return "mp3";
}
const DOWNLOAD_TIMEOUT_MS = 120000;
export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let value = bytes / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit++;
  }
  return `${value.toFixed(1)} ${units[unit]}`;
}
async function downloadFileAsBlob(
  url: string,
  onProgress?: (loaded: number, total: number) => void
): Promise<{
  blob: Blob;
  contentType: string;
} | null> {
  const controller = new AbortController();
  let timeoutId = setTimeout(() => controller.abort(), DOWNLOAD_TIMEOUT_MS);
  const resetTimeout = () => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => controller.abort(), DOWNLOAD_TIMEOUT_MS);
  };
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) return null;
    const contentLength = response.headers.get("content-length");
    const total = contentLength ? parseInt(contentLength, 10) : 0;
    if (!response.body) {
      const blob = await response.blob();
      const contentType = response.headers.get("content-type") || "";
      return { blob, contentType };
    }
    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let loaded = 0;
    let lastReported = -1;
    while (true) {
      resetTimeout();
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      loaded += value.length;
      if (onProgress && total) {
        const pct = Math.floor((loaded / total) * 100);
        if (pct !== lastReported) {
          lastReported = pct;
          onProgress(loaded, total);
        }
      }
    }
    const blob = new Blob(chunks as BlobPart[]);
    const contentType = response.headers.get("content-type") || "";
    return { blob, contentType };
  } catch (error) {
    logError("Download error:", error);
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}
function DownloadFloatingUI() {
  const { jobs, isMinimized, setIsMinimized, clearCompleted, dismissJob, retryFailed, downloadAsIs } =
    useDownloadManager();
  const activeJobs = jobs.filter((j) => j.status === "active");
  const completedJobs = jobs.filter((j) => j.status === "completed" || j.status === "failed");
  if (jobs.length === 0) return null;
  const totalItems = jobs.reduce((acc, j) => acc + j.items.length, 0);
  const completedItems = jobs.reduce((acc, j) => acc + j.completedCount + j.failedCount, 0);
  const overallProgress = totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0;
  const activeCount = activeJobs.reduce((acc, j) => acc + j.items.filter((i) => i.status === "downloading").length, 0);
  const hasFailedJobs = jobs.some((j) => j.failedCount > 0);
  return (
    <div className="fixed bottom-24 sm:bottom-4 right-4 z-50 w-80 max-h-96 bg-neutral-950 border border-neutral-800 rounded-xl shadow-2xl overflow-hidden">
      <div className="flex items-center justify-between p-3 border-b border-neutral-800 bg-neutral-900/50">
        <div className="flex items-center gap-2">
          <Archive
            className={`w-4 h-4 ${activeJobs.length > 0 ? "text-blue-400 animate-pulse" : hasFailedJobs ? "text-red-400" : "text-green-400"}`}
          />
          <span className="text-sm font-medium text-white">
            {activeJobs.length > 0
              ? `Downloading (${activeCount} active)`
              : hasFailedJobs
                ? "Downloads with issues"
                : "Downloads Complete"}
          </span>
        </div>
        <div className="flex items-center gap-1">
          {completedJobs.length > 0 && (
            <Button
              variant="ghost"
              size="icon"
              onClick={clearCompleted}
              className="h-6 w-6 text-neutral-500 hover:text-white"
              aria-label="Clear completed downloads"
            >
              <X className="w-3 h-3" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsMinimized(!isMinimized)}
            className="h-6 w-6 text-neutral-500 hover:text-white"
            aria-label={isMinimized ? "Expand downloads" : "Minimize downloads"}
          >
            {isMinimized ? <Maximize2 className="w-3 h-3" /> : <Minimize2 className="w-3 h-3" />}
          </Button>
        </div>
      </div>
      {!isMinimized && (
        <div className="max-h-72 overflow-y-auto">
          {jobs.map((job) => {
            const jobProgress =
              job.items.length > 0 ? Math.round(((job.completedCount + job.failedCount) / job.items.length) * 100) : 0;
            const isActive = job.status === "active";
            const downloadingItems = job.items.filter((i) => i.status === "downloading");
            const failedItems = job.items.filter((i) => i.status === "failed");
            return (
              <div key={job.id} className="p-3 border-b border-neutral-800 last:border-b-0">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    {job.isCreatingZip ? (
                      <Loader2 className="w-4 h-4 text-yellow-400 animate-spin flex-shrink-0" />
                    ) : job.status === "completed" ? (
                      <CheckCircle2 className="w-4 h-4 text-green-400 flex-shrink-0" />
                    ) : job.status === "failed" ? (
                      <XCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
                    ) : (
                      <Loader2 className="w-4 h-4 text-blue-400 animate-spin flex-shrink-0" />
                    )}
                    <span className="text-xs text-white truncate">{job.name}</span>
                  </div>
                  {!isActive && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => dismissJob(job.id)}
                      className="h-5 w-5 text-neutral-500 hover:text-white flex-shrink-0"
                      aria-label="Dismiss download"
                    >
                      <X className="w-3 h-3" />
                    </Button>
                  )}
                </div>
                <Progress value={jobProgress} className="h-1.5 mb-1" />
                <div className="flex items-center justify-between text-[10px] text-neutral-500">
                  <span>
                    {job.isCreatingZip ? "Creating ZIP..." : `${job.completedCount}/${job.items.length} files`}
                  </span>
                  {job.failedCount > 0 && <span className="text-red-400">{job.failedCount} failed</span>}
                  <span>{jobProgress}%</span>
                </div>
                {failedItems.length > 0 && (
                  <div className="mt-2 p-2 bg-red-950/40 border border-red-900/50 rounded-md text-xs space-y-1.5">
                    <div className="flex items-center justify-between text-[11px] font-medium text-red-300">
                      <span>Failed files ({failedItems.length}):</span>
                    </div>
                    <div className="max-h-24 overflow-y-auto space-y-1 pr-1">
                      {failedItems.map((item) => (
                        <div
                          key={item.id}
                          className="text-[10px] text-red-200/90 flex items-center justify-between gap-1 bg-red-900/20 px-1.5 py-0.5 rounded"
                        >
                          <span className="truncate flex-1" title={item.trackName}>
                            {item.trackName}
                          </span>
                          <button
                            type="button"
                            onClick={() => retryFailed(job.id, item.id)}
                            className="text-red-400 hover:text-white flex items-center gap-0.5 px-1 py-0.5 rounded hover:bg-red-800/50 flex-shrink-0 transition-colors"
                            title={`Retry ${item.trackName}`}
                            aria-label={`Retry ${item.trackName}`}
                          >
                            <RotateCcw className="w-2.5 h-2.5" />
                            <span className="text-[9px]">Retry</span>
                          </button>
                        </div>
                      ))}
                    </div>
                    <div className="flex items-center gap-1.5 pt-1 border-t border-red-900/40">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => retryFailed(job.id)}
                        className="h-6 text-[10px] px-2 text-red-200 border-red-800 bg-red-950/60 hover:bg-red-900/70 hover:text-white flex items-center gap-1"
                        aria-label="Retry all failed files"
                      >
                        <RotateCcw className="w-3 h-3" />
                        Retry {failedItems.length > 1 ? "all" : ""}
                      </Button>
                      {job.completedCount > 0 && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => downloadAsIs(job.id)}
                          disabled={job.isCreatingZip}
                          className="h-6 text-[10px] px-2 text-neutral-300 border-neutral-700 bg-neutral-900 hover:bg-neutral-800 hover:text-white flex items-center gap-1"
                          aria-label="Download as-is"
                        >
                          {job.isCreatingZip ? (
                            <Loader2 className="w-3 h-3 animate-spin text-yellow-400" />
                          ) : (
                            <Download className="w-3 h-3 text-neutral-400" />
                          )}
                          Download as-is ({job.completedCount})
                        </Button>
                      )}
                    </div>
                  </div>
                )}
                {isActive && downloadingItems.length > 0 && (
                  <div className="mt-2 space-y-1">
                    {downloadingItems.slice(0, 5).map((item) => (
                      <div key={item.id} className="text-[10px] text-neutral-400 truncate flex items-center gap-1">
                        <Loader2 className="w-2 h-2 animate-spin flex-shrink-0" />
                        <span className="flex-1 truncate">{item.trackName}</span>
                        {item.bytesTotal ? (
                          <span className="text-neutral-500 tabular-nums">
                            {formatBytes(item.bytesLoaded ?? 0)} / {formatBytes(item.bytesTotal)}
                          </span>
                        ) : item.progress > 0 ? (
                          <span className="text-neutral-600">{item.progress}%</span>
                        ) : null}
                      </div>
                    ))}
                    {downloadingItems.length > 5 && (
                      <div className="text-[10px] text-neutral-500">+{downloadingItems.length - 5} more...</div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
      {isMinimized && activeJobs.length > 0 && (
        <div className="p-2">
          <Progress value={overallProgress} className="h-1" />
          <p className="text-[10px] text-neutral-500 mt-1 text-center">
            {completedItems}/{totalItems} ({overallProgress}%)
          </p>
        </div>
      )}
    </div>
  );
}
export function DownloadProvider({ children }: { children: ReactNode }) {
  const [jobs, setJobs] = useState<DownloadJob[]>([]);
  const [isMinimized, setIsMinimized] = useState(false);
  const activeDownloadsRef = useRef(0);
  const downloadQueueRef = useRef<DownloadQueueItem[]>([]);
  const zipDataRef = useRef<
    Map<
      string,
      Map<
        string,
        {
          blob: Blob;
          ext: string;
        }
      >
    >
  >(new Map());
  const processQueueRef = useRef<() => void>(() => {});
  const creatingZipsRef = useRef<Set<string>>(new Set());
  const zipsRunningRef = useRef(false);
  const retryOrFail = useCallback((item: DownloadQueueItem) => {
    if (item.retryCount < MAX_RETRY_ATTEMPTS) {
      item.retryCount += 1;
      downloadQueueRef.current.push(item);
      setJobs((prev) =>
        patchJobItem(prev, item.jobId, item.itemId, { status: "pending", retryCount: item.retryCount })
      );
    } else {
      setJobs((prev) =>
        prev.map((job) =>
          job.id === item.jobId
            ? withRecountedTotals({
                ...job,
                items: job.items.map((i) => (i.id === item.itemId ? { ...i, status: "failed" as const } : i)),
              })
            : job
        )
      );
    }
  }, []);
  const downloadSingleItem = useCallback(
    async (item: DownloadQueueItem) => {
      setJobs((prev) =>
        patchJobItem(prev, item.jobId, item.itemId, { status: "downloading", progress: 0, bytesLoaded: 0 })
      );
      try {
        const result = await downloadFileAsBlob(item.playableUrl, (loaded, total) => {
          const progress = Math.round((loaded / total) * 100);
          setJobs((prev) =>
            patchJobItem(prev, item.jobId, item.itemId, { progress, bytesLoaded: loaded, bytesTotal: total })
          );
        });
        if (result) {
          let finalBlob = result.blob;
          const s = loadSettings();
          const format = s.downloads.format || "original";
          if (s.downloads.embedMetadata) {
            try {
              const { embedMetadata } = await import("@/src/lib/ffmpeg-metadata");
              finalBlob = await embedMetadata(
                result.blob,
                {
                  title: item.trackName,
                  artist: item.artistName,
                },
                format
              );
            } catch (e) {
              logError("Metadata embedding failed for batch download:", e);
            }
          }
          const formatExtMap: Record<string, string> = {
            mp3: "mp3",
            opus: "opus",
            ogg: "ogg",
            flac: "flac",
            wav: "wav",
          };
          const ext =
            s.downloads.embedMetadata && format !== "original" && formatExtMap[format]
              ? formatExtMap[format]
              : getFileExtension(item.playableUrl, result.contentType);
          if (!zipDataRef.current!.has(item.jobId)) zipDataRef.current!.set(item.jobId, new Map());
          zipDataRef.current!.get(item.jobId)!.set(item.itemId, { blob: finalBlob, ext });
          setJobs((prev) =>
            prev.map((job) => {
              if (job.id !== item.jobId) return job;
              const newItems = job.items.map((i) =>
                i.id === item.itemId ? { ...i, status: "completed" as const, progress: 100 } : i
              );
              return withRecountedTotals({ ...job, items: newItems });
            })
          );
        } else {
          retryOrFail(item);
        }
      } catch (error) {
        logError("Download failed:", error);
        retryOrFail(item);
      }
      activeDownloadsRef.current--;
      processQueueRef.current();
    },
    [retryOrFail]
  );
  const processQueue = useCallback(() => {
    while (activeDownloadsRef.current < CONCURRENT_DOWNLOADS && downloadQueueRef.current.length > 0) {
      const item = downloadQueueRef.current.shift();
      if (!item) break;
      activeDownloadsRef.current++;
      downloadSingleItem(item);
    }
  }, [downloadSingleItem]);
  useEffect(() => {
    processQueueRef.current = processQueue;
  }, [processQueue]);
  const hasRestoredRef = useRef(false);
  useEffect(() => {
    if (hasRestoredRef.current) return;
    hasRestoredRef.current = true;
    try {
      const raw = localStorage.getItem(JOBS_STORAGE_KEY);
      if (!raw) return;
      const restored = parseStoredJobs(raw);
      if (restored.length === 0) {
        localStorage.removeItem(JOBS_STORAGE_KEY);
        return;
      }
      setJobs(restored);
      for (const job of restored) {
        for (const item of job.items) {
          downloadQueueRef.current.push({
            jobId: job.id,
            itemId: item.id,
            playableUrl: item.playableUrl,
            trackName: item.trackName,
            artistName: job.artistName,
            eraName: item.eraName,
            retryCount: 0,
          });
        }
      }
      processQueueRef.current();
    } catch {}
  }, []);
  useEffect(() => {
    try {
      const active = jobs.filter((j) => j.status === "active");
      if (active.length === 0) {
        localStorage.removeItem(JOBS_STORAGE_KEY);
        return;
      }
      const slim = active.map((j) => ({
        id: j.id,
        name: j.name,
        artistName: j.artistName,
        eraName: j.eraName,
        items: j.items.map(({ id, trackName, eraName, playableUrl }) => ({
          id,
          trackName,
          eraName,
          playableUrl,
        })),
      }));
      safeSetItem(JOBS_STORAGE_KEY, JSON.stringify(slim));
    } catch {}
  }, [jobs]);
  const processZips = useCallback(async () => {
    if (zipsRunningRef.current) return;
    zipsRunningRef.current = true;
    try {
      const readyJobs = jobs.filter((job) => {
        if (job.status !== "active" || creatingZipsRef.current!.has(job.id)) return false;
        if (job.zipBlob || job.isCreatingZip) return false;
        const allDone = job.items.every((i) => i.status === "completed" || i.status === "failed");
        if (!allDone) return false;
        if (job.failedCount > 0) {
          return Boolean(job.forceZip && job.completedCount > 0);
        }
        return job.completedCount > 0;
      });
      if (readyJobs.length === 0) return;
      const JSZip = (await import("jszip")).default;
      for (const job of readyJobs) {
        const jobData = zipDataRef.current!.get(job.id);
        if (!jobData || jobData.size === 0) {
          setJobs((prev) =>
            prev.map((j) => (j.id === job.id ? { ...j, status: "failed" as const, forceZip: false } : j))
          );
          continue;
        }
        creatingZipsRef.current!.add(job.id);
        setJobs((prev) => prev.map((j) => (j.id === job.id ? { ...j, isCreatingZip: true } : j)));
        try {
          type ChunkEntry = {
            item: DownloadItem;
            fileData: {
              blob: Blob;
              ext: string;
            };
          };
          const chunks: ChunkEntry[][] = [[]];
          let chunkBytes = 0;
          for (const item of job.items) {
            if (item.status !== "completed") continue;
            const fileData = jobData.get(item.id);
            if (!fileData) continue;
            if (chunkBytes + fileData.blob.size > ZIP_CHUNK_SIZE && chunks[chunks.length - 1].length > 0) {
              chunks.push([]);
              chunkBytes = 0;
            }
            chunks[chunks.length - 1].push({ item, fileData });
            chunkBytes += fileData.blob.size;
          }
          const filled = chunks.filter((c) => c.length > 0);
          if (filled.length === 0) {
            setJobs((prev) =>
              prev.map((j) =>
                j.id === job.id ? { ...j, status: "failed" as const, isCreatingZip: false, forceZip: false } : j
              )
            );
            creatingZipsRef.current!.delete(job.id);
            continue;
          }
          const baseName = job.eraName
            ? `${sanitizeFilename(job.artistName)} - ${sanitizeFilename(job.eraName)}`
            : `${sanitizeFilename(job.artistName)} Tracker`;
          for (let i = 0; i < filled.length; i++) {
            const chunkItems = filled[i];
            if (i > 0) {
              await new Promise((r) => setTimeout(r, 1000));
            }
            const zip = new JSZip();
            const usedPaths = new Set<string>();
            for (const { item, fileData } of chunkItems) {
              const stem = sanitizeFilename(item.trackName);
              let path = `${sanitizeFilename(item.eraName)}/${stem}.${fileData.ext}`;
              let n = 2;
              while (usedPaths.has(path.toLowerCase())) {
                path = `${sanitizeFilename(item.eraName)}/${stem} (${n}).${fileData.ext}`;
                n++;
              }
              usedPaths.add(path.toLowerCase());
              zip.file(path, fileData.blob);
            }
            const content = await zip.generateAsync({
              type: "blob",
              compression: "DEFLATE",
              compressionOptions: { level: 6 },
              streamFiles: true,
            });
            const zipName = filled.length > 1 ? `${baseName} Part ${i + 1}.zip` : `${baseName}.zip`;
            const downloadUrl = URL.createObjectURL(content);
            const link = document.createElement("a");
            link.href = downloadUrl;
            link.download = zipName;
            link.style.display = "none";
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(downloadUrl);
            for (const { item } of chunkItems) jobData.delete(item.id);
          }
          setJobs((prev) =>
            prev.map((j) =>
              j.id === job.id ? { ...j, status: "completed" as const, isCreatingZip: false, forceZip: false } : j
            )
          );
          zipDataRef.current!.delete(job.id);
          creatingZipsRef.current!.delete(job.id);
        } catch (error) {
          logError("ZIP creation failed:", error);
          try {
            setJobs((prev) =>
              prev.map((j) =>
                j.id === job.id ? { ...j, status: "failed" as const, isCreatingZip: false, forceZip: false } : j
              )
            );
          } catch {}
          creatingZipsRef.current?.delete(job.id);
        }
      }
    } finally {
      zipsRunningRef.current = false;
    }
  }, [jobs]);
  useEffect(() => {
    setJobs((prev) => {
      let changed = false;
      const next = prev.map((job) => {
        if (job.status === "active" && !job.forceZip && !job.isCreatingZip) {
          const allDone = job.items.every((i) => i.status === "completed" || i.status === "failed");
          if (allDone && job.failedCount > 0) {
            changed = true;
            return { ...job, status: "failed" as const };
          }
        }
        return job;
      });
      return changed ? next : prev;
    });
  }, [jobs]);
  useEffect(() => {
    processZips();
  }, [jobs, processZips]);
  const retryFailed = useCallback(
    (jobId: string, itemId?: string) => {
      const job = jobs.find((j) => j.id === jobId);
      if (!job) return;
      const targetItems = job.items.filter((i) => i.status === "failed" && (!itemId || i.id === itemId));
      if (targetItems.length === 0) return;
      for (const item of targetItems) {
        downloadQueueRef.current.push({
          jobId: job.id,
          itemId: item.id,
          playableUrl: item.playableUrl,
          trackName: item.trackName,
          artistName: job.artistName,
          eraName: item.eraName,
          retryCount: 0,
        });
      }
      setJobs((prev) =>
        prev.map((j) => {
          if (j.id !== jobId) return j;
          const updatedItems = j.items.map((i) => {
            if (i.status === "failed" && (!itemId || i.id === itemId)) {
              return { ...i, status: "pending" as const, progress: 0, retryCount: 0 };
            }
            return i;
          });
          return withRecountedTotals({
            ...j,
            status: "active" as const,
            forceZip: false,
            items: updatedItems,
          });
        })
      );
      processQueue();
    },
    [jobs, processQueue]
  );
  const downloadAsIs = useCallback((jobId: string) => {
    setJobs((prev) =>
      prev.map((job) => {
        if (job.id !== jobId) return job;
        if (job.completedCount === 0) return job;
        return { ...job, forceZip: true, status: "active" as const };
      })
    );
  }, []);
  const startDownload = useCallback(
    (params: {
      artistName: string;
      eraName?: string;
      items: Array<{
        track: TALeak;
        era: Era;
        playableUrl: string;
      }>;
    }) => {
      const jobId = `job_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
      const downloadItems: DownloadItem[] = params.items.map((item, idx) => ({
        id: `${jobId}_item_${idx}`,
        trackName: item.track.name || "Unknown",
        eraName: item.era.name || "Unknown Era",
        playableUrl: item.playableUrl,
        status: "pending" as const,
        progress: 0,
        retryCount: 0,
      }));
      const newJob: DownloadJob = {
        id: jobId,
        name: params.eraName ? `${params.artistName} - ${params.eraName}` : `${params.artistName} Tracker`,
        artistName: params.artistName,
        eraName: params.eraName,
        items: downloadItems,
        status: "active",
        completedCount: 0,
        failedCount: 0,
      };
      setJobs((prev) => [...prev, newJob]);
      for (const item of downloadItems) {
        downloadQueueRef.current.push({
          jobId,
          itemId: item.id,
          playableUrl: item.playableUrl,
          trackName: item.trackName,
          artistName: params.artistName,
          eraName: item.eraName,
          retryCount: 0,
        });
      }
      processQueue();
    },
    [processQueue]
  );
  const clearCompleted = useCallback(() => {
    setJobs((prev) => prev.filter((j) => j.status === "active"));
  }, []);
  const dismissJob = useCallback((jobId: string) => {
    setJobs((prev) => prev.filter((j) => j.id !== jobId));
    zipDataRef.current!.delete(jobId);
    creatingZipsRef.current!.delete(jobId);
  }, []);
  return (
    <DownloadContext.Provider
      value={useMemo(
        () => ({
          jobs,
          isMinimized,
          setIsMinimized,
          startDownload,
          clearCompleted,
          dismissJob,
          retryFailed,
          downloadAsIs,
        }),
        [jobs, isMinimized, setIsMinimized, startDownload, clearCompleted, dismissJob, retryFailed, downloadAsIs]
      )}
    >
      {children}
      <DownloadFloatingUI />
    </DownloadContext.Provider>
  );
}
