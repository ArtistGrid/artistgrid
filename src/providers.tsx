import { createContext, use, useState, useCallback, useRef, useEffect, useMemo, ReactNode } from "react";
import SparkMD5 from "spark-md5";
import type { Track, LastFMClientInfo } from "./types";
import { LASTFM_KEY, LASTFM_API_SIG, LASTFM_API_URL } from "@/src/lib/config";
interface PlayerState {
  currentTrack: Track | null;
  queue: Track[];
  isPlaying: boolean;
  isShuffled: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  isBuffering: boolean;
}
interface LastFMSession {
  key: string;
  name: string;
}
interface PlayerContextType {
  state: PlayerState;
  playTrack: (track: Track) => void;
  togglePlayPause: () => void;
  seekTo: (time: number) => void;
  setVolume: (volume: number) => void;
  addToQueue: (track: Track) => void;
  removeFromQueue: (index: number) => void;
  clearQueue: () => void;
  playNext: () => void;
  playPrevious: () => void;
  reorderQueue: (fromIndex: number, toIndex: number) => void;
  playFromQueue: (index: number) => void;
  toggleShuffle: () => void;
  history: Track[];
  closePlayer: () => void;
  lastfm: LastFMClientInfo;
}
const PlayerContext = createContext<PlayerContextType | null>(null);
export function usePlayer() {
  const context = use(PlayerContext);
  if (!context) throw new Error("usePlayer must be used within PlayerProvider");
  return context;
}
function extractArtistName(trackerName: string | null | undefined): string {
  if (!trackerName) return "Unknown Artist";
  let name = trackerName.trim();
  const suffixes = [" Tracker", " tracker", " TRACKER"];
  for (const suffix of suffixes) {
    if (name.endsWith(suffix)) {
      name = name.slice(0, -suffix.length);
      break;
    }
  }
  return name || "Unknown Artist";
}

