import * as DialogPrimitive from "@radix-ui/react-dialog";
import { cva, type VariantProps } from "class-variance-authority";
import { X } from "lucide-react";
import * as React from "react";
import { cn } from "../../lib/cn";

/**
 * A side panel built on the same primitive as Dialog, for content that
 * needs focus but should preserve more workspace context than a centered
 * modal — a focused creation flow, a longer form, a detail view opened
 * from a table row (§22).
 */
export const Drawer = DialogPrimitive.Root;
export const DrawerTrigger = DialogPrimitive.Trigger;
export const DrawerClose = DialogPrimitive.Close;
export const DrawerPortal = DialogPrimitive.Portal;

export const DrawerOverlay = React.forwardRef<
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
DrawerOverlay.displayName = "DrawerOverlay";

const drawerVariants = cva(
  "fixed z-[var(--fs-z-modal)] flex h-full flex-col border-[var(--color-border-standard)] bg-[var(--color-background-elevated)] shadow-[var(--fs-shadow-lg)] outline-none",
  {
    variants: {
      side: {
        right: [
          "right-0 top-0 w-[min(480px,100vw)] border-l",
          "data-[state=open]:[animation:fs-slide-in-right_var(--fs-motion-duration-base)_var(--fs-motion-easing-enter)]",
          "data-[state=closed]:[animation:fs-slide-out-right_var(--fs-motion-duration-fast)_var(--fs-motion-easing-exit)]",
        ].join(" "),
        left: [
          "left-0 top-0 w-[min(480px,100vw)] border-r",
          "data-[state=open]:[animation:fs-slide-in-left_var(--fs-motion-duration-base)_var(--fs-motion-easing-enter)]",
          "data-[state=closed]:[animation:fs-slide-out-left_var(--fs-motion-duration-fast)_var(--fs-motion-easing-exit)]",
        ].join(" "),
      },
    },
    defaultVariants: { side: "right" },
  },
);

export interface DrawerContentProps
  extends React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>,
    VariantProps<typeof drawerVariants> {}

export const DrawerContent = React.forwardRef<React.ElementRef<typeof DialogPrimitive.Content>, DrawerContentProps>(
  ({ className, side, children, ...props }, ref) => (
    <DrawerPortal>
      <DrawerOverlay />
      <DialogPrimitive.Content ref={ref} className={cn(drawerVariants({ side }), className)} {...props}>
        <DialogPrimitive.Close
          className={cn(
            "absolute right-[16px] top-[16px] flex size-[28px] items-center justify-center rounded-md",
            "text-[var(--color-text-tertiary)] outline-none hover:bg-[var(--color-background-surface)] hover:text-[var(--color-text-primary)]",
            "focus-visible:ring-2 focus-visible:ring-[var(--color-action-primary)]",
            "[@media(pointer:coarse)]:size-[44px]",
          )}
          aria-label="Close panel"
        >
          <X className="size-[16px]" aria-hidden="true" />
        </DialogPrimitive.Close>
        {children}
      </DialogPrimitive.Content>
    </DrawerPortal>
  ),
);
DrawerContent.displayName = "DrawerContent";

export function DrawerHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "flex flex-col gap-[var(--fs-space-4)] border-b border-[var(--color-border-subtle)] p-[var(--fs-space-16)] pr-[48px]",
        "[@media(pointer:coarse)]:pr-[64px]",
        className,
      )}
      {...props}
    />
  );
}

export function DrawerBody({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex-1 overflow-y-auto p-[var(--fs-space-16)]", className)} {...props} />;
}

export function DrawerFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "flex items-center justify-end gap-[var(--fs-space-8)] border-t border-[var(--color-border-subtle)] p-[var(--fs-space-16)]",
        className,
      )}
      {...props}
    />
  );
}

export const DrawerTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn("text-[16px] font-semibold leading-[22px] text-[var(--color-text-primary)]", className)}
    {...props}
  />
));
DrawerTitle.displayName = "DrawerTitle";

export const DrawerDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className={cn("text-[13px] leading-[18px] text-[var(--color-text-secondary)]", className)}
    {...props}
  />
));
DrawerDescription.displayName = "DrawerDescription";
