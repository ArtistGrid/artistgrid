import type { Track } from "@/src/types";

export type RepeatMode = "off" | "all" | "one";

export function addToQueue(queue: Track[], track: Track): Track[] {
  return [...queue, track];
}

export function removeFromQueue(queue: Track[], index: number): Track[] {
  return queue.filter((_, i) => i !== index);
}

export function clearQueue(): Track[] {
  return [];
}

export function reorderQueue(queue: Track[], fromIndex: number, toIndex: number): Track[] {
  const newQueue = [...queue];
  const [removed] = newQueue.splice(fromIndex, 1);
  if (removed === undefined) return queue;
  newQueue.splice(toIndex, 0, removed);
  return newQueue;
}

export function cycleRepeatMode(current: RepeatMode): RepeatMode {
  const modes: RepeatMode[] = ["off", "all", "one"];
  return modes[(modes.indexOf(current) + 1) % modes.length];
}

export function shuffleQueue(queue: Track[]): Track[] {
  if (queue.length < 2) return [...queue];
  const shuffled = [...queue];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

export interface QueueState {
  queue: Track[];
  isShuffled: boolean;
}

export function toggleShuffleState(state: QueueState): QueueState {
  const newShuffled = !state.isShuffled;
  if (newShuffled && state.queue.length > 1) {
    return { isShuffled: true, queue: shuffleQueue(state.queue) };
  }
  return { ...state, isShuffled: newShuffled };
}

export function playNextFromQueue(queue: Track[]): { next: Track | null; rest: Track[] } {
  if (queue.length === 0) return { next: null, rest: [] };
  const [next, ...rest] = queue;
  return { next, rest };
}
