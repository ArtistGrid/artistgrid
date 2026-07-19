import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import Donate from "@/src/pages/Donate";

describe("Donate page", () => {
  it("renders donation content and back button", () => {
    render(
      <MemoryRouter>
        <Donate />
      </MemoryRouter>
    );
    expect(screen.getByText("Support ArtistGrid")).toBeInTheDocument();
    expect(screen.getByText("Back")).toBeInTheDocument();
    expect(screen.getByText("Ko-fi")).toBeInTheDocument();
  });

  it("shows QR overlay when crypto QR clicked", () => {
    render(
      <MemoryRouter>
        <Donate />
      </MemoryRouter>
    );
    fireEvent.click(screen.getByLabelText("Show Monero (XMR) QR code"));
    expect(screen.getByText("Monero (XMR)", { selector: "p" })).toBeInTheDocument();
  });
});
