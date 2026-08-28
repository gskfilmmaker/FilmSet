"use server";

import { requireProductionMember } from "@/lib/authz";
import type { Location } from "@filmset/core";
import { requireUser } from "@filmset/auth/server";
import { runAsUser, schema } from "@filmset/db/server";
import { and, eq } from "drizzle-orm";

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

export async function deleteLocation(productionId: string, id: string) {
  const user = await requireUser();
  await requireProductionMember(productionId);
  await runAsUser(user.id, (db) =>
    db.delete(schema.locations).where(and(eq(schema.locations.id, id), eq(schema.locations.productionId, productionId))),
  );
}
