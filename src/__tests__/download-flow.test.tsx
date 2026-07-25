import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act, waitFor } from "@testing-library/react";
import { DownloadProvider, useDownloadManager } from "@/src/components/download-manager";
import type { Era, TALeak } from "@/src/types";

const track: TALeak = { name: "Song", url: "https://x.com/a.mp3", id: "t1" };
const era: Era = { name: "Era" };

const createObjectURL = vi.fn(() => "blob:mock");
const revokeObjectURL = vi.fn();
let originalCreateObjectURL: typeof URL.createObjectURL | undefined;
let originalRevokeObjectURL: typeof URL.revokeObjectURL | undefined;

function Consumer() {
  const dm = useDownloadManager();
  const job = dm.jobs[0];
  return (
    <div>
      <span data-testid="count">{dm.jobs.length}</span>
      <span data-testid="status">{job ? job.status : "none"}</span>
      <span data-testid="debug">{JSON.stringify(dm.jobs.map((j) => ({ s: j.status, items: j.items.map((i) => i.status + ":" + i.retryCount) })))}</span>
      <button
        onClick={() =>
          dm.startDownload({
            artistName: "A",
            eraName: "E",
            items: [
              { track, era, playableUrl: "https://x.com/a.mp3" },
              { track: { ...track, id: "t2", name: "Song2" }, era, playableUrl: "https://x.com/b.mp3" },
            ],
          })
        }
      >
        start
      </button>
    </div>
  );
}

function wrap(ui: React.ReactNode) {
  return <DownloadProvider>{ui}</DownloadProvider>;
}

function mockFetch(ok: boolean) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({
      ok,
      status: ok ? 200 : 500,
      headers: { get: (h: string) => (h === "content-type" ? "audio/mpeg" : null) },
      body: null,
      blob: async () => new Blob([new Uint8Array([1, 2, 3, 4])], { type: "audio/mpeg" }),
    }))
  );
}

describe("DownloadProvider flow", () => {
  beforeEach(() => {
    originalCreateObjectURL = globalThis.URL.createObjectURL;
    originalRevokeObjectURL = globalThis.URL.revokeObjectURL;
    // @ts-expect-error - jsdom lacks createObjectURL
    globalThis.URL.createObjectURL = createObjectURL;
    // @ts-expect-error - jsdom lacks revokeObjectURL
    globalThis.URL.revokeObjectURL = revokeObjectURL;
    createObjectURL.mockClear();
    revokeObjectURL.mockClear();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    globalThis.URL.createObjectURL = originalCreateObjectURL as typeof URL.createObjectURL;
    globalThis.URL.revokeObjectURL = originalRevokeObjectURL as typeof URL.revokeObjectURL;
  });

  it("downloads all items and marks the job completed with a zip", async () => {
    mockFetch(true);
    render(wrap(<Consumer />));
    act(() => {
      screen.getByText("start").click();
    });
    expect(screen.getByTestId("count").textContent).toBe("1");
    await waitFor(() => expect(screen.getByTestId("status").textContent).toBe("completed"), {
      timeout: 8000,
    });
    // The zip blob was created and offered for download.
    expect(createObjectURL).toHaveBeenCalled();
  });

  it("marks the job failed when every item download fails", async () => {
    mockFetch(false);
    render(wrap(<Consumer />));
    act(() => {
      screen.getByText("start").click();
    });
    await waitFor(() => expect(screen.getByTestId("status").textContent).toBe("failed"), {
      timeout: 15000,
    });
  }, 20000);
});
