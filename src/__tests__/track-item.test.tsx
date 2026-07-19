import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import {
  PlayButton,
  PauseButton,
  OpenLinkButton,
  TrackDescription,
  FallbackView,
} from "@/src/components/view/track-item";

describe("track-item buttons", () => {
  it("PlayButton calls onPlay", () => {
    const onPlay = vi.fn();
    render(<PlayButton onPlay={onPlay} />);
    fireEvent.click(screen.getByLabelText("Play"));
    expect(onPlay).toHaveBeenCalled();
  });

  it("PauseButton calls onPlay", () => {
    const onPlay = vi.fn();
    render(<PauseButton onPlay={onPlay} label="Pause" />);
    fireEvent.click(screen.getByLabelText("Pause"));
    expect(onPlay).toHaveBeenCalled();
  });

  it("OpenLinkButton calls onOpenLink", () => {
    const onOpen = vi.fn();
    render(<OpenLinkButton onOpenLink={onOpen} />);
    fireEvent.click(screen.getByLabelText("Open link"));
    expect(onOpen).toHaveBeenCalled();
  });
});

describe("TrackDescription", () => {
  it("renders description", () => {
    render(<TrackDescription description="hello" />);
    expect(screen.getByText("hello")).toBeInTheDocument();
  });
  it("renders nothing when empty", () => {
    const { container } = render(<TrackDescription description={undefined} />);
    expect(container.firstChild).toBeNull();
  });
});

describe("FallbackView", () => {
  it("opens sheets url on button click", () => {
    const open = vi.fn();
    vi.stubGlobal("window", { ...window, open });
    render(
      <MemoryRouter>
        <FallbackView sheetsUrl="https://sheets" />
      </MemoryRouter>
    );
    fireEvent.click(screen.getByText(/Open Original Spreadsheet/));
    expect(open).toHaveBeenCalledWith("https://sheets", "_blank", "noopener,noreferrer");
  });

  it("links back home", () => {
    render(
      <MemoryRouter>
        <FallbackView sheetsUrl="https://sheets" />
      </MemoryRouter>
    );
    expect(screen.getByText(/Back to Home/).closest("a")).toHaveAttribute("href", "/");
  });
});
