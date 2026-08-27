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
}

function validate(input: CastMemberInput) {
  const characterName = input.characterName.trim();
  const actorName = input.actorName.trim();
  if (!characterName) throw new Error("Character name is required.");
  if (!actorName) throw new Error("Actor name is required.");
  return { characterName, actorName, status: input.status, contract: input.contract };
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
        .set({ characterId, actorName: values.actorName, status: values.status, contract: values.contract })
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
