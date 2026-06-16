import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";
const alertVariants = cva(
  "relative w-full rounded-lg border p-4 [&>svg~*]:pl-7 [&>svg+div]:translate-y-[-3px] [&>svg]:absolute [&>svg]:left-4 [&>svg]:top-4 [&>svg]:text-foreground",
  {
    variants: {
      variant: {
        default: "bg-background text-foreground",
        destructive: "border-destructive/50 text-destructive dark:border-destructive [&>svg]:text-destructive",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);
function Alert({ className, variant, ref, ...props }: React.HTMLAttributes<HTMLDivElement> & VariantProps<typeof alertVariants> & { ref?: React.Ref<HTMLDivElement> }) {
  return <div ref={ref} role="alert" className={cn(alertVariants({ variant }), className)} {...props} />;
}
Alert.displayName = "Alert";
export { AlertTitle } from "./alert-title";
export { AlertDescription } from "./alert-description";
export { Alert };
