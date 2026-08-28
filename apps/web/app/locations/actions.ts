"use server";

import { requireProductionMember } from "@/lib/authz";
import type { Location } from "@filmset/core";
import { requireUser } from "@filmset/auth/server";
import { runAsUser, schema } from "@filmset/db/server";
import { and, count, eq } from "drizzle-orm";

export interface LocationInput {
  name: string;
  address: string;
  permitStatus: Location["permitStatus"];
  permitExpiry: string | null;
}

function validate(input: LocationInput) {
  const name = input.name.trim();
  const address = input.address.trim();
  if (!name) throw new Error("Name is required.");
  if (!address) throw new Error("Address is required.");
  return { name, address, permitStatus: input.permitStatus, permitExpiry: input.permitExpiry?.trim() || null };
}

export async function createLocation(productionId: string, input: LocationInput) {
  const user = await requireUser();
  await requireProductionMember(productionId);
  const values = validate(input);
  const id = crypto.randomUUID();
  await runAsUser(user.id, (db) => db.insert(schema.locations).values({ id, productionId, ...values }));
  return id;
}

export async function updateLocation(productionId: string, id: string, input: LocationInput) {
  const user = await requireUser();
  await requireProductionMember(productionId);
  const values = validate(input);
  await runAsUser(user.id, (db) =>
    db.update(schema.locations).set(values).where(and(eq(schema.locations.id, id), eq(schema.locations.productionId, productionId))),
  );
}

/**
 * scenes.location_id and shoot_days.location_id are NOT NULL foreign keys
 * with no cascade, so Postgres would otherwise reject this delete with a
 * raw constraint-violation error. Check first and say why in terms the
 * user can act on, instead of surfacing that.
 */
export async function deleteLocation(productionId: string, id: string) {
  const user = await requireUser();
  await requireProductionMember(productionId);

  await runAsUser(user.id, async (db) => {
    const [[sceneUse], [dayUse]] = await Promise.all([
      db.select({ total: count() }).from(schema.scenes).where(and(eq(schema.scenes.locationId, id), eq(schema.scenes.productionId, productionId))),
      db
        .select({ total: count() })
        .from(schema.shootDays)
        .where(and(eq(schema.shootDays.locationId, id), eq(schema.shootDays.productionId, productionId))),
    ]);
    const sceneCount = sceneUse?.total ?? 0;
    const dayCount = dayUse?.total ?? 0;
    if (sceneCount > 0 || dayCount > 0) {
      const parts = [
        sceneCount > 0 ? `${sceneCount} scene${sceneCount === 1 ? "" : "s"}` : null,
        dayCount > 0 ? `${dayCount} shoot day${dayCount === 1 ? "" : "s"}` : null,
      ].filter(Boolean);
      throw new Error(`This location is still used by ${parts.join(" and ")} — change their location before removing it.`);
    }

    await db.delete(schema.locations).where(and(eq(schema.locations.id, id), eq(schema.locations.productionId, productionId)));
  });
}
