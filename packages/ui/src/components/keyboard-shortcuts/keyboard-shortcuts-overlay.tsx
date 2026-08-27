import * as React from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "../dialog/dialog";
import { shortcutGroups } from "../../keyboard/shortcuts";

export interface KeyboardShortcutsOverlayProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * The documented shortcut set (§42), made discoverable. Open with `?`
 * from anywhere a text field isn't focused.
 */
export function KeyboardShortcutsOverlay({ open, onOpenChange }: KeyboardShortcutsOverlayProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[min(560px,calc(100vw-32px))]">
        <DialogHeader>
          <DialogTitle>Keyboard shortcuts</DialogTitle>
          <DialogDescription>Every high-frequency action has a keyboard route.</DialogDescription>
        </DialogHeader>
        <div className="mt-[var(--fs-space-16)] grid grid-cols-2 gap-[var(--fs-space-24)]">
          {shortcutGroups.map((group) => (
            <div key={group.title} className="flex flex-col gap-[var(--fs-space-8)]">
              <h3 className="text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--color-text-tertiary)]">
                {group.title}
              </h3>
              <ul className="flex flex-col gap-[var(--fs-space-8)]">
                {group.shortcuts.map((s) => (
                  <li key={s.description} className="flex items-center justify-between gap-[var(--fs-space-12)]">
                    <span className="text-[13px] text-[var(--color-text-secondary)]">{s.description}</span>
                    <span className="flex shrink-0 gap-[4px]">
                      {s.keys.map((k) => (
                        <kbd
                          key={k}
                          className="rounded-[4px] border border-[var(--color-border-standard)] bg-[var(--color-background-surface)] px-[6px] py-[1px] text-[11px] font-medium text-[var(--color-text-primary)]"
                        >
                          {k}
                        </kbd>
                      ))}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** Opens on `?` when no text input/textarea/contenteditable is focused. Closes handled by the Dialog itself (Esc, overlay click). */
export function useKeyboardShortcutsOverlay() {
  const [open, setOpen] = React.useState(false);

  React.useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      const isTyping =
        target?.tagName === "INPUT" || target?.tagName === "TEXTAREA" || target?.isContentEditable;
      if (e.key === "?" && !isTyping) {
        e.preventDefault();
        setOpen(true);
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  return { open, setOpen };
}
