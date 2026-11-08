import { afterEach, describe, expect, it, vi } from "vitest";
import { readResponseText, withDeadline } from "@/src/lib/request";

afterEach(() => vi.useRealTimers());

describe("bounded response ownership", () => {
  it("bounds operations that never settle and releases its timer", async () => {
    vi.useFakeTimers();
    const pending = withDeadline(100, async () => new Promise(() => {}));
    const rejected = expect(pending).rejects.toMatchObject({ name: "TimeoutError" });
    await vi.advanceTimersByTimeAsync(100);
    await rejected;
    expect(vi.getTimerCount()).toBe(0);
  });

  it("cancels stalled body consumption when the request deadline expires", async () => {
    vi.useFakeTimers();
    const cancel = vi.fn();
    const response = new Response(new ReadableStream({ cancel }));
    const pending = withDeadline(100, (signal) => readResponseText(response, 1000, signal));
    const rejected = expect(pending).rejects.toMatchObject({ name: "TimeoutError" });
    await vi.advanceTimersByTimeAsync(100);
    await rejected;
    expect(cancel).toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("respects caller cancellation rather than waiting for the deadline", async () => {
    vi.useFakeTimers();
    const controller = new AbortController();
    const pending = withDeadline(1000, async () => new Promise(() => {}), controller.signal);
    const rejected = expect(pending).rejects.toMatchObject({ name: "AbortError" });
    controller.abort();
    await rejected;
    expect(vi.getTimerCount()).toBe(0);
  });

  it("limits bytes, including multibyte text, and returns bounded text intact", async () => {
    const signal = new AbortController().signal;
    await expect(readResponseText(new Response("é".repeat(6)), 10, signal)).rejects.toThrow("too large");
    expect(await readResponseText(new Response("é".repeat(5)), 10, signal)).toBe("é".repeat(5));
  });
});
