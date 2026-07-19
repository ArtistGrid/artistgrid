import { describe, it, expect, vi } from "vitest";
import { render, screen, act } from "@testing-library/react";
import { DownloadProvider, useDownloadManager } from "@/src/components/download-manager";
import type { Era, TALeak } from "@/src/types";

const track: TALeak = { name: "Song", url: "https://x.com/a.mp3", id: "t1" };
const era: Era = { name: "Era" };

function Consumer() {
  const dm = useDownloadManager();
  return (
    <div>
      <span data-testid="jobs">{dm.jobs.length}</span>
      <button onClick={() => dm.startDownload({ artistName: "A", eraName: "E", items: [{ track, era, playableUrl: "https://x.com/a.mp3" }] })}>
        start
      </button>
      <button onClick={() => dm.clearCompleted()}>clear</button>
    </div>
  );
}

function wrap(ui: React.ReactNode) {
  return <DownloadProvider>{ui}</DownloadProvider>;
}

describe("DownloadProvider", () => {
  it("throws outside provider", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => render(<Consumer />)).toThrow();
    spy.mockRestore();
  });

  it("provides download context", () => {
    render(wrap(<Consumer />));
    expect(screen.getByTestId("jobs").textContent).toBe("0");
  });

  it("startDownload creates a job", () => {
    render(wrap(<Consumer />));
    act(() => {
      screen.getByText("start").click();
    });
    expect(screen.getByTestId("jobs").textContent).toBe("1");
  });
});