export function PlayerProvider({ children }: { children: ReactNode }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [state, setState] = useState<PlayerState>({
    currentTrack: null,
    queue: [],
    isPlaying: false,
    isShuffled: false,
    currentTime: 0,
    duration: 0,
    volume: 1,
    isBuffering: false,
  });
  const [history, setHistory] = useState<Track[]>([]);
  const [lastfmSession, setLastfmSession] = useState<LastFMSession | null>(() => {
    try {
      const session = localStorage.getItem("lastfm-session:v1");
      return session ? (JSON.parse(session) as LastFMSession) : null;
    } catch {
      return null;
    }
  });
  const scrobbleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasScrobbledRef = useRef(false);
  const currentTrackRef = useRef<Track | null>(null);
  const getScrobbleArtist = useCallback((track: Track): string => {
    if (track.artistName) return track.artistName;
    return track.eraName || "Unknown Artist";
  }, []);
  const artworkBlobUrlRef = useRef<string | null>(null);
  const updateMediaSession = useCallback(
    async (track: Track, isPlaying: boolean) => {
      if (!("mediaSession" in navigator)) return;
      const artist = getScrobbleArtist(track);
      const artwork: MediaImage[] = [];
      if (track.eraImage) {
        try {
          const res = await fetch(track.eraImage, { referrerPolicy: "no-referrer" });
          const blob = await res.blob();
          if (artworkBlobUrlRef.current) URL.revokeObjectURL(artworkBlobUrlRef.current);
          artworkBlobUrlRef.current = URL.createObjectURL(blob);
          artwork.push({ src: artworkBlobUrlRef.current, sizes: "512x512", type: blob.type || "image/jpeg" });
        } catch {
          artwork.push({ src: track.eraImage, sizes: "512x512", type: "image/jpeg" });
        }
      }
      navigator.mediaSession.metadata = new MediaMetadata({
        title: track.name,
        artist,
        album: track.eraName || "",
        artwork,
      });
      navigator.mediaSession.playbackState = isPlaying ? "playing" : "paused";
    },
    [getScrobbleArtist]
  );
  const generateSignature = useCallback((params: Record<string, string>): string => {
    const filteredParams = { ...params };
    delete filteredParams.format;
    delete filteredParams.callback;
    const sortedKeys = Object.keys(filteredParams).sort();
    const signatureString = sortedKeys.map((key) => `${key}${filteredParams[key]}`).join("") + LASTFM_API_SIG;
    return SparkMD5.hash(signatureString);
  }, []);
  const makeLastFMRequest = useCallback(
    async <T = unknown>(method: string, params: Record<string, string> = {}, requiresAuth = false): Promise<T> => {
      const requestParams: Record<string, string> = { method, api_key: LASTFM_KEY, ...params };
      if (requiresAuth && lastfmSession?.key) requestParams.sk = lastfmSession.key;
      const signature = generateSignature(requestParams);
      const formData = new URLSearchParams({ ...requestParams, api_sig: signature, format: "json" });
      const response = await fetch(LASTFM_API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: formData,
      });
      const data = await response.json() as { error?: { code: number; message: string }; [key: string]: unknown };
      if (data.error) throw new Error(data.error.message || "Last.fm API error");
      return data as T;
    },
    [generateSignature, lastfmSession]
  );
  const clearScrobbleTimer = useCallback(() => {
    if (scrobbleTimerRef.current) {
      clearTimeout(scrobbleTimerRef.current);
      scrobbleTimerRef.current = null;
    }
  }, []);
  const scrobbleTrack = useCallback(
    async (track: Track) => {
      if (!lastfmSession?.key || hasScrobbledRef.current) return;
      try {
        const artist = getScrobbleArtist(track);
        const params: Record<string, string> = {
          artist,
          track: track.name,
          timestamp: Math.floor(Date.now() / 1000).toString(),
        };
        if (track.eraName) params.album = track.eraName;
        await makeLastFMRequest("track.scrobble", params, true);
        hasScrobbledRef.current = true;
      } catch (e) {
        console.error("Failed to scrobble:", e);
      }
    },
    [lastfmSession, makeLastFMRequest, getScrobbleArtist]
  );
  const updateNowPlaying = useCallback(
    async (track: Track) => {
      if (!lastfmSession?.key) return;
      try {
        const artist = getScrobbleArtist(track);
        const params: Record<string, string> = { artist, track: track.name };
        if (track.eraName) params.album = track.eraName;
        await makeLastFMRequest("track.updateNowPlaying", params, true);
      } catch (e) {
        console.error("Failed to update now playing:", e);
      }
    },
    [lastfmSession, makeLastFMRequest, getScrobbleArtist]
  );
  const scheduleScrobble = useCallback(
    (track: Track, duration: number) => {
      clearScrobbleTimer();
      hasScrobbledRef.current = false;
      const threshold = Math.min(duration / 2, 240) * 1000;
      scrobbleTimerRef.current = setTimeout(() => scrobbleTrack(track), threshold);
    },
    [clearScrobbleTimer, scrobbleTrack]
  );
  const playNext = useCallback(() => {
    setState((s) => {
      if (s.queue.length === 0) return s;
      const [next, ...rest] = s.queue;
      if (audioRef.current && next.playableUrl) {
        clearScrobbleTimer();
        hasScrobbledRef.current = false;
        currentTrackRef.current = next;
        audioRef.current.src = next.playableUrl;
        audioRef.current.play().catch(console.error);
        setHistory((h) => [...h, next]);
        if (lastfmSession?.key) updateNowPlaying(next);
        updateMediaSession(next, true);
        return { ...s, currentTrack: next, queue: rest, isPlaying: true };
      }
      return s;
    });
  }, [clearScrobbleTimer, lastfmSession, updateNowPlaying, updateMediaSession]);
  const playPrevious = useCallback(() => {
    if (history.length < 2) return;
    const prev = history[history.length - 2];
    if (audioRef.current && prev.playableUrl) {
      clearScrobbleTimer();
      hasScrobbledRef.current = false;
      currentTrackRef.current = prev;
      audioRef.current.src = prev.playableUrl;
      audioRef.current.play().catch(console.error);
      if (lastfmSession?.key) updateNowPlaying(prev);
      updateMediaSession(prev, true);
      setState((s) => ({ ...s, currentTrack: prev, isPlaying: true }));
    }
  }, [history, clearScrobbleTimer, lastfmSession, updateNowPlaying, updateMediaSession]);
  useEffect(() => {
    if ("mediaSession" in navigator) {
      navigator.mediaSession.setActionHandler("play", () => {
        if (audioRef.current) audioRef.current.play().catch(console.error);
      });
      navigator.mediaSession.setActionHandler("pause", () => {
        if (audioRef.current) audioRef.current.pause();
      });
      navigator.mediaSession.setActionHandler("previoustrack", () => playPrevious());
      navigator.mediaSession.setActionHandler("nexttrack", () => playNext());
      navigator.mediaSession.setActionHandler("seekto", (details) => {
        if (audioRef.current && details.seekTime !== undefined) {
          const audio = audioRef.current;
          if (audio.readyState >= 1 && audio.seekable.length > 0) {
            const seekableEnd = audio.seekable.end(audio.seekable.length - 1);
            const seekableStart = audio.seekable.start(0);
            const clampedTime = Math.max(seekableStart, Math.min(details.seekTime, seekableEnd));
            audio.currentTime = clampedTime;
          }
        }
      });
    }
  }, [playNext, playPrevious]);
  useEffect(() => {
    if (!audioRef.current) {
      audioRef.current = new Audio();
      audioRef.current.volume = state.volume;
      audioRef.current.preload = "metadata";
      (audioRef.current as HTMLMediaElement & { referrerPolicy?: string }).referrerPolicy = "no-referrer";
      audioRef.current.crossOrigin = "anonymous";
    }
    const audio = audioRef.current;
    const controller = new AbortController();
    const opts = { signal: controller.signal };
    audio.addEventListener("timeupdate", () => {
      setState((s) => ({ ...s, currentTime: audioRef.current?.currentTime || 0 }));
      if ("mediaSession" in navigator && audioRef.current) {
        navigator.mediaSession.setPositionState({
          duration: audioRef.current.duration || 0,
          playbackRate: audioRef.current.playbackRate,
          position: audioRef.current.currentTime,
        });
      }
    }, opts);
    audio.addEventListener("loadedmetadata", () => {
      const duration = audioRef.current?.duration || 0;
      setState((s) => ({ ...s, duration, isBuffering: false }));
      if (currentTrackRef.current && lastfmSession?.key && duration > 30) {
        scheduleScrobble(currentTrackRef.current, duration);
      }
    }, opts);
    audio.addEventListener("waiting", () => setState((s) => ({ ...s, isBuffering: true })), opts);
    audio.addEventListener("canplay", () => setState((s) => ({ ...s, isBuffering: false })), opts);
    audio.addEventListener("error", (e) => {
      console.error("Audio error:", e);
      setState((s) => ({ ...s, isBuffering: false }));
    }, opts);
    audio.addEventListener("ended", () => {
      clearScrobbleTimer();
      setState((s) => {
        if (s.queue.length > 0) {
          const [next, ...rest] = s.queue;
          if (audioRef.current && next.playableUrl) {
            audioRef.current.src = next.playableUrl;
            audioRef.current.play();
            setHistory((h) => [...h, next]);
            currentTrackRef.current = next;
            if (lastfmSession?.key) updateNowPlaying(next);
            updateMediaSession(next, true);
            return { ...s, currentTrack: next, queue: rest, isPlaying: true };
          }
        }
        if ("mediaSession" in navigator) navigator.mediaSession.playbackState = "none";
        return { ...s, isPlaying: false };
      });
    }, opts);
    audio.addEventListener("play", () => {
      setState((s) => {
        if (s.currentTrack) updateMediaSession(s.currentTrack, true);
        return { ...s, isPlaying: true };
      });
    }, opts);
    audio.addEventListener("pause", () => {
      setState((s) => {
        if (s.currentTrack) updateMediaSession(s.currentTrack, false);
        return { ...s, isPlaying: false };
      });
      clearScrobbleTimer();
    }, opts);
    return () => controller.abort();
  }, [lastfmSession, scheduleScrobble, clearScrobbleTimer, updateNowPlaying, updateMediaSession, state.volume]);
  const beginPlayback = useCallback(
    (track: Track) => {
      if (!audioRef.current) return;
      clearScrobbleTimer();
      hasScrobbledRef.current = false;
      currentTrackRef.current = track;
      audioRef.current.src = track.playableUrl!;
      audioRef.current.play().catch(console.error);
      setHistory((h) => [...h, track]);
    },
    [clearScrobbleTimer]
  );
  const playTrack = useCallback(
    (track: Track) => {
      if (!audioRef.current || !track.playableUrl) return;
      beginPlayback(track);
      setState((s) => ({ ...s, currentTrack: track, isPlaying: true }));
      if (lastfmSession?.key) updateNowPlaying(track);
      updateMediaSession(track, true);
    },
    [beginPlayback, lastfmSession, updateNowPlaying, updateMediaSession]
  );
  const togglePlayPause = useCallback(() => {
    if (!audioRef.current) return;
    if (audioRef.current.paused) audioRef.current.play().catch(console.error);
    else audioRef.current.pause();
  }, []);
  const seekTo = useCallback((time: number) => {
    if (!audioRef.current) return;
    const audio = audioRef.current;
    if (audio.readyState < 1 || audio.seekable.length === 0) return;
    try {
      const seekableEnd = audio.seekable.end(audio.seekable.length - 1);
      const seekableStart = audio.seekable.start(0);
      const clampedTime = Math.max(seekableStart, Math.min(time, seekableEnd));
      if (Math.abs(audio.currentTime - clampedTime) > 0.1) audio.currentTime = clampedTime;
    } catch (error) {
      console.error("Seek failed:", error);
    }
  }, []);
  const setVolume = useCallback((volume: number) => {
    if (audioRef.current) audioRef.current.volume = volume;
    setState((s) => ({ ...s, volume }));
  }, []);
  const addToQueue = useCallback((track: Track) => setState((s) => ({ ...s, queue: [...s.queue, track] })), []);
  const removeFromQueue = useCallback(
    (index: number) => setState((s) => ({ ...s, queue: s.queue.filter((_, i) => i !== index) })),
    []
  );
  const clearQueue = useCallback(() => setState((s) => ({ ...s, queue: [] })), []);
  const reorderQueue = useCallback((fromIndex: number, toIndex: number) => {
    setState((s) => {
      const newQueue = [...s.queue];
      const [removed] = newQueue.splice(fromIndex, 1);
      newQueue.splice(toIndex, 0, removed);
      return { ...s, queue: newQueue };
    });
  }, []);
  const playFromQueue = useCallback(
    (index: number) => {
      setState((s) => {
        if (index >= s.queue.length) return s;
        const track = s.queue[index];
        const newQueue = s.queue.slice(index + 1);
        if (audioRef.current && track.playableUrl) {
          beginPlayback(track);
          if (lastfmSession?.key) updateNowPlaying(track);
          updateMediaSession(track, true);
          return { ...s, currentTrack: track, queue: newQueue, isPlaying: true };
        }
        return s;
      });
    },
    [beginPlayback, lastfmSession, updateNowPlaying, updateMediaSession]
  );
  const toggleShuffle = useCallback(() => {
    setState((s) => {
      const newShuffled = !s.isShuffled;
      if (newShuffled && s.queue.length > 1) {
        const shuffled = [...s.queue];
        for (let i = shuffled.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        return { ...s, isShuffled: true, queue: shuffled };
      }
      return { ...s, isShuffled: newShuffled };
    });
  }, []);
  const closePlayer = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = "";
    }
    clearScrobbleTimer();
    currentTrackRef.current = null;
    setState((s) => ({ ...s, currentTrack: null, isPlaying: false, queue: [], currentTime: 0, duration: 0 }));
    setHistory([]);
    if ("mediaSession" in navigator) {
      navigator.mediaSession.metadata = null;
      navigator.mediaSession.playbackState = "none";
    }
  }, [clearScrobbleTimer]);
  const getAuthUrl = useCallback(async (): Promise<{
    token: string;
    url: string;
  }> => {
    const data = await makeLastFMRequest<{ token: string }>("auth.getToken");
    return { token: data.token, url: `https://www.last.fm/api/auth/?api_key=${LASTFM_KEY}&token=${data.token}` };
  }, [makeLastFMRequest]);
  const completeAuth = useCallback(
    async (
      token: string
    ): Promise<{
      success: boolean;
      username: string;
    }> => {
      const data = await makeLastFMRequest<{ session: { key: string; name: string } }>("auth.getSession", { token });
      if (data.session) {
        const session = { key: data.session.key, name: data.session.name };
        setLastfmSession(session);
        localStorage.setItem("lastfm-session:v1", JSON.stringify(session));
        return { success: true, username: data.session.name };
      }
      throw new Error("No session returned");
    },
    [makeLastFMRequest]
  );
  const disconnectLastFM = useCallback(() => {
    setLastfmSession(null);
    localStorage.removeItem("lastfm-session:v1");
    clearScrobbleTimer();
  }, [clearScrobbleTimer]);
  return (
    <PlayerContext.Provider
      value={useMemo(() => ({
        state,
        playTrack,
        togglePlayPause,
        seekTo,
        setVolume,
        addToQueue,
        removeFromQueue,
        clearQueue,
        playNext,
        playPrevious,
        reorderQueue,
        playFromQueue,
        toggleShuffle,
        history,
        closePlayer,
        lastfm: {
          isAuthenticated: !!lastfmSession?.key,
          username: lastfmSession?.name || null,
          getAuthUrl,
          completeAuth,
          disconnect: disconnectLastFM,
        },
      }), [state, playTrack, togglePlayPause, seekTo, setVolume, addToQueue, removeFromQueue, clearQueue, playNext, playPrevious, reorderQueue, playFromQueue, toggleShuffle, history, closePlayer, lastfmSession, getAuthUrl, completeAuth, disconnectLastFM])}
    >
      {children}
    </PlayerContext.Provider>
  );
}
