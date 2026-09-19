import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest";
import { render, screen, act, waitFor } from "@testing-library/react";
import { DownloadProvider, useDownloadManager } from "@/src/components/download-manager";
import type { Era, TALeak } from "@/src/types";
const track: TALeak = { name: "Song", url: "https://x.com/a.mp3", id: "t1" };
const era: Era = { name: "Era" };
function Consumer() {
  const dm = useDownloadManager();
  const job = dm.jobs[0];
  return (
    <div>
      <span data-testid="jobs">{dm.jobs.length}</span>
      <span data-testid="failed">{job?.failedCount ?? 0}</span>
      <span data-testid="completed">{job?.completedCount ?? 0}</span>
      <span data-testid="status">{job?.status ?? "-"}</span>
      <button
        onClick={() =>
          dm.startDownload({
            artistName: "A",
            eraName: "E",
            items: [{ track, era, playableUrl: "https://x.com/a.mp3" }],
          })
        }
      >
        start
      </button>
    </div>
  );
}
describe("DownloadProvider failure accounting", () => {
  beforeAll(() => {
    window.URL.createObjectURL = vi.fn();
    window.URL.revokeObjectURL = vi.fn();
  });
  beforeEach(() => {
    localStorage.clear();
  });
  it("counts failed items after retries are exhausted", async () => {
    let attempts = 0;
    globalThis.fetch = vi.fn().mockImplementation(async () => {
      attempts++;
      return { ok: false, status: 500 } as unknown as Response;
    }) as unknown as typeof fetch;
    render(
      <DownloadProvider>
        <Consumer />
      </DownloadProvider>
    );
    act(() => screen.getByText("start").click());
    await waitFor(
      () => {
        expect(screen.getByTestId("failed").textContent).toBe("1");
        expect(attempts).toBeGreaterThanOrEqual(3);
      },
      { timeout: 3000 }
    );
    expect(screen.getByTestId("completed").textContent).toBe("0");
  });
  it("marks a job completed with correct counts when downloads succeed", async () => {
    const headers = new Map([
      ["content-length", "3"],
      ["content-type", "audio/mpeg"],
    ]);
    globalThis.fetch = vi.fn().mockImplementation(async () => ({
      ok: true,
      status: 200,
      headers,
      body: {
        getReader: () => ({
          read: async () => ({ done: true, value: undefined }),
        }),
      },
    })) as unknown as typeof fetch;
    render(
      <DownloadProvider>
        <Consumer />
      </DownloadProvider>
    );
    act(() => screen.getByText("start").click());
    await waitFor(() => expect(screen.getByTestId("completed").textContent).toBe("1"), { timeout: 3000 });
    expect(screen.getByTestId("failed").textContent).toBe("0");
  });
  it("tells which files failed and allows downloading as-is", async () => {
    const successHeaders = new Map([
      ["content-length", "3"],
      ["content-type", "audio/mpeg"],
    ]);
    globalThis.fetch = vi.fn().mockImplementation(async (url: string) => {
      if (url.includes("fail.mp3")) {
        return { ok: false, status: 500 } as unknown as Response;
      }
      return {
        ok: true,
        status: 200,
        headers: successHeaders,
        body: {
          getReader: () => ({
            read: async () => ({ done: true, value: undefined }),
          }),
        },
      } as unknown as Response;
    }) as unknown as typeof fetch;
    function MultiConsumer() {
      const dm = useDownloadManager();
      const job = dm.jobs[dm.jobs.length - 1];
      return (
        <div>
          <span data-testid="status">{job?.status ?? "-"}</span>
          <span data-testid="completed">{job?.completedCount ?? 0}</span>
          <span data-testid="failed">{job?.failedCount ?? 0}</span>
          <button
            onClick={() =>
              dm.startDownload({
                artistName: "TestArtist",
                eraName: "TestEra",
                items: [
                  {
                    track: { name: "Good Song", url: "https://x.com/good.mp3", id: "t1" },
                    era,
                    playableUrl: "https://x.com/good.mp3",
                  },
                  {
                    track: { name: "Broken Song", url: "https://x.com/fail.mp3", id: "t2" },
                    era,
                    playableUrl: "https://x.com/fail.mp3",
                  },
                ],
              })
            }
          >
            start-multi
          </button>
        </div>
      );
    }
    render(
      <DownloadProvider>
        <MultiConsumer />
      </DownloadProvider>
    );
    act(() => screen.getByText("start-multi").click());
    await waitFor(() => expect(screen.getByTestId("status").textContent).toBe("failed"), { timeout: 5000 });
    expect(screen.getByTestId("completed").textContent).toBe("1");
    expect(screen.getByTestId("failed").textContent).toBe("1");
    expect(screen.getByText("Failed files (1):")).toBeDefined();
    expect(screen.getByText("Broken Song")).toBeDefined();
    const downloadAsIsBtn = screen.getByRole("button", { name: /download as-is/i });
    expect(downloadAsIsBtn).toBeDefined();
    act(() => downloadAsIsBtn.click());
    await waitFor(() => expect(screen.getByTestId("status").textContent).toBe("completed"), { timeout: 5000 });
  });
  it("tells which files failed and allows retrying them", async () => {
    let shouldFail = true;
    const successHeaders = new Map([
      ["content-length", "3"],
      ["content-type", "audio/mpeg"],
    ]);
    globalThis.fetch = vi.fn().mockImplementation(async () => {
      if (shouldFail) {
        return { ok: false, status: 500 } as unknown as Response;
      }
      return {
        ok: true,
        status: 200,
        headers: successHeaders,
        body: {
          getReader: () => ({
            read: async () => ({ done: true, value: undefined }),
          }),
        },
      } as unknown as Response;
    }) as unknown as typeof fetch;
    function RetryConsumer() {
      const dm = useDownloadManager();
      const job = dm.jobs[dm.jobs.length - 1];
      return (
        <div>
          <span data-testid="status">{job?.status ?? "-"}</span>
          <span data-testid="completed">{job?.completedCount ?? 0}</span>
          <span data-testid="failed">{job?.failedCount ?? 0}</span>
          <button
            onClick={() =>
              dm.startDownload({
                artistName: "RetryArtist",
                eraName: "RetryEra",
                items: [
                  {
                    track: { name: "Flaky Track", url: "https://x.com/flaky.mp3", id: "t1" },
                    era,
                    playableUrl: "https://x.com/flaky.mp3",
                  },
                ],
              })
            }
          >
            start-flaky
          </button>
        </div>
      );
    }
    render(
      <DownloadProvider>
        <RetryConsumer />
      </DownloadProvider>
    );
    act(() => screen.getByText("start-flaky").click());
    await waitFor(() => expect(screen.getByTestId("status").textContent).toBe("failed"), { timeout: 5000 });
    expect(screen.getByText("Failed files (1):")).toBeDefined();
    expect(screen.getByText("Flaky Track")).toBeDefined();
    shouldFail = false;
    const retryBtn = screen.getByRole("button", { name: /retry all failed/i });
    act(() => retryBtn.click());
    await waitFor(() => expect(screen.getByTestId("status").textContent).toBe("completed"), { timeout: 5000 });
    expect(screen.getByTestId("completed").textContent).toBe("1");
    expect(screen.getByTestId("failed").textContent).toBe("0");
  });
  it("allows retrying a specific failed file individually", async () => {
    let fixItem2 = false;
    const successHeaders = new Map([
      ["content-length", "3"],
      ["content-type", "audio/mpeg"],
    ]);
    globalThis.fetch = vi.fn().mockImplementation(async (url: string) => {
      if (url.includes("fail1.mp3")) {
        return { ok: false, status: 500 } as unknown as Response;
      }
      if (url.includes("fail2.mp3")) {
        if (!fixItem2) {
          return { ok: false, status: 500 } as unknown as Response;
        }
      }
      return {
        ok: true,
        status: 200,
        headers: successHeaders,
        body: {
          getReader: () => ({
            read: async () => ({ done: true, value: undefined }),
          }),
        },
      } as unknown as Response;
    }) as unknown as typeof fetch;
    function SingleRetryConsumer() {
      const dm = useDownloadManager();
      const job = dm.jobs[dm.jobs.length - 1];
      return (
        <div>
          <span data-testid="status">{job?.status ?? "-"}</span>
          <span data-testid="completed">{job?.completedCount ?? 0}</span>
          <span data-testid="failed">{job?.failedCount ?? 0}</span>
          <button
            onClick={() =>
              dm.startDownload({
                artistName: "ArtistDual",
                eraName: "EraDual",
                items: [
                  {
                    track: { name: "Fail 1", url: "https://x.com/fail1.mp3", id: "t1" },
                    era,
                    playableUrl: "https://x.com/fail1.mp3",
                  },
                  {
                    track: { name: "Fail 2", url: "https://x.com/fail2.mp3", id: "t2" },
                    era,
                    playableUrl: "https://x.com/fail2.mp3",
                  },
                ],
              })
            }
          >
            start-dual
          </button>
        </div>
      );
    }
    render(
      <DownloadProvider>
        <SingleRetryConsumer />
      </DownloadProvider>
    );
    act(() => screen.getByText("start-dual").click());
    await waitFor(() => expect(screen.getByTestId("status").textContent).toBe("failed"), { timeout: 5000 });
    expect(screen.getByText("Failed files (2):")).toBeDefined();
    expect(screen.getByText("Fail 1")).toBeDefined();
    expect(screen.getByText("Fail 2")).toBeDefined();
    fixItem2 = true;
    const retryFail2Btn = screen.getByRole("button", { name: /retry fail 2/i });
    act(() => retryFail2Btn.click());
    await waitFor(() => expect(screen.getByTestId("completed").textContent).toBe("1"), { timeout: 5000 });
    expect(screen.getByTestId("failed").textContent).toBe("1");
    expect(screen.getByText("Failed files (1):")).toBeDefined();
    expect(screen.getByText("Fail 1")).toBeDefined();
  });
});
