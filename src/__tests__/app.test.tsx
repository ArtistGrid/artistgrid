import { describe, it, expect, vi, beforeAll, afterEach } from "vitest";
import { render, screen, waitFor, act, cleanup } from "@testing-library/react";
import App from "@/src/App";

beforeAll(() => {
  window.HTMLMediaElement.prototype.play = vi.fn().mockResolvedValue(undefined);
  window.HTMLMediaElement.prototype.pause = vi.fn();
  Object.defineProperty(window, "mediaSession", { configurable: true, value: { setActionHandler: vi.fn() } });
  HTMLDialogElement.prototype.showModal = vi.fn(function (this: HTMLDialogElement) {
    Object.defineProperty(this, "open", { value: true, configurable: true });
  });
  HTMLDialogElement.prototype.close = vi.fn(function (this: HTMLDialogElement) {
    Object.defineProperty(this, "open", { value: false, configurable: true });
  });
});

async function navigateTo(path: string) {
  act(() => {
    window.history.pushState({}, "", path);
    window.dispatchEvent(new PopStateEvent("popstate"));
  });
}

describe("App", () => {
  afterEach(() => cleanup());

  it("renders the home page at root", async () => {
    render(<App />);
    await waitFor(() => expect(screen.getByText("ArtistGrid")).toBeInTheDocument());
  });

  it("renders the donate page on /donate", async () => {
    render(<App />);
    await navigateTo("/donate");
    await waitFor(() => expect(screen.getByText(/Support ArtistGrid/i)).toBeInTheDocument(), { timeout: 2000 });
  });
});
