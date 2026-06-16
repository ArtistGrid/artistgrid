"use client";
import * as React from "react";
import * as AvatarPrimitive from "@radix-ui/react-avatar";
import { cn } from "@/lib/utils";
function AvatarFallback({ className, ref, ...props }: React.ComponentPropsWithRef<typeof AvatarPrimitive.Fallback>) {
  return (
    <AvatarPrimitive.Fallback
      ref={ref}
      className={cn("flex h-full w-full items-center justify-center rounded-full bg-muted", className)}
      {...props}
    />
  );
}
AvatarFallback.displayName = AvatarPrimitive.Fallback.displayName;
export { AvatarFallback };
