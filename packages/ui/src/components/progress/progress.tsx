import * as ProgressPrimitive from "@radix-ui/react-progress";
import * as React from "react";
import { cn } from "../../lib/cn";

export interface ProgressProps extends React.ComponentPropsWithoutRef<typeof ProgressPrimitive.Root> {
  /** Shown inline, e.g. "Analyzing screenplay — 72%" (§35). Also supplies the progressbar's accessible name — pass `aria-label` yourself if omitting this. */
  label?: string;
}

/**
 * Visible progress for long jobs — never mask slowness with animation
 * alone (§35, §68). `value={null}` (Radix default) renders an
 * indeterminate bar for work with no known duration.
 */
export const Progress = React.forwardRef<React.ElementRef<typeof ProgressPrimitive.Root>, ProgressProps>(
  ({ className, value, label, id, "aria-labelledby": ariaLabelledBy, ...props }, ref) => {
    const generatedId = React.useId();
    const labelId = label ? (id ? `${id}-label` : generatedId) : undefined;

    return (
      <div className="flex flex-col gap-[var(--fs-space-4)]">
        {label && (
          <p id={labelId} className="text-[12px] leading-[16px] tabular-nums text-[var(--color-text-secondary)]">
            {label}
            {typeof value === "number" && ` — ${Math.round(value)}%`}
          </p>
        )}
        <ProgressPrimitive.Root
          ref={ref}
          value={value}
          id={id}
          aria-labelledby={labelId ?? ariaLabelledBy}
          className={cn(
            "relative h-[4px] w-full overflow-hidden rounded-full bg-[var(--color-background-elevated)]",
            className,
          )}
          {...props}
        >
          <ProgressPrimitive.Indicator
            className={cn(
              "h-full bg-[var(--color-action-primary)] transition-transform duration-[var(--fs-motion-duration-slow)] ease-[var(--fs-motion-easing-standard)]",
              value === null || value === undefined ? "w-1/3 animate-pulse" : undefined,
            )}
            style={value === null || value === undefined ? undefined : { transform: `translateX(-${100 - value}%)` }}
          />
        </ProgressPrimitive.Root>
      </div>
    );
  },
);
Progress.displayName = "Progress";
