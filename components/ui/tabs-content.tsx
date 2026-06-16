"use client";
import * as React from "react";
import * as TabsPrimitive from "@radix-ui/react-tabs";
import { cn } from "@/lib/utils";
function TabsContent({ className, ref, ...props }: React.ComponentPropsWithRef<typeof TabsPrimitive.Content>) {
  return (
    <TabsPrimitive.Content
      ref={ref}
      className={cn(
        "mt-2 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        className
      )}
      {...props}
    />
  );
}
TabsContent.displayName = TabsPrimitive.Content.displayName;
export { TabsContent };
