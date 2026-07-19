import { describe, it, expect, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useKeyPress } from "@/src/hooks/use-key-press";

describe("useKeyPress", () => {
  it("invokes callback on matching keydown", () => {
    const cb = vi.fn();
    renderHook(() => useKeyPress("Escape", cb));
    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    });
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it("ignores non-matching keys", () => {
    const cb = vi.fn();
    renderHook(() => useKeyPress("Escape", cb));
    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));
    });
    expect(cb).not.toHaveBeenCalled();
  });

  it("uses latest callback without re-binding", () => {
    const cb1 = vi.fn();
    const cb2 = vi.fn();
    const { rerender } = renderHook(({ cb }) => useKeyPress("a", cb), { initialProps: { cb: cb1 } });
    rerender({ cb: cb2 });
    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "a" }));
    });
    expect(cb1).not.toHaveBeenCalled();
    expect(cb2).toHaveBeenCalledTimes(1);
  });
});
