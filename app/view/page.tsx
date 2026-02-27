"use client";

import { useState, useEffect, useCallback, useMemo, Suspense, useRef, createContext, useContext } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { usePlayer } from "@/app/providers";
import { useToast } from "@/components/ui/use-toast";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuCheckboxItem, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Search, X, Play, Pause, Filter, Share2, ChevronDown, CircleSlash, ListPlus, MoreHorizontal, Download, ExternalLink, Loader2, Radio, Link as LinkIcon, AlertTriangle, Share, SkipForward, FolderDown, Archive, CheckCircle2, XCircle, Minimize2, Maximize2 } from "lucide-react";

export const API_BASE = "https://trackerapi-2.artistgrid.cx";
const API_FALLBACK = "https://tracker.thug.surf";

export async function fetchWithFallback(endpoint: string, options?: RequestInit): Promise<Response> {
  try {
    const res = await fetch(`${API_BASE}${endpoint}`, options);
    if (res.ok || res.type === 'opaqueredirect') return res;
    throw new Error('Primary failed');
  } catch {
    return fetch(`${API_FALLBACK}${endpoint}`, options);
  }
}
const KRAKENFILES_API = "https://info.artistgrid.cx/kf/?id=";
const IMGUR_API = "https://temp.imgur.gg/api/file/";
const QOBUZ_API = "https://qobuz.squid.wtf/api/download-music";
const TRACKER_ID_LENGTH = 44;
const CACHE_KEY_PREFIX = "artistgrid_tracker_";
const CACHE_EXPIRY = 1000 * 60 * 60 * 24;
const ART_TABS = ["Art"];
const NON_PLAYABLE_TABS = ["Art", "Tracklists", "Misc"];
const CONCURRENT_DOWNLOADS = 3;
const MAX_ZIP_SIZE = 500 * 1024 * 1024;
const MAX_RETRY_ATTEMPTS = 2;

const TIDAL_APIS = [
  { baseUrl: 'https://triton.squid.wtf' },
  { baseUrl: 'https://tidal.kinoplus.online' },
  { baseUrl: 'https://hund.qqdl.site' },
  { baseUrl: 'https://katze.qqdl.site' },
  { baseUrl: 'https://maus.qqdl.site' },
  { baseUrl: 'https://vogel.qqdl.site' },
  { baseUrl: 'https://wolf.qqdl.site' }
];

let tidalApiIndex = 0;

interface Track {
  id: string;
  name: string;
  extra: string;
  url: string;
  playableUrl: string | null;
  source: "pillows" | "froste" | "juicewrldapi" | "pixeldrain" | "krakenfiles" | "imgur" | "soundcloud" | "tidal" | "qobuz" | "yetracker" | "unknown";
  quality?: string;
  trackLength?: string;
  type?: string;
  description?: string;
  eraImage?: string;
  eraName?: string;
  artistName?: string;
}

export interface Era {
  name: string;
  extra?: string;
  timeline?: string;
  fileInfo?: string[];
  image?: string;
  textColor?: string;
  backgroundColor?: string;
  description?: string;
  data?: Record<string, TALeak[]>;
}

export interface TALeak {
  name: string;
  extra?: string;
  description?: string;
  track_length?: string;
  leak_date?: string;
  file_date?: string;
  type?: string;
  available_length?: string;
  quality?: string;
  url?: string;
  urls?: string[] | undefined;
}

export interface TrackerResponse {
  name: string | null | undefined;
  tabs: string[];
  current_tab: string;
  eras: Record<string, Era>;
}

interface FilterOptions {
  showPlayableOnly: boolean;
  qualityFilter: string;
}

interface CacheEntry {
  data: TrackerResponse;
  timestamp: number;
  resolvedUrls: Record<string, string | null>;
}

interface LastFMModalProps {
  isOpen: boolean;
  onClose: () => void;
  lastfm: {
    isAuthenticated: boolean;
    username: string | null;
    getAuthUrl: () => Promise<{ token: string; url: string }>;
    completeAuth: (token: string) => Promise<{ success: boolean; username: string }>;
    disconnect: () => void;
  };
  token: string | null;
  setToken: (t: string | null) => void;
}

interface PlayableTrackData {
  track: TALeak;
  era: Era;
  url: string;
  playableUrl: string;
}

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
    items: Array<{ track: TALeak; era: Era; playableUrl: string }>;
  }) => void;
  clearCompleted: () => void;
  dismissJob: (jobId: string) => void;
}

const DownloadContext = createContext<DownloadContextType | null>(null);

export function useDownloadManager() {
  const ctx = useContext(DownloadContext);
  if (!ctx) throw new Error("useDownloadManager must be used within DownloadProvider");
  return ctx;
}

