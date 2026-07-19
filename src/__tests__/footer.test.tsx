import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Footer } from "@/src/components/home/footer";

describe("Footer", () => {
  it("renders tracker count", () => {
    render(<Footer displayedCount={5} totalCount={10} onDonateClick={() => {}} visitorCount={null} />);
    expect(screen.getByText("5 of 10 trackers")).toBeInTheDocument();
  });

  it("renders GitHub and Discord links", () => {
    render(<Footer displayedCount={1} totalCount={1} onDonateClick={() => {}} visitorCount={null} />);
    expect(screen.getByRole("link", { name: /GitHub/ })).toHaveAttribute("href", "https://github.com/ArtistGrid");
  });

  it("calls onDonateClick", () => {
    const onClick = vi.fn();
    render(<Footer displayedCount={1} totalCount={1} onDonateClick={onClick} visitorCount={null} />);
    fireEvent.click(screen.getByRole("button", { name: /Donate/ }));
    expect(onClick).toHaveBeenCalled();
  });

  it("shows visitor count when provided", () => {
    render(<Footer displayedCount={1} totalCount={1} onDonateClick={() => {}} visitorCount={42} />);
    expect(screen.getByText(/Visitor #42/)).toBeInTheDocument();
  });
});
