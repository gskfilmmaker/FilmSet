"use client";

import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Command as CommandPrimitive } from "cmdk";
import { Search } from "lucide-react";
import * as React from "react";
import { cn } from "../../lib/cn";

/**
 * The universal command palette (§19/§20) — search and commands as one
 * interface. Owns no global keybinding itself; the app wires ⌘K to
 * `onOpenChange`, matching how GlobalBar's search field already triggers it.
 */
export const Command = React.forwardRef<
  React.ElementRef<typeof CommandPrimitive>,
  React.ComponentPropsWithoutRef<typeof CommandPrimitive>
>(({ className, ...props }, ref) => (
  <CommandPrimitive
    ref={ref}
    className={cn("flex h-full w-full flex-col overflow-hidden text-[var(--color-text-primary)]", className)}
    {...props}
  />
));
Command.displayName = "Command";

export interface CommandDialogProps extends React.ComponentPropsWithoutRef<typeof DialogPrimitive.Root> {
  label?: string;
}

export function CommandDialog({ children, label = "Command palette", ...props }: CommandDialogProps) {
  return (
    <DialogPrimitive.Root {...props}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay
          className={cn(
            "fixed inset-0 z-[var(--fs-z-overlay)] bg-[var(--color-background-overlay)]",
            "data-[state=open]:[animation:fs-fade-in_var(--fs-motion-duration-base)_var(--fs-motion-easing-enter)]",
            "data-[state=closed]:[animation:fs-fade-out_var(--fs-motion-duration-fast)_var(--fs-motion-easing-exit)]",
          )}
        />
        <DialogPrimitive.Content
          className={cn(
            "fixed left-1/2 top-[15%] z-[var(--fs-z-modal)] w-[min(560px,calc(100vw-32px))] -translate-x-1/2",
            "overflow-hidden rounded-lg border border-[var(--color-border-standard)] bg-[var(--color-background-elevated)]",
            "shadow-[var(--fs-shadow-lg)] outline-none",
            "data-[state=open]:[animation:fs-dialog-in_var(--fs-motion-duration-base)_var(--fs-motion-easing-enter)]",
            "data-[state=closed]:[animation:fs-dialog-out_var(--fs-motion-duration-fast)_var(--fs-motion-easing-exit)]",
          )}
        >
          <DialogPrimitive.Title className="sr-only">{label}</DialogPrimitive.Title>
          <DialogPrimitive.Description className="sr-only">
            Search the production or run a command.
          </DialogPrimitive.Description>
          <Command shouldFilter={true}>{children}</Command>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

export const CommandInput = React.forwardRef<
  React.ElementRef<typeof CommandPrimitive.Input>,
  React.ComponentPropsWithoutRef<typeof CommandPrimitive.Input>
>(({ className, ...props }, ref) => (
  <div className="flex items-center gap-[var(--fs-space-8)] border-b border-[var(--color-border-subtle)] px-[var(--fs-space-16)]">
    <Search className="size-[16px] shrink-0 text-[var(--color-text-tertiary)]" aria-hidden="true" />
    <CommandPrimitive.Input
      ref={ref}
      className={cn(
        "h-[48px] w-full bg-transparent text-[14px] text-[var(--color-text-primary)] outline-none",
        "placeholder:text-[var(--color-text-tertiary)]",
        className,
      )}
      {...props}
    />
  </div>
));
CommandInput.displayName = "CommandInput";

export const CommandList = React.forwardRef<
  React.ElementRef<typeof CommandPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof CommandPrimitive.List>
>(({ className, ...props }, ref) => (
  <CommandPrimitive.List ref={ref} className={cn("max-h-[360px] overflow-y-auto overflow-x-hidden p-[4px]", className)} {...props} />
));
CommandList.displayName = "CommandList";

export const CommandEmpty = React.forwardRef<
  React.ElementRef<typeof CommandPrimitive.Empty>,
  React.ComponentPropsWithoutRef<typeof CommandPrimitive.Empty>
>((props, ref) => (
  <CommandPrimitive.Empty
    ref={ref}
    className="py-[var(--fs-space-24)] text-center text-[13px] text-[var(--color-text-tertiary)]"
    {...props}
  />
));
CommandEmpty.displayName = "CommandEmpty";

export const CommandGroup = React.forwardRef<
  React.ElementRef<typeof CommandPrimitive.Group>,
  React.ComponentPropsWithoutRef<typeof CommandPrimitive.Group>
>(({ className, ...props }, ref) => (
  <CommandPrimitive.Group
    ref={ref}
    className={cn(
      "overflow-hidden p-[4px]",
      "[&_[cmdk-group-heading]]:px-[var(--fs-space-8)] [&_[cmdk-group-heading]]:py-[4px]",
      "[&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:uppercase",
      "[&_[cmdk-group-heading]]:tracking-[0.04em] [&_[cmdk-group-heading]]:text-[var(--color-text-tertiary)]",
      className,
    )}
    {...props}
  />
));
CommandGroup.displayName = "CommandGroup";

export const CommandSeparator = React.forwardRef<
  React.ElementRef<typeof CommandPrimitive.Separator>,
  React.ComponentPropsWithoutRef<typeof CommandPrimitive.Separator>
>(({ className, ...props }, ref) => (
  <CommandPrimitive.Separator ref={ref} className={cn("my-[4px] h-px bg-[var(--color-border-subtle)]", className)} {...props} />
));
CommandSeparator.displayName = "CommandSeparator";

export const CommandItem = React.forwardRef<
  React.ElementRef<typeof CommandPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof CommandPrimitive.Item>
>(({ className, ...props }, ref) => (
  <CommandPrimitive.Item
    ref={ref}
    className={cn(
      "relative flex h-[var(--fs-control-height)] cursor-pointer select-none items-center gap-[var(--fs-space-8)]",
      "rounded-[4px] px-[var(--fs-space-8)] text-[13px] text-[var(--color-text-primary)] outline-none",
      "data-[selected=true]:bg-[var(--color-background-surface)]",
      "data-[disabled=true]:pointer-events-none data-[disabled=true]:opacity-[var(--fs-opacity-disabled)]",
      className,
    )}
    {...props}
  />
));
CommandItem.displayName = "CommandItem";

export function CommandShortcut({ className, ...props }: React.HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cn("ml-auto text-[11px] tracking-widest text-[var(--color-text-tertiary)]", className)}
      {...props}
    />
  );
}
