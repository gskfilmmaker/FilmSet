"use client";

import { Shell } from "@/components/shell";
import type { Production, Scene } from "@filmset/core";
import { Check } from "lucide-react";
import Link from "next/link";

export interface RoleBundle {
  roleId: string;
  roleName: string;
  grants: { key: string; description: string }[];
}

/**
 * DEPARTMENT_UX_SPEC.md §5 — Permission Preview. Reads `role_permissions`
 * directly (via the Server Component page above), so if a future PR edits
 * the seeded bundles, this screen updates with zero code change — it is
 * not a hand-maintained description of what each role does.
 *
 * The spec's `Tooltip`-based "ⓘ" explanation for the HOD-only grant is
 * rendered here as an inline caption instead: `TooltipProvider` isn't set
 * up anywhere in this app yet, and adding global provider wiring for one
 * caption is out of scope for this screen.
 */
export function DepartmentPermissionPreview({
  production,
  scenes,
  userEmail,
  departmentId,
  departmentName,
  roleBundles,
  extraGrants,
  hasHead,
}: {
  production: Pick<Production, "id" | "name" | "phase">;
  scenes: Pick<Scene, "id" | "number" | "setName" | "dayNight" | "intExt" | "shootDayId">[];
  userEmail: string | null;
  departmentId: string;
  departmentName: string;
  roleBundles: RoleBundle[];
  extraGrants: { key: string; description: string }[];
  hasHead: boolean;
}) {
  return (
    <Shell production={production} scenes={scenes} userEmail={userEmail ?? undefined}>
      <div className="flex flex-col gap-[var(--fs-space-24)] p-[var(--fs-space-24)]">
        <div className="flex flex-col gap-[var(--fs-space-4)]">
          <Link
            href={`/settings/departments/${departmentId}`}
            className="text-[13px] text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)]"
          >
            ← {departmentName}
          </Link>
          <h1 className="text-[22px] font-semibold leading-[28px] text-[var(--color-text-primary)]">{departmentName} — Permissions</h1>
          <p className="text-[13px] text-[var(--color-text-secondary)]">What this department&apos;s role structure actually grants, today.</p>
        </div>

        <div className="flex flex-col divide-y divide-[var(--color-border-subtle)] rounded-lg border border-[var(--color-border-subtle)]">
          {roleBundles.map((bundle) => (
            <div key={bundle.roleId} className="flex flex-col gap-[var(--fs-space-8)] p-[var(--fs-space-16)]">
              <h2 className="text-[13px] font-semibold text-[var(--color-text-primary)]">{bundle.roleName}</h2>
              {bundle.grants.length === 0 ? (
                <p className="text-[13px] text-[var(--color-text-tertiary)]">No permissions granted.</p>
              ) : (
                <ul className="flex flex-col gap-[var(--fs-space-4)]">
                  {bundle.grants.map((g) => {
                    const isHodOnly = g.key === "departments.manage" || g.key === "departments.assign_hod";
                    return (
                      <li key={g.key} className="flex items-start gap-[var(--fs-space-8)] text-[13px] text-[var(--color-text-secondary)]">
                        <Check className="mt-[2px] size-[14px] shrink-0 text-[var(--color-status-success)]" aria-hidden="true" />
                        <span>
                          {g.description}
                          {isHodOnly && (
                            <span className="ml-[6px] text-[12px] text-[var(--color-text-tertiary)]">
                              — granted via the HOD record ({hasHead ? "assigned" : "unassigned"}), never this role bundle
                            </span>
                          )}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          ))}

          {extraGrants.length > 0 && (
            <div className="flex flex-col gap-[var(--fs-space-8)] p-[var(--fs-space-16)]">
              <h2 className="text-[13px] font-semibold text-[var(--color-text-primary)]">Extra department-specific grants</h2>
              <ul className="flex flex-col gap-[var(--fs-space-4)]">
                {extraGrants.map((g) => (
                  <li key={g.key} className="flex items-start gap-[var(--fs-space-8)] text-[13px] text-[var(--color-text-secondary)]">
                    <Check className="mt-[2px] size-[14px] shrink-0 text-[var(--color-status-success)]" aria-hidden="true" />
                    <span>{g.description}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </Shell>
  );
}
