"use server";

import { requireProductionMember } from "@/lib/authz";
import { findOrCreateLocation } from "@/lib/find-or-create";
import type { Scene } from "@filmset/core";
import { requireUser } from "@filmset/auth/server";
import { runAsUser, schema, type Tx } from "@filmset/db/server";
import { and, count, eq } from "drizzle-orm";

export interface SceneInput {
  number: string;
  intExt: Scene["intExt"];
  setName: string;
  dayNight: Scene["dayNight"];
  synopsis: string;
  status: Scene["status"];
  castMemberIds: string[];
  continuityNotes: string;
}

function validate(input: SceneInput) {
  const number = input.number.trim();
  const setName = input.setName.trim();
  if (!number) throw new Error("Scene number is required.");
  if (!setName) throw new Error("Location is required.");
  return { ...input, number, setName, synopsis: input.synopsis.trim(), continuityNotes: input.continuityNotes.trim() };
}

async function setSceneCast(tx: Tx, sceneId: string, castMemberIds: string[]) {
  await tx.delete(schema.sceneCast).where(eq(schema.sceneCast.sceneId, sceneId));
  if (castMemberIds.length > 0) {
    await tx.insert(schema.sceneCast).values(castMemberIds.map((castMemberId) => ({ sceneId, castMemberId })));
  }
}

/** New scenes start unscheduled (shootDayId null) — the stripboard is where a scene gets a shoot day. */
export async function createScene(productionId: string, input: SceneInput) {
  const user = await requireUser();
  await requireProductionMember(productionId);
  const values = validate(input);
  const id = crypto.randomUUID();

  await runAsUser(user.id, (db) =>
    db.transaction(async (tx) => {
      const [existing] = await tx.select({ total: count() }).from(schema.scenes).where(eq(schema.scenes.productionId, productionId));
      const locationId = await findOrCreateLocation(tx, productionId, values.setName);

      await tx.insert(schema.scenes).values({
        id,
        productionId,
        number: values.number,
        intExt: values.intExt,
        setName: values.setName,
        dayNight: values.dayNight,
        synopsis: values.synopsis,
        status: values.status,
        continuityNotes: values.continuityNotes,
        locationId,
        scheduleOrder: existing?.total ?? 0,
      });

      await setSceneCast(tx, id, values.castMemberIds);
    }),
  );
  return id;
}

export async function updateScene(productionId: string, sceneId: string, input: SceneInput) {
  const user = await requireUser();
  await requireProductionMember(productionId);
  const values = validate(input);

  await runAsUser(user.id, (db) =>
    db.transaction(async (tx) => {
      const locationId = await findOrCreateLocation(tx, productionId, values.setName);
      await tx
        .update(schema.scenes)
        .set({
          number: values.number,
          intExt: values.intExt,
          setName: values.setName,
          dayNight: values.dayNight,
          synopsis: values.synopsis,
          status: values.status,
          continuityNotes: values.continuityNotes,
          locationId,
        })
        .where(and(eq(schema.scenes.id, sceneId), eq(schema.scenes.productionId, productionId)));

      await setSceneCast(tx, sceneId, values.castMemberIds);
    }),
  );
}

/**
 * A focused sibling of updateScene for the Wardrobe department — lets them
 * log continuity directly from /wardrobe without needing (or being able to
 * touch) the scene number/location/D-N/status/cast fields that live on the
 * full Script edit form.
 */
export async function updateSceneContinuity(productionId: string, sceneId: string, continuityNotes: string) {
  const user = await requireUser();
  await requireProductionMember(productionId);
  await runAsUser(user.id, (db) =>
    db
      .update(schema.scenes)
      .set({ continuityNotes: continuityNotes.trim() })
      .where(and(eq(schema.scenes.id, sceneId), eq(schema.scenes.productionId, productionId))),
  );
}

/**
 * Hard-deletes a scene and everything scoped to it (script pages, cast
 * links, breakdown/issue links — all cascade via FK). This is for a scene
 * that was never really shot (added by mistake, a duplicate from a bad
 * import) — a scene that's part of the record but no longer being made
 * should be marked "Omitted" via edit instead, which keeps every other
 * scene's locked number stable; a hard delete does too, since numbers are
 * never renumbered on delete.
 */
export async function deleteScene(productionId: string, sceneId: string) {
  const user = await requireUser();
  await requireProductionMember(productionId);
  await runAsUser(user.id, (db) =>
    db.delete(schema.scenes).where(and(eq(schema.scenes.id, sceneId), eq(schema.scenes.productionId, productionId))),
  );
}
