import { describe, it, expect, vi, beforeEach, beforeAll } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import ArtistGallery from "@/src/pages/Home";
import { PlayerProvider } from "@/src/providers";
import { SettingsProvider } from "@/src/hooks/use-settings";

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

const CSV = `name,url,image
Kanye West,https://docs.google.com/spreadsheets/d/abc123def456ghi789jklmno,https://assets.artistgrid.cx/kanyewest.webp
Drake,https://docs.google.com/spreadsheets/d/def456ghi789jklmnoabc123,https://assets.artistgrid.cx/drake.webp`;

function mockCsv(body: string, ok = true) {
  globalThis.fetch = vi.fn().mockResolvedValue({
    ok,
    status: ok ? 200 : 500,
    text: async () => body,
    clone: () => ({ ok, status: ok ? 200 : 500, text: async () => body }),
  }) as unknown as typeof fetch;
}

function wrap(ui: React.ReactNode) {
  return (
    <MemoryRouter>
      <SettingsProvider>
        <PlayerProvider>{ui}</PlayerProvider>
      </SettingsProvider>
    </MemoryRouter>
  );
}

describe("Home (ArtistGallery)", () => {
  beforeEach(() => {
    localStorage.clear();
    mockCsv(CSV);
  });

  it("loads and renders artists from CSV", async () => {
    render(wrap(<ArtistGallery />));
    await waitFor(() => expect(screen.getByText("Kanye West")).toBeInTheDocument());
    expect(screen.getByText("Drake")).toBeInTheDocument();
  });

  it("shows error message when CSV fetch fails", async () => {
    mockCsv("", false);
    render(wrap(<ArtistGallery />));
    await waitFor(() => expect(screen.getByText("Error Loading Artists")).toBeInTheDocument());
  });

  it("shows no results when CSV has no rows", async () => {
    mockCsv("name,url,image");
    render(wrap(<ArtistGallery />));
    await waitFor(() => expect(screen.getByText(/No Artists Found/)).toBeInTheDocument());
  });
});