function sanitizeFilename(name: string): string {
  return name.replace(/[<>:"/\\|?*]/g, "_").replace(/\s+/g, " ").trim() || "unknown";
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

async function downloadFileAsBlob(url: string, onProgress?: (loaded: number, total: number) => void): Promise<{ blob: Blob; contentType: string } | null> {
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

      if (onProgress && total) {
        onProgress(loaded, total);
      }
    }

    const blob = new Blob(chunks);
    const contentType = response.headers.get("content-type") || "";
    return { blob, contentType };
  } catch (error) {
    console.error("Download error:", error);
    return null;
  }
}

export function DownloadProvider({ children }: { children: React.ReactNode }) {
  const [jobs, setJobs] = useState<DownloadJob[]>([]);
  const [isMinimized, setIsMinimized] = useState(false);
  const activeDownloadsRef = useRef(0);
  const downloadQueueRef = useRef<DownloadQueueItem[]>([]);
  const zipDataRef = useRef<Map<string, Map<string, { blob: Blob; ext: string }>>>(new Map());
  const processQueueRef = useRef<() => void>(() => {});
  const creatingZipsRef = useRef<Set<string>>(new Set());
  const downloadUrlsRef = useRef<Map<string, string>>(new Map());

  const downloadSingleItem = useCallback(async (item: DownloadQueueItem) => {
    setJobs(prev => prev.map(job => {
      if (job.id !== item.jobId) return job;
      return {
        ...job,
        items: job.items.map(i => i.id === item.itemId ? { ...i, status: "downloading" as const, progress: 0 } : i)
      };
    }));

    try {
      const result = await downloadFileAsBlob(item.playableUrl, (loaded, total) => {
        const progress = Math.round((loaded / total) * 100);
        setJobs(prev => prev.map(job => {
          if (job.id !== item.jobId) return job;
          return {
            ...job,
            items: job.items.map(i => i.id === item.itemId ? { ...i, progress } : i)
          };
        }));
      });

      if (result) {
        const ext = getFileExtension(item.playableUrl, result.contentType);
        if (!zipDataRef.current.has(item.jobId)) {
          zipDataRef.current.set(item.jobId, new Map());
        }
        zipDataRef.current.get(item.jobId)!.set(item.itemId, { blob: result.blob, ext });

        setJobs(prev => prev.map(job => {
          if (job.id !== item.jobId) return job;
          const newItems = job.items.map(i => i.id === item.itemId ? { ...i, status: "completed" as const, progress: 100 } : i);
          const newCompletedCount = newItems.filter(i => i.status === "completed").length;
          return { ...job, items: newItems, completedCount: newCompletedCount };
        }));
      } else {
        setJobs(prev => prev.map(job => {
          if (job.id !== item.jobId) return job;
          const newItems = job.items.map(i => {
            if (i.id === item.itemId) {
              if (i.retryCount < MAX_RETRY_ATTEMPTS) {
                downloadQueueRef.current.push(item);
                return { ...i, retryCount: i.retryCount + 1, status: "pending" as const };
              }
              return { ...i, status: "failed" as const };
            }
            return i;
          });
          const newFailedCount = newItems.filter(i => i.status === "failed").length;
          return { ...job, items: newItems, failedCount: newFailedCount };
        }));
      }
    } catch (error) {
      console.error("Download failed:", error);
      setJobs(prev => prev.map(job => {
        if (job.id !== item.jobId) return job;
        const newItems = job.items.map(i => {
          if (i.id === item.itemId) {
            if (i.retryCount < MAX_RETRY_ATTEMPTS) {
              downloadQueueRef.current.push(item);
              return { ...i, retryCount: i.retryCount + 1, status: "pending" as const };
            }
            return { ...i, status: "failed" as const };
          }
          return i;
        });
        const newFailedCount = newItems.filter(i => i.status === "failed").length;
        return { ...job, items: newItems, failedCount: newFailedCount };
      }));
    }

    activeDownloadsRef.current--;
    processQueueRef.current();
  }, []);

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
    const checkAndCreateZips = async () => {
      for (const job of jobs) {
        if (job.status === "active" && !creatingZipsRef.current.has(job.id)) {
          const allDone = job.items.every(i => i.status === "completed" || i.status === "failed");
          if (allDone && !job.zipBlob && !job.isCreatingZip) {
            const jobData = zipDataRef.current.get(job.id);
            if (jobData && jobData.size > 0) {
              creatingZipsRef.current.add(job.id);
              setJobs(prev => prev.map(j => j.id === job.id ? { ...j, isCreatingZip: true } : j));

              try {
                const JSZip = (await import("jszip")).default;
                const zip = new JSZip();
                let totalSize = 0;

                for (const item of job.items) {
                  if (item.status === "completed") {
                    const fileData = jobData.get(item.id);
                    if (fileData) {
                      totalSize += fileData.blob.size;
                      if (totalSize > MAX_ZIP_SIZE) {
                        throw new Error("ZIP size exceeds maximum limit");
                      }
                      const folderPath = sanitizeFilename(item.eraName);
                      const fileName = `${sanitizeFilename(item.trackName)}.${fileData.ext}`;
                      zip.file(`${folderPath}/${fileName}`, fileData.blob);
                    }
                  }
                }

                const content = await zip.generateAsync({
                  type: "blob",
                  compression: "DEFLATE",
                  compressionOptions: { level: 6 }
                });

                const zipName = job.eraName
                  ? `${sanitizeFilename(job.artistName)} - ${sanitizeFilename(job.eraName)}.zip`
                  : `${sanitizeFilename(job.artistName)} Tracker.zip`;

                const downloadUrl = URL.createObjectURL(content);
                downloadUrlsRef.current.set(job.id, downloadUrl);

                setJobs(prev => prev.map(j => j.id === job.id ? {
                  ...j,
                  status: "completed" as const,
                  zipBlob: content,
                  isCreatingZip: false,
                  downloadUrl
                } : j));

                const link = document.createElement("a");
                link.href = downloadUrl;
                link.download = zipName;
                link.style.display = "none";
                document.body.appendChild(link);

                setTimeout(() => {
                  link.click();
                  setTimeout(() => {
                    document.body.removeChild(link);
                  }, 100);
                }, 100);

                zipDataRef.current.delete(job.id);
                creatingZipsRef.current.delete(job.id);
              } catch (error) {
                console.error("ZIP creation failed:", error);
                setJobs(prev => prev.map(j => j.id === job.id ? {
                  ...j,
                  status: "failed" as const,
                  isCreatingZip: false
                } : j));
                creatingZipsRef.current.delete(job.id);
              }
            } else {
              setJobs(prev => prev.map(j => j.id === job.id ? { ...j, status: "failed" as const } : j));
            }
          }
        }
      }
    };

    checkAndCreateZips();
  }, [jobs]);

  useEffect(() => {
    return () => {
      for (const url of downloadUrlsRef.current.values()) {
        URL.revokeObjectURL(url);
      }
      downloadUrlsRef.current.clear();
    };
  }, []);

  const startDownload = useCallback((params: {
    artistName: string;
    eraName?: string;
    items: Array<{ track: TALeak; era: Era; playableUrl: string }>;
  }) => {
    const jobId = `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const downloadItems: DownloadItem[] = params.items.map((item, idx) => ({
      id: `${jobId}_item_${idx}`,
      trackName: item.track.name || "Unknown",
      eraName: item.era.name || "Unknown Era",
      playableUrl: item.playableUrl,
      status: "pending" as const,
      progress: 0,
      retryCount: 0
    }));

    const newJob: DownloadJob = {
      id: jobId,
      name: params.eraName ? `${params.artistName} - ${params.eraName}` : `${params.artistName} Tracker`,
      artistName: params.artistName,
      eraName: params.eraName,
      items: downloadItems,
      status: "active",
      completedCount: 0,
      failedCount: 0
    };

    setJobs(prev => [...prev, newJob]);

    for (const item of downloadItems) {
      downloadQueueRef.current.push({
        jobId,
        itemId: item.id,
        playableUrl: item.playableUrl,
        trackName: item.trackName,
        eraName: item.eraName
      });
    }

    processQueue();
  }, [processQueue]);

  const clearCompleted = useCallback(() => {
    const completedJobs = jobs.filter(j => j.status === "completed" || j.status === "failed");
    for (const job of completedJobs) {
      const url = downloadUrlsRef.current.get(job.id);
      if (url) {
        URL.revokeObjectURL(url);
        downloadUrlsRef.current.delete(job.id);
      }
    }
    setJobs(prev => prev.filter(j => j.status === "active"));
  }, [jobs]);

  const dismissJob = useCallback((jobId: string) => {
    const url = downloadUrlsRef.current.get(jobId);
    if (url) {
      URL.revokeObjectURL(url);
      downloadUrlsRef.current.delete(jobId);
    }
    setJobs(prev => prev.filter(j => j.id !== jobId));
    zipDataRef.current.delete(jobId);
    creatingZipsRef.current.delete(jobId);
  }, []);

  return (
    <DownloadContext.Provider value={{ jobs, isMinimized, setIsMinimized, startDownload, clearCompleted, dismissJob }}>
      {children}
      <DownloadFloatingUI />
    </DownloadContext.Provider>
  );
}

function DownloadFloatingUI() {
  const { jobs, isMinimized, setIsMinimized, clearCompleted, dismissJob } = useDownloadManager();

  const activeJobs = jobs.filter(j => j.status === "active");
  const completedJobs = jobs.filter(j => j.status === "completed" || j.status === "failed");

  if (jobs.length === 0) return null;

  const totalItems = jobs.reduce((acc, j) => acc + j.items.length, 0);
  const completedItems = jobs.reduce((acc, j) => acc + j.completedCount + j.failedCount, 0);
  const overallProgress = totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0;

  const activeCount = activeJobs.reduce((acc, j) => acc + j.items.filter(i => i.status === "downloading").length, 0);

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
            <Button variant="ghost" size="icon" onClick={clearCompleted} className="h-6 w-6 text-neutral-500 hover:text-white">
              <X className="w-3 h-3" />
            </Button>
          )}
          <Button variant="ghost" size="icon" onClick={() => setIsMinimized(!isMinimized)} className="h-6 w-6 text-neutral-500 hover:text-white">
            {isMinimized ? <Maximize2 className="w-3 h-3" /> : <Minimize2 className="w-3 h-3" />}
          </Button>
        </div>
      </div>

      {!isMinimized && (
        <div className="max-h-72 overflow-y-auto">
          {jobs.map(job => {
            const jobProgress = job.items.length > 0 ? Math.round(((job.completedCount + job.failedCount) / job.items.length) * 100) : 0;
            const isActive = job.status === "active";
            const downloadingItems = job.items.filter(i => i.status === "downloading");

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
                    <Button variant="ghost" size="icon" onClick={() => dismissJob(job.id)} className="h-5 w-5 text-neutral-500 hover:text-white flex-shrink-0">
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
                    {downloadingItems.slice(0, 5).map(item => (
                      <div key={item.id} className="text-[10px] text-neutral-400 truncate flex items-center gap-1">
                        <Loader2 className="w-2 h-2 animate-spin flex-shrink-0" />
                        <span className="flex-1 truncate">{item.trackName}</span>
                        {item.progress > 0 && <span className="text-neutral-600">{item.progress}%</span>}
                      </div>
                    ))}
                    {downloadingItems.length > 5 && (
                      <div className="text-[10px] text-neutral-500">
                        +{downloadingItems.length - 5} more...
                      </div>
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
          <p className="text-[10px] text-neutral-500 mt-1 text-center">{completedItems}/{totalItems} ({overallProgress}%)</p>
        </div>
      )}
    </div>
  );
}

function getCache(trackerId: string, tab?: string): CacheEntry | null {
  if (typeof window === "undefined") return null;
  try {
    const key = tab ? `${CACHE_KEY_PREFIX}${trackerId}_${tab}` : `${CACHE_KEY_PREFIX}${trackerId}`;
    const cached = localStorage.getItem(key);
    if (!cached) return null;
    const entry: CacheEntry = JSON.parse(cached);
    if (Date.now() - entry.timestamp > CACHE_EXPIRY) {
      localStorage.removeItem(key);
      return null;
    }
    return entry;
  } catch {
    return null;
  }
}

function setCache(trackerId: string, data: TrackerResponse, resolvedUrls: Record<string, string | null>, tab?: string) {
  if (typeof window === "undefined") return;
  try {
    const key = tab ? `${CACHE_KEY_PREFIX}${trackerId}_${tab}` : `${CACHE_KEY_PREFIX}${trackerId}`;
    const entry: CacheEntry = { data, timestamp: Date.now(), resolvedUrls };
    localStorage.setItem(key, JSON.stringify(entry));
  } catch {}
}

function generateTrackId(url: string): string {
  let hash = 0;
  for (let i = 0; i < url.length; i++) {
    hash = ((hash << 5) - hash) + url.charCodeAt(i);
    hash = hash & hash;
  }
  return "tk" + Math.abs(hash).toString(36);
}

function isUrl(str: string | null | undefined): boolean {
  if (!str || typeof str !== "string") return false;
  return str.startsWith("http://") || str.startsWith("https://");
}

function normalizePillowsUrl(url: string): string {
  return url.replace(/pillowcase\.su/g, "pillows.su");
}

function extractKrakenId(url: string): string | null {
  const match = url.match(/krakenfiles\.com\/view\/([a-zA-Z0-9]+)/);
  return match ? match[1] : null;
}

function extractImgurId(url: string): string | null {
  let match = url.match(/\/f\/([a-zA-Z0-9]+)/);
  if (match) return match[1];
  match = url.match(/\/([a-zA-Z0-9]+)(?:\?|$)/);
  return match ? match[1] : null;
}

function extractSoundcloudPath(url: string): string | null {
  const match = url.match(/soundcloud\.com\/([^/]+\/[^/?#]+)/);
  return match ? match[1] : null;
}

function extractTidalId(url: string): string | null {
  const match = url.match(/tidal\.com\/(?:browse\/)?track\/(\d+)/);
  return match ? match[1] : null;
}

function extractQobuzId(url: string): string | null {
  const match = url.match(/(?:open\.)?qobuz\.com\/track\/(\d+)/);
  return match ? match[1] : null;
}

function selectTidalApi(): string {
  const api = TIDAL_APIS[tidalApiIndex];
  tidalApiIndex = (tidalApiIndex + 1) % TIDAL_APIS.length;
  return api.baseUrl;
}

function getTrackSource(url: string): Track["source"] {
  const normalized = normalizePillowsUrl(url);
  if (/https?:\/\/pillows\.su\/f\//.test(normalized)) return "pillows";
  if (/https?:\/\/music\.froste\.lol\/song\//.test(normalized)) return "froste";
  if (/https?:\/\/krakenfiles\.com\/view\//.test(normalized)) return "krakenfiles";
  if (/https?:\/\/pixeldrain.com\/d\//.test(normalized)) return "pixeldrain";
  if (/https?:\/\/juicewrldapi\.com\/juicewrld/.test(normalized)) return "juicewrldapi";
  if (/https?:\/\/.*imgur\.gg/.test(normalized)) return "imgur";
  if (/https?:\/\/files\.yetracker\.org\/f\//.test(normalized)) return "yetracker";
  if (/https?:\/\/(www\.)?soundcloud\.com\//.test(normalized)) return "soundcloud";
  if (/https?:\/\/tidal\.com\//.test(normalized)) return "tidal";
  if (/https?:\/\/(open\.)?qobuz\.com\/track\//.test(normalized)) return "qobuz";
  return "unknown";
}

async function resolvePlayableUrl(url: string): Promise<string | null> {
  const normalized = normalizePillowsUrl(url);
  const source = getTrackSource(normalized);
  console.log(`[resolvePlayableUrl] Input: ${url}, Normalized: ${normalized}, Source: ${source}`);

  try {
    switch (source) {
      case "pillows": {
        const match = normalized.match(/pillows\.su\/f\/([a-f0-9]+)/);
        console.log(`[resolvePlayableUrl] pillows match: ${match?.[1]}`);
        return match ? `https://api.pillows.su/api/download/${match[1]}` : null;
      }
      case "pixeldrain": {
        const match = normalized.match(/pixeldrain\.com\/d\/([a-zA-Z0-9]+)/);
        console.log(`[resolvePlayableUrl] pixeldrain match: ${match?.[1]}`);
        return match ? `https://tracker.thug.surf/goy/dl/${match[1]}` : null;
      }
      case "froste": {
        const match = normalized.match(/music\.froste\.lol\/song\/([a-f0-9]+)/);
        console.log(`[resolvePlayableUrl] froste match: ${match?.[1]}`);
        return match ? `https://music.froste.lol/song/${match[1]}/download` : null;
      }
      case "krakenfiles": {
        const id = extractKrakenId(normalized);
        console.log(`[resolvePlayableUrl] krakenfiles id: ${id}`);
        if (!id) return null;
        const res = await fetch(`${KRAKENFILES_API}${id}`);
        const data = await res.json();
        return data.success ? data.m4a : null;
      }
      case "imgur": {
        const id = extractImgurId(normalized);
        console.log(`[resolvePlayableUrl] imgur id: ${id}, API: ${IMGUR_API}${id}`);
        if (!id) return null;
        const res = await fetch(`${IMGUR_API}${id}`);
        console.log(`[resolvePlayableUrl] imgur response status: ${res.status}`);
        if (!res.ok) return null;
        const data = await res.json();
        console.log(`[resolvePlayableUrl] imgur data:`, data);
        return data.cdnUrl || null;
      }
      case "yetracker": {
        const match = normalized.match(/files\.yetracker\.org\/f\/([a-zA-Z0-9]+)/);
        console.log(`[resolvePlayableUrl] yetracker id: ${match?.[1]}`);
        return match ? `https://files.yetracker.org/raw/${match[1]}` : null;
      }
      case "soundcloud": {
        const path = extractSoundcloudPath(normalized);
        return path ? `https://sc.maid.zone/_/restream/${path}` : null;
      }
      case "tidal": {
        const id = extractTidalId(normalized);
        if (!id) return null;
        const apiBase = selectTidalApi();
        const res = await fetch(`${apiBase}/track/?id=${id}&quality=HI_RES_LOSSLESS`, {
          signal: AbortSignal.timeout(10000)
        });
        if (!res.ok) return null;
        const data = await res.json();
        if (data?.data?.manifest) {
          const manifestJson = JSON.parse(atob(data.data.manifest));
          if (manifestJson?.urls?.[0]) {
            return manifestJson.urls[0];
          }
        }
        return null;
      }
      case "qobuz": {
        const id = extractQobuzId(normalized);
        if (!id) return null;
        const res = await fetch(`${QOBUZ_API}?track_id=${id}&quality=27`);
        if (!res.ok) return null;
        const data = await res.json();
        return data?.data?.url || null;
      }
      case "yetracker": {
        const match = normalized.match(/files\.yetracker\.org\/f\/([a-zA-Z0-9]+)/);
        return match ? `https://files.yetracker.org/raw/${match[1]}` : null;
      }
      case "juicewrldapi":
        return url;
      default:
        return null;
    }
  } catch (error) {
    console.error(`Error resolving ${source} URL:`, error);
    return null;
  }
}

