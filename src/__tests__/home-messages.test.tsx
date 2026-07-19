import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ErrorMessage, NoResultsMessage } from "@/src/components/home/messages";

describe("ErrorMessage", () => {
  it("renders the message", () => {
    render(<ErrorMessage message="boom" />);
    expect(screen.getByText("boom")).toBeInTheDocument();
    expect(screen.getByText("Error Loading Artists")).toBeInTheDocument();
  });
});

describe("NoResultsMessage", () => {
  it("renders with search query", () => {
    render(<NoResultsMessage searchQuery="kanye" />);
    expect(screen.getByText(/kanye/)).toBeInTheDocument();
  });
  it("renders without search query", () => {
    render(<NoResultsMessage searchQuery="" />);
    expect(screen.getByText(/adjusting your filters/)).toBeInTheDocument();
  });
});
