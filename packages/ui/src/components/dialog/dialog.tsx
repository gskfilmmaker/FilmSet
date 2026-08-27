import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import * as React from "react";
import { cn } from "../../lib/cn";

/**
 * Reserve for irreversible action confirmation, critical approval, security,
 * or focused creation flows (§22). Never open one Dialog from another — use
 * an inline step or a Drawer instead. Prefer inline editing, an Inspector,
 * a Popover, or a Drawer for anything that doesn't need focused,
 * blocking attention.
 */
export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogClose = DialogPrimitive.Close;
export const DialogPortal = DialogPrimitive.Portal;

export const DialogOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      "fixed inset-0 z-[var(--fs-z-overlay)] bg-[var(--color-background-overlay)]",
      "data-[state=open]:[animation:fs-fade-in_var(--fs-motion-duration-base)_var(--fs-motion-easing-enter)]",
      "data-[state=closed]:[animation:fs-fade-out_var(--fs-motion-duration-fast)_var(--fs-motion-easing-exit)]",
      className,
    )}
    {...props}
  />
));
DialogOverlay.displayName = "DialogOverlay";

export const DialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>
>(({ className, children, ...props }, ref) => (
  <DialogPortal>
    <DialogOverlay />
    <DialogPrimitive.Content
      ref={ref}
      className={cn(
        "fixed left-1/2 top-1/2 z-[var(--fs-z-modal)] w-[min(480px,calc(100vw-32px))] -translate-x-1/2 -translate-y-1/2",
        "rounded-lg border border-[var(--color-border-standard)] bg-[var(--color-background-elevated)]",
        "p-[var(--fs-space-24)] shadow-[var(--fs-shadow-lg)] outline-none",
        "data-[state=open]:[animation:fs-dialog-in_var(--fs-motion-duration-base)_var(--fs-motion-easing-enter)]",
        "data-[state=closed]:[animation:fs-dialog-out_var(--fs-motion-duration-fast)_var(--fs-motion-easing-exit)]",
        className,
      )}
      {...props}
    >
      {children}
      <DialogPrimitive.Close
        className={cn(
          "absolute right-[16px] top-[16px] flex size-[28px] items-center justify-center rounded-md",
          "text-[var(--color-text-tertiary)] outline-none hover:bg-[var(--color-background-surface)] hover:text-[var(--color-text-primary)]",
          "focus-visible:ring-2 focus-visible:ring-[var(--color-action-primary)]",
        )}
        aria-label="Close dialog"
      >
        <X className="size-[16px]" aria-hidden="true" />
      </DialogPrimitive.Close>
    </DialogPrimitive.Content>
  </DialogPortal>
));
DialogContent.displayName = "DialogContent";

export function DialogHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex flex-col gap-[var(--fs-space-4)] pr-[24px]", className)} {...props} />;
}

export function DialogFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("mt-[var(--fs-space-24)] flex items-center justify-end gap-[var(--fs-space-8)]", className)}
      {...props}
    />
  );
}

export const DialogTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn("text-[16px] font-semibold leading-[22px] text-[var(--color-text-primary)]", className)}
    {...props}
  />
));
DialogTitle.displayName = "DialogTitle";

export const DialogDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className={cn("text-[13px] leading-[18px] text-[var(--color-text-secondary)]", className)}
    {...props}
  />
));
DialogDescription.displayName = "DialogDescription";
