"use server";

import { requireProductionMember } from "@/lib/authz";
import type { ShootDay } from "@filmset/core";
import { requireUser } from "@filmset/auth/server";
import { runAsUser, schema } from "@filmset/db/server";
import { and, asc, count, eq } from "drizzle-orm";

export interface ShootDayInput {
  date: string;
  callTime: string;
  wrapTime: string;
  locationId: string;
  unit: ShootDay["unit"];
  status: ShootDay["status"];
}

function validate(input: ShootDayInput) {
  const date = input.date.trim();
  const callTime = input.callTime.trim();
  if (!date) throw new Error("Date is required.");
  if (!callTime) throw new Error("Call time is required.");
  if (!input.locationId) throw new Error("Location is required.");
  return { ...input, date, callTime, wrapTime: input.wrapTime.trim() || null };
}

/** dayNumber/totalDays are kept in sync across every shoot day in the production, so "Day X of N" stays correct everywhere it's shown. */
export async function createShootDay(productionId: string, input: ShootDayInput) {
  const user = await requireUser();
  await requireProductionMember(productionId);
  const values = validate(input);
  const id = crypto.randomUUID();

  await runAsUser(user.id, (db) =>
    db.transaction(async (tx) => {
      const [existing] = await tx.select({ total: count() }).from(schema.shootDays).where(eq(schema.shootDays.productionId, productionId));
      const totalDays = (existing?.total ?? 0) + 1;

      await tx.insert(schema.shootDays).values({
        id,
        productionId,
        dayNumber: totalDays,
        totalDays,
        date: values.date,
        locationId: values.locationId,
        status: values.status,
        callTime: values.callTime,
        wrapTime: values.wrapTime,
        unit: values.unit,
      });

      await tx.update(schema.shootDays).set({ totalDays }).where(eq(schema.shootDays.productionId, productionId));
    }),
  );
  return id;
}

export async function updateShootDay(productionId: string, id: string, input: ShootDayInput) {
  const user = await requireUser();
  await requireProductionMember(productionId);
  const values = validate(input);

  await runAsUser(user.id, (db) =>
    db
      .update(schema.shootDays)
      .set({
        date: values.date,
        locationId: values.locationId,
        status: values.status,
        callTime: values.callTime,
        wrapTime: values.wrapTime,
        unit: values.unit,
      })
      .where(and(eq(schema.shootDays.id, id), eq(schema.shootDays.productionId, productionId))),
  );
}

/**
 * Deletes a shoot day (its call sheet cascades; any scene scheduled on it
 * falls back to unscheduled via ON DELETE SET NULL, never deleted) and
 * renumbers what's left by date so "Day X of N" stays contiguous and
 * correct everywhere it's shown — the same invariant createShootDay keeps.
 */
export async function deleteShootDay(productionId: string, id: string) {
  const user = await requireUser();
  await requireProductionMember(productionId);

  await runAsUser(user.id, (db) =>
    db.transaction(async (tx) => {
      await tx.delete(schema.shootDays).where(and(eq(schema.shootDays.id, id), eq(schema.shootDays.productionId, productionId)));

      const remaining = await tx
        .select({ id: schema.shootDays.id })
        .from(schema.shootDays)
        .where(eq(schema.shootDays.productionId, productionId))
        .orderBy(asc(schema.shootDays.date));

      for (const [index, day] of remaining.entries()) {
        await tx.update(schema.shootDays).set({ dayNumber: index + 1, totalDays: remaining.length }).where(eq(schema.shootDays.id, day.id));
      }
    }),
  );
}
