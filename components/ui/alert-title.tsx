import * as React from "react";
import { cn } from "@/lib/utils";
function AlertTitle({ className, ref, ...props }: React.HTMLAttributes<HTMLHeadingElement> & { ref?: React.Ref<HTMLParagraphElement> }) {
  return <h5 ref={ref} className={cn("mb-1 font-medium leading-none tracking-tight", className)} {...props} />;
}
AlertTitle.displayName = "AlertTitle";
export { AlertTitle };
