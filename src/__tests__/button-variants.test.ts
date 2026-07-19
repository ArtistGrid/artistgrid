import { describe, it, expect } from "vitest";
import { buttonVariants } from "@/components/ui/button-variants";

describe("buttonVariants", () => {
  it("returns base classes by default", () => {
    const c = buttonVariants();
    expect(c).toContain("inline-flex");
  });
  it("applies variant", () => {
    expect(buttonVariants({ variant: "destructive" })).toContain("bg-destructive");
  });
  it("applies size", () => {
    expect(buttonVariants({ size: "icon" })).toContain("w-10");
  });
  it("merges custom className", () => {
    expect(buttonVariants({ className: "custom" })).toContain("custom");
  });
});
