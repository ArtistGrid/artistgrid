import { useState, useEffect, useCallback, useRef, useMemo, createContext, use, type ReactNode } from "react";
import { Archive, CheckCircle2, Loader2, Maximize2, Minimize2, X, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import type { Era, TALeak } from "@/src/types";
const CONCURRENT_DOWNLOADS = 3;
const ZIP_CHUNK_SIZE = 900 * 1024 * 1024;
const MAX_RETRY_ATTEMPTS = 2;
interface DownloadItem {
  id: string;
  trackName: string;
  eraName: string;
  playableUrl: string;
  status: "pending" | "downloading" | "completed" | "failed";
  progress: number;
  retryCount: number;
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
  downloadUrl?: string;
}
interface DownloadQueueItem {
  jobId: string;
  itemId: string;
  playableUrl: string;
  trackName: string;
  eraName: string;
}
interface DownloadContextType {
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
}
const DownloadContext = createContext<DownloadContextType | null>(null);
export function useDownloadManager() {
  const ctx = use(DownloadContext);
  if (!ctx) throw new Error("useDownloadManager must be used within DownloadProvider");
  return ctx;
}
function patchJobItem(prev: DownloadJob[], jobId: string, itemId: string, patch: Partial<DownloadItem>): DownloadJob[] {
  return prev.map((job) => {
    if (job.id !== jobId) return job;
    return { ...job, items: job.items.map((i) => (i.id === itemId ? { ...i, ...patch } : i)) };
  });
}
function sanitizeFilename(name: string): string {
  return (
    name
      .replace(/[<>:"/\\|?*]/g, "_")
      .replace(/\s+/g, " ")
      .trim() || "unknown"
  );
}
function getFileExtension(url: string, contentType?: string): string {
  if (contentType) {
    if (contentType.includes("audio/mpeg") || contentType.includes("audio/mp3")) return "mp3";
    if (contentType.includes("audio/mp4") || contentType.includes("audio/m4a")) return "m4a";
    if (contentType.includes("audio/ogg")) return "ogg";
    if (contentType.includes("audio/wav")) return "wav";
    if (contentType.includes("audio/flac")) return "flac";
  }
  const urlLower = url.toLowerCase();
  if (urlLower.includes(".mp3") || urlLower.includes("mp3")) return "mp3";
  if (urlLower.includes(".m4a") || urlLower.includes("m4a")) return "m4a";
  if (urlLower.includes(".ogg")) return "ogg";
  if (urlLower.includes(".wav")) return "wav";
  if (urlLower.includes(".flac")) return "flac";
  return "mp3";
}
async function downloadFileAsBlob(
  url: string,
  onProgress?: (loaded: number, total: number) => void
): Promise<{
  blob: Blob;
  contentType: string;
} | null> {
  try {
    const response = await fetch(url);
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
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      loaded += value.length;
      if (onProgress && total) onProgress(loaded, total);
    }
    const blob = new Blob(chunks as BlobPart[]);
    const contentType = response.headers.get("content-type") || "";
    return { blob, contentType };
  } catch (error) {
    console.error("Download error:", error);
    return null;
  }
}
function DownloadFloatingUI() {
  const { jobs, isMinimized, setIsMinimized, clearCompleted, dismissJob } = useDownloadManager();
  const activeJobs = jobs.filter((j) => j.status === "active");
  const completedJobs = jobs.filter((j) => j.status === "completed" || j.status === "failed");
  if (jobs.length === 0) return null;
  const totalItems = jobs.reduce((acc, j) => acc + j.items.length, 0);
  const completedItems = jobs.reduce((acc, j) => acc + j.completedCount + j.failedCount, 0);
  const overallProgress = totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0;
  const activeCount = activeJobs.reduce((acc, j) => acc + j.items.filter((i) => i.status === "downloading").length, 0);
  return (
    <div className="fixed bottom-20 sm:bottom-4 right-4 z-50 w-80 max-h-96 bg-neutral-950 border border-neutral-800 rounded-xl shadow-2xl overflow-hidden">
      <div className="flex items-center justify-between p-3 border-b border-neutral-800 bg-neutral-900/50">
        <div className="flex items-center gap-2">
          <Archive className={`w-4 h-4 ${activeJobs.length > 0 ? "text-blue-400 animate-pulse" : "text-green-400"}`} />
          <span className="text-sm font-medium text-white">
            {activeJobs.length > 0 ? `Downloading (${activeCount} active)` : "Downloads Complete"}
          </span>
        </div>
        <div className="flex items-center gap-1">
          {completedJobs.length > 0 && (
            <Button
              variant="ghost"
              size="icon"
              onClick={clearCompleted}
              className="h-6 w-6 text-neutral-500 hover:text-white"
            >
              <X className="w-3 h-3" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsMinimized(!isMinimized)}
            className="h-6 w-6 text-neutral-500 hover:text-white"
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
                {isActive && downloadingItems.length > 0 && (
                  <div className="mt-2 space-y-1">
                    {downloadingItems.slice(0, 5).map((item) => (
                      <div key={item.id} className="text-[10px] text-neutral-400 truncate flex items-center gap-1">
                        <Loader2 className="w-2 h-2 animate-spin flex-shrink-0" />
                        <span className="flex-1 truncate">{item.trackName}</span>
                        {item.progress > 0 && <span className="text-neutral-600">{item.progress}%</span>}
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
  const zipDataRef = useRef<Map<string, Map<string, { blob: Blob; ext: string }>> | null>(null);
  if (!zipDataRef.current) zipDataRef.current = new Map();
  const processQueueRef = useRef<() => void>(() => {});
  const creatingZipsRef = useRef<Set<string> | null>(null);
  if (!creatingZipsRef.current) creatingZipsRef.current = new Set();
  const downloadUrlsRef = useRef<Map<string, string> | null>(null);
  if (!downloadUrlsRef.current) downloadUrlsRef.current = new Map();
  const markItemFailed = useCallback((item: DownloadQueueItem) => {
    setJobs((prev) =>
      prev.map((job) => {
        if (job.id !== item.jobId) return job;
        const newItems = job.items.map((i) => {
          if (i.id !== item.itemId) return i;
          if (i.retryCount < MAX_RETRY_ATTEMPTS) {
            downloadQueueRef.current.push(item);
            return { ...i, retryCount: i.retryCount + 1, status: "pending" as const };
          }
          return { ...i, status: "failed" as const };
        });
        return { ...job, items: newItems, failedCount: newItems.filter((i) => i.status === "failed").length };
      })
    );
  }, []);
  const downloadSingleItem = useCallback(async (item: DownloadQueueItem) => {
    setJobs((prev) => patchJobItem(prev, item.jobId, item.itemId, { status: "downloading", progress: 0 }));
    try {
      const result = await downloadFileAsBlob(item.playableUrl, (loaded, total) => {
        const progress = Math.round((loaded / total) * 100);
        setJobs((prev) => patchJobItem(prev, item.jobId, item.itemId, { progress }));
      });
      if (result) {
        const ext = getFileExtension(item.playableUrl, result.contentType);
        if (!zipDataRef.current!.has(item.jobId)) zipDataRef.current!.set(item.jobId, new Map());
        zipDataRef.current!.get(item.jobId)!.set(item.itemId, { blob: result.blob, ext });
        setJobs((prev) =>
          prev.map((job) => {
            if (job.id !== item.jobId) return job;
            const newItems = job.items.map((i) =>
              i.id === item.itemId ? { ...i, status: "completed" as const, progress: 100 } : i
            );
            return { ...job, items: newItems, completedCount: newItems.filter((i) => i.status === "completed").length };
          })
        );
      } else {
        markItemFailed(item);
      }
    } catch (error) {
      console.error("Download failed:", error);
      markItemFailed(item);
    }
    activeDownloadsRef.current--;
    processQueueRef.current();
  }, [markItemFailed]);
  const processQueue = useCallback(() => {
    while (activeDownloadsRef.current < CONCURRENT_DOWNLOADS && downloadQueueRef.current.length > 0) {
      const item = downloadQueueRef.current.shift();
      if (!item) break;
      activeDownloadsRef.current++;
      downloadSingleItem(item);
    }
  }, [downloadSingleItem]);
  processQueueRef.current = processQueue;
  useEffect(() => {
    const timeouts: ReturnType<typeof setTimeout>[] = [];
    const checkAndCreateZips = async () => {
      const readyJobs = jobs.filter((job) => {
        if (job.status !== "active" || creatingZipsRef.current!.has(job.id)) return false;
        return job.items.every((i) => i.status === "completed" || i.status === "failed") && !job.zipBlob && !job.isCreatingZip;
      });
      if (readyJobs.length === 0) return;
      const JSZip = (await import("jszip")).default;
      await Promise.all(
        readyJobs.map(async (job) => {
          const jobData = zipDataRef.current!.get(job.id);
          if (!jobData || jobData.size === 0) {
            setJobs((prev) => prev.map((j) => (j.id === job.id ? { ...j, status: "failed" as const } : j)));
            return;
          }
          creatingZipsRef.current!.add(job.id);
          setJobs((prev) => prev.map((j) => (j.id === job.id ? { ...j, isCreatingZip: true } : j)));
          try {
            // Split completed items into ≤900 MB chunks
            type ChunkEntry = { item: DownloadItem; fileData: { blob: Blob; ext: string } };
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
              setJobs((prev) => prev.map((j) => (j.id === job.id ? { ...j, status: "failed" as const, isCreatingZip: false } : j)));
              creatingZipsRef.current!.delete(job.id);
              return;
            }
            const baseName = job.eraName
              ? `${sanitizeFilename(job.artistName)} - ${sanitizeFilename(job.eraName)}`
              : `${sanitizeFilename(job.artistName)} Tracker`;
            let firstContent: Blob | undefined;
            // Generate each part sequentially to avoid holding multiple 900 MB blobs in memory simultaneously
            for (let i = 0; i < filled.length; i++) {
              const zip = new JSZip();
              for (const { item, fileData } of filled[i]) {
                zip.file(
                  `${sanitizeFilename(item.eraName)}/${sanitizeFilename(item.trackName)}.${fileData.ext}`,
                  fileData.blob
                );
              }
              const content = await zip.generateAsync({
                type: "blob",
                compression: "DEFLATE",
                compressionOptions: { level: 6 },
              });
              if (i === 0) firstContent = content;
              const zipName = filled.length > 1 ? `${baseName} Part ${i + 1}.zip` : `${baseName}.zip`;
              const downloadUrl = URL.createObjectURL(content);
              if (i === 0) downloadUrlsRef.current!.set(job.id, downloadUrl);
              // Stagger each part by 600 ms so the browser doesn't block simultaneous saves
              const t1 = setTimeout(() => {
                const link = document.createElement("a");
                link.href = downloadUrl;
                link.download = zipName;
                link.style.display = "none";
                document.body.appendChild(link);
                link.click();
                const t2 = setTimeout(() => document.body.removeChild(link), 100);
                timeouts.push(t2);
              }, i * 600);
              timeouts.push(t1);
            }
            setJobs((prev) =>
              prev.map((j) =>
                j.id === job.id
                  ? { ...j, status: "completed" as const, zipBlob: firstContent, isCreatingZip: false, downloadUrl: downloadUrlsRef.current!.get(job.id) }
                  : j
              )
            );
            zipDataRef.current!.delete(job.id);
            creatingZipsRef.current!.delete(job.id);
          } catch (error) {
            console.error("ZIP creation failed:", error);
            setJobs((prev) =>
              prev.map((j) => (j.id === job.id ? { ...j, status: "failed" as const, isCreatingZip: false } : j))
            );
            creatingZipsRef.current!.delete(job.id);
          }
        })
      );
    };
    checkAndCreateZips();
    return () => timeouts.forEach(clearTimeout);
  }, [jobs]);
  useEffect(() => {
    const ref = downloadUrlsRef;
    return () => {
      if (ref.current) {
        for (const url of ref.current.values()) URL.revokeObjectURL(url);
        ref.current.clear();
      }
    };
  }, [downloadUrlsRef]);
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
      const jobId = `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
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
          eraName: item.eraName,
        });
      }
      processQueue();
    },
    [processQueue]
  );
  const clearCompleted = useCallback(() => {
    const completedJobs = jobs.filter((j) => j.status === "completed" || j.status === "failed");
    for (const job of completedJobs) {
      const url = downloadUrlsRef.current!.get(job.id);
      if (url) {
        URL.revokeObjectURL(url);
        downloadUrlsRef.current!.delete(job.id);
      }
    }
    setJobs((prev) => prev.filter((j) => j.status === "active"));
  }, [jobs]);
  const dismissJob = useCallback((jobId: string) => {
    const url = downloadUrlsRef.current!.get(jobId);
    if (url) {
      URL.revokeObjectURL(url);
      downloadUrlsRef.current!.delete(jobId);
    }
    setJobs((prev) => prev.filter((j) => j.id !== jobId));
    zipDataRef.current!.delete(jobId);
    creatingZipsRef.current!.delete(jobId);
  }, []);
  return (
    <DownloadContext.Provider value={useMemo(() => ({ jobs, isMinimized, setIsMinimized, startDownload, clearCompleted, dismissJob }), [jobs, isMinimized, setIsMinimized, startDownload, clearCompleted, dismissJob])}>
      {children}
      <DownloadFloatingUI />
    </DownloadContext.Provider>
  );
}
