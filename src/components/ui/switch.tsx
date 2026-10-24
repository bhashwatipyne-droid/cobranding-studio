"use client";
import * as SwitchPrimitive from "@radix-ui/react-switch";
import * as React from "react";
import { cn } from "@/lib/utils";

export const Switch = React.forwardRef<React.ElementRef<typeof SwitchPrimitive.Root>, React.ComponentPropsWithoutRef<typeof SwitchPrimitive.Root> & { small?: boolean }>(
  ({ className, small, ...props }, ref) => (
    <SwitchPrimitive.Root
      ref={ref}
      className={cn("relative shrink-0 rounded-full bg-line-2 transition-colors data-[state=checked]:bg-accent", small ? "h-[18px] w-8" : "h-[22px] w-[38px]", className)}
      {...props}
    >
      <SwitchPrimitive.Thumb
        className={cn("block rounded-full bg-white shadow-1 transition-transform", small ? "size-3.5 translate-x-0.5 data-[state=checked]:translate-x-4" : "size-[18px] translate-x-0.5 data-[state=checked]:translate-x-[18px]")}
      />
    </SwitchPrimitive.Root>
  ),
);
Switch.displayName = "Switch";
