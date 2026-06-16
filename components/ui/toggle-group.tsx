"use client";
import * as React from "react";
import * as ToggleGroupPrimitive from "@radix-ui/react-toggle-group";
import { type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";
import { toggleVariants } from "@/components/ui/toggle-variants";
const ToggleGroupContext = React.createContext<VariantProps<typeof toggleVariants>>({
  size: "default",
  variant: "default",
});
function ToggleGroup({ className, variant, size, children, ref, ...props }: React.ComponentPropsWithRef<typeof ToggleGroupPrimitive.Root> & VariantProps<typeof toggleVariants>) {
  return (
    <ToggleGroupPrimitive.Root ref={ref} className={cn("flex items-center justify-center gap-1", className)} {...props}>
      <ToggleGroupContext.Provider value={React.useMemo(() => ({ variant, size }), [variant, size])}>{children}</ToggleGroupContext.Provider>
    </ToggleGroupPrimitive.Root>
  );
}
ToggleGroup.displayName = ToggleGroupPrimitive.Root.displayName;
function ToggleGroupItem({ className, children, variant, size, ref, ...props }: React.ComponentPropsWithRef<typeof ToggleGroupPrimitive.Item> & VariantProps<typeof toggleVariants>) {
  const context = React.use(ToggleGroupContext);
  return (
    <ToggleGroupPrimitive.Item
      ref={ref}
      className={cn(
        toggleVariants({
          variant: context.variant || variant,
          size: context.size || size,
        }),
        className
      )}
      {...props}
    >
      {children}
    </ToggleGroupPrimitive.Item>
  );
}
ToggleGroupItem.displayName = ToggleGroupPrimitive.Item.displayName;
export { ToggleGroup, ToggleGroupItem };
