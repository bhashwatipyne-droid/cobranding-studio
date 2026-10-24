import * as React from "react";
import { cn } from "@/lib/utils";

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(({ className, ...props }, ref) => (
  <input
    ref={ref}
    className={cn("h-10 w-full rounded-md border border-line-2 bg-surface px-3 text-[13px] outline-none transition focus:border-accent focus:ring-[3px] focus:ring-accent/20 disabled:cursor-not-allowed disabled:border-dashed disabled:bg-surface-2 disabled:text-ink-soft", className)}
    {...props}
  />
));
Input.displayName = "Input";
