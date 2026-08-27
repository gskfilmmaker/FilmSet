import { X } from "lucide-react";
import * as React from "react";
import { cn } from "../../lib/cn";

export interface InspectorProps {
  /** The object's type, e.g. "SCENE", "LOCATION" — sets expectation before the title. */
  objectType: string;
  title: string;
  subtitle?: string;
  onClose?: () => void;
  headerActions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

/**
 * Standardized object inspector (§21). The same pattern works for scene,
 * person, location, prop, costume, shot, expense, document — consistency
 * dramatically reduces learning cost. Contextual and collapsible; never
 * destroys the caller's workspace state.
 */
export function Inspector({ objectType, title, subtitle, onClose, headerActions, children, className }: InspectorProps) {
  return (
    <aside
      aria-label={`${objectType} inspector: ${title}`}
      className={cn(
        "flex h-full flex-col border-l border-[var(--color-border-subtle)] bg-[var(--color-background-elevated)]",
        className,
      )}
      style={{ width: "var(--fs-panel-inspector-default)" }}
    >
      <div className="flex items-start justify-between gap-8 border-b border-[var(--color-border-subtle)] p-[var(--fs-space-16)]">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--color-text-tertiary)]">
            {objectType}
          </p>
          <h2 className="mt-[2px] truncate text-[16px] font-semibold leading-[22px] text-[var(--color-text-primary)]">
            {title}
          </h2>
          {subtitle && (
            <p className="mt-[2px] truncate text-[13px] leading-[16px] text-[var(--color-text-secondary)]">{subtitle}</p>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-4">
          {headerActions}
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              aria-label="Close inspector"
              className={cn(
                "flex size-[28px] items-center justify-center rounded-md text-[var(--color-text-tertiary)]",
                "hover:bg-[var(--color-background-surface)] hover:text-[var(--color-text-primary)]",
                "outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-action-primary)]",
              )}
            >
              <X className="size-[16px]" aria-hidden="true" />
            </button>
          )}
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-[var(--fs-space-16)]">
        <div className="flex flex-col gap-[var(--fs-space-20)]">{children}</div>
      </div>
    </aside>
  );
}

export interface InspectorSectionProps {
  label: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}

export function InspectorSection({ label, action, children }: InspectorSectionProps) {
  return (
    <section className="flex flex-col gap-8">
      <div className="flex items-center justify-between">
        <h3 className="text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--color-text-tertiary)]">
          {label}
        </h3>
        {action}
      </div>
      <div className="text-[13px] leading-[18px] text-[var(--color-text-primary)]">{children}</div>
    </section>
  );
}
