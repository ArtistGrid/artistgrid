import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { DonationContent } from "@/src/components/crypto-donation-section";
import { Toaster } from "@/components/ui/toaster";
import { useToast } from "@/components/ui/use-toast";

function Harness() {
  const { toast } = useToast();
  return (
    <div>
      <DonationContent onShowQr={(d) => toast({ title: d.name })} />
      <Toaster />
    </div>
  );
}

describe("DonationContent", () => {
  it("renders URL donation buttons", () => {
    render(<DonationContent onShowQr={() => {}} />);
    expect(screen.getByText("Ko-fi")).toBeInTheDocument();
  });

  it("renders crypto options", () => {
    render(<DonationContent onShowQr={() => {}} />);
    expect(screen.getByText("Monero (XMR)")).toBeInTheDocument();
    expect(screen.getByText("Bitcoin · Active")).toBeInTheDocument();
  });

  it("invokes onShowQr with QR option", () => {
    const onShowQr = vi.fn();
    render(<DonationContent onShowQr={onShowQr} />);
    fireEvent.click(screen.getByLabelText("Show Monero (XMR) QR code"));
    expect(onShowQr).toHaveBeenCalledWith(
      expect.objectContaining({ name: "Monero (XMR)" })
    );
  });

  it("copies address on copy click", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });
    render(<Harness />);
    fireEvent.click(screen.getByLabelText("Copy Monero (XMR) address"));
    expect(writeText).toHaveBeenCalled();
  });
});
