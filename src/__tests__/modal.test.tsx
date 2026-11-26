import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Modal } from "@/components/modal";
describe("Modal", () => {
  it("renders children when open", () => {
    render(
      <Modal isOpen onClose={() => {}} ariaLabel="Test">
        <div>content</div>
      </Modal>
    );
    expect(screen.getByText("content")).toBeInTheDocument();
  });
  it("calls onClose when close button clicked", () => {
    const onClose = vi.fn();
    render(
      <Modal isOpen onClose={onClose} ariaLabel="Test">
        <div>content</div>
      </Modal>
    );
    fireEvent.click(screen.getByLabelText("Close"));
    expect(onClose).toHaveBeenCalled();
  });
  it("renders a dialog element when closed", () => {
    const { container } = render(
      <Modal isOpen={false} onClose={() => {}} ariaLabel="Test">
        <div>hidden</div>
      </Modal>
    );
    expect(container.querySelector("dialog")).toBeInTheDocument();
  });
});
