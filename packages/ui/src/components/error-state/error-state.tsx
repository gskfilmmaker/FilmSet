import { OctagonAlert } from "lucide-react";
import * as React from "react";
import { cn } from "../../lib/cn";

export interface ErrorStateProps extends React.HTMLAttributes<HTMLDivElement> {
  /** What happened, in plain language — "You don't have permission to publish this schedule." */
  title: string;
  /** What to do about it — "Ask the 1st AD or Production Administrator for publishing access." */
  description?: string;
  /** Technical identifier (status code, request id) — available under a Details disclosure, never the headline (§37). */
  details?: string;
  action?: React.ReactNode;
}

export function ErrorState({ title, description, details, action, className, ...props }: ErrorStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-[var(--fs-space-12)] px-[var(--fs-space-24)] py-[var(--fs-space-48)] text-center",
        className,
      )}
      {...props}
    >
      <OctagonAlert className="size-[24px] text-[var(--color-status-danger)]" aria-hidden="true" />
      <div className="flex flex-col gap-[var(--fs-space-4)]">
        <p className="text-[14px] font-medium leading-[20px] text-[var(--color-text-primary)]">{title}</p>
        {description && (
          <p className="max-w-[360px] text-[13px] leading-[18px] text-[var(--color-text-secondary)]">{description}</p>
        )}
      </div>
      {action && <div className="mt-[var(--fs-space-8)]">{action}</div>}
      {details && (
        <details className="mt-[var(--fs-space-8)] text-left">
          <summary className="cursor-pointer text-[12px] leading-[16px] text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)]">
            Details
          </summary>
          <pre className="mt-[var(--fs-space-8)] max-w-[360px] overflow-x-auto rounded-md bg-[var(--color-background-elevated)] p-[var(--fs-space-12)] font-mono text-[11px] leading-[16px] text-[var(--color-text-tertiary)]">
            {details}
          </pre>
        </details>
      )}
    </div>
  );
}
