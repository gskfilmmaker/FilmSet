"use server";

import { requireProductionMember } from "@/lib/authz";
import { findOrCreateLocation } from "@/lib/find-or-create";
import { parseScreenplay } from "@/lib/script-parser";
import { requireUser } from "@filmset/auth/server";
import { runAsUser, schema } from "@filmset/db/server";
import { count, eq } from "drizzle-orm";

export interface ImportScriptResult {
  sceneCount: number;
  locationCount: number;
}

/**
 * Parses pasted screenplay text into scenes + script pages, appending after
 * any scenes the production already has. Each unique scene-heading set name
 * finds or creates a Location — scenes.location_id is NOT NULL, so this is
 * required, not a nicety, and it's also what lets Locations end up
 * populated just from importing a script.
 */
export async function importScript(productionId: string, rawText: string): Promise<ImportScriptResult> {
  const user = await requireUser();
  await requireProductionMember(productionId);

  const parsed = parseScreenplay(rawText);
  if (parsed.length === 0) {
    throw new Error("No scene headings found — lines should start with INT. or EXT., e.g. \"INT. TAXI - NIGHT\".");
  }

  const locationIds = new Set<string>();

  await runAsUser(user.id, (db) =>
    db.transaction(async (tx) => {
      const [existing] = await tx
        .select({ total: count() })
        .from(schema.scenes)
        .where(eq(schema.scenes.productionId, productionId));
      const offset = existing?.total ?? 0;

      for (const [index, scene] of parsed.entries()) {
        const locationId = await findOrCreateLocation(tx, productionId, scene.setName);
        locationIds.add(locationId);

        const sceneId = crypto.randomUUID();
        await tx.insert(schema.scenes).values({
          id: sceneId,
          productionId,
          number: String(offset + index + 1),
          intExt: scene.intExt,
          setName: scene.setName,
          dayNight: scene.dayNight,
          locationId,
          scheduleOrder: offset + index,
        });

        await tx.insert(schema.scriptPages).values({
          id: crypto.randomUUID(),
          productionId,
          sceneId,
          elements: scene.elements,
        });
      }
    }),
  );

  return { sceneCount: parsed.length, locationCount: locationIds.size };
}
