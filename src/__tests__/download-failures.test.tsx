import { describe, it, expect, vi, beforeAll } from "vitest";
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
});
