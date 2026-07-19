import { describe, it, expect, vi, beforeAll } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
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

describe("App", () => {
  it("renders the home page at root", async () => {
    render(<App />);
    // Home renders a header search / footer
    await waitFor(() => expect(screen.getByText("ArtistGrid")).toBeInTheDocument());
  });
});
