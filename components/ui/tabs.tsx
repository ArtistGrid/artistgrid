"use client";
import * as React from "react";
import * as TabsPrimitive from "@radix-ui/react-tabs";
import { cn } from "@/lib/utils";
const Tabs = TabsPrimitive.Root;
function TabsList({ className, ref, ...props }: React.ComponentPropsWithRef<typeof TabsPrimitive.List>) {
  return (
    <TabsPrimitive.List
      ref={ref}
      className={cn(
        "inline-flex h-10 items-center justify-center rounded-md bg-muted p-1 text-muted-foreground",
        className
      )}
      {...props}
    />
  );
}
TabsList.displayName = TabsPrimitive.List.displayName;
export { TabsTrigger } from "./tabs-trigger";
export { TabsContent } from "./tabs-content";
export { Tabs, TabsList };