function getTrackUrl(track: TALeak): string | null {
  if (track.url && isUrl(track.url)) return normalizePillowsUrl(track.url);
  if (track.quality && isUrl(track.quality)) return normalizePillowsUrl(track.quality);
  if (track.available_length && isUrl(track.available_length)) return normalizePillowsUrl(track.available_length);
  return null;
}

function getTrackDescription(track: TALeak): string | null {
  return (track as any).description || (track as any).notes || (track as any).info || null;
}

function isValidTrackerId(id: string): boolean {
  if (!id || typeof id !== "string") return false;
  return id.trim().length === TRACKER_ID_LENGTH && /^[a-zA-Z0-9_-]+$/.test(id.trim());
}

function encodeTrackForUrl(url: string): string {
  return btoa(url).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function decodeTrackFromUrl(encoded: string): string | null {
  try {
    const base64 = encoded.replace(/-/g, "+").replace(/_/g, "/");
    const padding = (4 - (base64.length % 4)) % 4;
    return atob(base64 + "=".repeat(padding));
  } catch {
    return null;
  }
}

function transformUrlForOpening(url: string): string {
  if (url.includes("soundcloud.com/")) {
    const path = extractSoundcloudPath(url);
    if (path) {
      return `https://sc.maid.zone/${path}`;
    }
  }
  return url;
}

function getGoogleSheetsUrl(trackerId: string): string {
  return `https://docs.google.com/spreadsheets/d/${trackerId}/htmlview`;
}

function getSourceDisplayName(source: Track["source"]): string {
  const names: Record<Track["source"], string> = {
    pillows: "Pillows",
    froste: "Froste",
    krakenfiles: "KrakenFiles",
    juicewrldapi: "JuiceWrldAPI",
    imgur: "Imgur",
    pixeldrain: "Pixeldrain",
    soundcloud: "SoundCloud",
    tidal: "Tidal",
    qobuz: "Qobuz",
    yetracker: "YeTracker",
    unknown: "Unknown"
  };
  return names[source];
}

const Modal = ({ isOpen, onClose, children, ariaLabel }: { isOpen: boolean; onClose: () => void; children: React.ReactNode; ariaLabel: string }) => {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4" onClick={onClose} role="dialog" aria-modal="true" aria-label={ariaLabel}>
      <div className="bg-neutral-950 border border-neutral-800 shadow-2xl rounded-xl w-full max-w-md relative animate-in fade-in-0 zoom-in-95" onClick={(e) => e.stopPropagation()}>
        <Button variant="ghost" size="icon" onClick={onClose} className="absolute top-3 right-3 text-neutral-500 hover:text-white h-8 w-8 rounded-lg z-10">
          <X className="w-5 h-5" />
        </Button>
        {children}
      </div>
    </div>
  );
};

