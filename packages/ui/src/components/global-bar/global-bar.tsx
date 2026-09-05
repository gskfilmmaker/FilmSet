import { Bell, ChevronDown, Menu, Search } from "lucide-react";
import * as React from "react";
import { cn } from "../../lib/cn";
import { FilmSetWordmark } from "../frame-mark/filmset-wordmark";
import { FrameMark } from "../frame-mark/frame-mark";

export interface GlobalBarProps {
  productionName: string;
  /** e.g. "Prep", "Production", "Wrap" — production phase, not a system env label. */
  phase?: string;
  notificationCount?: number;
  userName: string;
  userInitials: string;
  onOpenCommandPalette: () => void;
  onOpenNotifications?: () => void;
  onOpenProductionSwitcher?: () => void;
  onOpenUserMenu?: () => void;
  /** Only rendered (as a lg:hidden hamburger, leftmost) when provided — the persistent Sidebar is desktop-only, this is its mobile replacement. */
  onOpenMobileNav?: () => void;
  className?: string;
}

/**
 * Global bar (§17) — restrained. Mark, current production, phase, universal
 * search/command, notifications, user. Module-specific controls belong in
 * the workspace toolbar, never here.
 */
export function GlobalBar({
  productionName,
  phase,
  notificationCount = 0,
  userName,
  userInitials,
  onOpenCommandPalette,
  onOpenNotifications,
  onOpenProductionSwitcher,
  onOpenUserMenu,
  onOpenMobileNav,
  className,
}: GlobalBarProps) {
  return (
    <header
      className={cn(
        "flex h-[var(--fs-control-height)] items-center justify-between gap-[var(--fs-space-16)]",
        "border-b border-[var(--color-border-subtle)] bg-[var(--color-background-canvas)]",
        "px-[var(--fs-space-16)]",
        className,
      )}
    >
      <div className="flex min-w-0 items-center gap-[var(--fs-space-16)]">
        {onOpenMobileNav && (
          <button
            type="button"
            onClick={onOpenMobileNav}
            aria-label="Open navigation menu"
            className={cn(
              "flex size-[28px] shrink-0 items-center justify-center rounded-md lg:hidden",
              "text-[var(--color-text-secondary)] hover:bg-[var(--color-background-elevated)] hover:text-[var(--color-text-primary)]",
              "outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-action-primary)]",
            )}
          >
            <Menu className="size-[18px]" aria-hidden="true" />
          </button>
        )}
        <div className="flex shrink-0 items-center gap-[var(--fs-space-4)]" aria-hidden="true">
          <FrameMark className="size-[18px] text-[var(--color-action-primary)]" />
          <FilmSetWordmark className="hidden text-[14px] text-[var(--color-text-primary)] sm:block" />
        </div>
        <span className="hidden h-[16px] w-px bg-[var(--color-border-subtle)] sm:block" aria-hidden="true" />
        <button
          type="button"
          onClick={onOpenProductionSwitcher}
          className={cn(
            "flex min-w-0 items-center gap-[var(--fs-space-4)] rounded-md px-[var(--fs-space-8)] py-[var(--fs-space-4)] text-[13px] font-medium",
            "text-[var(--color-text-primary)] hover:bg-[var(--color-background-elevated)]",
            "outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-action-primary)]",
          )}
        >
          <span className="max-w-[120px] truncate sm:max-w-[240px]">{productionName}</span>
          {phase && (
            <span className="ml-[var(--fs-space-4)] hidden shrink-0 rounded-sm bg-[var(--color-background-elevated)] px-[6px] py-[1px] text-[11px] font-medium text-[var(--color-text-tertiary)] sm:block">
              {phase}
            </span>
          )}
          <ChevronDown className="size-[14px] shrink-0 text-[var(--color-text-tertiary)]" aria-hidden="true" />
        </button>
      </div>

      <button
        type="button"
        onClick={onOpenCommandPalette}
        aria-label="Search or run a command"
        className={cn(
          "flex w-[36px] shrink-0 items-center justify-center gap-[var(--fs-space-8)] rounded-md border border-[var(--color-border-standard)]",
          "bg-[var(--color-background-surface)] px-[var(--fs-space-8)] py-[6px] text-[13px] text-[var(--color-text-tertiary)]",
          "hover:border-[var(--color-border-strong)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-action-primary)]",
          "sm:w-full sm:max-w-[420px] sm:justify-start sm:px-[var(--fs-space-12)]",
        )}
      >
        <Search className="size-[14px] shrink-0" aria-hidden="true" />
        <span className="hidden flex-1 text-left sm:block">Search or run a command</span>
        <kbd className="hidden rounded-sm border border-[var(--color-border-standard)] bg-[var(--color-background-elevated)] px-[6px] py-[1px] text-[11px] font-medium tabular-nums sm:block">
          ⌘K
        </kbd>
      </button>

      <div className="flex items-center gap-[var(--fs-space-8)]">
        <button
          type="button"
          onClick={onOpenNotifications}
          aria-label={notificationCount > 0 ? `Notifications, ${notificationCount} unread` : "Notifications"}
          className={cn(
            "relative flex size-[var(--fs-control-height)] items-center justify-center rounded-md",
            "text-[var(--color-text-secondary)] hover:bg-[var(--color-background-elevated)] hover:text-[var(--color-text-primary)]",
            "outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-action-primary)]",
          )}
        >
          <Bell className="size-[16px]" aria-hidden="true" />
          {notificationCount > 0 && (
            <span
              className="absolute right-[6px] top-[6px] size-[6px] rounded-full bg-[var(--color-action-primary)]"
              aria-hidden="true"
            />
          )}
        </button>
        <button
          type="button"
          onClick={onOpenUserMenu}
          aria-label={`Account menu for ${userName}`}
          className={cn(
            "flex size-[28px] items-center justify-center rounded-full bg-[var(--color-background-elevated)]",
            "text-[12px] font-semibold text-[var(--color-text-primary)] border border-[var(--color-border-standard)]",
            "outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-action-primary)]",
          )}
        >
          {userInitials}
        </button>
      </div>
    </header>
  );
}
