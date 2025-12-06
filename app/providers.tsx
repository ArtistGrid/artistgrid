// app/providers.tsx
"use client";

import { createContext, useContext, useState, useCallback, useRef, useEffect, ReactNode } from "react";

interface Track {
  id: string;
  name: string;
  extra: string;
  url: string;
  playableUrl: string | null;
  source: "pillows" | "froste" | "juicewrldapi" | "krakenfiles" | "imgur" | "pixeldrain" | "soundcloud" | "unknown";
  quality?: string;
  trackLength?: string;
  type?: string;
  description?: string;
  eraImage?: string;
  eraName?: string;
  artistName?: string;
}

interface PlayerState {
  currentTrack: Track | null;
  queue: Track[];
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
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
  removeFromQueue: (trackId: string) => void;
  clearQueue: () => void;
  playNext: () => void;
  playPrevious: () => void;
  history: Track[];
  closePlayer: () => void;
  lastfm: {
    isAuthenticated: boolean;
    username: string | null;
    getAuthUrl: () => Promise<{ token: string; url: string }>;
    completeAuth: (token: string) => Promise<{ success: boolean; username: string }>;
    disconnect: () => void;
  };
}

const PlayerContext = createContext<PlayerContextType | null>(null);

const LASTFM_API_KEY = "0fc32c426d943d34a662977b31b98b67";
const LASTFM_API_SECRET = "53acf2466be726db021e7fdfd0ad1084";
const LASTFM_API_URL = "https://ws.audioscrobbler.com/2.0/";

export function usePlayer() {
  const context = useContext(PlayerContext);
  if (!context) throw new Error("usePlayer must be used within PlayerProvider");
  return context;
}

