import { cva, type VariantProps } from "class-variance-authority";
import { AlertTriangle, CheckCircle2, Circle, Info, OctagonAlert } from "lucide-react";
import * as React from "react";
import { cn } from "../../lib/cn";

/**
 * Status is never color-only (§12, §27, §33). Every badge pairs a color with
 * an icon and a label. Use industry status language at the call site
 * (Scheduled, Locked, Superseded, Pickup...) — this component only supplies
 * the visual tone, not the vocabulary.
 */
const statusBadgeVariants = cva(
  "inline-flex items-center gap-4 rounded-md px-[var(--fs-space-8)] py-[2px] text-[12px] font-medium leading-4 border",
  {
    variants: {
      tone: {
        success: "text-[var(--color-status-success)] border-[var(--color-status-success)]/30 bg-[var(--color-status-success)]/10",
        warning: "text-[var(--color-status-warning)] border-[var(--color-status-warning)]/30 bg-[var(--color-status-warning)]/10",
        danger: "text-[var(--color-status-danger)] border-[var(--color-status-danger)]/30 bg-[var(--color-status-danger)]/10",
        info: "text-[var(--color-status-info)] border-[var(--color-status-info)]/30 bg-[var(--color-status-info)]/10",
        neutral: "text-[var(--color-text-secondary)] border-[var(--color-border-standard)] bg-[var(--color-background-elevated)]",
      },
    },
    defaultVariants: { tone: "neutral" },
  },
);

const defaultIcon: Record<NonNullable<VariantProps<typeof statusBadgeVariants>["tone"]>, React.ReactNode> = {
  success: <CheckCircle2 className="size-[12px]" aria-hidden="true" />,
  warning: <AlertTriangle className="size-[12px]" aria-hidden="true" />,
  danger: <OctagonAlert className="size-[12px]" aria-hidden="true" />,
  info: <Info className="size-[12px]" aria-hidden="true" />,
  neutral: <Circle className="size-[8px] fill-current" aria-hidden="true" />,
};

export interface StatusBadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof statusBadgeVariants> {
  icon?: React.ReactNode;
}

export const StatusBadge = React.forwardRef<HTMLSpanElement, StatusBadgeProps>(
  ({ className, tone, icon, children, ...props }, ref) => {
    const resolvedTone = tone ?? "neutral";
    return (
      <span ref={ref} className={cn(statusBadgeVariants({ tone: resolvedTone }), className)} {...props}>
        {icon ?? defaultIcon[resolvedTone]}
        {children}
      </span>
    );
  },
);
StatusBadge.displayName = "StatusBadge";
