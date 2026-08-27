import * as ToastPrimitive from "@radix-ui/react-toast";
import { cva, type VariantProps } from "class-variance-authority";
import { AlertTriangle, CheckCircle2, Info, OctagonAlert, X } from "lucide-react";
import * as React from "react";
import { cn } from "../../lib/cn";

export const ToastProvider = ToastPrimitive.Provider;

export const ToastViewport = React.forwardRef<
  React.ElementRef<typeof ToastPrimitive.Viewport>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitive.Viewport>
>(({ className, ...props }, ref) => (
  <ToastPrimitive.Viewport
    ref={ref}
    className={cn(
      "fixed bottom-0 right-0 z-[var(--fs-z-toast)] flex w-[min(380px,100vw)] flex-col gap-[var(--fs-space-8)] p-[var(--fs-space-16)] outline-none",
      className,
    )}
    {...props}
  />
));
ToastViewport.displayName = "ToastViewport";

const toastVariants = cva(
  [
    "relative flex items-start gap-[var(--fs-space-8)] rounded-md border p-[var(--fs-space-12)] shadow-[var(--fs-shadow-md)]",
    "data-[state=open]:[animation:fs-toast-in_var(--fs-motion-duration-base)_var(--fs-motion-easing-enter)]",
    "data-[state=closed]:[animation:fs-fade-out_var(--fs-motion-duration-fast)_var(--fs-motion-easing-exit)]",
    "data-[swipe=end]:[animation:fs-toast-swipe-out_var(--fs-motion-duration-fast)_var(--fs-motion-easing-exit)]",
  ].join(" "),
  {
    variants: {
      tone: {
        neutral: "border-[var(--color-border-standard)] bg-[var(--color-background-elevated)]",
        success: "border-[var(--color-status-success)]/30 bg-[var(--color-background-elevated)]",
        warning: "border-[var(--color-status-warning)]/30 bg-[var(--color-background-elevated)]",
        danger: "border-[var(--color-status-danger)]/30 bg-[var(--color-background-elevated)]",
        info: "border-[var(--color-status-info)]/30 bg-[var(--color-background-elevated)]",
      },
    },
    defaultVariants: { tone: "neutral" },
  },
);

const toneIcon: Record<NonNullable<VariantProps<typeof toastVariants>["tone"]>, React.ReactNode> = {
  neutral: null,
  success: <CheckCircle2 className="size-[16px] shrink-0 text-[var(--color-status-success)]" aria-hidden="true" />,
  warning: <AlertTriangle className="size-[16px] shrink-0 text-[var(--color-status-warning)]" aria-hidden="true" />,
  danger: <OctagonAlert className="size-[16px] shrink-0 text-[var(--color-status-danger)]" aria-hidden="true" />,
  info: <Info className="size-[16px] shrink-0 text-[var(--color-status-info)]" aria-hidden="true" />,
};

export interface ToastProps
  extends React.ComponentPropsWithoutRef<typeof ToastPrimitive.Root>,
    VariantProps<typeof toastVariants> {}

export const Toast = React.forwardRef<React.ElementRef<typeof ToastPrimitive.Root>, ToastProps>(
  ({ className, tone, children, ...props }, ref) => {
    const resolvedTone = tone ?? "neutral";
    return (
      <ToastPrimitive.Root ref={ref} className={cn(toastVariants({ tone: resolvedTone }), className)} {...props}>
        {toneIcon[resolvedTone]}
        <div className="flex-1 min-w-0">{children}</div>
      </ToastPrimitive.Root>
    );
  },
);
Toast.displayName = "Toast";

export const ToastTitle = React.forwardRef<
  React.ElementRef<typeof ToastPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitive.Title>
>(({ className, ...props }, ref) => (
  <ToastPrimitive.Title ref={ref} className={cn("text-[13px] font-medium leading-[16px] text-[var(--color-text-primary)]", className)} {...props} />
));
ToastTitle.displayName = "ToastTitle";

export const ToastDescription = React.forwardRef<
  React.ElementRef<typeof ToastPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitive.Description>
>(({ className, ...props }, ref) => (
  <ToastPrimitive.Description ref={ref} className={cn("mt-[2px] text-[12px] leading-[16px] text-[var(--color-text-secondary)]", className)} {...props} />
));
ToastDescription.displayName = "ToastDescription";

export const ToastAction = React.forwardRef<
  React.ElementRef<typeof ToastPrimitive.Action>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitive.Action>
>(({ className, ...props }, ref) => (
  <ToastPrimitive.Action
    ref={ref}
    className={cn(
      "mt-[8px] inline-flex h-[24px] items-center rounded-[4px] border border-[var(--color-border-standard)] px-[8px] text-[12px] font-medium text-[var(--color-text-primary)] outline-none hover:bg-[var(--color-background-surface)] focus-visible:ring-2 focus-visible:ring-[var(--color-action-primary)]",
      className,
    )}
    {...props}
  />
));
ToastAction.displayName = "ToastAction";

export const ToastClose = React.forwardRef<
  React.ElementRef<typeof ToastPrimitive.Close>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitive.Close>
>(({ className, ...props }, ref) => (
  <ToastPrimitive.Close
    ref={ref}
    aria-label="Dismiss"
    className={cn(
      "absolute right-[8px] top-[8px] flex size-[20px] items-center justify-center rounded-[4px] text-[var(--color-text-tertiary)] outline-none hover:bg-[var(--color-background-surface)] hover:text-[var(--color-text-primary)] focus-visible:ring-2 focus-visible:ring-[var(--color-action-primary)]",
      className,
    )}
    {...props}
  >
    <X className="size-[12px]" aria-hidden="true" />
  </ToastPrimitive.Close>
));
ToastClose.displayName = "ToastClose";
