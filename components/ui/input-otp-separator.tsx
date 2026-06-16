"use client";
import * as React from "react";
import { Dot } from "lucide-react";
function InputOTPSeparator({ ref, ...props }: React.ComponentPropsWithoutRef<"div"> & { ref?: React.Ref<HTMLDivElement> }) {
  return (
    <div ref={ref} role="separator" {...props}>
      <Dot />
    </div>
  );
}
InputOTPSeparator.displayName = "InputOTPSeparator";
export { InputOTPSeparator };
