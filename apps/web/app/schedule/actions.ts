"use server";

import { requireProductionMember } from "@/lib/authz";
import { requireUser } from "@filmset/auth/server";
import { runAsUser, schema } from "@filmset/db/server";
import { and, eq, inArray } from "drizzle-orm";

export type Board = Record<string, string[]>;

/**
 * Persists the whole stripboard layout: every scene's shootDayId (null for
 * "unscheduled") and its position within that day/bucket. Called after
 * every successful drop and after Undo, inside one transaction so a
 * partial write can never leave the board inconsistent.
 *
 * Every scene/shoot-day id is verified to belong to productionId before any
 * write. RLS alone isn't enough here: a user who belongs to two productions
 * would pass RLS's is_production_member check on a scene from either one,
 * so without this an id from production B could get reassigned into
 * production A's schedule.
 */
export async function persistBoard(productionId: string, board: Board) {
  const user = await requireUser();
  await requireProductionMember(productionId);

  const sceneIds = Object.values(board).flat();
  const shootDayIds = Object.keys(board).filter((id) => id !== "unscheduled");

  await runAsUser(user.id, (db) =>
    db.transaction(async (tx) => {
      if (sceneIds.length > 0) {
        const owned = await tx
          .select({ id: schema.scenes.id })
          .from(schema.scenes)
          .where(and(inArray(schema.scenes.id, sceneIds), eq(schema.scenes.productionId, productionId)));
        if (owned.length !== new Set(sceneIds).size) throw new Error("One or more scenes don't belong to this production.");
      }
      if (shootDayIds.length > 0) {
        const owned = await tx
          .select({ id: schema.shootDays.id })
          .from(schema.shootDays)
          .where(and(inArray(schema.shootDays.id, shootDayIds), eq(schema.shootDays.productionId, productionId)));
        if (owned.length !== shootDayIds.length) throw new Error("One or more shoot days don't belong to this production.");
      }

      for (const [containerId, sceneIdsInContainer] of Object.entries(board)) {
        const shootDayId = containerId === "unscheduled" ? null : containerId;
        for (let index = 0; index < sceneIdsInContainer.length; index += 1) {
          await tx
            .update(schema.scenes)
            .set({ shootDayId, scheduleOrder: index })
            .where(and(eq(schema.scenes.id, sceneIdsInContainer[index]!), eq(schema.scenes.productionId, productionId)));
        }
      }
    }),
  );
}
