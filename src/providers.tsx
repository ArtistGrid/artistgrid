import { createContext, use, useState, useCallback, useRef, useEffect, useMemo, ReactNode } from "react";
import SparkMD5 from "spark-md5";
import type { Track, LastFMClientInfo } from "./types";
import { LASTFM_KEY, LASTFM_API_SIG, LASTFM_API_URL, LISTENBRAINZ_API_URL } from "@/src/lib/config";
import { loadSettings } from "@/src/lib/settings";
import { stripEmojis } from "@/lib/utils";
type RepeatMode = "off" | "one" | "all";

interface PlayerState {
  currentTrack: Track | null;
  queue: Track[];
  isPlaying: boolean;
  isShuffled: boolean;
  repeatMode: RepeatMode;
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
  toggleRepeat: () => void;
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
export function PlayerProvider({ children }: { children: ReactNode }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const prefetchRef = useRef<HTMLAudioElement | null>(null);
  const queueRef = useRef<Track[]>([]);
  const [state, setState] = useState<PlayerState>(() => {
    const s = loadSettings();
    return {
      currentTrack: null,
      queue: [],
      isPlaying: false,
      isShuffled: s.player.startupShuffle,
      repeatMode: "off",
      currentTime: 0,
      duration: 0,
      volume: 1,
      isBuffering: false,
    };
  });
  const [history, setHistory] = useState<Track[]>([]);
  const historyRef = useRef<Track[]>([]);
  useEffect(() => { historyRef.current = history; }, [history]);
  useEffect(() => { queueRef.current = state.queue; }, [state.queue]);
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
  const updateMediaSession = useCallback(
    (track: Track, isPlaying: boolean) => {
      if (!("mediaSession" in navigator)) return;
      const settings = loadSettings();
      const artist = getScrobbleArtist(track);
      const title = settings.behavior.showEmojis ? track.name : stripEmojis(track.name);
      const artwork: MediaImage[] = [];
      if (track.eraImage) {
        artwork.push({ src: track.eraImage, sizes: "512x512", type: "image/jpeg" });
      }
      navigator.mediaSession.metadata = new MediaMetadata({
        title,
        artist,
        album: track.eraName || "",
        artwork,
      });
      navigator.mediaSession.playbackState = isPlaying ? "playing" : "paused";
    },
    [getScrobbleArtist]
  );
  const generateSignature = useCallback((params: Record<string, string>, secret: string): string => {
    const filteredParams = { ...params };
    delete filteredParams.format;
    delete filteredParams.callback;
    const sortedKeys = Object.keys(filteredParams).sort();
    const signatureString = sortedKeys.map((key) => `${key}${filteredParams[key]}`).join("") + secret;
    return SparkMD5.hash(signatureString);
  }, []);
  const getLastFmConfig = useCallback(() => {
    const settings = loadSettings();
    const lf = settings.scrobbling.lastfm;
    if (lf.customServer && lf.apiUrl) {
      return { url: lf.apiUrl.replace(/\/$/, ""), key: lf.apiKey || LASTFM_KEY, secret: lf.apiSecret || LASTFM_API_SIG };
    }
    return { url: LASTFM_API_URL, key: LASTFM_KEY, secret: LASTFM_API_SIG };
  }, []);
  const makeLastFMRequest = useCallback(
    async <T = unknown>(method: string, params: Record<string, string> = {}, requiresAuth = false): Promise<T> => {
      const cfg = getLastFmConfig();
      const requestParams: Record<string, string> = { method, api_key: cfg.key, ...params };
      if (requiresAuth && lastfmSession?.key) requestParams.sk = lastfmSession.key;
      const signature = generateSignature(requestParams, cfg.secret);
      const formData = new URLSearchParams({ ...requestParams, api_sig: signature, format: "json" });
      const response = await fetch(cfg.url, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: formData,
      });
      const data = await response.json() as { error?: { code: number; message: string }; [key: string]: unknown };
      if (data.error) throw new Error(data.error.message || "Last.fm API error");
      return data as T;
    },
    [generateSignature, getLastFmConfig, lastfmSession]
  );
  const clearScrobbleTimer = useCallback(() => {
    if (scrobbleTimerRef.current) {
      clearTimeout(scrobbleTimerRef.current);
      scrobbleTimerRef.current = null;
    }
  }, []);
  const scrobbleListenBrainz = useCallback(async (track: Track) => {
    const settings = loadSettings();
    const lb = settings.scrobbling.listenbrainz;
    if (!lb.enabled || !lb.token) return;
    try {
      const artist = getScrobbleArtist(track);
      const trackName = settings.behavior.showEmojis ? track.name : stripEmojis(track.name);
      const base = (lb.apiUrl || LISTENBRAINZ_API_URL).replace(/\/$/, "");
      const listen: Record<string, unknown> = {
        listened_at: Math.floor(Date.now() / 1000),
        track_metadata: {
          artist_name: artist,
          track_name: trackName,
          ...(track.eraName ? { release_name: track.eraName } : {}),
        },
      };
      await fetch(`${base}/1/submit-listens`, {
        method: "POST",
        headers: { Authorization: `Token ${lb.token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ listen_type: "single", payload: [listen] }),
      });
    } catch (e) {
      console.error("Failed to scrobble to ListenBrainz:", e);
    }
  }, [getScrobbleArtist]);
  const scrobbleTrack = useCallback(
    async (track: Track) => {
      if (hasScrobbledRef.current) return;
      hasScrobbledRef.current = true;
      if (lastfmSession?.key) {
        try {
          const artist = getScrobbleArtist(track);
          const settings = loadSettings();
          const trackName = settings.behavior.showEmojis ? track.name : stripEmojis(track.name);
          const params: Record<string, string> = {
            artist,
            track: trackName,
            timestamp: Math.floor(Date.now() / 1000).toString(),
          };
          if (track.eraName) params.album = track.eraName;
          await makeLastFMRequest("track.scrobble", params, true);
        } catch (e) {
          console.error("Failed to scrobble:", e);
        }
      }
      await scrobbleListenBrainz(track);
    },
    [lastfmSession, makeLastFMRequest, getScrobbleArtist, scrobbleListenBrainz]
  );
  const updateNowPlaying = useCallback(
    async (track: Track) => {
      if (!lastfmSession?.key) return;
      try {
        const artist = getScrobbleArtist(track);
        const settings = loadSettings();
        const trackName = settings.behavior.showEmojis ? track.name : stripEmojis(track.name);
        const params: Record<string, string> = { artist, track: trackName };
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
    const h = historyRef.current;
    if (h.length < 2) return;
    const prev = h[h.length - 2];
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
  }, [clearScrobbleTimer, lastfmSession, updateNowPlaying, updateMediaSession]);
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
  const prefetchNext = useCallback((queue: Track[]) => {
    if (prefetchRef.current) {
      prefetchRef.current.src = "";
      prefetchRef.current = null;
    }
    const next = queue[0];
    if (!next?.playableUrl) return;
    const el = new Audio();
    el.preload = "auto";
    (el as HTMLMediaElement & { referrerPolicy?: string }).referrerPolicy = "no-referrer";
    el.crossOrigin = "anonymous";
    el.src = next.playableUrl;
    prefetchRef.current = el;
  }, []);
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
        try {
          const duration = audioRef.current.duration;
          const position = audioRef.current.currentTime;
          if (isFinite(duration) && isFinite(position)) {
            navigator.mediaSession.setPositionState({
              duration,
              playbackRate: audioRef.current.playbackRate,
              position,
            });
          }
        } catch {
          // setPositionState may throw on some browsers
        }
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
        if (s.repeatMode === "one" && s.currentTrack?.playableUrl) {
          audio.currentTime = 0;
          audio.play().catch(console.error);
          return { ...s, isPlaying: true };
        }
        if (s.queue.length > 0) {
          const [next, ...rest] = s.queue;
          if (audio && next.playableUrl) {
            const prefetched = prefetchRef.current;
            if (prefetched && prefetched.src === next.playableUrl) {
              audio.src = next.playableUrl;
              audio.play().catch(console.error);
              prefetchRef.current = null;
            } else {
              audio.src = next.playableUrl;
              audio.play().catch(console.error);
            }
            setHistory((h) => [...h, next]);
            currentTrackRef.current = next;
            prefetchNext(rest);
            if (lastfmSession?.key) updateNowPlaying(next);
            updateMediaSession(next, true);
            const settings = loadSettings();
            if (settings.behavior.notifications && document.hidden && "Notification" in window && Notification.permission === "granted") {
              const artist = next.artistName || next.eraName || "Unknown";
              new Notification(next.name, { body: artist, icon: next.eraImage || undefined });
            }
            try {
              const raw = localStorage.getItem("artistgrid-history:v1");
              const hist: Array<{ name: string; artist: string; time: number }> = raw ? JSON.parse(raw) : [];
              hist.push({ name: next.name, artist: next.artistName || next.eraName || "", time: Date.now() });
              if (hist.length > 200) hist.splice(0, hist.length - 200);
              localStorage.setItem("artistgrid-history:v1", JSON.stringify(hist));
            } catch {}
            return { ...s, currentTrack: next, queue: rest, isPlaying: true };
          }
        }
        if (s.repeatMode === "all" && s.currentTrack?.playableUrl) {
          audio.currentTime = 0;
          audio.play().catch(console.error);
          return { ...s, isPlaying: true };
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
  }, [lastfmSession, scheduleScrobble, clearScrobbleTimer, updateNowPlaying, updateMediaSession, state.volume, prefetchNext]);

  useEffect(() => {
    const s = loadSettings();
    if (s.behavior.notifications && "Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }
  }, []);
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
      prefetchNext(queueRef.current);
      if (lastfmSession?.key) updateNowPlaying(track);
      updateMediaSession(track, true);
      const s = loadSettings();
      if (s.behavior.notifications && document.hidden && "Notification" in window && Notification.permission === "granted") {
        const artist = track.artistName || track.eraName || "Unknown";
        new Notification(track.name, { body: artist, icon: track.eraImage || undefined });
      }
      try {
        const raw = localStorage.getItem("artistgrid-history:v1");
        const history: Array<{ name: string; artist: string; time: number }> = raw ? JSON.parse(raw) : [];
        history.push({ name: track.name, artist: track.artistName || track.eraName || "", time: Date.now() });
        if (history.length > 200) history.splice(0, history.length - 200);
        localStorage.setItem("artistgrid-history:v1", JSON.stringify(history));
      } catch {}
    },
    [beginPlayback, lastfmSession, updateNowPlaying, updateMediaSession, prefetchNext]
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
          prefetchNext(newQueue);
          if (lastfmSession?.key) updateNowPlaying(track);
          updateMediaSession(track, true);
          return { ...s, currentTrack: track, queue: newQueue, isPlaying: true };
        }
        return s;
      });
    },
    [beginPlayback, lastfmSession, updateNowPlaying, updateMediaSession, prefetchNext]
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
  const toggleRepeat = useCallback(() => {
    setState((s) => {
      const modes: RepeatMode[] = ["off", "all", "one"];
      const next = modes[(modes.indexOf(s.repeatMode) + 1) % modes.length];
      return { ...s, repeatMode: next };
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
        toggleRepeat,
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
