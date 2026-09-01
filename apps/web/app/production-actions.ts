"use server";

import { requireUser } from "@filmset/auth/server";
import { STANDARD_DEPARTMENTS } from "@filmset/core";
import { runAsUser, schema, type Tx } from "@filmset/db/server";
import { and, eq } from "drizzle-orm";
import { redirect } from "next/navigation";

export interface MyProduction {
  id: string;
  name: string;
  phase: string;
  role: string;
}

/** Every production the signed-in user belongs to — powers the project switcher. */
export async function listMyProductions(): Promise<MyProduction[]> {
  const user = await requireUser();
  return runAsUser(user.id, (db) =>
    db
      .select({
        id: schema.productions.id,
        name: schema.productions.name,
        phase: schema.productions.phase,
        role: schema.productionMembers.role,
      })
      .from(schema.productionMembers)
      .innerJoin(schema.productions, eq(schema.productions.id, schema.productionMembers.productionId))
      .where(eq(schema.productionMembers.userId, user.id)),
  );
}

/**
 * Every production must belong to an organization (P1a — see
 * docs/audits/VRINDAVAN_MIGRATION_IMPACT.md). Real organization
 * onboarding/selection UX doesn't exist yet (that's later work, once P1b's
 * authorize() engine lands), so for now this reuses the caller's first
 * existing organization membership if they have one, or creates a personal
 * one named after them. One user, one organization, for the moment — the
 * same shape the P1a migration's backfill gave the existing account.
 */
async function getOrCreateOwnOrganizationId(tx: Tx, userId: string, userEmail: string | null): Promise<string> {
  const [existing] = await tx
    .select({ organizationId: schema.organizationMemberships.organizationId })
    .from(schema.organizationMemberships)
    .where(eq(schema.organizationMemberships.userId, userId))
    .limit(1);
  if (existing) return existing.organizationId;

  const organizationId = crypto.randomUUID();
  await tx.insert(schema.organizations).values({ id: organizationId, name: `${userEmail ?? "My"} Organization`, createdBy: userId });
  await tx.insert(schema.organizationMemberships).values({ organizationId, userId, role: "Owner" });
  return organizationId;
}

/**
 * Creates a new production, makes the caller its Producer, and makes it
 * their active production. Used both by onboarding (a brand-new account's
 * first production) and by the project switcher's "New production" form —
 * same action either way, a FormData `name` field is all either caller has.
 */
export async function createProduction(formData: FormData) {
  const user = await requireUser();
  const name = String(formData.get("name") ?? "").trim();
  if (!name) throw new Error("Production name is required.");

  const id = crypto.randomUUID();
  await runAsUser(user.id, (db) =>
    db.transaction(async (tx) => {
      const organizationId = await getOrCreateOwnOrganizationId(tx, user.id, user.email);
      await tx.insert(schema.productions).values({ id, name, phase: "Development", createdBy: user.id, organizationId });
      await tx.insert(schema.productionMembers).values({ productionId: id, userId: user.id, role: "Producer" });
      // P1b's migration backfilled the standard department list for every
      // production that existed at cutover time; a production created
      // afterward needs the same seed here, or its Departments screen
      // (apps/web/app/settings/departments) would start empty forever.
      await tx.insert(schema.departments).values(STANDARD_DEPARTMENTS.map((name) => ({ id: crypto.randomUUID(), productionId: id, name })));
      await tx.update(schema.profiles).set({ activeProductionId: id }).where(eq(schema.profiles.id, user.id));
    }),
  );

  redirect("/overview");
}

/** Switches which production requireCurrentProduction loads for this user. */
export async function switchActiveProduction(productionId: string) {
  const user = await requireUser();
  await runAsUser(user.id, async (db) => {
    const [membership] = await db
      .select({ productionId: schema.productionMembers.productionId })
      .from(schema.productionMembers)
      .where(and(eq(schema.productionMembers.userId, user.id), eq(schema.productionMembers.productionId, productionId)))
      .limit(1);
    if (!membership) throw new Error("You're not a member of that production.");
    await db.update(schema.profiles).set({ activeProductionId: productionId }).where(eq(schema.profiles.id, user.id));
  });
  redirect("/overview");
}
