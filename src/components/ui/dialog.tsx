"use client";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import * as React from "react";
import { cn } from "@/lib/utils";

export const Dialog = DialogPrimitive.Root;
export const DialogTitle = DialogPrimitive.Title;
export const DialogDescription = DialogPrimitive.Description;

export const DialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> & { hideClose?: boolean }
>(({ className, children, hideClose, ...props }, ref) => (
  <DialogPrimitive.Portal>
    <DialogPrimitive.Overlay className="fixed inset-0 z-[200] bg-ink/50 backdrop-blur-[3px]" style={{ animation: "fadeIn .18s" }} />
    <DialogPrimitive.Content
      ref={ref}
      className={cn("rise-in fixed left-1/2 top-1/2 z-[201] max-h-[92vh] max-w-[96vw] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-xl bg-surface shadow-5 outline-none", className)}
      {...props}
    >
      {children}
      {!hideClose && (
        <DialogPrimitive.Close aria-label="Close" className="absolute right-3.5 top-3.5 z-10 grid size-8 place-items-center rounded-full bg-white/90 text-ink-soft shadow-2 hover:bg-white hover:text-ink">
          <X className="size-4" />
        </DialogPrimitive.Close>
      )}
    </DialogPrimitive.Content>
  </DialogPrimitive.Portal>
));
DialogContent.displayName = "DialogContent";
