"use server";

import { requireProductionMember } from "@/lib/authz";
import { PRODUCTION_ROLES, type ProductionRole } from "@filmset/auth";
import { requireUser } from "@filmset/auth/server";
import { runAsUser, schema } from "@filmset/db/server";
import { and, eq, sql } from "drizzle-orm";

/**
 * Team management — the "production owners can invite/manage members"
 * requirement. Invites are synchronous, not email-based: they look up an
 * existing profiles row by email (auto-created for every signed-up user)
 * and add a membership directly. There's no invite-by-email-before-signup
 * flow here — that would need the Supabase Admin API (a service-role
 * operation) and an email template, out of scope for this pass.
 *
 * The lookup goes through find_profile_for_invite (a security definer SQL
 * function), not a plain `select from profiles` — the profiles RLS policies
 * only let a caller see their own row or a *co-member's* row, which is
 * exactly the row a fresh invitee doesn't have yet. The function bypasses
 * that, gated on the caller already being a Producer of productionId.
 */

export async function inviteMember(productionId: string, email: string, role: ProductionRole) {
  const user = await requireUser();
  await requireProductionMember(productionId, ["Producer"]);

  const trimmedEmail = email.trim().toLowerCase();
  if (!trimmedEmail) throw new Error("Email is required.");
  if (!PRODUCTION_ROLES.includes(role)) throw new Error("Not a valid role.");

  await runAsUser(user.id, async (db) => {
    const [profile] = await db.execute<{ id: string }>(
      sql`select id from public.find_profile_for_invite(${productionId}, ${trimmedEmail})`,
    );
    if (!profile) {
      throw new Error(`No FilmSet account found for ${trimmedEmail} yet — ask them to sign up first, then invite them again.`);
    }
    await db
      .insert(schema.productionMembers)
      .values({ productionId, userId: profile.id, role })
      .onConflictDoUpdate({
        target: [schema.productionMembers.productionId, schema.productionMembers.userId],
        set: { role },
      });
  });
}

export async function updateMemberRole(productionId: string, userId: string, role: ProductionRole) {
  const user = await requireUser();
  await requireProductionMember(productionId, ["Producer"]);
  await runAsUser(user.id, (db) =>
    db
      .update(schema.productionMembers)
      .set({ role })
      .where(and(eq(schema.productionMembers.productionId, productionId), eq(schema.productionMembers.userId, userId))),
  );
}

/** A Producer can remove anyone; any member can remove themselves (leave the production). */
export async function removeMember(productionId: string, userId: string) {
  const actingUser = await requireUser();
  const membership = await requireProductionMember(productionId);
  if (membership.role !== "Producer" && actingUser.id !== userId) {
    throw new Error("Only a Producer can remove other members.");
  }
  await runAsUser(actingUser.id, (db) =>
    db
      .delete(schema.productionMembers)
      .where(and(eq(schema.productionMembers.productionId, productionId), eq(schema.productionMembers.userId, userId))),
  );
}
