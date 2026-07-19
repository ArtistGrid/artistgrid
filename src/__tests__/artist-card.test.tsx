import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { ArtistGridDisplay } from "@/src/components/home/artist-card";
import type { Artist } from "@/src/types";

// The component reads artist.imageFilename at runtime (precomputed by callers).
const artists = [
  { name: "Kanye West", url: "https://docs.google.com/spreadsheets/d/abc123def456ghi789jklmno", imageFilename: "kanyewest.webp" },
  { name: "Drake", url: "https://docs.google.com/spreadsheets/d/def456ghi789jklmnoabc123", imageFilename: "drake.webp" },
] as unknown as Artist[];

describe("ArtistGridDisplay", () => {
  it("renders all artist names", () => {
    render(
      <MemoryRouter>
        <ArtistGridDisplay artists={artists} onArtistClick={() => {}} onSheetClick={() => {}} />
      </MemoryRouter>
    );
    expect(screen.getByText("Kanye West")).toBeInTheDocument();
    expect(screen.getByText("Drake")).toBeInTheDocument();
  });

  it("calls onArtistClick", () => {
    const onArtistClick = vi.fn();
    render(
      <MemoryRouter>
        <ArtistGridDisplay artists={artists} onArtistClick={onArtistClick} onSheetClick={() => {}} />
      </MemoryRouter>
    );
    fireEvent.click(screen.getByText("Kanye West"));
    expect(onArtistClick).toHaveBeenCalledWith(artists[0]);
  });

  it("calls onSheetClick", () => {
    const onSheetClick = vi.fn();
    render(
      <MemoryRouter>
        <ArtistGridDisplay artists={artists} onArtistClick={() => {}} onSheetClick={onSheetClick} />
      </MemoryRouter>
    );
    fireEvent.click(screen.getByLabelText("Open sheet for Kanye West"));
    expect(onSheetClick).toHaveBeenCalled();
  });
});
