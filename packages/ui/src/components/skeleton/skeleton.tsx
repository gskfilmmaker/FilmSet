import * as React from "react";
import { cn } from "../../lib/cn";

/**
 * Prefer this over a full-page spinner wherever the eventual layout is
 * known (§35). `animate-pulse` is Tailwind's native keyframe — not part of
 * the numbered spacing scale, so it needs no token wiring.
 */
export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("animate-pulse rounded-md bg-[var(--color-background-elevated)]", className)}
      aria-hidden="true"
      {...props}
    />
  );
}
