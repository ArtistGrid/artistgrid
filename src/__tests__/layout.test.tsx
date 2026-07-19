import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { Layout } from "@/src/components/layout";

function renderWithRouter(ui: React.ReactNode) {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
}

describe("Layout", () => {
  it("renders header with ArtistGrid link and slots", () => {
    renderWithRouter(<Layout />);
    expect(screen.getByText("ArtistGrid")).toBeInTheDocument();
    expect(document.getElementById("header-center")).toBeInTheDocument();
    expect(document.getElementById("header-right")).toBeInTheDocument();
  });
});
