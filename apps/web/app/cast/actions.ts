"use server";

import { requireProductionMember } from "@/lib/authz";
import { findOrCreateCharacter } from "@/lib/find-or-create";
import { deleteEntityPhoto, uploadEntityPhoto } from "@/lib/photo-storage";
import type { CastMember } from "@filmset/core";
import { requireUser } from "@filmset/auth/server";
import { runAsUser, schema } from "@filmset/db/server";
import { and, eq } from "drizzle-orm";

export interface CastMemberInput {
  characterName: string;
  actorName: string;
  status: CastMember["status"];
  contract: CastMember["contract"];
  email: string;
  phone: string;
  emergencyContactName: string;
  emergencyContactPhone: string;
  agentName: string;
  agentPhone: string;
  agentEmail: string;
  height: string;
  shirtSize: string;
  pantSize: string;
  shoeSize: string;
  sizingNotes: string;
}

/** Form fields are always strings; an empty one means "unset" and is stored as null. */
function toNullable(value: string): string | null {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function validate(input: CastMemberInput) {
  const characterName = input.characterName.trim();
  const actorName = input.actorName.trim();
  if (!characterName) throw new Error("Character name is required.");
  if (!actorName) throw new Error("Actor name is required.");
  return {
    characterName,
    actorName,
    status: input.status,
    contract: input.contract,
    email: toNullable(input.email),
    phone: toNullable(input.phone),
    emergencyContactName: toNullable(input.emergencyContactName),
    emergencyContactPhone: toNullable(input.emergencyContactPhone),
    agentName: toNullable(input.agentName),
    agentPhone: toNullable(input.agentPhone),
    agentEmail: toNullable(input.agentEmail),
    height: toNullable(input.height),
    shirtSize: toNullable(input.shirtSize),
    pantSize: toNullable(input.pantSize),
    shoeSize: toNullable(input.shoeSize),
    sizingNotes: toNullable(input.sizingNotes),
  };
}

export async function createCastMember(productionId: string, input: CastMemberInput) {
  const user = await requireUser();
  await requireProductionMember(productionId);
  const values = validate(input);
  const id = crypto.randomUUID();

  await runAsUser(user.id, (db) =>
    db.transaction(async (tx) => {
      const characterId = await findOrCreateCharacter(tx, productionId, values.characterName);
      await tx.insert(schema.castMembers).values({
        id,
        productionId,
        characterId,
        actorName: values.actorName,
        status: values.status,
        contract: values.contract,
        email: values.email,
        phone: values.phone,
        emergencyContactName: values.emergencyContactName,
        emergencyContactPhone: values.emergencyContactPhone,
        agentName: values.agentName,
        agentPhone: values.agentPhone,
        agentEmail: values.agentEmail,
        height: values.height,
        shirtSize: values.shirtSize,
        pantSize: values.pantSize,
        shoeSize: values.shoeSize,
        sizingNotes: values.sizingNotes,
      });
    }),
  );
  return id;
}

export async function updateCastMember(productionId: string, id: string, input: CastMemberInput) {
  const user = await requireUser();
  await requireProductionMember(productionId);
  const values = validate(input);

  await runAsUser(user.id, (db) =>
    db.transaction(async (tx) => {
      const characterId = await findOrCreateCharacter(tx, productionId, values.characterName);
      await tx
        .update(schema.castMembers)
        .set({
          characterId,
          actorName: values.actorName,
          status: values.status,
          contract: values.contract,
          email: values.email,
          phone: values.phone,
          emergencyContactName: values.emergencyContactName,
          emergencyContactPhone: values.emergencyContactPhone,
          agentName: values.agentName,
          agentPhone: values.agentPhone,
          agentEmail: values.agentEmail,
          height: values.height,
          shirtSize: values.shirtSize,
          pantSize: values.pantSize,
          shoeSize: values.shoeSize,
          sizingNotes: values.sizingNotes,
        })
        .where(and(eq(schema.castMembers.id, id), eq(schema.castMembers.productionId, productionId)));
    }),
  );
}

export interface CastSizingInput {
  height: string;
  shirtSize: string;
  pantSize: string;
  shoeSize: string;
  sizingNotes: string;
}

/**
 * A focused sibling of updateCastMember for the Wardrobe department —
 * lets them log sizing directly from /wardrobe without needing (or being
 * able to touch) the character/actor/status/contract/contact fields that
 * live on the full Cast edit form.
 */
export async function updateCastSizing(productionId: string, id: string, input: CastSizingInput) {
  const user = await requireUser();
  await requireProductionMember(productionId);
  const values = {
    height: toNullable(input.height),
    shirtSize: toNullable(input.shirtSize),
    pantSize: toNullable(input.pantSize),
    shoeSize: toNullable(input.shoeSize),
    sizingNotes: toNullable(input.sizingNotes),
  };
  await runAsUser(user.id, (db) =>
    db.update(schema.castMembers).set(values).where(and(eq(schema.castMembers.id, id), eq(schema.castMembers.productionId, productionId))),
  );
}

export async function deleteCastMember(productionId: string, id: string) {
  const user = await requireUser();
  await requireProductionMember(productionId);
  await runAsUser(user.id, (db) =>
    db.delete(schema.castMembers).where(and(eq(schema.castMembers.id, id), eq(schema.castMembers.productionId, productionId))),
  );
}

export async function uploadCastPhoto(productionId: string, id: string, formData: FormData) {
  const user = await requireUser();
  await requireProductionMember(productionId);
  const file = formData.get("photo");
  if (!(file instanceof File) || file.size === 0) throw new Error("No photo selected.");

  const [existing] = await runAsUser(user.id, (db) =>
    db
      .select({ photoPath: schema.castMembers.photoPath })
      .from(schema.castMembers)
      .where(and(eq(schema.castMembers.id, id), eq(schema.castMembers.productionId, productionId)))
      .limit(1),
  );
  if (!existing) throw new Error("Cast member not found in this production.");

  const path = await uploadEntityPhoto(productionId, "cast", id, file);
  await runAsUser(user.id, (db) =>
    db.update(schema.castMembers).set({ photoPath: path }).where(and(eq(schema.castMembers.id, id), eq(schema.castMembers.productionId, productionId))),
  );
  if (existing.photoPath) await deleteEntityPhoto(existing.photoPath);
}
