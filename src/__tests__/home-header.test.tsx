import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { SettingsProvider } from "@/src/hooks/use-settings";
import { SettingsModalContext } from "@/src/components/settings-modal-context";
import { FilterControls, HeaderActions, HomeHeaderCenter, DiscordIcon } from "@/src/components/home/header";
import { DEFAULT_FILTER_OPTIONS } from "@/src/lib/home-constants";

function wrap(ui: React.ReactNode, settingsOpen = false) {
  return (
    <MemoryRouter>
      <SettingsProvider>
        <SettingsModalContext value={{ settingsOpen, setSettingsOpen: () => {} }}>
          {ui}
        </SettingsModalContext>
      </SettingsProvider>
    </MemoryRouter>
  );
}

describe("DiscordIcon", () => {
  it("renders an svg", () => {
    const { container } = render(<DiscordIcon className="w-4" />);
    expect(container.querySelector("svg")).toBeInTheDocument();
  });
});

describe("FilterControls", () => {
  it("renders filter button with dot when active", () => {
    const opts = { ...DEFAULT_FILTER_OPTIONS, showWorking: true };
    render(wrap(<FilterControls options={opts} onFilterChange={() => {}} />));
    expect(screen.getByLabelText("Filter options")).toBeInTheDocument();
  });

  it("calls onFilterChange on checkbox", async () => {
    const onFilterChange = vi.fn();
    render(wrap(<FilterControls options={DEFAULT_FILTER_OPTIONS} onFilterChange={onFilterChange} />));
    await userEvent.click(screen.getByLabelText("Filter options"));
    await userEvent.click(screen.getByText("Working links only"));
    expect(onFilterChange).toHaveBeenCalledWith("showWorking", true);
  });
});

describe("HeaderActions", () => {
  it("renders Discord, Donate, Settings, About buttons", () => {
    render(wrap(<HeaderActions onInfoClick={() => {}} onDonateClick={() => {}} />));
    expect(screen.getByLabelText("Discord")).toBeInTheDocument();
    expect(screen.getByLabelText("Donate")).toBeInTheDocument();
    expect(screen.getByLabelText("Settings")).toBeInTheDocument();
    expect(screen.getByLabelText("About")).toBeInTheDocument();
  });

  it("calls onDonateClick", () => {
    const onDonateClick = vi.fn();
    render(wrap(<HeaderActions onInfoClick={() => {}} onDonateClick={onDonateClick} />));
    fireEvent.click(screen.getByLabelText("Donate"));
    expect(onDonateClick).toHaveBeenCalled();
  });
});

describe("HomeHeaderCenter", () => {
  it("updates search query", () => {
    const setSearchQuery = vi.fn();
    render(wrap(<HomeHeaderCenter searchQuery="" setSearchQuery={setSearchQuery} />));
    fireEvent.change(screen.getByLabelText("Search artists"), { target: { value: "kanye" } });
    expect(setSearchQuery).toHaveBeenCalledWith("kanye");
  });

  it("clears search when clear clicked", () => {
    const setSearchQuery = vi.fn();
    render(wrap(<HomeHeaderCenter searchQuery="x" setSearchQuery={setSearchQuery} />));
    fireEvent.click(screen.getByLabelText("Clear search"));
    expect(setSearchQuery).toHaveBeenCalledWith("");
  });
});
