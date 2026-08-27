"use server";

import { requireProductionMember } from "@/lib/authz";
import { requireUser } from "@filmset/auth/server";
import { runAsUser, schema } from "@filmset/db/server";
import { eq } from "drizzle-orm";

export type Board = Record<string, string[]>;

/**
 * Persists the whole stripboard layout: every scene's shootDayId (null for
 * "unscheduled") and its position within that day/bucket. Called after
 * every successful drop and after Undo, inside one transaction so a
 * partial write can never leave the board inconsistent.
 */
export async function persistBoard(productionId: string, board: Board) {
  const user = await requireUser();
  await requireProductionMember(productionId);
  await runAsUser(user.id, (db) =>
    db.transaction(async (tx) => {
      for (const [containerId, sceneIds] of Object.entries(board)) {
        const shootDayId = containerId === "unscheduled" ? null : containerId;
        for (let index = 0; index < sceneIds.length; index += 1) {
          await tx
            .update(schema.scenes)
            .set({ shootDayId, scheduleOrder: index })
            .where(eq(schema.scenes.id, sceneIds[index]!));
        }
      }
    }),
  );
}
