import { describe, it, expect } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useToast } from "@/hooks/use-toast";

describe("useToast", () => {
  it("adds and dismisses a toast", () => {
    const { result } = renderHook(() => useToast());
    let id: string;
    act(() => {
      const t = result.current.toast({ title: "Hello" });
      id = t.id;
    });
    expect(result.current.toasts).toHaveLength(1);
    expect(result.current.toasts[0].title).toBe("Hello");

    act(() => {
      result.current.dismiss(id!);
    });
    expect(result.current.toasts[0].open).toBe(false);
  });

  it("dismisses all toasts", () => {
    const { result } = renderHook(() => useToast());
    act(() => {
      result.current.toast({ title: "A" });
    });
    act(() => result.current.dismiss());
    expect(result.current.toasts.every((t) => t.open === false)).toBe(true);
  });

  it("enforces TOAST_LIMIT of 1", () => {
    const { result } = renderHook(() => useToast());
    act(() => {
      result.current.toast({ title: "A" });
      result.current.toast({ title: "B" });
      result.current.toast({ title: "C" });
    });
    expect(result.current.toasts).toHaveLength(1);
  });

  it("updates a toast via update()", () => {
    const { result } = renderHook(() => useToast());
    let id: string;
    act(() => {
      id = result.current.toast({ title: "A" }).id;
    });
    act(() => {
      result.current.toast({ title: "Z" });
    });
    act(() => {
      result.current.dismiss(id!);
    });
    expect(result.current.toasts.some((t) => t.title === "Z")).toBe(true);
  });
});
