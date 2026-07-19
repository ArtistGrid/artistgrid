import { describe, it, expect } from "vitest";
import type { Track } from "@/src/types";
import {
  addToQueue,
  removeFromQueue,
  clearQueue,
  reorderQueue,
  cycleRepeatMode,
  shuffleQueue,
  toggleShuffleState,
  playNextFromQueue,
} from "@/src/lib/player-queue";

function makeTrack(name: string): Track {
  return {
    id: `tk-${name}`,
    name,
    extra: "",
    url: `https://example.com/${name}`,
    playableUrl: `https://example.com/${name}`,
    source: "pillows",
  };
}

const a = makeTrack("a");
const b = makeTrack("b");
const c = makeTrack("c");

describe("player-queue pure helpers", () => {
  it("addToQueue appends", () => {
    expect(addToQueue([a], b)).toEqual([a, b]);
    expect(addToQueue([], a)).toEqual([a]);
  });

  it("removeFromQueue removes by index without mutating", () => {
    const q = [a, b, c];
    expect(removeFromQueue(q, 1)).toEqual([a, c]);
    expect(q).toEqual([a, b, c]);
  });

  it("removeFromQueue with out-of-range index returns same", () => {
    expect(removeFromQueue([a, b], 9)).toEqual([a, b]);
  });

  it("clearQueue returns empty", () => {
    expect(clearQueue()).toEqual([]);
  });

  it("reorderQueue moves item", () => {
    expect(reorderQueue([a, b, c], 0, 2)).toEqual([b, c, a]);
    expect(reorderQueue([a, b, c], 2, 0)).toEqual([c, a, b]);
  });

  it("reorderQueue with invalid fromIndex returns unchanged", () => {
    expect(reorderQueue([a, b], 5, 0)).toEqual([a, b]);
  });

  it("cycleRepeatMode cycles off -> all -> one -> off", () => {
    expect(cycleRepeatMode("off")).toBe("all");
    expect(cycleRepeatMode("all")).toBe("one");
    expect(cycleRepeatMode("one")).toBe("off");
  });

  it("shuffleQueue preserves contents and length", () => {
    const q = [a, b, c, makeTrack("d"), makeTrack("e")];
    const shuffled = shuffleQueue(q);
    expect(shuffled).toHaveLength(q.length);
    expect([...shuffled].sort((x, y) => x.name.localeCompare(y.name))).toEqual(
      [...q].sort((x, y) => x.name.localeCompare(y.name))
    );
  });

  it("shuffleQueue returns copy of single-item queue", () => {
    expect(shuffleQueue([a])).toEqual([a]);
  });

  it("toggleShuffleState enables and shuffles when >1 item", () => {
    const result = toggleShuffleState({ queue: [a, b, c], isShuffled: false });
    expect(result.isShuffled).toBe(true);
    expect(result.queue).toHaveLength(3);
    expect([...result.queue].sort((x, y) => x.name.localeCompare(y.name))).toEqual([a, b, c]);
  });

  it("toggleShuffleState disables without reshuffling", () => {
    const result = toggleShuffleState({ queue: [a, b, c], isShuffled: true });
    expect(result.isShuffled).toBe(false);
    expect(result.queue).toEqual([a, b, c]);
  });

  it("playNextFromQueue returns head and tail", () => {
    expect(playNextFromQueue([a, b, c])).toEqual({ next: a, rest: [b, c] });
  });

  it("playNextFromQueue returns nulls for empty queue", () => {
    expect(playNextFromQueue([])).toEqual({ next: null, rest: [] });
  });
});
