import * as React from "react";
import { cn } from "@/lib/utils";
import { ChevronDown } from "lucide-react";
interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  options: {
    value: string;
    label: string;
  }[];
}
const Select = React.forwardRef<HTMLSelectElement, SelectProps>(({ className, options, ...props }, ref) => (
  <div className="relative">
    <select
      ref={ref}
      className={cn(
        "flex h-8 w-full appearance-none items-center min-w-[7.5rem] cursor-pointer rounded-lg border border-white/10 bg-white/[0.04] px-3 pr-8 text-xs text-white/85 transition-colors hover:border-white/15 hover:bg-white/[0.07] focus-visible:border-white/30 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      {...props}
    >
      {options.map((opt) => (
        <option key={opt.value} value={opt.value} className="bg-neutral-900 text-white">
          {opt.label}
        </option>
      ))}
    </select>
    <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/40 pointer-events-none" />
  </div>
));
Select.displayName = "Select";
export { Select };
