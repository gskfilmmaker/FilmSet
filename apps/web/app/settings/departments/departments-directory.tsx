"use client";

import { Shell } from "@/components/shell";
import type { Production, Scene } from "@filmset/core";
import { StatusBadge } from "@filmset/ui";
import Link from "next/link";

export interface DepartmentRow {
  id: string;
  name: string;
  headName: string | null;
  memberCount: number;
}

/**
 * DEPARTMENT_UX_SPEC.md §2 — Directory. Read-only landing screen for
 * Settings → Departments. Deliberately plain rows rather than the FRAME
 * `DataTable` primitive the spec names: no screen in this app actually
 * uses `DataTable` today (Crew/Cast/Locations all use a styled list),
 * so this follows the real established convention instead.
 */
export function DepartmentsDirectory({
  production,
  scenes,
  userEmail,
  departments,
}: {
  production: Pick<Production, "id" | "name" | "phase">;
  scenes: Pick<Scene, "id" | "number" | "setName" | "dayNight" | "intExt" | "shootDayId">[];
  userEmail: string | null;
  departments: DepartmentRow[];
}) {
  return (
    <Shell production={production} scenes={scenes} userEmail={userEmail ?? undefined}>
      <div className="flex flex-col gap-[var(--fs-space-24)] p-[var(--fs-space-24)]">
        <div className="flex flex-col gap-[var(--fs-space-4)]">
          <Link href="/settings" className="text-[13px] text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)]">
            ← Settings
          </Link>
          <h1 className="text-[22px] font-semibold leading-[28px] text-[var(--color-text-primary)]">Departments</h1>
        </div>

        <ul className="flex flex-col divide-y divide-[var(--color-border-subtle)] rounded-lg border border-[var(--color-border-subtle)]">
          {departments.map((d) => (
            <li key={d.id}>
              <Link
                href={`/settings/departments/${d.id}`}
                className="flex items-center justify-between gap-[var(--fs-space-16)] p-[var(--fs-space-12)] hover:bg-[var(--color-background-surface)]"
              >
                <span className="text-[13px] font-medium text-[var(--color-text-primary)]">{d.name}</span>
                <div className="flex shrink-0 items-center gap-[var(--fs-space-16)]">
                  <span className="text-[13px] text-[var(--color-text-secondary)]">{d.headName ?? "— Unassigned —"}</span>
                  <span className="text-[12px] text-[var(--color-text-tertiary)]">
                    {d.memberCount} member{d.memberCount === 1 ? "" : "s"}
                  </span>
                  {!d.headName && <StatusBadge tone="warning">No HOD</StatusBadge>}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </Shell>
  );
}
