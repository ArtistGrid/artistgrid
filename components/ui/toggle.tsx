"use client";
import * as React from "react";
import * as TogglePrimitive from "@radix-ui/react-toggle";
import { type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";
import { toggleVariants } from "./toggle-variants";
function Toggle({ className, variant, size, ref, ...props }: React.ComponentPropsWithRef<typeof TogglePrimitive.Root> & VariantProps<typeof toggleVariants>) {
  return <TogglePrimitive.Root ref={ref} className={cn(toggleVariants({ variant, size, className }))} {...props} />;
}
Toggle.displayName = TogglePrimitive.Root.displayName;
export { Toggle };
