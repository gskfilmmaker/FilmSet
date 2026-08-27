import * as CheckboxPrimitive from "@radix-ui/react-checkbox";
import { Check, Minus } from "lucide-react";
import * as React from "react";
import { cn } from "../../lib/cn";

export const Checkbox = React.forwardRef<
  React.ElementRef<typeof CheckboxPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root>
>(({ className, ...props }, ref) => (
  <CheckboxPrimitive.Root
    ref={ref}
    className={cn(
      "flex size-[16px] shrink-0 items-center justify-center rounded-[4px] border",
      "border-[var(--color-border-strong)] bg-[var(--color-background-surface)]",
      "data-[state=checked]:border-[var(--color-action-primary)] data-[state=checked]:bg-[var(--color-action-primary)]",
      "data-[state=indeterminate]:border-[var(--color-action-primary)] data-[state=indeterminate]:bg-[var(--color-action-primary)]",
      "outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-action-primary)] focus-visible:ring-offset-1 focus-visible:ring-offset-[var(--color-background-surface)]",
      "disabled:cursor-not-allowed disabled:opacity-[var(--fs-opacity-disabled)]",
      className,
    )}
    {...props}
  >
    <CheckboxPrimitive.Indicator className="text-[var(--color-text-inverse)]">
      {props.checked === "indeterminate" ? (
        <Minus className="size-[11px]" aria-hidden="true" />
      ) : (
        <Check className="size-[11px]" aria-hidden="true" />
      )}
    </CheckboxPrimitive.Indicator>
  </CheckboxPrimitive.Root>
));
Checkbox.displayName = "Checkbox";
