import * as SelectPrimitive from "@radix-ui/react-select";
import { Check, ChevronDown, ChevronUp } from "lucide-react";
import * as React from "react";
import { cn } from "../../lib/cn";

export const Select = SelectPrimitive.Root;
export const SelectGroup = SelectPrimitive.Group;
export const SelectValue = SelectPrimitive.Value;

export const SelectTrigger = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Trigger>
>(({ className, children, ...props }, ref) => (
  <SelectPrimitive.Trigger
    ref={ref}
    className={cn(
      "flex h-[var(--fs-control-height)] w-full items-center justify-between gap-[var(--fs-space-8)] rounded-md border",
      "border-[var(--color-border-standard)] bg-[var(--color-background-surface)] px-[var(--fs-space-12)]",
      "text-[14px] leading-[20px] text-[var(--color-text-primary)]",
      "data-[placeholder]:text-[var(--color-text-tertiary)]",
      "outline-none focus-visible:border-[var(--color-action-primary)] focus-visible:ring-2 focus-visible:ring-[var(--color-action-primary)]/30",
      "disabled:cursor-not-allowed disabled:opacity-[var(--fs-opacity-disabled)]",
      className,
    )}
    {...props}
  >
    {children}
    <SelectPrimitive.Icon asChild>
      <ChevronDown className="size-[14px] shrink-0 text-[var(--color-text-tertiary)]" aria-hidden="true" />
    </SelectPrimitive.Icon>
  </SelectPrimitive.Trigger>
));
SelectTrigger.displayName = "SelectTrigger";

export const SelectContent = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Content>
>(({ className, children, position = "popper", ...props }, ref) => (
  <SelectPrimitive.Portal>
    <SelectPrimitive.Content
      ref={ref}
      position={position}
      className={cn(
        "relative z-[var(--fs-z-dropdown)] max-h-[--radix-select-content-available-height] min-w-[var(--radix-select-trigger-width)]",
        "overflow-hidden rounded-md border border-[var(--color-border-standard)] bg-[var(--color-background-elevated)]",
        "shadow-[var(--fs-shadow-md)]",
        className,
      )}
      {...props}
    >
      <SelectPrimitive.ScrollUpButton className="flex h-[20px] items-center justify-center text-[var(--color-text-tertiary)]">
        <ChevronUp className="size-[14px]" aria-hidden="true" />
      </SelectPrimitive.ScrollUpButton>
      <SelectPrimitive.Viewport className="p-[4px]">{children}</SelectPrimitive.Viewport>
      <SelectPrimitive.ScrollDownButton className="flex h-[20px] items-center justify-center text-[var(--color-text-tertiary)]">
        <ChevronDown className="size-[14px]" aria-hidden="true" />
      </SelectPrimitive.ScrollDownButton>
    </SelectPrimitive.Content>
  </SelectPrimitive.Portal>
));
SelectContent.displayName = "SelectContent";

export const SelectLabel = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Label>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Label>
>(({ className, ...props }, ref) => (
  <SelectPrimitive.Label
    ref={ref}
    className={cn(
      "px-[var(--fs-space-8)] py-[4px] text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--color-text-tertiary)]",
      className,
    )}
    {...props}
  />
));
SelectLabel.displayName = "SelectLabel";

export const SelectItem = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Item>
>(({ className, children, ...props }, ref) => (
  <SelectPrimitive.Item
    ref={ref}
    className={cn(
      "relative flex h-[var(--fs-control-height)] cursor-pointer select-none items-center rounded-md",
      "px-[var(--fs-space-8)] pr-[28px] text-[13px] text-[var(--color-text-primary)] outline-none",
      "data-[highlighted]:bg-[var(--color-background-surface)]",
      "data-[disabled]:pointer-events-none data-[disabled]:opacity-[var(--fs-opacity-disabled)]",
      className,
    )}
    {...props}
  >
    <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
    <SelectPrimitive.ItemIndicator className="absolute right-[8px] flex items-center">
      <Check className="size-[14px] text-[var(--color-action-primary)]" aria-hidden="true" />
    </SelectPrimitive.ItemIndicator>
  </SelectPrimitive.Item>
));
SelectItem.displayName = "SelectItem";

export const SelectSeparator = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Separator>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Separator>
>(({ className, ...props }, ref) => (
  <SelectPrimitive.Separator
    ref={ref}
    className={cn("my-[4px] h-px bg-[var(--color-border-subtle)]", className)}
    {...props}
  />
));
SelectSeparator.displayName = "SelectSeparator";
