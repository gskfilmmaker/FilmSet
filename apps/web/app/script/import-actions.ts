"use server";

import { requireProductionMember } from "@/lib/authz";
import { findOrCreateCastMember, findOrCreateCharacter, findOrCreateLocation } from "@/lib/find-or-create";
import { parseDocxText } from "@/lib/import/parse-docx";
import { parsePdfText } from "@/lib/import/parse-pdf";
import { charactersInScene, parseScreenplay, type ParsedElement, type ParsedScene } from "@/lib/script-parser";
import { nextRevisionColor } from "@filmset/core";
import { requireUser } from "@filmset/auth/server";
import { runAsUser, schema, type Tx } from "@filmset/db/server";
import { asc, count, eq } from "drizzle-orm";

const MAX_SCRIPT_FILE_BYTES = 15 * 1024 * 1024;

/**
 * Extracts raw text from an uploaded .pdf or .docx script — a separate
 * step from importScript/importRevision so the extracted text lands back
 * in the paste box for review/edit first, same as a .txt upload already
 * does, rather than committing straight from the file.
 */
export async function extractScriptFileText(productionId: string, formData: FormData): Promise<string> {
  await requireUser();
  await requireProductionMember(productionId);
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) throw new Error("No file selected.");
  if (file.size > MAX_SCRIPT_FILE_BYTES) throw new Error("File must be 15MB or smaller.");

  const buffer = await file.arrayBuffer();
  const isDocx = /\.docx$/i.test(file.name);
  const text = isDocx ? await parseDocxText(buffer) : await parsePdfText(buffer);
  if (text.trim().length < 20) {
    throw new Error(`Couldn't read text from that ${isDocx ? "document" : "PDF"} — it may be a scanned image rather than real text.`);
  }
  return text;
}

export interface ImportScriptResult {
  sceneCount: number;
  locationCount: number;
  castCount: number;
}

/** Finds/creates a cast slot for every character cued in the scene and links it via scene_cast — never removes an existing link, so a manual cast assignment always survives a re-import. */
async function linkSceneCast(tx: Tx, productionId: string, sceneId: string, scene: ParsedScene, castIds: Set<string>) {
  for (const name of charactersInScene(scene)) {
    const characterId = await findOrCreateCharacter(tx, productionId, name);
    const castMemberId = await findOrCreateCastMember(tx, productionId, characterId);
    castIds.add(castMemberId);
    await tx.insert(schema.sceneCast).values({ sceneId, castMemberId }).onConflictDoNothing();
  }
}

/**
 * Parses pasted screenplay text into scenes + script pages, appending after
 * any scenes the production already has. Each unique scene-heading set name
 * finds or creates a Location — scenes.location_id is NOT NULL, so this is
 * required, not a nicety, and it's also what lets Locations end up
 * populated just from importing a script. Every character cued in the
 * dialogue similarly finds or creates a Cast slot (with no actor attached
 * yet) and is linked to the scenes they appear in, so Cast and each scene's
 * cast list are populated from the script too, not just Locations.
 */
export async function importScript(productionId: string, rawText: string): Promise<ImportScriptResult> {
  const user = await requireUser();
  await requireProductionMember(productionId);

  const parsed = parseScreenplay(rawText);
  if (parsed.length === 0) {
    throw new Error("No scene headings found — lines should start with INT. or EXT., e.g. \"INT. TAXI - NIGHT\".");
  }

  const locationIds = new Set<string>();
  const castIds = new Set<string>();

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

        await linkSceneCast(tx, productionId, sceneId, scene, castIds);
      }
    }),
  );

  return { sceneCount: parsed.length, locationCount: locationIds.size, castCount: castIds.size };
}

export interface ImportRevisionResult {
  changedCount: number;
  newCount: number;
  revisionColor: string;
  castCount: number;
}

function sameContent(a: ParsedElement[], b: ParsedElement[]): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/**
 * Re-imports the *full* current script as a revision: matched position by
 * position against the production's existing scenes (in script order), not
 * by re-deriving scene numbers — locked scene numbers must never shift once
 * assigned, matching how a real revised script preserves them. A changed
 * scene is updated in place (never re-created, so its id/number/history
 * survive); any extra parsed scenes past the existing count are appended as
 * new. Existing scenes with no counterpart in the new text are left alone —
 * this never deletes a scene; marking one Omitted is a separate, deliberate
 * action, not something a partial paste should do automatically.
 *
 * The production's revision color only advances if something actually
 * changed, and only the scenes that changed (or are new) move to that
 * color — everything else stays on whatever color it last changed on.
 */
