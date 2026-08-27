import { ChevronsLeft, ChevronsRight } from "lucide-react";
import * as React from "react";
import { cn } from "../../lib/cn";

export interface SidebarItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  href?: string;
  badge?: React.ReactNode;
}

export interface SidebarProps {
  items: SidebarItem[];
  activeId: string;
  onNavigate: (id: string) => void;
  /** FilmSet AI is pinned at the bottom, separated from the module list (§18). */
  aiItem: SidebarItem;
  /** Settings/administration is separated from primary navigation (§18). */
  settingsItem: SidebarItem;
  expanded: boolean;
  onToggleExpanded: () => void;
  className?: string;
}

/**
 * Primary sidebar (§18). Supports expanded / collapsed / keyboard nav.
 * Rests on the canvas layer — no separate fill, "lifted" only by the border
 * against the workspace (§9).
 */
export function Sidebar({
  items,
  activeId,
  onNavigate,
  aiItem,
  settingsItem,
  expanded,
  onToggleExpanded,
  className,
}: SidebarProps) {
  const allIds = React.useMemo(() => [...items.map((i) => i.id), aiItem.id, settingsItem.id], [items, aiItem, settingsItem]);
  const itemRefs = React.useRef<Map<string, HTMLButtonElement>>(new Map());

  function handleKeyDown(event: React.KeyboardEvent, currentId: string) {
    const index = allIds.indexOf(currentId);
    let nextIndex: number | null = null;
    if (event.key === "ArrowDown") nextIndex = (index + 1) % allIds.length;
    if (event.key === "ArrowUp") nextIndex = (index - 1 + allIds.length) % allIds.length;
    if (event.key === "Home") nextIndex = 0;
    if (event.key === "End") nextIndex = allIds.length - 1;
    if (nextIndex !== null) {
      event.preventDefault();
      const nextId = allIds[nextIndex];
      if (nextId) itemRefs.current.get(nextId)?.focus();
    }
  }

  function renderItem(item: SidebarItem) {
    const isActive = item.id === activeId;
    return (
      <button
        key={item.id}
        ref={(el) => {
          if (el) itemRefs.current.set(item.id, el);
          else itemRefs.current.delete(item.id);
        }}
        type="button"
        role="link"
        aria-current={isActive ? "page" : undefined}
        title={!expanded ? item.label : undefined}
        onClick={() => onNavigate(item.id)}
        onKeyDown={(e) => handleKeyDown(e, item.id)}
        className={cn(
          "group flex items-center gap-8 rounded-md px-[var(--fs-space-8)]",
          "h-[var(--fs-control-height)] text-[13px] font-medium leading-none",
          "outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-action-primary)] focus-visible:ring-offset-1 focus-visible:ring-offset-[var(--color-background-canvas)]",
          "transition-colors duration-[var(--fs-motion-duration-fast)] ease-[var(--fs-motion-easing-standard)]",
          !expanded && "justify-center px-0",
          isActive
            ? "bg-[var(--color-background-elevated)] text-[var(--color-text-primary)]"
            : "text-[var(--color-text-secondary)] hover:bg-[var(--color-background-elevated)] hover:text-[var(--color-text-primary)]",
        )}
      >
        <span
          className={cn(
            "flex size-[16px] shrink-0 items-center justify-center",
            isActive ? "text-[var(--color-action-primary)]" : "text-current",
          )}
          aria-hidden="true"
        >
          {item.icon}
        </span>
        {expanded && <span className="truncate">{item.label}</span>}
        {expanded && item.badge}
      </button>
    );
  }

  return (
    <nav
      aria-label="Primary"
      className={cn(
        "flex h-full flex-col justify-between border-r border-[var(--color-border-subtle)] bg-[var(--color-background-canvas)]",
        "transition-[width] duration-[var(--fs-motion-duration-base)] ease-[var(--fs-motion-easing-standard)]",
        "p-[var(--fs-space-8)]",
        className,
      )}
      style={{ width: expanded ? "var(--fs-panel-sidebar-expanded)" : "var(--fs-panel-sidebar-collapsed)" }}
    >
      <div className="flex flex-col gap-4">{items.map(renderItem)}</div>
      <div className="flex flex-col gap-4 border-t border-[var(--color-border-subtle)] pt-[var(--fs-space-8)]">
        {renderItem(aiItem)}
        {renderItem(settingsItem)}
        <button
          type="button"
          onClick={onToggleExpanded}
          aria-label={expanded ? "Collapse sidebar" : "Expand sidebar"}
          className={cn(
            "flex h-[var(--fs-control-height)] items-center gap-8 rounded-md px-[var(--fs-space-8)]",
            "text-[var(--color-text-tertiary)] hover:bg-[var(--color-background-elevated)] hover:text-[var(--color-text-primary)]",
            "outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-action-primary)]",
            !expanded && "justify-center px-0",
          )}
        >
          {expanded ? (
            <ChevronsLeft className="size-[16px]" aria-hidden="true" />
          ) : (
            <ChevronsRight className="size-[16px]" aria-hidden="true" />
          )}
          {expanded && <span className="text-[13px]">Collapse</span>}
        </button>
      </div>
    </nav>
  );
}
