"use client";
import * as React from "react";
import * as AvatarPrimitive from "@radix-ui/react-avatar";
import { cn } from "@/lib/utils";
function AvatarImage({ className, ref, ...props }: React.ComponentPropsWithRef<typeof AvatarPrimitive.Image>) {
  return <AvatarPrimitive.Image ref={ref} className={cn("aspect-square h-full w-full", className)} {...props} />;
}
AvatarImage.displayName = AvatarPrimitive.Image.displayName;
export { AvatarImage };