export async function importRevision(productionId: string, rawText: string): Promise<ImportRevisionResult> {
  const user = await requireUser();
  await requireProductionMember(productionId);

  const parsed = parseScreenplay(rawText);
  if (parsed.length === 0) {
    throw new Error("No scene headings found — lines should start with INT. or EXT., e.g. \"INT. TAXI - NIGHT\".");
  }

  return runAsUser(user.id, (db) =>
    db.transaction(async (tx) => {
      const [production] = await tx
        .select({ scriptRevisionColor: schema.productions.scriptRevisionColor })
        .from(schema.productions)
        .where(eq(schema.productions.id, productionId))
        .limit(1);
      if (!production) throw new Error("Production not found.");

      const existingScenes = await tx
        .select({ id: schema.scenes.id })
        .from(schema.scenes)
        .where(eq(schema.scenes.productionId, productionId))
        .orderBy(asc(schema.scenes.scheduleOrder));

      const existingPages = await tx
        .select({ sceneId: schema.scriptPages.sceneId, elements: schema.scriptPages.elements })
        .from(schema.scriptPages)
        .where(eq(schema.scriptPages.productionId, productionId));
      const pagesBySceneId = new Map(existingPages.map((p) => [p.sceneId, p.elements as ParsedElement[]]));

      const updates: { sceneId: string; scene: (typeof parsed)[number] }[] = [];
      const unchanged: { sceneId: string; scene: (typeof parsed)[number] }[] = [];
      const newScenes: (typeof parsed)[number][] = [];

      for (let i = 0; i < parsed.length; i++) {
        const parsedScene = parsed[i]!;
        const existing = existingScenes[i];
        if (existing) {
          const existingElements = pagesBySceneId.get(existing.id) ?? [];
          if (sameContent(existingElements, parsedScene.elements)) {
            unchanged.push({ sceneId: existing.id, scene: parsedScene });
          } else {
            updates.push({ sceneId: existing.id, scene: parsedScene });
          }
        } else {
          newScenes.push(parsedScene);
        }
      }

      const castIds = new Set<string>();

      // Cast linking runs for every scene in the parsed script, changed or not — a scene's dialogue
      // not having changed doesn't mean its characters were already backfilled onto /cast (e.g. this
      // is the first re-import since Cast auto-population shipped). Idempotent (onConflictDoNothing),
      // so re-running it on unchanged scenes is always safe.
      for (const { sceneId, scene } of unchanged) {
        await linkSceneCast(tx, productionId, sceneId, scene, castIds);
      }

      if (updates.length === 0 && newScenes.length === 0) {
        return { changedCount: 0, newCount: 0, revisionColor: production.scriptRevisionColor, castCount: castIds.size };
      }

      const revisionColor = nextRevisionColor(production.scriptRevisionColor);

      for (const { sceneId, scene } of updates) {
        const locationId = await findOrCreateLocation(tx, productionId, scene.setName);
        await tx
          .update(schema.scenes)
          .set({ intExt: scene.intExt, setName: scene.setName, dayNight: scene.dayNight, locationId, revisionColor })
          .where(eq(schema.scenes.id, sceneId));

        if (pagesBySceneId.has(sceneId)) {
          await tx.update(schema.scriptPages).set({ elements: scene.elements }).where(eq(schema.scriptPages.sceneId, sceneId));
        } else {
          await tx.insert(schema.scriptPages).values({ id: crypto.randomUUID(), productionId, sceneId, elements: scene.elements });
        }

        await linkSceneCast(tx, productionId, sceneId, scene, castIds);
      }

      if (newScenes.length > 0) {
        const offset = existingScenes.length;
        for (const [j, scene] of newScenes.entries()) {
          const locationId = await findOrCreateLocation(tx, productionId, scene.setName);
          const sceneId = crypto.randomUUID();
          await tx.insert(schema.scenes).values({
            id: sceneId,
            productionId,
            number: String(offset + j + 1),
            intExt: scene.intExt,
            setName: scene.setName,
            dayNight: scene.dayNight,
            locationId,
            scheduleOrder: offset + j,
            revisionColor,
          });
          await tx.insert(schema.scriptPages).values({ id: crypto.randomUUID(), productionId, sceneId, elements: scene.elements });

          await linkSceneCast(tx, productionId, sceneId, scene, castIds);
        }
      }

      await tx.update(schema.productions).set({ scriptRevisionColor: revisionColor }).where(eq(schema.productions.id, productionId));

      return { changedCount: updates.length, newCount: newScenes.length, revisionColor, castCount: castIds.size };
    }),
  );
}
