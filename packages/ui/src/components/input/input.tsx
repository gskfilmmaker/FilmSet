import * as React from "react";
import { cn } from "../../lib/cn";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  /** Helper text shown under the field when there is no error. */
  description?: string;
  /** Actionable error message (§37) — state what happened and what to do. */
  error?: string;
  /** Right-aligns and applies tabular numerals — for money, time, page counts (§13). */
  numeric?: boolean;
  containerClassName?: string;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  (
    { className, containerClassName, label, description, error, numeric, id, ...props },
    ref,
  ) => {
    const generatedId = React.useId();
    const inputId = id ?? generatedId;
    const descriptionId = description ? `${inputId}-description` : undefined;
    const errorId = error ? `${inputId}-error` : undefined;

    return (
      <div className={cn("flex flex-col gap-[var(--fs-space-4)]", containerClassName)}>
        {label && (
          <label
            htmlFor={inputId}
            className="text-[13px] font-medium leading-[16px] text-[var(--color-text-secondary)]"
          >
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          aria-invalid={Boolean(error) || undefined}
          aria-describedby={cn(descriptionId, errorId) || undefined}
          className={cn(
            "h-[var(--fs-control-height)] rounded-md border bg-[var(--color-background-surface)]",
            "px-[var(--fs-space-12)] text-[14px] leading-[20px] text-[var(--color-text-primary)]",
            "border-[var(--color-border-standard)] placeholder:text-[var(--color-text-tertiary)]",
            "transition-colors duration-[var(--fs-motion-duration-fast)] ease-[var(--fs-motion-easing-standard)]",
            "outline-none focus-visible:border-[var(--color-action-primary)]",
            "focus-visible:ring-2 focus-visible:ring-[var(--color-action-primary)]/30",
            "disabled:opacity-[var(--fs-opacity-disabled)] disabled:cursor-not-allowed",
            error && "border-[var(--color-status-danger)]",
            numeric && "text-right tabular-nums",
            className,
          )}
          {...props}
        />
        {error ? (
          <p id={errorId} role="alert" className="text-[12px] leading-[16px] text-[var(--color-status-danger)]">
            {error}
          </p>
        ) : description ? (
          <p id={descriptionId} className="text-[12px] leading-[16px] text-[var(--color-text-tertiary)]">
            {description}
          </p>
        ) : null}
      </div>
    );
  },
);
Input.displayName = "Input";
