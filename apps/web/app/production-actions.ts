"use server";

import { requireUser } from "@filmset/auth/server";
import { runAsUser, schema } from "@filmset/db/server";
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
      await tx.insert(schema.productions).values({ id, name, phase: "Development", createdBy: user.id });
      await tx.insert(schema.productionMembers).values({ productionId: id, userId: user.id, role: "Producer" });
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
