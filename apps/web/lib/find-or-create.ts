import "server-only";
import { schema, type Tx } from "@filmset/db/server";
import { and, eq, ilike } from "drizzle-orm";

/** Reuses an existing location with the same (case-insensitive) name in this production, or creates a bare one — permit status starts "Missing" since nothing about it is confirmed yet. Shared by Script Import and manual scene create/edit. */
export async function findOrCreateLocation(tx: Tx, productionId: string, name: string): Promise<string> {
  const [existing] = await tx
    .select({ id: schema.locations.id })
    .from(schema.locations)
    .where(and(eq(schema.locations.productionId, productionId), ilike(schema.locations.name, name)))
    .limit(1);
  if (existing) return existing.id;

  const id = crypto.randomUUID();
  await tx.insert(schema.locations).values({ id, productionId, name, address: "", permitStatus: "Missing" });
  return id;
}

/** Reuses an existing character with the same (case-insensitive) name in this production, or creates one. Shared by Cast CRUD and future character-referencing flows. */
export async function findOrCreateCharacter(tx: Tx, productionId: string, name: string): Promise<string> {
  const [existing] = await tx
    .select({ id: schema.characters.id })
    .from(schema.characters)
    .where(and(eq(schema.characters.productionId, productionId), ilike(schema.characters.name, name)))
    .limit(1);
  if (existing) return existing.id;

  const id = crypto.randomUUID();
  await tx.insert(schema.characters).values({ id, productionId, name });
  return id;
}
