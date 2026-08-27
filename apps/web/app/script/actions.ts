"use server";

import { requireProductionMember } from "@/lib/authz";
import type { BreakdownCategory } from "@filmset/core";
import { requireUser } from "@filmset/auth/server";
import { runAsUser, schema } from "@filmset/db/server";
import { and, eq } from "drizzle-orm";

export async function confirmBreakdownElement(productionId: string, elementId: string) {
  const user = await requireUser();
  await requireProductionMember(productionId);
  await runAsUser(user.id, (db) =>
    db
      .update(schema.breakdownElements)
      .set({ source: "confirmed" })
      .where(and(eq(schema.breakdownElements.id, elementId), eq(schema.breakdownElements.productionId, productionId))),
  );
}

export async function confirmAllBreakdownElements(productionId: string, sceneId: string) {
  const user = await requireUser();
  await requireProductionMember(productionId);
  await runAsUser(user.id, (db) =>
    db
      .update(schema.breakdownElements)
      .set({ source: "confirmed" })
      .where(and(eq(schema.breakdownElements.sceneId, sceneId), eq(schema.breakdownElements.productionId, productionId))),
  );
}

export async function rejectBreakdownElement(productionId: string, elementId: string) {
  const user = await requireUser();
  await requireProductionMember(productionId);
  await runAsUser(user.id, (db) =>
    db
      .delete(schema.breakdownElements)
      .where(and(eq(schema.breakdownElements.id, elementId), eq(schema.breakdownElements.productionId, productionId))),
  );
}

/** sceneId is verified to belong to productionId before insert — otherwise a user in two productions could attach a breakdown element to a scene that isn't actually in this one. */
export async function addBreakdownTag(productionId: string, sceneId: string, category: BreakdownCategory, label: string) {
  const user = await requireUser();
  await requireProductionMember(productionId);
  const id = crypto.randomUUID();
  await runAsUser(user.id, async (db) => {
    const [scene] = await db
      .select({ id: schema.scenes.id })
      .from(schema.scenes)
      .where(and(eq(schema.scenes.id, sceneId), eq(schema.scenes.productionId, productionId)))
      .limit(1);
    if (!scene) throw new Error("Scene not found in this production.");
    await db.insert(schema.breakdownElements).values({ id, productionId, sceneId, category, label, source: "confirmed" });
  });
  return id;
}
