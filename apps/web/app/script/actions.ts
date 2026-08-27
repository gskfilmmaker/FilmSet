"use server";

import { requireProductionMember } from "@/lib/authz";
import type { BreakdownCategory } from "@filmset/core";
import { getDb, schema } from "@filmset/db/server";
import { eq } from "drizzle-orm";

export async function confirmBreakdownElement(productionId: string, elementId: string) {
  await requireProductionMember(productionId);
  const db = getDb();
  await db.update(schema.breakdownElements).set({ source: "confirmed" }).where(eq(schema.breakdownElements.id, elementId));
}

export async function confirmAllBreakdownElements(productionId: string, sceneId: string) {
  await requireProductionMember(productionId);
  const db = getDb();
  await db
    .update(schema.breakdownElements)
    .set({ source: "confirmed" })
    .where(eq(schema.breakdownElements.sceneId, sceneId));
}

export async function rejectBreakdownElement(productionId: string, elementId: string) {
  await requireProductionMember(productionId);
  const db = getDb();
  await db.delete(schema.breakdownElements).where(eq(schema.breakdownElements.id, elementId));
}

export async function addBreakdownTag(productionId: string, sceneId: string, category: BreakdownCategory, label: string) {
  await requireProductionMember(productionId);
  const db = getDb();
  const id = crypto.randomUUID();
  await db.insert(schema.breakdownElements).values({ id, productionId, sceneId, category, label, source: "confirmed" });
  return id;
}
