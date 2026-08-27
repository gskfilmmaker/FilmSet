"use server";

import { requireProductionMember } from "@/lib/authz";
import type { BreakdownCategory } from "@filmset/core";
import { requireUser } from "@filmset/auth/server";
import { runAsUser, schema } from "@filmset/db/server";
import { eq } from "drizzle-orm";

export async function confirmBreakdownElement(productionId: string, elementId: string) {
  const user = await requireUser();
  await requireProductionMember(productionId);
  await runAsUser(user.id, (db) =>
    db.update(schema.breakdownElements).set({ source: "confirmed" }).where(eq(schema.breakdownElements.id, elementId)),
  );
}

export async function confirmAllBreakdownElements(productionId: string, sceneId: string) {
  const user = await requireUser();
  await requireProductionMember(productionId);
  await runAsUser(user.id, (db) =>
    db.update(schema.breakdownElements).set({ source: "confirmed" }).where(eq(schema.breakdownElements.sceneId, sceneId)),
  );
}

export async function rejectBreakdownElement(productionId: string, elementId: string) {
  const user = await requireUser();
  await requireProductionMember(productionId);
  await runAsUser(user.id, (db) => db.delete(schema.breakdownElements).where(eq(schema.breakdownElements.id, elementId)));
}

export async function addBreakdownTag(productionId: string, sceneId: string, category: BreakdownCategory, label: string) {
  const user = await requireUser();
  await requireProductionMember(productionId);
  const id = crypto.randomUUID();
  await runAsUser(user.id, (db) =>
    db.insert(schema.breakdownElements).values({ id, productionId, sceneId, category, label, source: "confirmed" }),
  );
  return id;
}
