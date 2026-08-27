import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { Loader2 } from "lucide-react";
import * as React from "react";
import { cn } from "../../lib/cn";

/**
 * Button hierarchy (§59): primary / secondary / tertiary / quiet / destructive.
 * A screen should rarely contain multiple competing primary buttons — that
 * discipline is a design-review concern, not something the component can
 * enforce, so keep primary use deliberate.
 *
 * High-risk actions cannot merely use a different color — pair `destructive`
 * with wording and confirmation proportionate to consequence (dialog, typed
 * confirmation, etc.) at the call site.
 */
const buttonVariants = cva(
  [
    "inline-flex items-center justify-center gap-8",
    "rounded-md font-ui text-[13px] font-medium leading-none",
    "transition-colors duration-[var(--fs-motion-duration-fast)] ease-[var(--fs-motion-easing-standard)]",
    "disabled:pointer-events-none disabled:opacity-[var(--fs-opacity-disabled)]",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
    "focus-visible:ring-[var(--color-action-primary)] focus-visible:ring-offset-[var(--color-background-canvas)]",
    "h-[var(--fs-control-height)] px-[var(--fs-space-12)]",
  ].join(" "),
  {
    variants: {
      variant: {
        primary: [
          "bg-[var(--color-action-primary)] text-[var(--color-action-on-primary)]",
          "hover:bg-[var(--color-action-hover)]",
          "active:bg-[var(--color-action-active)]",
        ].join(" "),
        secondary: [
          "bg-[var(--color-background-elevated)] text-[var(--color-text-primary)]",
          "border border-[var(--color-border-standard)]",
          "hover:border-[var(--color-border-strong)] hover:bg-[var(--color-background-surface)]",
        ].join(" "),
        tertiary: [
          "bg-transparent text-[var(--color-text-primary)]",
          "border border-[var(--color-border-subtle)]",
          "hover:bg-[var(--color-background-elevated)]",
        ].join(" "),
        quiet: [
          "bg-transparent text-[var(--color-text-secondary)]",
          "hover:bg-[var(--color-background-elevated)] hover:text-[var(--color-text-primary)]",
        ].join(" "),
        destructive: [
          "bg-transparent text-[var(--color-status-danger)]",
          "border border-[var(--color-border-standard)]",
          "hover:bg-[var(--color-status-danger)] hover:text-[var(--color-text-inverse)] hover:border-transparent",
        ].join(" "),
      },
      iconOnly: {
        true: "px-0 w-[var(--fs-control-height)]",
        false: "",
      },
    },
    defaultVariants: {
      variant: "primary",
      iconOnly: false,
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  /** Render as the child element (Radix Slot) instead of a <button>. */
  asChild?: boolean;
  /** Shows a spinner and disables interaction; label remains for screen readers. */
  loading?: boolean;
  /** Icon element placed before the label. */
  icon?: React.ReactNode;
  /** True when the button contains only an icon — requires aria-label. */
  iconOnly?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    { className, variant, iconOnly, loading, icon, disabled, children, asChild, ...props },
    ref,
  ) => {
    const Comp = asChild ? Slot : "button";

    return (
      <Comp
        ref={ref}
        className={cn(buttonVariants({ variant, iconOnly }), className)}
        disabled={disabled || loading}
        aria-busy={loading || undefined}
        {...props}
      >
        {loading ? (
          <Loader2 className="size-[14px] animate-spin" aria-hidden="true" />
        ) : (
          icon
        )}
        {!iconOnly && children}
      </Comp>
    );
  },
);
Button.displayName = "Button";
