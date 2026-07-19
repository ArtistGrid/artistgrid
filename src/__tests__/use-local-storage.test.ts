import { describe, it, expect, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useLocalStorage } from "@/src/hooks/use-local-storage";

describe("useLocalStorage", () => {
  beforeEach(() => localStorage.clear());

  it("returns initial value when empty", () => {
    const { result } = renderHook(() => useLocalStorage("k", "def"));
    expect(result.current[0]).toBe("def");
  });

  it("reads existing value", () => {
    localStorage.setItem("k", JSON.stringify("stored"));
    const { result } = renderHook(() => useLocalStorage("k", "def"));
    expect(result.current[0]).toBe("stored");
  });

  it("sets value and persists", () => {
    const { result } = renderHook(() => useLocalStorage("k", 0));
    act(() => result.current[1](5));
    expect(result.current[0]).toBe(5);
    expect(JSON.parse(localStorage.getItem("k")!)).toBe(5);
  });

  it("supports functional updates", () => {
    const { result } = renderHook(() => useLocalStorage("k", 1));
    act(() => result.current[1]((v) => v + 10));
    expect(result.current[0]).toBe(11);
  });
});
