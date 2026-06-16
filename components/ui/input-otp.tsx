"use client";
import * as React from "react";
import { OTPInput } from "input-otp";
import { cn } from "@/lib/utils";
function InputOTP({ className, containerClassName, ref, ...props }: React.ComponentPropsWithRef<typeof OTPInput>) {
  return (
    <OTPInput
      ref={ref}
      containerClassName={cn("flex items-center gap-2 has-[:disabled]:opacity-50", containerClassName)}
      className={cn("disabled:cursor-not-allowed", className)}
      {...props}
    />
  );
}
InputOTP.displayName = "InputOTP";
function InputOTPGroup({ className, ref, ...props }: React.ComponentPropsWithoutRef<"div"> & { ref?: React.Ref<HTMLDivElement> }) {
  return <div ref={ref} className={cn("flex items-center", className)} {...props} />;
}
InputOTPGroup.displayName = "InputOTPGroup";
export { InputOTPSlot } from "./input-otp-slot";
export { InputOTPSeparator } from "./input-otp-separator";
export { InputOTP, InputOTPGroup };
