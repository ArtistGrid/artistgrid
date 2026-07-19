import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CustomViewManager } from "@/src/components/view/custom-view-manager";
import type { CustomView } from "@/src/lib/custom-views";

function makeProps(over: Partial<Parameters<typeof CustomViewManager>[0]> = {}): Parameters<typeof CustomViewManager>[0] {
  return {
    trackerId: "tid",
    customViews: [],
    setCustomViews: vi.fn(),
    activeCustomView: null,
    setActiveCustomView: vi.fn(),
    onSelect: vi.fn(),
    tabsList: ["Tab A", "Tab B"],
    tabSlugs: { "Tab A": "a", "Tab B": "b" },
    ...over,
  };
}

describe("CustomViewManager", () => {
  beforeEach(() => localStorage.clear());

  it("shows empty state and create button", () => {
    render(<CustomViewManager {...makeProps()} />);
    expect(screen.getByText("No Custom Views")).toBeInTheDocument();
    expect(screen.getByText("Create Custom View")).toBeInTheDocument();
  });

  it("opens editor and creates a view", () => {
    const setCustomViews = vi.fn();
    render(<CustomViewManager {...makeProps({ setCustomViews })} />);
    fireEvent.click(screen.getByText("Create Custom View"));
    fireEvent.change(screen.getByPlaceholderText("View name..."), { target: { value: "My View" } });
    fireEvent.click(screen.getByText("Tab A"));
    fireEvent.click(screen.getByText("Create"));
    expect(setCustomViews).toHaveBeenCalled();
    const saved = JSON.parse(localStorage.getItem("artistgrid-custom-views_tid")!);
    expect(saved[0].name).toBe("My View");
    expect(saved[0].tabs).toContain("Tab A");
  });

  it("does not save with empty name", () => {
    const setCustomViews = vi.fn();
    render(<CustomViewManager {...makeProps({ setCustomViews })} />);
    fireEvent.click(screen.getByText("Create Custom View"));
    // name empty, no tabs selected -> create disabled
    expect(screen.getByText("Create")).toBeDisabled();
  });

  it("renders select dropdown when views exist", () => {
    const views: CustomView[] = [{ id: "1", name: "View1", tabs: ["Tab A"] }];
    render(<CustomViewManager {...makeProps({ customViews: views })} />);
    expect(screen.getByText("Select a Custom View")).toBeInTheDocument();
  });

  it("selects an existing view", async () => {
    const onSelect = vi.fn();
    const views: CustomView[] = [{ id: "1", name: "View1", tabs: ["Tab A"] }];
    render(<CustomViewManager {...makeProps({ customViews: views, onSelect })} />);
    await userEvent.click(screen.getByText("Select a Custom View"));
    await userEvent.click(screen.getByText("View1"));
    expect(onSelect).toHaveBeenCalledWith(views[0]);
  });

  it("edits an existing view name and tabs", async () => {
    const setCustomViews = vi.fn();
    const views: CustomView[] = [{ id: "1", name: "View1", tabs: ["Tab A"] }];
    render(<CustomViewManager {...makeProps({ customViews: views, setCustomViews, activeCustomView: views[0] })} />);
    await userEvent.click(screen.getByLabelText("Edit view picker"));
    fireEvent.click(screen.getByLabelText("Edit View1"));
    fireEvent.change(screen.getByPlaceholderText("View name..."), { target: { value: "Renamed" } });
    fireEvent.click(screen.getByText("Tab B"));
    fireEvent.click(screen.getByText("Save"));
    expect(setCustomViews).toHaveBeenCalled();
    const saved = JSON.parse(localStorage.getItem("artistgrid-custom-views_tid")!);
    expect(saved[0].name).toBe("Renamed");
    expect(saved[0].tabs).toContain("Tab B");
  });

  it("deletes an existing view", async () => {
    const setCustomViews = vi.fn();
    const views: CustomView[] = [{ id: "1", name: "View1", tabs: ["Tab A"] }];
    render(<CustomViewManager {...makeProps({ customViews: views, setCustomViews, activeCustomView: views[0] })} />);
    await userEvent.click(screen.getByLabelText("Edit view picker"));
    fireEvent.click(screen.getByLabelText("Delete View1"));
    expect(setCustomViews).toHaveBeenCalledWith([]);
  });

  it("toggles a tab off in the create editor", () => {
    render(<CustomViewManager {...makeProps()} />);
    fireEvent.click(screen.getByText("Create Custom View"));
    fireEvent.click(screen.getByText("Tab A"));
    fireEvent.click(screen.getByText("Tab A"));
    expect(screen.getByText("Create")).toBeDisabled();
    expect(localStorage.getItem("artistgrid-custom-views_tid")).toBeNull();
  });
});
