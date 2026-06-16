import * as React from "react";
import { cn } from "@/lib/utils";
function AlertDescription({ className, ref, ...props }: React.HTMLAttributes<HTMLParagraphElement> & { ref?: React.Ref<HTMLParagraphElement> }) {
  return <div ref={ref} className={cn("text-sm [&_p]:leading-relaxed", className)} {...props} />;
}
AlertDescription.displayName = "AlertDescription";
export { AlertDescription };
