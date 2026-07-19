import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { GallerySkeleton } from "@/src/components/home/skeletons";
import { SettingsModalContext, useSettingsModal } from "@/src/components/settings-modal-context";
import { MemoryRouter } from "react-router-dom";

describe("GallerySkeleton", () => {
  it("renders 18 skeleton cells", () => {
    const { container } = render(<GallerySkeleton />);
    // Each cell has an image skeleton + text skeleton; count image skeletons (aspect-square)
    expect(container.querySelectorAll(".aspect-square").length).toBe(18);
  });
});

describe("useSettingsModal", () => {
  it("reads context values", () => {
    let captured: boolean | null = null;
    function Consumer() {
      const { settingsOpen } = useSettingsModal();
      captured = settingsOpen;
      return null;
    }
    render(
      <SettingsModalContext value={{ settingsOpen: true, setSettingsOpen: () => {} }}>
        <Consumer />
      </SettingsModalContext>
    );
    expect(captured).toBe(true);
  });
});
