import "server-only";
import type { ProductionRole } from "@filmset/auth";
import { assertRole, requireUser, type ProductionMembership } from "@filmset/auth/server";
import { runAsUser, schema, type Tx } from "@filmset/db/server";
import { and, asc, eq } from "drizzle-orm";
import { redirect } from "next/navigation";

export async function getMyMembership(productionId: string): Promise<ProductionMembership | null> {
  const user = await requireUser();
  const [row] = await runAsUser(user.id, (tx) =>
    tx
      .select({ role: schema.productionMembers.role })
      .from(schema.productionMembers)
      .where(and(eq(schema.productionMembers.productionId, productionId), eq(schema.productionMembers.userId, user.id)))
      .limit(1),
  );
  if (!row) return null;
  return { productionId, role: row.role as ProductionRole };
}

/** Throws FORBIDDEN if the current user isn't a member (or lacks an allowed role) — call from Server Actions. */
export async function requireProductionMember(productionId: string, allowedRoles?: ProductionRole[]) {
  const membership = await getMyMembership(productionId);
  return assertRole(membership, allowedRoles);
}

async function loadMembership(tx: Tx, userId: string, productionId: string) {
  const [membership] = await tx
    .select({ productionId: schema.productionMembers.productionId, role: schema.productionMembers.role })
    .from(schema.productionMembers)
    .where(and(eq(schema.productionMembers.userId, userId), eq(schema.productionMembers.productionId, productionId)))
    .limit(1);
  return membership ?? null;
}

/**
 * The signed-in user's current production, ready for a page's top-level
 * fetches. Redirects to /onboarding if they don't belong to one yet —
 * every protected screen calls this first (see apps/web/app/overview/page.tsx).
 *
 * "Current" means profiles.active_production_id (set by the project
 * switcher / createProduction / switchActiveProduction in
 * apps/web/app/production-actions.ts) when that still points at a
 * production the user belongs to; otherwise falls back to their
 * earliest membership, so an account with a stale/unset preference (or
 * one created before this preference existed) still lands somewhere
 * instead of erroring.
 *
 * Queries run through runAsUser, so Postgres RLS (not just this function)
 * is what actually limits the result to `membership`'s row: the
 * production_members SELECT policy lets a user see their own membership
 * rows regardless of production, which is what makes "find my production"
 * possible before we even know its id.
 */
export async function requireCurrentProduction() {
  const user = await requireUser();

  const { membership, production } = await runAsUser(user.id, async (tx) => {
    const [profile] = await tx
      .select({ activeProductionId: schema.profiles.activeProductionId })
      .from(schema.profiles)
      .where(eq(schema.profiles.id, user.id))
      .limit(1);

    let membership = profile?.activeProductionId ? await loadMembership(tx, user.id, profile.activeProductionId) : null;

    if (!membership) {
      const [fallback] = await tx
        .select({ productionId: schema.productionMembers.productionId, role: schema.productionMembers.role })
        .from(schema.productionMembers)
        .where(eq(schema.productionMembers.userId, user.id))
        .orderBy(asc(schema.productionMembers.createdAt))
        .limit(1);
      membership = fallback ?? null;
    }
    if (!membership) return { membership: null, production: null };

    const [production] = await tx.select().from(schema.productions).where(eq(schema.productions.id, membership.productionId)).limit(1);
    return { membership, production: production ?? null };
  });

  if (!membership || !production) redirect("/onboarding");

  return { user, production, role: membership.role as ProductionRole };
}
