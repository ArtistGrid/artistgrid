import { useSyncExternalStore } from "react";

let currentTime = 0;
let duration = 0;
let version = 0;
const listeners = new Set<() => void>();

function emit() {
  version++;
  for (const fn of listeners) fn();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

function getSnapshot() {
  return version;
}

function getServerSnapshot() {
  return 0;
}

export function setCurrentTime(t: number) {
  if (t === currentTime) return;
  currentTime = t;
  emit();
}

export function setDuration(d: number) {
  if (d === duration) return;
  duration = d;
  emit();
}

export function resetTime() {
  currentTime = 0;
  duration = 0;
  emit();
}

export function usePlayerTime(): { currentTime: number; duration: number } {
  useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  return { currentTime, duration };
}
