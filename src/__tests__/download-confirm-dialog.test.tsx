import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { DownloadConfirmDialog } from "@/src/components/view/download-confirm-dialog";
describe("DownloadConfirmDialog", () => {
  it("renders track count and subtitle with correct pluralization", () => {
    render(<DownloadConfirmDialog trackCount={1} subtitle="Kanye - Donda" onCancel={vi.fn()} onConfirm={vi.fn()} />);
    expect(screen.getByText("Download 1 track")).toBeInTheDocument();
    expect(screen.getByText("Kanye - Donda")).toBeInTheDocument();
  });
  it("pluralizes counts above one", () => {
    render(<DownloadConfirmDialog trackCount={5} subtitle="X" onCancel={vi.fn()} onConfirm={vi.fn()} />);
    expect(screen.getByText("Download 5 tracks")).toBeInTheDocument();
  });
  it("invokes the callbacks", () => {
    const onCancel = vi.fn();
    const onConfirm = vi.fn();
    render(<DownloadConfirmDialog trackCount={3} subtitle="X" onCancel={onCancel} onConfirm={onConfirm} />);
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    fireEvent.click(screen.getByRole("button", { name: "Start Download" }));
    fireEvent.click(screen.getByLabelText("Close download dialog"));
    expect(onCancel).toHaveBeenCalledTimes(2);
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });
});
