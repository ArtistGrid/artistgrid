export async function withDeadline<T>(
  milliseconds: number,
  operation: (signal: AbortSignal) => Promise<T>,
  parentSignal?: AbortSignal
): Promise<T> {
  const controller = new AbortController();
  const signal = parentSignal ? AbortSignal.any([parentSignal, controller.signal]) : controller.signal;
  signal.throwIfAborted();
  let abort!: () => void;
  const cancelled = new Promise<never>((_, reject) => {
    abort = () => reject(signal.reason);
    signal.addEventListener("abort", abort, { once: true });
  });
  const timeout = setTimeout(
    () => controller.abort(new DOMException("Request timed out", "TimeoutError")),
    milliseconds
  );
  try {
    return await Promise.race([
      Promise.resolve().then(() => {
        signal.throwIfAborted();
        return operation(signal);
      }),
      cancelled,
    ]);
  } finally {
    clearTimeout(timeout);
    signal.removeEventListener("abort", abort);
  }
}

export async function readResponseText(response: Response, maxBytes: number, signal: AbortSignal): Promise<string> {
  signal.throwIfAborted();
  if (!response.body) {
    const text = await response.text();
    signal.throwIfAborted();
    if (new TextEncoder().encode(text).byteLength > maxBytes) throw new Error("Response is too large");
    return text;
  }
  const reader = response.body.getReader();
  const abort = () => void reader.cancel(signal.reason).catch(() => {});
  signal.addEventListener("abort", abort, { once: true });
  const decoder = new TextDecoder();
  let bytes = 0;
  let text = "";
  try {
    while (true) {
      const { value, done } = await reader.read();
      signal.throwIfAborted();
      if (done) return text + decoder.decode();
      bytes += value.byteLength;
      if (bytes > maxBytes) {
        await reader.cancel();
        throw new Error("Response is too large");
      }
      text += decoder.decode(value, { stream: true });
    }
  } finally {
    signal.removeEventListener("abort", abort);
    reader.releaseLock();
  }
}
