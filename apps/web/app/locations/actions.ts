"use server";

import { requireProductionMember } from "@/lib/authz";
import { suggestLocationMatch, type SuggestedRecommendation } from "@/lib/ai";
import { deleteEntityPhoto, uploadEntityPhoto } from "@/lib/photo-storage";
import { getProductionSnapshot } from "@/lib/queries";
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

export async function uploadLocationPhoto(productionId: string, id: string, formData: FormData) {
  const user = await requireUser();
  await requireProductionMember(productionId);
  const file = formData.get("photo");
  if (!(file instanceof File) || file.size === 0) throw new Error("No photo selected.");

  const [existing] = await runAsUser(user.id, (db) =>
    db
      .select({ photoPath: schema.locations.photoPath })
      .from(schema.locations)
      .where(and(eq(schema.locations.id, id), eq(schema.locations.productionId, productionId)))
      .limit(1),
  );
  if (!existing) throw new Error("Location not found in this production.");

  const path = await uploadEntityPhoto(productionId, "location", id, file);
  await runAsUser(user.id, (db) =>
    db.update(schema.locations).set({ photoPath: path }).where(and(eq(schema.locations.id, id), eq(schema.locations.productionId, productionId))),
  );
  if (existing.photoPath) await deleteEntityPhoto(existing.photoPath);
  return path;
}

const IMAGE_MEDIA_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

/**
 * Suggest step only — reads the photo + the production's scenes/locations
 * and proposes which scene(s) this photographed location could serve,
 * logged to ai_suggestion_log exactly like app/ai/actions.ts's
 * generateSuggestion. Nothing is written to ai_recommendations (visible
 * anywhere) until the user calls approveSuggestion from app/ai/actions.ts —
 * same Suggest→Explain→Preview→Approve→Commit pipeline, reused rather than
 * duplicated.
 */
export async function suggestLocationPhotoMatch(
  productionId: string,
  locationId: string,
  formData: FormData,
): Promise<{ logId: string; suggestion: SuggestedRecommendation }> {
  const user = await requireUser();
  await requireProductionMember(productionId);
  const file = formData.get("photo");
  if (!(file instanceof File) || file.size === 0) throw new Error("No photo selected.");
  if (!IMAGE_MEDIA_TYPES.has(file.type)) throw new Error("Please choose a JPEG, PNG, WebP, or GIF image.");

  const [location] = await runAsUser(user.id, (db) =>
    db.select({ name: schema.locations.name }).from(schema.locations).where(and(eq(schema.locations.id, locationId), eq(schema.locations.productionId, productionId))).limit(1),
  );
  if (!location) throw new Error("Location not found in this production.");

  const snapshot = await getProductionSnapshot(user.id, productionId);
  const imageBase64 = Buffer.from(await file.arrayBuffer()).toString("base64");
  const mediaType = file.type as "image/jpeg" | "image/png" | "image/webp" | "image/gif";

  const suggestion = await suggestLocationMatch(snapshot, location.name, imageBase64, mediaType);

  const logId = crypto.randomUUID();
  await runAsUser(user.id, (db) =>
    db.insert(schema.aiSuggestionLog).values({
      id: logId,
      productionId,
      requestedBy: user.id,
      kind: "recommendation",
      input: { snapshotSummary: `location photo match for "${location.name}"` },
      suggestion,
      explanation: suggestion.explanation,
      status: "suggested",
    }),
  );

  return { logId, suggestion };
}
