import { describe, it, expect, vi, beforeAll } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { AnnouncementModal, InfoModal } from "@/src/components/home/modals";
beforeAll(() => {
  HTMLDialogElement.prototype.showModal = vi.fn(function (this: HTMLDialogElement) {
    Object.defineProperty(this, "open", { value: true, configurable: true });
  });
  HTMLDialogElement.prototype.close = vi.fn(function (this: HTMLDialogElement) {
    Object.defineProperty(this, "open", { value: false, configurable: true });
  });
});
describe("AnnouncementModal", () => {
  it("renders markdown headings and closes", () => {
    const onClose = vi.fn();
    render(<AnnouncementModal isOpen onClose={onClose} message={"# Hello\n- **Bold**: value\nplain line"} />);
    expect(screen.getByText("Hello")).toBeInTheDocument();
    expect(screen.getByText(/Bold/)).toBeInTheDocument();
    expect(screen.getByText("plain line")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Got it!"));
    expect(onClose).toHaveBeenCalled();
  });
  it("renders donate link when onDonate provided", () => {
    const onDonate = vi.fn();
    render(<AnnouncementModal isOpen onClose={() => {}} message="hi" onDonate={onDonate} />);
    fireEvent.click(screen.getByText(/Please consider donating/));
    expect(onDonate).toHaveBeenCalled();
  });
  it("renders inline markdown links", () => {
    render(
      <AnnouncementModal
        isOpen
        onClose={() => {}}
        message="Check [pillows.su](https://pillows.su) and [leaked.cx](https://leaked.cx) now"
      />
    );
    expect(screen.getByText("pillows.su")).toHaveAttribute("href", "https://pillows.su");
    expect(screen.getByText("leaked.cx")).toHaveAttribute("href", "https://leaked.cx");
  });
});
describe("InfoModal", () => {
  it("renders Originally by JustAMZ with instagram link", () => {
    render(<InfoModal isOpen onClose={() => {}} visitorCount={null} onDonate={() => {}} />);
    const link = screen.getByText("JustAMZ");
    expect(link).toHaveAttribute("href", "https://instagram.com/aledio.m");
  });
});
