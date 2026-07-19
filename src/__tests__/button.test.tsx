import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { Button } from "@/components/ui/button";

describe("Button", () => {
  it("renders a button element", () => {
    render(<Button>Click</Button>);
    expect(screen.getByRole("button", { name: "Click" })).toBeInTheDocument();
  });

  it("applies variant classes", () => {
    render(<Button variant="outline">X</Button>);
    expect(screen.getByRole("button")).toHaveClass("border-input");
  });

  it("renders as child (Slot) when asChild", () => {
    render(
      <Button asChild>
        <a href="/x">Link</a>
      </Button>
    );
    const link = screen.getByRole("link", { name: "Link" });
    expect(link).toHaveAttribute("href", "/x");
    expect(link).toHaveClass("inline-flex");
  });

  it("forwards onClick", () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Go</Button>);
    screen.getByRole("button").click();
    expect(onClick).toHaveBeenCalled();
  });
});
