"use server";

import { requireProductionMember } from "@/lib/authz";
import { findOrCreateCharacter } from "@/lib/find-or-create";
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
        })
        .where(and(eq(schema.castMembers.id, id), eq(schema.castMembers.productionId, productionId)));
    }),
  );
}

export async function deleteCastMember(productionId: string, id: string) {
  const user = await requireUser();
  await requireProductionMember(productionId);
  await runAsUser(user.id, (db) =>
    db.delete(schema.castMembers).where(and(eq(schema.castMembers.id, id), eq(schema.castMembers.productionId, productionId))),
  );
}
