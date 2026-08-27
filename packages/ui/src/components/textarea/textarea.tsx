import * as React from "react";
import { cn } from "../../lib/cn";

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  /** Helper text shown under the field when there is no error. */
  description?: string;
  /** Actionable error message (§37) — state what happened and what to do. */
  error?: string;
  containerClassName?: string;
}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, containerClassName, label, description, error, id, ...props }, ref) => {
    const generatedId = React.useId();
    const textareaId = id ?? generatedId;
    const descriptionId = description ? `${textareaId}-description` : undefined;
    const errorId = error ? `${textareaId}-error` : undefined;

    return (
      <div className={cn("flex flex-col gap-[var(--fs-space-4)]", containerClassName)}>
        {label && (
          <label htmlFor={textareaId} className="text-[13px] font-medium leading-[16px] text-[var(--color-text-secondary)]">
            {label}
          </label>
        )}
        <textarea
          ref={ref}
          id={textareaId}
          aria-invalid={Boolean(error) || undefined}
          aria-describedby={cn(descriptionId, errorId) || undefined}
          className={cn(
            "rounded-md border bg-[var(--color-background-surface)]",
            "px-[var(--fs-space-12)] py-[var(--fs-space-8)] text-[14px] leading-[20px] text-[var(--color-text-primary)]",
            "border-[var(--color-border-standard)] placeholder:text-[var(--color-text-tertiary)]",
            "transition-colors duration-[var(--fs-motion-duration-fast)] ease-[var(--fs-motion-easing-standard)]",
            "outline-none focus-visible:border-[var(--color-action-primary)]",
            "focus-visible:ring-2 focus-visible:ring-[var(--color-action-primary)]/30",
            "disabled:opacity-[var(--fs-opacity-disabled)] disabled:cursor-not-allowed",
            "resize-y",
            error && "border-[var(--color-status-danger)]",
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
Textarea.displayName = "Textarea";
