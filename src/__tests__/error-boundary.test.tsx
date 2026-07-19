import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

class Boom extends Error {
  constructor(msg: string) {
    super(msg);
  }
}

function Thrower({ msg }: { msg: string }) {
  throw new Boom(msg);
}

import { ChunkErrorBoundary } from "@/src/components/error-boundary";

describe("ChunkErrorBoundary", () => {
  it("renders children when no error", () => {
    render(
      <ChunkErrorBoundary>
        <div>ok</div>
      </ChunkErrorBoundary>
    );
    expect(screen.getByText("ok")).toBeInTheDocument();
  });

  it("renders fallback on error", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    render(
      <ChunkErrorBoundary fallback={<div>fallback</div>}>
        <Thrower msg="x" />
      </ChunkErrorBoundary>
    );
    expect(screen.getByText("fallback")).toBeInTheDocument();
    spy.mockRestore();
  });

  it("reloads on chunk load error", () => {
    const reload = vi.fn();
    vi.stubGlobal("window", { ...window, location: { ...window.location, reload } });
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    render(
      <ChunkErrorBoundary>
        <Thrower msg="Failed to fetch dynamically imported module" />
      </ChunkErrorBoundary>
    );
    expect(reload).toHaveBeenCalled();
    spy.mockRestore();
  });
});
