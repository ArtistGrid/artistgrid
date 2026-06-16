"use client";
import * as React from "react";
import * as AvatarPrimitive from "@radix-ui/react-avatar";
import { cn } from "@/lib/utils";
function Avatar({ className, ref, ...props }: React.ComponentPropsWithRef<typeof AvatarPrimitive.Root>) {
  return (
    <AvatarPrimitive.Root
      ref={ref}
      className={cn("relative flex h-10 w-10 shrink-0 overflow-hidden rounded-full", className)}
      {...props}
    />
  );
}
Avatar.displayName = AvatarPrimitive.Root.displayName;
export { AvatarImage } from "./avatar-image";
export { AvatarFallback } from "./avatar-fallback";
export { Avatar };
