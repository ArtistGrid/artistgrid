import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { DraggablePanel } from "@/src/components/draggable-panel";

describe("DraggablePanel", () => {
  it("renders label and children", () => {
    render(
      <DraggablePanel label="Mini Player" onClose={() => {}}>
        <div>body</div>
      </DraggablePanel>
    );
    expect(screen.getByText("Mini Player")).toBeInTheDocument();
    expect(screen.getByText("body")).toBeInTheDocument();
  });

  it("calls onClose via close button", () => {
    const onClose = vi.fn();
    render(
      <DraggablePanel label="Mini Player" onClose={onClose}>
        <div>body</div>
      </DraggablePanel>
    );
    fireEvent.click(screen.getByLabelText("Close player"));
    expect(onClose).toHaveBeenCalled();
  });

  it("starts dragging on mousedown and moves on mousemove", () => {
    const { container } = render(
      <DraggablePanel label="Mini Player" onClose={() => {}}>
        <div>body</div>
      </DraggablePanel>
    );
    const handle = screen.getByLabelText("Drag to reposition player");
    fireEvent.mouseDown(handle, { clientX: 100, clientY: 100 });
    fireEvent.mouseMove(window, { clientX: 140, clientY: 130 });
    fireEvent.mouseUp(window);
    const root = container.firstChild as HTMLElement;
    expect(root.style.left).not.toBe("");
  });
});