const LastFMModal = ({ isOpen, onClose, lastfm, token, setToken }: LastFMModalProps) => {
  const [isLoading, setIsLoading] = useState(false);

  const handleConnect = async () => {
    setIsLoading(true);
    try {
      const { token: newToken, url } = await lastfm.getAuthUrl();
      setToken(newToken);
      window.open(url, "_blank", "noopener,noreferrer,width=800,height=600");
    } catch {} finally {
      setIsLoading(false);
    }
  };

  const handleComplete = async () => {
    if (!token) return;
    setIsLoading(true);
    try {
      await lastfm.completeAuth(token);
      setToken(null);
      onClose();
    } catch {} finally {
      setIsLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} ariaLabel="Last.fm Connection">
      <div className="p-6 pt-12 text-center">
        <Radio className="w-12 h-12 mx-auto mb-4 text-neutral-400" />
        <h2 className="text-xl font-bold text-white mb-2">Last.fm Scrobbling</h2>
        {lastfm.isAuthenticated ? (
          <div className="space-y-4">
            <p className="text-neutral-300">Connected as <span className="font-semibold text-white">{lastfm.username}</span></p>
            <Button variant="outline" onClick={() => { lastfm.disconnect(); onClose(); }} className="text-red-400 border-red-400/30 hover:bg-red-400/10">Disconnect</Button>
          </div>
        ) : token ? (
          <div className="space-y-4">
            <p className="text-neutral-400">Authorize in the popup window, then click below to complete</p>
            <Button onClick={handleComplete} disabled={isLoading} className="bg-white text-black hover:bg-neutral-200">{isLoading ? "Connecting..." : "Complete Connection"}</Button>
            <Button variant="ghost" onClick={() => setToken(null)} className="text-neutral-500 hover:text-white">Cancel</Button>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-neutral-400">Connect your Last.fm account to scrobble tracks while listening</p>
            <Button onClick={handleConnect} disabled={isLoading} className="bg-white text-black hover:bg-neutral-200">{isLoading ? "Loading..." : "Connect Last.fm"}</Button>
          </div>
        )}
      </div>
    </Modal>
  );
};

const ImageLightbox = ({ src, alt, originalUrl, onClose }: { src: string; alt: string; originalUrl: string; onClose: () => void }) => {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="relative max-w-4xl max-h-[90vh] w-full h-full flex items-center justify-center" onClick={(e) => e.stopPropagation()}>
        <img src={src} alt={alt} className="max-w-full max-h-full object-contain rounded-lg cursor-pointer hover:opacity-90 transition-opacity" onClick={() => window.open(originalUrl, "_blank", "noopener,noreferrer")} title="Click to open original" />
        <Button variant="ghost" size="icon" onClick={onClose} className="absolute top-4 right-4 text-white hover:bg-white/10"><X className="w-6 h-6" /></Button>
        <p className="absolute bottom-4 left-1/2 -translate-x-1/2 text-sm text-neutral-400">Click image to open original link</p>
      </div>
    </div>
  );
};

