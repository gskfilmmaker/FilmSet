"use client";

import { Monitor } from "lucide-react";
import * as React from "react";
import { cn } from "../../lib/cn";

const DESKTOP_BREAKPOINT_QUERY = "(min-width: 1024px)";

/**
 * A non-blocking advisory for screens whose primary job is configuration or
 * approval, not field use — Security & Access admin tabs, budget approval,
 * organization settings. Never denies the action; someone who genuinely
 * needs to act from a phone still can — this only sets expectations that
 * the layout below was designed for a larger screen, matching how the rest
 * of the app is deliberately split between "office" screens and "handy"
 * field screens (Scan, Call Sheet, Crew/Cast lookup) rather than trying to
 * cram every workflow into one responsive layout.
 *
 * Defaults to hidden on the server and during the first client render
 * (`isNarrow` starts false) so there's no server/client markup mismatch —
 * it only appears once matchMedia has actually measured the viewport.
 */
export function DesktopRecommendedBanner({ children, className }: { children: React.ReactNode; className?: string }) {
  const [isNarrow, setIsNarrow] = React.useState(false);

  React.useEffect(() => {
    const mql = window.matchMedia(DESKTOP_BREAKPOINT_QUERY);
    setIsNarrow(!mql.matches);
    function onChange(e: MediaQueryListEvent) {
      setIsNarrow(!e.matches);
    }
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  if (!isNarrow) return null;

  return (
    <div
      className={cn(
        "flex items-start gap-[var(--fs-space-8)] rounded-md border border-[var(--color-status-info)]/30 bg-[var(--color-status-info)]/10 p-[var(--fs-space-12)] text-[13px] text-[var(--color-text-secondary)]",
        className,
      )}
    >
      <Monitor className="mt-[1px] size-[15px] shrink-0 text-[var(--color-status-info)]" aria-hidden="true" />
      <p>{children}</p>
    </div>
  );
}
