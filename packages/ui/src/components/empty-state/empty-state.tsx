import * as React from "react";
import { cn } from "../../lib/cn";

export interface EmptyStateProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Small monochrome icon — not a large illustration (§36). */
  icon?: React.ReactNode;
  title: string;
  /** Teach the workflow, not just state absence — "Import a screenplay to create scenes...", not "No scenes found." */
  description?: string;
  action?: React.ReactNode;
  secondaryAction?: React.ReactNode;
}

export function EmptyState({ icon, title, description, action, secondaryAction, className, ...props }: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-[var(--fs-space-12)] px-[var(--fs-space-24)] py-[var(--fs-space-48)] text-center",
        className,
      )}
      {...props}
    >
      {icon && (
        <div className="flex size-[32px] items-center justify-center text-[var(--color-text-tertiary)]" aria-hidden="true">
          {icon}
        </div>
      )}
      <div className="flex flex-col gap-[var(--fs-space-4)]">
        <p className="text-[14px] font-medium leading-[20px] text-[var(--color-text-primary)]">{title}</p>
        {description && (
          <p className="max-w-[360px] text-[13px] leading-[18px] text-[var(--color-text-secondary)]">{description}</p>
        )}
      </div>
      {(action || secondaryAction) && (
        <div className="mt-[var(--fs-space-8)] flex items-center gap-[var(--fs-space-8)]">
          {action}
          {secondaryAction}
        </div>
      )}
    </div>
  );
}
