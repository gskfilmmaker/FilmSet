"use server";

import { requireProductionMember } from "@/lib/authz";
import { deleteEntityPhoto, uploadEntityPhoto } from "@/lib/photo-storage";
import { requireUser } from "@filmset/auth/server";
import { runAsUser, schema } from "@filmset/db/server";
import { eq } from "drizzle-orm";

export async function updateFullName(fullName: string) {
  const user = await requireUser();
  const trimmed = fullName.trim();
  await runAsUser(user.id, (db) => db.update(schema.profiles).set({ fullName: trimmed || null }).where(eq(schema.profiles.id, user.id)));
}

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

/** Null clears the brand color back to the badge's default — a producer isn't required to pick one. */
export async function updateBrandColor(productionId: string, brandColor: string | null) {
  const user = await requireUser();
  await requireProductionMember(productionId, ["Producer"]);
  const trimmed = brandColor?.trim() || null;
  if (trimmed && !HEX_COLOR.test(trimmed)) throw new Error("Brand color must be a hex value like #1A2B3C.");
  await runAsUser(user.id, (db) => db.update(schema.productions).set({ brandColor: trimmed }).where(eq(schema.productions.id, productionId)));
}

export async function uploadProductionLogo(productionId: string, formData: FormData) {
  const user = await requireUser();
  await requireProductionMember(productionId, ["Producer"]);
  const file = formData.get("logo");
  if (!(file instanceof File) || file.size === 0) throw new Error("No logo selected.");

  const [existing] = await runAsUser(user.id, (db) =>
    db.select({ logoPath: schema.productions.logoPath }).from(schema.productions).where(eq(schema.productions.id, productionId)).limit(1),
  );

  const path = await uploadEntityPhoto(productionId, "production", productionId, file);
  await runAsUser(user.id, (db) => db.update(schema.productions).set({ logoPath: path }).where(eq(schema.productions.id, productionId)));
  if (existing?.logoPath) await deleteEntityPhoto(existing.logoPath);
  return path;
}
