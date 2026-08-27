import * as TabsPrimitive from "@radix-ui/react-tabs";
import * as React from "react";
import { cn } from "../../lib/cn";

export const Tabs = TabsPrimitive.Root;

export const TabsList = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.List
    ref={ref}
    className={cn(
      "inline-flex h-[var(--fs-control-height)] items-center gap-[var(--fs-space-4)] rounded-md border border-[var(--color-border-subtle)] bg-[var(--color-background-surface)] p-[3px]",
      className,
    )}
    {...props}
  />
));
TabsList.displayName = "TabsList";

export const TabsTrigger = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Trigger
    ref={ref}
    className={cn(
      "inline-flex h-full items-center rounded-[4px] px-[var(--fs-space-12)] text-[13px] font-medium leading-none",
      "text-[var(--color-text-secondary)] outline-none transition-colors duration-[var(--fs-motion-duration-fast)]",
      "hover:text-[var(--color-text-primary)]",
      "data-[state=active]:bg-[var(--color-background-elevated)] data-[state=active]:text-[var(--color-text-primary)]",
      "data-[state=active]:shadow-[var(--fs-shadow-sm)]",
      "focus-visible:ring-2 focus-visible:ring-[var(--color-action-primary)]",
      "disabled:pointer-events-none disabled:opacity-[var(--fs-opacity-disabled)]",
      className,
    )}
    {...props}
  />
));
TabsTrigger.displayName = "TabsTrigger";

export const TabsContent = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Content
    ref={ref}
    className={cn("mt-[var(--fs-space-12)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-action-primary)]", className)}
    {...props}
  />
));
TabsContent.displayName = "TabsContent";
