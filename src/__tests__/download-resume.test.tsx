import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from "vitest";
import { render, screen, act, waitFor } from "@testing-library/react";
import { DownloadProvider, useDownloadManager } from "@/src/components/download-manager";
const JOBS_KEY = "artistgrid-downloads:v1";
function Consumer() {
  const dm = useDownloadManager();
  const job = dm.jobs[0];
  return (
    <div>
      <span data-testid="jobs">{dm.jobs.length}</span>
      <span data-testid="name">{job?.name ?? "-"}</span>
      <span data-testid="completed">{job?.completedCount ?? 0}</span>
      <button
        onClick={() =>
          dm.startDownload({
            artistName: "A",
            eraName: "E",
            items: [
              {
                track: { name: "Live Song", url: "https://x.com/a" } as never,
                era: { name: "Era" },
                playableUrl: "https://x.com/a.mp3",
              },
            ],
          })
        }
      >
        start
      </button>
    </div>
  );
}
describe("DownloadProvider resume after reload", () => {
  beforeAll(() => {
    window.URL.createObjectURL = vi.fn();
    window.URL.revokeObjectURL = vi.fn();
  });
  beforeEach(() => {
    localStorage.removeItem(JOBS_KEY);
  });
  afterEach(() => {
    localStorage.removeItem(JOBS_KEY);
  });
  it("restores a persisted job on mount and re-downloads it", async () => {
    localStorage.setItem(
      JOBS_KEY,
      JSON.stringify([
        {
          id: "job_restored",
          name: "Artist - Era",
          artistName: "Artist",
          eraName: "Era",
          items: [
            { id: "job_restored_item_0", trackName: "Song", eraName: "Era", playableUrl: "https://x.com/restored.mp3" },
          ],
        },
      ])
    );
    const headers = new Map([
      ["content-length", "3"],
      ["content-type", "audio/mpeg"],
    ]);
    globalThis.fetch = vi.fn().mockImplementation(async () => ({
      ok: true,
      status: 200,
      headers,
      body: { getReader: () => ({ read: async () => ({ done: true, value: undefined }) }) },
    })) as unknown as typeof fetch;
    render(
      <DownloadProvider>
        <Consumer />
      </DownloadProvider>
    );
    await waitFor(() => expect(screen.getByTestId("completed").textContent).toBe("1"), { timeout: 3000 });
    expect(screen.getByTestId("name").textContent).toBe("Artist - Era");
    expect(fetch).toHaveBeenCalledWith("https://x.com/restored.mp3", expect.anything());
  });
  it("persists newly started jobs for the next load", async () => {
    globalThis.fetch = vi.fn().mockImplementation(async () => new Promise(() => {})) as unknown as typeof fetch;
    render(
      <DownloadProvider>
        <Consumer />
      </DownloadProvider>
    );
    act(() => screen.getByText("start").click());
    await waitFor(() => {
      const raw = localStorage.getItem(JOBS_KEY);
      expect(raw).not.toBeNull();
      const parsed = JSON.parse(raw!);
      const names = parsed.flatMap(
        (j: {
          items: Array<{
            trackName: string;
          }>;
        }) => j.items.map((i) => i.trackName)
      );
      expect(names).toContain("Live Song");
      for (const j of parsed) {
        for (const i of j.items) {
          expect(i.status).toBeUndefined();
        }
      }
    });
  });
});
