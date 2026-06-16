"use client";
import * as React from "react";
import * as AccordionPrimitive from "@radix-ui/react-accordion";
import { cn } from "@/lib/utils";
function AccordionContent({ className, children, ref, ...props }: React.ComponentPropsWithRef<typeof AccordionPrimitive.Content>) {
  return (
    <AccordionPrimitive.Content
      ref={ref}
      className="overflow-hidden text-sm transition-all data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down"
      {...props}
    >
      <div className={cn("pb-4 pt-0", className)}>{children}</div>
    </AccordionPrimitive.Content>
  );
}
AccordionContent.displayName = AccordionPrimitive.Content.displayName;
export { AccordionContent };
