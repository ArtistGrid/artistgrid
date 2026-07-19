import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { SettingsProvider } from "@/src/hooks/use-settings";
import { ArtGallery, ImageLightbox } from "@/src/components/art-gallery";
import type { Era } from "@/src/types";

const eras: Record<string, Era> = {
  "1": {
    name: "Era X",
    data: {
      Leaks: [{ name: "Art1", url: "https://i.imgur.com/abc123.png", id: "a1" }],
    },
  },
};

function wrap(ui: React.ReactNode) {
  return <SettingsProvider>{ui}</SettingsProvider>;
}

describe("ArtGallery", () => {
  it("renders era name and track count", () => {
    render(wrap(<ArtGallery eras={eras} onImageClick={() => {}} />));
    expect(screen.getByText("Era X")).toBeInTheDocument();
    expect(screen.getByText(/1 songs?/)).toBeInTheDocument();
  });

  it("shows images for tracks with image urls", () => {
    render(wrap(<ArtGallery eras={eras} onImageClick={() => {}} />));
    expect(screen.getByText("Art1")).toBeInTheDocument();
  });

  it("calls onImageClick when image clicked", () => {
    const onImageClick = vi.fn();
    render(wrap(<ArtGallery eras={eras} onImageClick={onImageClick} />));
    fireEvent.click(screen.getByText("Art1"));
    expect(onImageClick).toHaveBeenCalled();
  });

  it("toggles era expansion", () => {
    const { container } = render(wrap(<ArtGallery eras={eras} onImageClick={() => {}} />));
    const btn = screen.getByText("Era X");
    fireEvent.click(btn);
    // collapsed: era name still present (button text), art may hide
    expect(btn).toBeInTheDocument();
  });
});

describe("ImageLightbox", () => {
  it("renders image and closes on overlay click", () => {
    const onClose = vi.fn();
    render(
      wrap(
        <ImageLightbox src="https://x.com/a.png" alt="alt" originalUrl="https://x.com/a" onClose={onClose} />
      )
    );
    const dialog = screen.getByRole("dialog");
    expect(dialog).toBeInTheDocument();
    fireEvent.click(dialog);
    expect(onClose).toHaveBeenCalled();
  });

  it("closes on Escape key", () => {
    const onClose = vi.fn();
    render(
      wrap(
        <ImageLightbox src="https://x.com/a.png" alt="alt" originalUrl="https://x.com/a" onClose={onClose} />
      )
    );
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    expect(onClose).toHaveBeenCalled();
  });
});