export function extractArtistName(trackerName: string | null | undefined): string {
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

function md5(string: string): string {
  function rotateLeft(value: number, shift: number): number {
    return (value << shift) | (value >>> (32 - shift));
  }
  function addUnsigned(x: number, y: number): number {
    const lsw = (x & 0xffff) + (y & 0xffff);
    const msw = (x >> 16) + (y >> 16) + (lsw >> 16);
    return (msw << 16) | (lsw & 0xffff);
  }
  function f(x: number, y: number, z: number): number { return (x & y) | (~x & z); }
  function g(x: number, y: number, z: number): number { return (x & z) | (y & ~z); }
  function h(x: number, y: number, z: number): number { return x ^ y ^ z; }
  function i(x: number, y: number, z: number): number { return y ^ (x | ~z); }
  function ff(a: number, b: number, c: number, d: number, x: number, s: number, ac: number): number {
    a = addUnsigned(a, addUnsigned(addUnsigned(f(b, c, d), x), ac));
    return addUnsigned(rotateLeft(a, s), b);
  }
  function gg(a: number, b: number, c: number, d: number, x: number, s: number, ac: number): number {
    a = addUnsigned(a, addUnsigned(addUnsigned(g(b, c, d), x), ac));
    return addUnsigned(rotateLeft(a, s), b);
  }
  function hh(a: number, b: number, c: number, d: number, x: number, s: number, ac: number): number {
    a = addUnsigned(a, addUnsigned(addUnsigned(h(b, c, d), x), ac));
    return addUnsigned(rotateLeft(a, s), b);
  }
  function ii(a: number, b: number, c: number, d: number, x: number, s: number, ac: number): number {
    a = addUnsigned(a, addUnsigned(addUnsigned(i(b, c, d), x), ac));
    return addUnsigned(rotateLeft(a, s), b);
  }
  function convertToWordArray(str: string): number[] {
    const lWordCount = (((str.length + 8) - ((str.length + 8) % 64)) / 64 + 1) * 16;
    const lWordArray: number[] = new Array(lWordCount - 1).fill(0);
    let lByteCount = 0;
    let lBytePosition = 0;
    while (lByteCount < str.length) {
      const lWordPosition = (lByteCount - (lByteCount % 4)) / 4;
      lBytePosition = (lByteCount % 4) * 8;
      lWordArray[lWordPosition] = lWordArray[lWordPosition] | (str.charCodeAt(lByteCount) << lBytePosition);
      lByteCount++;
    }
    const lWordPosition = (lByteCount - (lByteCount % 4)) / 4;
    lBytePosition = (lByteCount % 4) * 8;
    lWordArray[lWordPosition] = lWordArray[lWordPosition] | (0x80 << lBytePosition);
    lWordArray[lWordCount - 2] = str.length << 3;
    lWordArray[lWordCount - 1] = str.length >>> 29;
    return lWordArray;
  }
  function wordToHex(value: number): string {
    let hex = "";
    for (let i = 0; i <= 3; i++) {
      const byte = (value >>> (i * 8)) & 255;
      hex += ("0" + byte.toString(16)).slice(-2);
    }
    return hex;
  }
  const x = convertToWordArray(string);
  let a = 0x67452301, b = 0xefcdab89, c = 0x98badcfe, d = 0x10325476;
  const S11 = 7, S12 = 12, S13 = 17, S14 = 22, S21 = 5, S22 = 9, S23 = 14, S24 = 20;
  const S31 = 4, S32 = 11, S33 = 16, S34 = 23, S41 = 6, S42 = 10, S43 = 15, S44 = 21;
  for (let k = 0; k < x.length; k += 16) {
    const AA = a, BB = b, CC = c, DD = d;
    a = ff(a, b, c, d, x[k], S11, 0xd76aa478); d = ff(d, a, b, c, x[k + 1], S12, 0xe8c7b756);
    c = ff(c, d, a, b, x[k + 2], S13, 0x242070db); b = ff(b, c, d, a, x[k + 3], S14, 0xc1bdceee);
    a = ff(a, b, c, d, x[k + 4], S11, 0xf57c0faf); d = ff(d, a, b, c, x[k + 5], S12, 0x4787c62a);
    c = ff(c, d, a, b, x[k + 6], S13, 0xa8304613); b = ff(b, c, d, a, x[k + 7], S14, 0xfd469501);
    a = ff(a, b, c, d, x[k + 8], S11, 0x698098d8); d = ff(d, a, b, c, x[k + 9], S12, 0x8b44f7af);
    c = ff(c, d, a, b, x[k + 10], S13, 0xffff5bb1); b = ff(b, c, d, a, x[k + 11], S14, 0x895cd7be);
    a = ff(a, b, c, d, x[k + 12], S11, 0x6b901122); d = ff(d, a, b, c, x[k + 13], S12, 0xfd987193);
    c = ff(c, d, a, b, x[k + 14], S13, 0xa679438e); b = ff(b, c, d, a, x[k + 15], S14, 0x49b40821);
    a = gg(a, b, c, d, x[k + 1], S21, 0xf61e2562); d = gg(d, a, b, c, x[k + 6], S22, 0xc040b340);
    c = gg(c, d, a, b, x[k + 11], S23, 0x265e5a51); b = gg(b, c, d, a, x[k], S24, 0xe9b6c7aa);
    a = gg(a, b, c, d, x[k + 5], S21, 0xd62f105d); d = gg(d, a, b, c, x[k + 10], S22, 0x02441453);
    c = gg(c, d, a, b, x[k + 15], S23, 0xd8a1e681); b = gg(b, c, d, a, x[k + 4], S24, 0xe7d3fbc8);
    a = gg(a, b, c, d, x[k + 9], S21, 0x21e1cde6); d = gg(d, a, b, c, x[k + 14], S22, 0xc33707d6);
    c = gg(c, d, a, b, x[k + 3], S23, 0xf4d50d87); b = gg(b, c, d, a, x[k + 8], S24, 0x455a14ed);
    a = gg(a, b, c, d, x[k + 13], S21, 0xa9e3e905); d = gg(d, a, b, c, x[k + 2], S22, 0xfcefa3f8);
    c = gg(c, d, a, b, x[k + 7], S23, 0x676f02d9); b = gg(b, c, d, a, x[k + 12], S24, 0x8d2a4c8a);
    a = hh(a, b, c, d, x[k + 5], S31, 0xfffa3942); d = hh(d, a, b, c, x[k + 8], S32, 0x8771f681);
    c = hh(c, d, a, b, x[k + 11], S33, 0x6d9d6122); b = hh(b, c, d, a, x[k + 14], S34, 0xfde5380c);
    a = hh(a, b, c, d, x[k + 1], S31, 0xa4beea44); d = hh(d, a, b, c, x[k + 4], S32, 0x4bdecfa9);
    c = hh(c, d, a, b, x[k + 7], S33, 0xf6bb4b60); b = hh(b, c, d, a, x[k + 10], S34, 0xbebfbc70);
    a = hh(a, b, c, d, x[k + 13], S31, 0x289b7ec6); d = hh(d, a, b, c, x[k], S32, 0xeaa127fa);
    c = hh(c, d, a, b, x[k + 3], S33, 0xd4ef3085); b = hh(b, c, d, a, x[k + 6], S34, 0x04881d05);
    a = hh(a, b, c, d, x[k + 9], S31, 0xd9d4d039); d = hh(d, a, b, c, x[k + 12], S32, 0xe6db99e5);
    c = hh(c, d, a, b, x[k + 15], S33, 0x1fa27cf8); b = hh(b, c, d, a, x[k + 2], S34, 0xc4ac5665);
    a = ii(a, b, c, d, x[k], S41, 0xf4292244); d = ii(d, a, b, c, x[k + 7], S42, 0x432aff97);
    c = ii(c, d, a, b, x[k + 14], S43, 0xab9423a7); b = ii(b, c, d, a, x[k + 5], S44, 0xfc93a039);
    a = ii(a, b, c, d, x[k + 12], S41, 0x655b59c3); d = ii(d, a, b, c, x[k + 3], S42, 0x8f0ccc92);
    c = ii(c, d, a, b, x[k + 10], S43, 0xffeff47d); b = ii(b, c, d, a, x[k + 1], S44, 0x85845dd1);
    a = ii(a, b, c, d, x[k + 8], S41, 0x6fa87e4f); d = ii(d, a, b, c, x[k + 15], S42, 0xfe2ce6e0);
    c = ii(c, d, a, b, x[k + 6], S43, 0xa3014314); b = ii(b, c, d, a, x[k + 13], S44, 0x4e0811a1);
    a = ii(a, b, c, d, x[k + 4], S41, 0xf7537e82); d = ii(d, a, b, c, x[k + 11], S42, 0xbd3af235);
    c = ii(c, d, a, b, x[k + 2], S43, 0x2ad7d2bb); b = ii(b, c, d, a, x[k + 9], S44, 0xeb86d391);
    a = addUnsigned(a, AA); b = addUnsigned(b, BB); c = addUnsigned(c, CC); d = addUnsigned(d, DD);
  }
  return (wordToHex(a) + wordToHex(b) + wordToHex(c) + wordToHex(d)).toLowerCase();
}

export function PlayerProvider({ children }: { children: ReactNode }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [state, setState] = useState<PlayerState>({
    currentTrack: null,
    queue: [],
    isPlaying: false,
    currentTime: 0,
    duration: 0,
    volume: 1,
  });
  const [history, setHistory] = useState<Track[]>([]);
  const [lastfmSession, setLastfmSession] = useState<LastFMSession | null>(null);
  const scrobbleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasScrobbledRef = useRef(false);
  const currentTrackRef = useRef<Track | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      try {
        const session = localStorage.getItem("lastfm-session");
        if (session) setLastfmSession(JSON.parse(session));
      } catch (e) { console.error("Failed to load Last.fm session:", e); }
    }
  }, []);

  const getScrobbleArtist = useCallback((track: Track): string => {
    if (track.artistName) return track.artistName;
    return track.eraName || "Unknown Artist";
  }, []);

  const updateMediaSession = useCallback((track: Track, isPlaying: boolean) => {
    if (typeof window === "undefined" || !("mediaSession" in navigator)) return;

    const artwork: MediaImage[] = [];
    if (track.eraImage) {
      artwork.push({ src: track.eraImage, sizes: "512x512", type: "image/jpeg" });
    }

    const artist = getScrobbleArtist(track);

    navigator.mediaSession.metadata = new MediaMetadata({
      title: track.name,
      artist,
      album: track.eraName || "",
      artwork,
    });

    navigator.mediaSession.playbackState = isPlaying ? "playing" : "paused";
  }, [getScrobbleArtist]);

  const generateSignature = useCallback((params: Record<string, string>): string => {
    const filteredParams = { ...params };
    delete filteredParams.format;
    delete filteredParams.callback;
    const sortedKeys = Object.keys(filteredParams).sort();
    const signatureString = sortedKeys.map(key => `${key}${filteredParams[key]}`).join("") + LASTFM_API_SECRET;
    return md5(signatureString);
  }, []);

  const makeLastFMRequest = useCallback(async (method: string, params: Record<string, string> = {}, requiresAuth = false): Promise<any> => {
    const requestParams: Record<string, string> = { method, api_key: LASTFM_API_KEY, ...params };
    if (requiresAuth && lastfmSession?.key) requestParams.sk = lastfmSession.key;
    const signature = generateSignature(requestParams);
    const formData = new URLSearchParams({ ...requestParams, api_sig: signature, format: "json" });
    const response = await fetch(LASTFM_API_URL, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: formData });
    const data = await response.json();
    if (data.error) throw new Error(data.message || "Last.fm API error");
    return data;
  }, [generateSignature, lastfmSession]);

  const clearScrobbleTimer = useCallback(() => {
    if (scrobbleTimerRef.current) {
      clearTimeout(scrobbleTimerRef.current);
      scrobbleTimerRef.current = null;
    }
  }, []);

  const scrobbleTrack = useCallback(async (track: Track) => {
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
    } catch (e) { console.error("Failed to scrobble:", e); }
  }, [lastfmSession, makeLastFMRequest, getScrobbleArtist]);

  const updateNowPlaying = useCallback(async (track: Track) => {
    if (!lastfmSession?.key) return;
    try {
      const artist = getScrobbleArtist(track);
      const params: Record<string, string> = { artist, track: track.name };
      if (track.eraName) params.album = track.eraName;
      await makeLastFMRequest("track.updateNowPlaying", params, true);
    } catch (e) { console.error("Failed to update now playing:", e); }
  }, [lastfmSession, makeLastFMRequest, getScrobbleArtist]);

  const scheduleScrobble = useCallback((track: Track, duration: number) => {
    clearScrobbleTimer();
    hasScrobbledRef.current = false;
    const threshold = Math.min(duration / 2, 240) * 1000;
    scrobbleTimerRef.current = setTimeout(() => scrobbleTrack(track), threshold);
  }, [clearScrobbleTimer, scrobbleTrack]);

  const playNext = useCallback(() => {
    setState(s => {
      if (s.queue.length === 0) return s;
      const [next, ...rest] = s.queue;
      if (audioRef.current && next.playableUrl) {
        clearScrobbleTimer();
        hasScrobbledRef.current = false;
        currentTrackRef.current = next;
        audioRef.current.src = next.playableUrl;
        audioRef.current.play().catch(console.error);
        setHistory(h => [...h, next]);
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
      setState(s => ({ ...s, currentTrack: prev, isPlaying: true }));
    }
  }, [history, clearScrobbleTimer, lastfmSession, updateNowPlaying, updateMediaSession]);

  useEffect(() => {
    if (typeof window !== "undefined" && "mediaSession" in navigator) {
      navigator.mediaSession.setActionHandler("play", () => {
        if (audioRef.current) audioRef.current.play().catch(console.error);
      });
      navigator.mediaSession.setActionHandler("pause", () => {
        if (audioRef.current) audioRef.current.pause();
      });
      navigator.mediaSession.setActionHandler("previoustrack", () => {
        playPrevious();
      });
      navigator.mediaSession.setActionHandler("nexttrack", () => {
        playNext();
      });
      navigator.mediaSession.setActionHandler("seekto", (details) => {
        if (audioRef.current && details.seekTime !== undefined) {
          audioRef.current.currentTime = details.seekTime;
        }
      });
    }
  }, [playNext, playPrevious]);

  useEffect(() => {
    if (typeof window !== "undefined" && !audioRef.current) {
      audioRef.current = new Audio();
      audioRef.current.volume = state.volume;
      audioRef.current.addEventListener("timeupdate", () => {
        setState(s => ({ ...s, currentTime: audioRef.current?.currentTime || 0 }));
        if ("mediaSession" in navigator && audioRef.current) {
          navigator.mediaSession.setPositionState({
            duration: audioRef.current.duration || 0,
            playbackRate: audioRef.current.playbackRate,
            position: audioRef.current.currentTime,
          });
        }
      });
      audioRef.current.addEventListener("loadedmetadata", () => {
        const duration = audioRef.current?.duration || 0;
        setState(s => ({ ...s, duration }));
        if (currentTrackRef.current && lastfmSession?.key && duration > 30) {
          scheduleScrobble(currentTrackRef.current, duration);
        }
      });
      audioRef.current.addEventListener("ended", () => {
        clearScrobbleTimer();
        setState(s => {
          if (s.queue.length > 0) {
            const [next, ...rest] = s.queue;
            if (audioRef.current && next.playableUrl) {
              audioRef.current.src = next.playableUrl;
              audioRef.current.play();
              setHistory(h => [...h, next]);
              currentTrackRef.current = next;
              if (lastfmSession?.key) updateNowPlaying(next);
              updateMediaSession(next, true);
              return { ...s, currentTrack: next, queue: rest, isPlaying: true };
            }
          }
          if ("mediaSession" in navigator) {
            navigator.mediaSession.playbackState = "none";
          }
          return { ...s, isPlaying: false };
        });
      });
      audioRef.current.addEventListener("play", () => {
        setState(s => {
          if (s.currentTrack) updateMediaSession(s.currentTrack, true);
          return { ...s, isPlaying: true };
        });
      });
      audioRef.current.addEventListener("pause", () => {
        setState(s => {
          if (s.currentTrack) updateMediaSession(s.currentTrack, false);
          return { ...s, isPlaying: false };
        });
        clearScrobbleTimer();
      });
    }
  }, [lastfmSession, scheduleScrobble, clearScrobbleTimer, updateNowPlaying, updateMediaSession, state.volume]);

  const playTrack = useCallback((track: Track) => {
    if (!audioRef.current || !track.playableUrl) return;
    clearScrobbleTimer();
    hasScrobbledRef.current = false;
    currentTrackRef.current = track;
    audioRef.current.src = track.playableUrl;
    audioRef.current.play().catch(console.error);
    setHistory(h => [...h, track]);
    setState(s => ({ ...s, currentTrack: track, isPlaying: true }));
    if (lastfmSession?.key) updateNowPlaying(track);
    updateMediaSession(track, true);
  }, [clearScrobbleTimer, lastfmSession, updateNowPlaying, updateMediaSession]);

  const togglePlayPause = useCallback(() => {
    if (!audioRef.current) return;
    if (audioRef.current.paused) audioRef.current.play().catch(console.error);
    else audioRef.current.pause();
  }, []);

  const seekTo = useCallback((time: number) => {
    if (audioRef.current) audioRef.current.currentTime = time;
  }, []);

  const setVolume = useCallback((volume: number) => {
    if (audioRef.current) audioRef.current.volume = volume;
    setState(s => ({ ...s, volume }));
  }, []);

  const addToQueue = useCallback((track: Track) => {
    setState(s => ({ ...s, queue: [...s.queue, track] }));
  }, []);

  const removeFromQueue = useCallback((trackId: string) => {
    setState(s => ({ ...s, queue: s.queue.filter(t => t.id !== trackId) }));
  }, []);

  const clearQueue = useCallback(() => {
    setState(s => ({ ...s, queue: [] }));
  }, []);

  const closePlayer = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = "";
    }
    clearScrobbleTimer();
    currentTrackRef.current = null;
    setState(s => ({ ...s, currentTrack: null, isPlaying: false, queue: [], currentTime: 0, duration: 0 }));
    setHistory([]);
    if ("mediaSession" in navigator) {
      navigator.mediaSession.metadata = null;
      navigator.mediaSession.playbackState = "none";
    }
  }, [clearScrobbleTimer]);

  const getAuthUrl = useCallback(async (): Promise<{ token: string; url: string }> => {
    const data = await makeLastFMRequest("auth.getToken");
    return { token: data.token, url: `https://www.last.fm/api/auth/?api_key=${LASTFM_API_KEY}&token=${data.token}` };
  }, [makeLastFMRequest]);

  const completeAuth = useCallback(async (token: string): Promise<{ success: boolean; username: string }> => {
    const data = await makeLastFMRequest("auth.getSession", { token });
    if (data.session) {
      const session = { key: data.session.key, name: data.session.name };
      setLastfmSession(session);
      localStorage.setItem("lastfm-session", JSON.stringify(session));
      return { success: true, username: data.session.name };
    }
    throw new Error("No session returned");
  }, [makeLastFMRequest]);

  const disconnectLastFM = useCallback(() => {
    setLastfmSession(null);
    localStorage.removeItem("lastfm-session");
    clearScrobbleTimer();
  }, [clearScrobbleTimer]);

  return (
    <PlayerContext.Provider value={{
      state, playTrack, togglePlayPause, seekTo, setVolume, addToQueue, removeFromQueue, clearQueue, playNext, playPrevious, history, closePlayer,
      lastfm: { isAuthenticated: !!lastfmSession?.key, username: lastfmSession?.name || null, getAuthUrl, completeAuth, disconnect: disconnectLastFM }
    }}>
      {children}
    </PlayerContext.Provider>
  );
}