const ArtGallery = ({ eras, onImageClick }: { eras: Record<string, Era>; onImageClick: (url: string, name: string) => void }) => {
  const [expandedEras, setExpandedEras] = useState<Set<string>>(new Set([Object.keys(eras)[0] || ""]));

  const toggleEra = (eraKey: string) => {
    setExpandedEras((prev) => {
      const next = new Set(prev);
      if (next.has(eraKey)) next.delete(eraKey);
      else next.add(eraKey);
      return next;
    });
  };

  const getImageUrl = (url: string): string | null => {
    if (url.includes("ibb.co")) {
      const match = url.match(/ibb\.co\/([a-zA-Z0-9]+)/);
      if (match) return `https://i.ibb.co/${match[1]}/image.jpg`;
    }
    if (url.includes("imgur.com") || url.includes("i.imgur.com")) {
      const match = url.match(/imgur\.com\/([a-zA-Z0-9]+)/);
      if (match) return `https://i.imgur.com/${match[1]}.jpg`;
    }
    if (url.match(/\.(jpg|jpeg|png|gif|webp)$/i)) return url;
    return null;
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      {Object.entries(eras).map(([key, era]) => (
        <div key={key} className="bg-neutral-950 border border-neutral-800 rounded-xl overflow-hidden">
          <button className="w-full flex items-center gap-3 sm:gap-4 p-4 sm:p-5 text-left hover:bg-white/[0.02] transition-colors" onClick={() => toggleEra(key)}>
            {era.image ? <img src={era.image} alt={era.name} className="w-12 h-12 sm:w-16 sm:h-16 rounded-xl object-cover bg-neutral-800 flex-shrink-0" /> : <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-xl bg-neutral-800 flex-shrink-0" />}
            <div className="flex-1 min-w-0">
              <h3 className="text-base sm:text-lg font-bold text-white truncate">{era.name || key}</h3>
              {era.extra && <p className="text-xs sm:text-sm text-neutral-500 truncate">{era.extra}</p>}
            </div>
            <ChevronDown className={`w-5 h-5 text-neutral-500 transition-transform flex-shrink-0 ${expandedEras.has(key) ? "rotate-180" : ""}`} />
          </button>
          {expandedEras.has(key) && era.data && (
            <div className="px-4 pb-4 sm:px-5 sm:pb-5">
              {Object.entries(era.data).map(([cat, items]) => (
                <div key={cat} className="mb-4 sm:mb-6 last:mb-0">
                  {cat !== "Default" && <h4 className="text-xs sm:text-sm font-semibold text-neutral-300 pb-2 sm:pb-3 mb-2 sm:mb-3 border-b border-neutral-800">{cat}</h4>}
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 sm:gap-4">
                    {(items as TALeak[]).map((item, i) => {
                      const url = item.url || (item.urls && item.urls[0]);
                      const imageUrl = url ? getImageUrl(url) : null;
                      return (
                        <div key={i} className="group cursor-pointer rounded-lg sm:rounded-xl overflow-hidden bg-neutral-900 border border-neutral-800 hover:border-neutral-600 transition-all" onClick={() => url && onImageClick(url, item.name)}>
                          <div className="aspect-square relative bg-neutral-800">
                            {imageUrl ? <img src={imageUrl} alt={item.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform" /> : <div className="w-full h-full flex items-center justify-center text-neutral-600"><LinkIcon className="w-6 h-6 sm:w-8 sm:h-8" /></div>}
                          </div>
                          <div className="p-2 sm:p-3">
                            <p className="text-xs sm:text-sm font-medium text-white truncate">{item.name}</p>
                            {item.description && <p className="text-xs text-neutral-500 truncate mt-0.5 sm:mt-1 hidden sm:block">{item.description}</p>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
};

const FallbackView = ({ trackerId, sheetsUrl }: { trackerId: string; sheetsUrl: string }) => {
  return (
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
            <strong className="text-neutral-400">Disclaimer:</strong> ArtistGrid is not affiliated with, endorsed by, or associated with Google, TrackerHub, or any artists whose content may appear in these trackers. We do not host, store, or distribute any copyrighted content.
          </p>
        </div>
        <div className="mt-4 sm:mt-6">
          <Link href="/" className="text-sm text-neutral-500 hover:text-white transition-colors">
            ← Back to Home
          </Link>
        </div>
      </div>
    </div>
  );
};

function TrackerViewContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { toast } = useToast();
  const { state: playerState, playTrack, addToQueue, clearQueue, togglePlayPause, lastfm } = usePlayer();
  const downloadManager = useDownloadManager();
  const [trackerId, setTrackerId] = useState(searchParams.get("id") || "");
  const [inputValue, setInputValue] = useState(searchParams.get("id") || "");
  const [artistNameFromUrl, setArtistNameFromUrl] = useState<string | null>(searchParams.get("artist"));
  const [data, setData] = useState<TrackerResponse | null>(null);
  const [baseEraImages, setBaseEraImages] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error" | "fallback">("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedEras, setExpandedEras] = useState<Set<string>>(new Set());
  const [filters, setFilters] = useState<FilterOptions>({ showPlayableOnly: false, qualityFilter: "all" });
  const [resolvedUrls, setResolvedUrls] = useState<Map<string, string | null>>(new Map());
  const [resolveProgress, setResolveProgress] = useState({ current: 0, total: 0 });
  const [isPreloading, setIsPreloading] = useState(false);
  const [currentTab, setCurrentTab] = useState<string>("");
  const [lastfmModalOpen, setLastfmModalOpen] = useState(false);
  const [lastfmToken, setLastfmToken] = useState<string | null>(null);
  const [lightboxImage, setLightboxImage] = useState<{ src: string; alt: string; originalUrl: string } | null>(null);
  const [highlightedTrackUrl, setHighlightedTrackUrl] = useState<string | null>(null);
  const highlightedTrackRef = useRef<HTMLDivElement | null>(null);
  const pendingTrackUrlRef = useRef<string | null>(null);

  const artistDisplayName = useMemo(() => artistNameFromUrl || "Unknown Artist", [artistNameFromUrl]);

  const getEraImage = useCallback((era: Era): string | undefined => {
    if (era.image) return era.image;
    const eraName = era.name;
    if (eraName && baseEraImages[eraName]) return baseEraImages[eraName];
    return undefined;
  }, [baseEraImages]);

  const erasWithImages = useMemo(() => {
    if (!data?.eras) return null;
    const result: Record<string, Era> = {};
    for (const [key, era] of Object.entries(data.eras)) {
      result[key] = { ...era, image: getEraImage(era) };
    }
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
          const supportedSources = ["pillows", "froste", "krakenfiles", "pixeldrain", "imgur", "yetracker", "soundcloud", "tidal", "qobuz"];
          const isSupported = supportedSources.includes(source);
          if (filters.showPlayableOnly && !resolvedUrls.get(url) && !isSupported) return false;
          if (filters.qualityFilter !== "all" && !(t.quality?.toLowerCase() || "").includes(filters.qualityFilter.toLowerCase())) return false;
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

  const createTrackObject = useCallback((rawTrack: TALeak, era: Era, url: string, playableUrl: string): Track => ({
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
  }), [artistDisplayName, getEraImage]);

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
              if (playableUrl) {
                playTrack(createTrackObject(track, era, url, playableUrl));
              }
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

  const preloadAllUrls = async (eras: Record<string, Era>, id: string, tab: string | undefined, trackerData: TrackerResponse) => {
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

  const loadTrackerData = useCallback(async (id: string, tab?: string) => {
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
  }, [fetchBaseEraImages]);

  useEffect(() => {
    if (!trackerId || !isValidTrackerId(trackerId)) return;
    loadTrackerData(trackerId);
  }, [trackerId, loadTrackerData]);

  const handleLoad = useCallback(() => {
    if (!isValidTrackerId(inputValue)) {
      toast({ title: "Invalid ID", description: `Tracker ID must be ${TRACKER_ID_LENGTH} characters` });
      return;
    }
    router.push(`/view?id=${inputValue}`);
  }, [inputValue, router, toast]);

  const handleShare = useCallback(() => {
    let url = `${window.location.origin}/view?id=${trackerId}`;
    if (artistNameFromUrl) url += `&artist=${encodeURIComponent(artistNameFromUrl)}`;
    navigator.clipboard.writeText(url);
    toast({ title: "Copied!", description: "Share link copied to clipboard" });
  }, [trackerId, artistNameFromUrl, toast]);

  const handleShareTrack = useCallback((trackUrl: string, trackName: string) => {
    const encodedTrack = encodeTrackForUrl(trackUrl);
    let shareUrl = `${window.location.origin}/view?id=${trackerId}&track=${encodedTrack}`;
    if (artistNameFromUrl) shareUrl += `&artist=${encodeURIComponent(artistNameFromUrl)}`;
    if (currentTab && currentTab !== data?.tabs?.[0]) shareUrl += `&tab=${encodeURIComponent(currentTab)}`;
    navigator.clipboard.writeText(shareUrl);
    toast({ title: "Track link copied!", description: `Share link for "${trackName}" copied to clipboard` });
  }, [trackerId, artistNameFromUrl, currentTab, data?.tabs, toast]);

  const handleTabChange = useCallback((tab: string) => {
    if (!trackerId || tab === currentTab) return;
    setResolvedUrls(new Map());
    setHighlightedTrackUrl(null);
    loadTrackerData(trackerId, tab);
  }, [trackerId, currentTab, loadTrackerData]);

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

  const handlePlayTrack = useCallback(async (rawTrack: TALeak, era: Era) => {
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
    const currentIdx = allPlayableTracks.findIndex(t => t.url === url);
    if (currentIdx !== -1) {
      const remainingTracks = allPlayableTracks.slice(currentIdx + 1);
      for (const t of remainingTracks) {
        addToQueue(createTrackObject(t.track, t.era, t.url, t.playableUrl));
      }
    }
  }, [playTrack, playerState.currentTrack, togglePlayPause, handleOpenUrl, allPlayableTracks, addToQueue, clearQueue, createTrackObject]);

  const handlePlayNext = useCallback(async (rawTrack: TALeak, era: Era) => {
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
  }, [addToQueue, toast, createTrackObject]);

  const handleAddToQueue = useCallback(async (rawTrack: TALeak, era: Era) => {
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
  }, [addToQueue, toast, createTrackObject]);

  const handleDownload = useCallback(async (rawTrack: TALeak) => {
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
  }, [resolvedUrls, toast]);

  const handleOpenOriginal = useCallback((rawTrack: TALeak) => {
    const url = getTrackUrl(rawTrack);
    if (url) handleOpenUrl(url);
  }, [handleOpenUrl]);

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

  const downloadTracker = useCallback((eraKey?: string) => {
    if (!data?.eras) return;
    const erasToDownload = eraKey ? { [eraKey]: data.eras[eraKey] } : data.eras;
    const downloadItems: Array<{ track: TALeak; era: Era; playableUrl: string }> = [];
    for (const era of Object.values(erasToDownload)) {
      if (!era.data) continue;
      for (const tracks of Object.values(era.data)) {
        if (!Array.isArray(tracks)) continue;
        for (const track of tracks) {
          const url = getTrackUrl(track);
          const playableUrl = url ? resolvedUrls.get(url) : null;
          if (url && playableUrl) {
            downloadItems.push({ track, era, playableUrl });
          }
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
      items: downloadItems
    });
    toast({ title: "Download started", description: `Downloading ${downloadItems.length} tracks in background` });
  }, [data, resolvedUrls, artistDisplayName, downloadManager, toast]);

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
    let total = 0, playable = 0;
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

  if (status === "fallback") {
    return <FallbackView trackerId={trackerId} sheetsUrl={getGoogleSheetsUrl(trackerId)} />;
  }

  return (
    <div className="min-h-screen bg-black pb-32 sm:pb-24">
      <header className="sticky top-0 z-30 py-3 sm:py-4 bg-black/70 backdrop-blur-lg border-b border-neutral-900">
        <div className="max-w-7xl mx-auto flex items-center gap-2 sm:gap-4 px-3 sm:px-6">
          <Link href="/" className="text-xl sm:text-2xl font-bold bg-gradient-to-b from-neutral-50 to-neutral-400 bg-clip-text text-transparent flex-shrink-0">ArtistGrid</Link>
          <div className="relative flex-1 min-w-0">
            <Search className="absolute left-3 sm:left-4 top-1/2 -translate-y-1/2 w-4 sm:w-5 h-4 sm:h-5 text-neutral-500 pointer-events-none" />
            <Input type="text" placeholder="Tracker ID..." value={inputValue} onChange={(e) => setInputValue(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleLoad()} className="bg-neutral-900 border-2 border-neutral-800 text-white placeholder:text-neutral-500 focus:border-white/50 rounded-lg sm:rounded-xl w-full pl-9 sm:pl-12 pr-8 sm:pr-10 h-10 sm:h-12 text-sm sm:text-base" />
            {inputValue && <Button variant="ghost" size="icon" className="absolute right-1 sm:right-2 top-1/2 -translate-y-1/2 h-7 w-7 sm:h-8 sm:w-8 text-neutral-500 hover:text-white" onClick={() => setInputValue("")}><X className="w-4 h-4" /></Button>}
          </div>
          <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
            {trackerId && (
              <Button variant="outline" size="icon" onClick={handleShare} className="bg-neutral-900 border-neutral-800 hover:bg-neutral-800 text-white h-9 w-9 sm:h-10 sm:w-10">
                <Share2 className="w-4 h-4" />
              </Button>
            )}
            <Button variant="outline" size="icon" onClick={() => setLastfmModalOpen(true)} aria-label="Last.fm" className={`bg-neutral-900 border-neutral-800 hover:bg-neutral-800 h-9 w-9 sm:h-10 sm:w-10 ${lastfm.isAuthenticated ? "text-green-500 hover:text-green-400" : "text-white hover:text-white"}`}>
              <Radio className="w-4 sm:w-5 h-4 sm:h-5" />
            </Button>
            <Button onClick={handleLoad} className="bg-white text-black hover:bg-neutral-200 h-9 sm:h-10 px-3 sm:px-4 text-sm sm:text-base">Load</Button>
          </div>
        </div>
      </header>
      <LastFMModal isOpen={lastfmModalOpen} onClose={() => setLastfmModalOpen(false)} lastfm={lastfm} token={lastfmToken} setToken={setLastfmToken} />
      {lightboxImage && <ImageLightbox src={lightboxImage.src} alt={lightboxImage.alt} originalUrl={lightboxImage.originalUrl} onClose={() => setLightboxImage(null)} />}
      <main className="max-w-7xl mx-auto px-3 sm:px-6 py-4 sm:py-6">
        {status === "idle" && (
          <div className="text-center py-12 sm:py-20">
            <h2 className="text-lg sm:text-xl font-semibold text-neutral-300 mb-2">Enter a Tracker ID to get started</h2>
            <p className="text-sm sm:text-base text-neutral-500">Tracker IDs are exactly 44 characters long</p>
          </div>
        )}
        {status === "loading" && (
          <div className="space-y-4 sm:space-y-6">
            <div className="text-center py-4">
              <div className="inline-flex items-center gap-2 text-neutral-400 text-sm sm:text-base"><Loader2 className="w-4 sm:w-5 h-4 sm:h-5 animate-spin" /><span>Loading tracker data...</span></div>
            </div>
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="bg-neutral-950 border border-neutral-800 rounded-xl p-4 sm:p-5">
                <div className="flex items-center gap-3 sm:gap-4 mb-4">
                  <Skeleton className="w-12 h-12 sm:w-16 sm:h-16 rounded-xl bg-neutral-800" />
                  <div className="flex-1"><Skeleton className="h-4 sm:h-5 w-1/3 bg-neutral-800 mb-2" /><Skeleton className="h-3 sm:h-4 w-1/4 bg-neutral-800" /></div>
                </div>
                <div className="space-y-2 sm:space-y-3">{Array.from({ length: 3 }).map((_, j) => <Skeleton key={j} className="h-14 sm:h-16 bg-neutral-800 rounded-xl" />)}</div>
              </div>
            ))}
          </div>
        )}
        {status === "error" && (
          <div className="flex items-center justify-center py-12 sm:py-20">
            <div className="text-center bg-neutral-900 border border-red-500/30 p-6 sm:p-8 rounded-xl max-w-md">
              <h2 className="text-lg sm:text-xl font-bold text-white mb-2">Error Loading Data</h2>
              <p className="text-sm sm:text-base text-neutral-400">{errorMessage}</p>
            </div>
          </div>
        )}
        {status === "success" && data && (
          <>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
              <h1 className="text-xl sm:text-2xl font-bold text-white">{artistDisplayName}</h1>
              {!isArtTab && stats.playable > 0 && (
                <Button variant="outline" size="sm" onClick={() => downloadTracker()} disabled={isPreloading} className="bg-neutral-900 border-neutral-800 hover:bg-neutral-800 text-white self-start sm:self-auto">
                  <FolderDown className="w-4 h-4 mr-2" />
                  Download All ({stats.playable})
                </Button>
              )}
            </div>
            {data.tabs && data.tabs.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-4 sm:mb-6 pb-3 sm:pb-4 border-b border-neutral-800">
                {data.tabs.map((tab) => (
                  <Button key={tab} variant={currentTab === tab ? "default" : "outline"} size="sm" onClick={() => handleTabChange(tab)} className={`flex-shrink-0 text-xs sm:text-sm ${currentTab === tab ? "bg-white text-black hover:bg-neutral-200" : "bg-neutral-900 border-neutral-800 hover:bg-neutral-800 text-white"}`}>{tab}</Button>
                ))}
              </div>
            )}
            {!isArtTab && (
              <div className="flex flex-col gap-3 mb-4 sm:mb-6">
                <div className="relative w-full">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" />
                  <Input type="text" placeholder="Search tracks..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="bg-neutral-900 border-neutral-800 text-white pl-10 h-10 rounded-lg text-sm" />
                </div>
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    {isPreloading ? (
                      <div className="flex items-center gap-2 text-xs sm:text-sm text-neutral-400">
                        <Loader2 className="w-3 sm:w-4 h-3 sm:h-4 animate-spin" />
                        <span>{resolveProgress.current}/{resolveProgress.total}</span>
                      </div>
                    ) : resolvedUrls.size > 0 ? (
                      <span className="text-xs sm:text-sm text-neutral-500">{stats.playable}/{stats.total} playable</span>
                    ) : null}
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="icon" className="bg-neutral-900 border-neutral-800 hover:bg-neutral-800 text-white h-9 w-9 sm:h-10 sm:w-10">
                        <Filter className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-56 bg-neutral-950 border-neutral-800 text-neutral-200">
                      <DropdownMenuLabel>Filters</DropdownMenuLabel>
                      <DropdownMenuSeparator className="bg-neutral-800" />
                      <DropdownMenuCheckboxItem checked={filters.showPlayableOnly} onCheckedChange={(c) => setFilters((f) => ({ ...f, showPlayableOnly: !!c }))}>Show playable only</DropdownMenuCheckboxItem>
                      <DropdownMenuSeparator className="bg-neutral-800" />
                      <DropdownMenuLabel>Quality</DropdownMenuLabel>
                      <DropdownMenuCheckboxItem checked={filters.qualityFilter === "all"} onCheckedChange={() => setFilters((f) => ({ ...f, qualityFilter: "all" }))}>All qualities</DropdownMenuCheckboxItem>
                      {qualities.map((q) => <DropdownMenuCheckboxItem key={q} checked={filters.qualityFilter === q} onCheckedChange={() => setFilters((f) => ({ ...f, qualityFilter: q }))}>{q}</DropdownMenuCheckboxItem>)}
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
                  const eraPlayableCount = era.data ? Object.values(era.data).flat().filter((t: any) => {
                    const url = getTrackUrl(t);
                    return url && resolvedUrls.get(url);
                  }).length : 0;
                  return (
                    <div key={key} style={{ background: era.backgroundColor ? `color-mix(in srgb, ${era.backgroundColor}, oklch(14.5% 0 0) 80%)` : "oklch(14.5% 0 0)" }} className="border border-neutral-800 rounded-xl overflow-hidden">
                      <div className="flex items-center">
                        <button style={{ color: "black" }} className="flex-1 flex items-center gap-3 sm:gap-4 p-4 sm:p-5 text-left hover:bg-white/[0.02] transition-colors" onClick={() => toggleEra(key)}>
                          {era.image ? <img src={era.image} alt={era.name} className="w-12 h-12 sm:w-16 sm:h-16 rounded-xl object-cover bg-neutral-800 flex-shrink-0" /> : <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-xl bg-neutral-800 flex-shrink-0" />}
                          <div className="flex-1 min-w-0">
                            <h3 style={{ color: era.textColor ? `color-mix(in srgb, ${era.textColor}, rgb(255,255,255) 40%)` : "white" }} className="text-base sm:text-lg font-bold truncate">{era.name || key}</h3>
                            {era.extra && <p className="text-xs sm:text-sm text-neutral-500 truncate">{era.extra}</p>}
                          </div>
                          <ChevronDown className={`w-5 h-5 text-neutral-500 transition-transform flex-shrink-0 ${expandedEras.has(key) ? "rotate-180" : ""}`} />
                        </button>
                        {eraPlayableCount > 0 && (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="text-neutral-500 hover:text-white hover:bg-white/10 mr-2 h-9 w-9 sm:h-10 sm:w-10 flex-shrink-0">
                                <MoreHorizontal className="w-4 sm:w-5 h-4 sm:h-5" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-48 bg-neutral-950 border-neutral-800 text-neutral-200">
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
                          {era.description && <p className="text-xs sm:text-sm text-neutral-400 p-3 sm:p-4 bg-black/30 rounded-xl mb-3 sm:mb-5">{era.description}</p>}
                          {era.data && Object.entries(era.data).map(([cat, tracks]) => (
                            <div key={cat} className="mb-4 sm:mb-6 last:mb-0">
                              <h4 className="text-xs sm:text-sm font-semibold text-neutral-300 pb-2 sm:pb-3 mb-2 sm:mb-3 border-b border-neutral-800">{cat}</h4>
                              <div className="space-y-1.5 sm:space-y-2">
                                {(tracks as TALeak[]).map((track, i) => {
                                  const url = getTrackUrl(track);
                                  const source = url ? getTrackSource(url) : "unknown";
                                  const supportedSources = ["pillows", "froste", "krakenfiles", "pixeldrain", "imgur", "yetracker", "soundcloud", "tidal", "qobuz"];
                                  const isSupported = supportedSources.includes(source);
                                  const playableUrl = url ? resolvedUrls.get(url) : null;
                                  const isPlayable = !!playableUrl || isSupported;
                                  const isCurrentlyPlaying = playerState.currentTrack?.url === url && playerState.isPlaying;
                                  const isCurrentTrack = playerState.currentTrack?.url === url;
                                  const isHighlighted = url === highlightedTrackUrl;
                                  const description = getTrackDescription(track);
                                  const shouldShowSource = source !== "unknown" && source !== "juicewrldapi";
                                  return (
                                    <div key={i} ref={isHighlighted ? highlightedTrackRef : null} className={`rounded-lg sm:rounded-xl transition-colors ${isHighlighted ? "bg-yellow-500/20 border border-yellow-500/50 ring-2 ring-yellow-500/30" : isCurrentTrack ? "bg-white/10 border border-white/20" : "bg-white/[0.02] hover:bg-white/[0.05] border border-transparent"}`}>
                                      <div className="flex items-center gap-2 sm:gap-3 p-2.5 sm:p-3">
                                        {isPlayable ? (
                                          <button onClick={() => handlePlayTrack(track, era)} className="w-9 h-9 sm:w-10 sm:h-10 flex-shrink-0 flex items-center justify-center rounded-full bg-white text-black hover:scale-110 transition-transform">{isCurrentlyPlaying ? <Pause className="w-3.5 sm:w-4 h-3.5 sm:h-4" /> : <Play className="w-3.5 sm:w-4 h-3.5 sm:h-4 ml-0.5" />}</button>
                                        ) : (
                                          <button onClick={() => url && handleOpenUrl(url)} className="w-9 h-9 sm:w-10 sm:h-10 flex-shrink-0 flex items-center justify-center rounded-full bg-white text-black hover:scale-110 transition-transform"><LinkIcon className="w-3.5 sm:w-4 h-3.5 sm:h-4" /></button>
                                        )}
                                        <div className="flex-1 min-w-0">
                                          <div className="font-semibold text-white text-xs sm:text-sm truncate">{track.name || "Unknown"}</div>
                                          <div className="flex flex-wrap items-center gap-1 sm:gap-2 mt-0.5 sm:mt-1">
                                            {track.extra && <span className="text-xs text-neutral-500 truncate max-w-[120px] sm:max-w-none">{track.extra}</span>}
                                            <div className="flex items-center gap-1 sm:hidden">
                                              {track.type && track.type !== "Unknown" && track.type !== "N/A" && <span className="text-[10px] px-1.5 py-0.5 bg-white/5 rounded text-neutral-400">{track.type}</span>}
                                              {track.track_length && track.track_length !== "N/A" && track.track_length !== "?:??" && <span className="text-[10px] px-1.5 py-0.5 bg-white/5 rounded text-neutral-400">{track.track_length}</span>}
                                            </div>
                                          </div>
                                        </div>
                                        <div className="hidden sm:flex items-center gap-2 flex-shrink-0">
                                          {shouldShowSource && <span className="text-xs px-2 py-1 bg-white/5 rounded text-neutral-400">{getSourceDisplayName(source)}</span>}
                                          {track.type && track.type !== "Unknown" && track.type !== "N/A" && <span className="text-xs px-2 py-1 bg-white/5 rounded text-neutral-400">{track.type}</span>}
                                          {track.quality && !isUrl(track.quality) && track.quality !== "N/A" && <span className="text-xs px-2 py-1 bg-white/5 rounded text-neutral-400">{track.quality}</span>}
                                          {track.track_length && track.track_length !== "N/A" && track.track_length !== "?:??" && <span className="text-xs px-2 py-1 bg-white/5 rounded text-neutral-400">{track.track_length}</span>}
                                        </div>
                                        {url && (
                                          <Button variant="ghost" size="icon" onClick={() => handleOpenUrl(url)} className="text-neutral-500 hover:text-white hover:bg-white/10 w-7 h-7 sm:w-8 sm:h-8 rounded-lg flex-shrink-0">
                                            <ExternalLink className="w-4 h-4" />
                                          </Button>
                                        )}
                                        <DropdownMenu>
                                          <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="text-neutral-500 hover:text-white hover:bg-white/10 w-7 h-7 sm:w-8 sm:h-8 rounded-lg flex-shrink-0"><MoreHorizontal className="w-4 h-4" /></Button></DropdownMenuTrigger>
                                          <DropdownMenuContent align="end" className="w-48 bg-neutral-950 border-neutral-800 text-neutral-200">
                                            {url && <DropdownMenuItem onClick={() => handleShareTrack(url, track.name || "Track")} className="cursor-pointer"><Share className="w-4 h-4 mr-2" />Share Track</DropdownMenuItem>}
                                            {isPlayable && (
                                              <>
                                                <DropdownMenuItem onClick={() => handlePlayNext(track, era)} className="cursor-pointer"><SkipForward className="w-4 h-4 mr-2" />Play Next</DropdownMenuItem>
                                                <DropdownMenuItem onClick={() => handleAddToQueue(track, era)} className="cursor-pointer"><ListPlus className="w-4 h-4 mr-2" />Add to Queue</DropdownMenuItem>
                                                <DropdownMenuSeparator className="bg-neutral-800" />
                                                <DropdownMenuItem onClick={() => handleDownload(track)} className="cursor-pointer"><Download className="w-4 h-4 mr-2" />Download</DropdownMenuItem>
                                              </>
                                            )}
                                            <DropdownMenuItem onClick={() => handleOpenOriginal(track)} className="cursor-pointer"><ExternalLink className="w-4 h-4 mr-2" />Open Original URL</DropdownMenuItem>
                                          </DropdownMenuContent>
                                        </DropdownMenu>
                                      </div>
                                      {description && <div className="px-2.5 pb-2.5 sm:px-3 sm:pb-3"><p className="text-[10px] sm:text-xs text-neutral-500 pl-11 sm:pl-[52px]">{description}</p></div>}
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
                <p className="text-sm sm:text-base text-neutral-500 mt-1">{searchQuery ? `No results for "${searchQuery}"` : "Try adjusting your filters"}</p>
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
              ArtistGrid is not affiliated with, endorsed by, or associated with Google, TrackerHub, or any artists whose content may appear in these trackers. We do not host, store, or distribute any copyrighted content.
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
    <Suspense fallback={<div className="min-h-screen bg-black flex items-center justify-center"><div className="w-8 h-8 border-2 border-neutral-700 border-t-white rounded-full animate-spin" /></div>}>
      <TrackerViewWithProvider />
    </Suspense>
  );
}
