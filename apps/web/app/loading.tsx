import { Skeleton } from "@filmset/ui";

/**
 * Root-level loading UI (§35) — shown while a screen's Server Component
 * fetches its ProductionSnapshot. Every screen's rough shape is a header
 * plus a couple of panel-sized blocks, so one shared skeleton (not five
 * bespoke ones) covers the real perceived-layout case reasonably well.
 */
export default function Loading() {
  return (
    <div className="flex h-screen flex-col gap-[var(--fs-space-24)] p-[var(--fs-space-24)]">
      <div className="flex items-center justify-between">
        <Skeleton className="h-[28px] w-[220px]" />
        <Skeleton className="h-[var(--fs-control-height)] w-[160px]" />
      </div>
      <Skeleton className="h-[96px] w-full" />
      <div className="grid grid-cols-1 gap-[var(--fs-space-24)] md:grid-cols-2">
        <Skeleton className="h-[160px] w-full" />
        <Skeleton className="h-[160px] w-full" />
      </div>
      <Skeleton className="h-[200px] w-full" />
    </div>
  );
}
