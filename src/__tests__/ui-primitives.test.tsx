import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Switch } from "@/components/ui/switch";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";

describe("Switch", () => {
  it("renders a switch button", () => {
    render(<Switch aria-label="toggle" />);
    expect(screen.getByRole("switch")).toBeInTheDocument();
  });

  it("calls onCheckedChange", async () => {
    const onChange = vi.fn();
    render(<Switch aria-label="toggle" onCheckedChange={onChange} />);
    await userEvent.click(screen.getByRole("switch"));
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it("respects checked prop", () => {
    render(<Switch aria-label="toggle" checked />);
    expect(screen.getByRole("switch")).toHaveAttribute("data-state", "checked");
  });
});

describe("Progress", () => {
  it("renders an indicator whose transform reflects value", () => {
    const { container } = render(<Progress value={30} />);
    expect(container.innerHTML).toContain("translateX(-70%)");
  });
});

describe("Skeleton", () => {
  it("renders with pulse class", () => {
    const { container } = render(<Skeleton />);
    expect(container.firstChild).toHaveClass("animate-pulse");
  });
});
