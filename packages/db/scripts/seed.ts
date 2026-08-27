import "dotenv/config";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "../src/schema";
import {
  activities,
  aiRecommendations,
  approvals,
  breakdownElements,
  budgetLines,
  callSheetDay18,
  castMembers,
  characters,
  crewMembers,
  documents,
  expenses,
  issues,
  locations,
  props,
  scriptPages,
  shootDays,
  theBandProduction,
  theBandScenes,
} from "../src/fixtures";

/**
 * One-time / re-runnable seed: loads "THE BAND" fixture data (the same
 * data the FRAME prototype screens shipped with) into a real Supabase
 * Postgres database, so the live app has something real to show instead
 * of an empty database. Every insert is idempotent (onConflictDoUpdate/
 * DoNothing) so this is safe to run again after schema changes.
 *
 * Requires DATABASE_URL and SEED_OWNER_USER_ID (a real Supabase Auth user
 * id — sign up once in the app, copy their id from the Supabase dashboard
 * Authentication tab, then run: SEED_OWNER_USER_ID=<uuid> pnpm db:seed).
 */
async function main() {
  const connectionString = process.env.DATABASE_URL;
  const ownerId = process.env.SEED_OWNER_USER_ID;
  if (!connectionString) throw new Error("DATABASE_URL is required.");
  if (!ownerId) {
    throw new Error(
      "SEED_OWNER_USER_ID is required — sign up in the app once, then copy your user id from " +
        "Supabase → Authentication → Users, and re-run: SEED_OWNER_USER_ID=<uuid> pnpm db:seed",
    );
  }

  const client = postgres(connectionString, { prepare: false });
  const db = drizzle(client, { schema });

  console.log(`[seed] Seeding "${theBandProduction.name}" (${theBandProduction.id})…`);

  await db
    .insert(schema.productions)
    .values({ id: theBandProduction.id, name: theBandProduction.name, phase: theBandProduction.phase, createdBy: ownerId })
    .onConflictDoUpdate({
      target: schema.productions.id,
      set: { name: theBandProduction.name, phase: theBandProduction.phase },
    });

  await db
    .insert(schema.productionMembers)
    .values({ productionId: theBandProduction.id, userId: ownerId, role: "Producer" })
    .onConflictDoNothing();

  await db
    .insert(schema.characters)
    .values(characters.map((c) => ({ id: c.id, productionId: theBandProduction.id, name: c.name })))
    .onConflictDoUpdate({ target: schema.characters.id, set: { name: schema.characters.name } });

  await db
    .insert(schema.castMembers)
    .values(
      castMembers.map((c) => ({
        id: c.id,
        productionId: theBandProduction.id,
        characterId: c.characterId,
        actorName: c.actorName,
        status: c.status,
        contract: c.contract,
      })),
    )
    .onConflictDoUpdate({
      target: schema.castMembers.id,
      set: { actorName: schema.castMembers.actorName, status: schema.castMembers.status, contract: schema.castMembers.contract },
    });

  await db
    .insert(schema.crewMembers)
    .values(crewMembers.map((c) => ({ id: c.id, productionId: theBandProduction.id, name: c.name, department: c.department, role: c.role })))
    .onConflictDoUpdate({ target: schema.crewMembers.id, set: { name: schema.crewMembers.name, department: schema.crewMembers.department, role: schema.crewMembers.role } });

  await db
    .insert(schema.locations)
    .values(
      locations.map((l) => ({
        id: l.id,
        productionId: theBandProduction.id,
        name: l.name,
        address: l.address,
        permitStatus: l.permitStatus,
        permitExpiry: l.permitExpiry,
      })),
    )
    .onConflictDoUpdate({
      target: schema.locations.id,
      set: { name: schema.locations.name, address: schema.locations.address, permitStatus: schema.locations.permitStatus, permitExpiry: schema.locations.permitExpiry },
    });

  await db
    .insert(schema.shootDays)
    .values(
      shootDays.map((d) => ({
        id: d.id,
        productionId: theBandProduction.id,
        dayNumber: d.dayNumber,
        totalDays: d.totalDays,
        date: d.date,
        locationId: d.locationId,
        status: d.status,
        callTime: d.callTime,
        wrapTime: d.wrapTime,
        unit: d.unit,
      })),
    )
    .onConflictDoUpdate({
      target: schema.shootDays.id,
      set: { status: schema.shootDays.status, callTime: schema.shootDays.callTime, wrapTime: schema.shootDays.wrapTime },
    });

  const scheduleOrderByScene = new Map<string, number>();
  for (const day of shootDays) {
    day.sceneIds.forEach((sceneId, idx) => scheduleOrderByScene.set(sceneId, idx));
  }
  let unscheduledIdx = 0;
  for (const scene of theBandScenes) {
    if (!scheduleOrderByScene.has(scene.id)) scheduleOrderByScene.set(scene.id, unscheduledIdx++);
  }

  await db
    .insert(schema.scenes)
    .values(
      theBandScenes.map((s) => ({
        id: s.id,
        productionId: theBandProduction.id,
        number: s.number,
        intExt: s.intExt,
        setName: s.setName,
        dayNight: s.dayNight,
        synopsis: s.synopsis,
        pageCount: s.pageCount,
        status: s.status,
        shootDayId: s.shootDayId,
        scheduleOrder: scheduleOrderByScene.get(s.id) ?? 0,
        locationId: s.locationId,
      })),
    )
    .onConflictDoUpdate({
      target: schema.scenes.id,
      set: { status: schema.scenes.status, shootDayId: schema.scenes.shootDayId, scheduleOrder: schema.scenes.scheduleOrder },
    });

  const sceneCastRows = theBandScenes.flatMap((s) => s.castIds.map((castMemberId) => ({ sceneId: s.id, castMemberId })));
  if (sceneCastRows.length > 0) {
    await db.insert(schema.sceneCast).values(sceneCastRows).onConflictDoNothing();
  }

  await db
    .insert(schema.props)
    .values(props.map((p) => ({ id: p.id, productionId: theBandProduction.id, name: p.name })))
    .onConflictDoUpdate({ target: schema.props.id, set: { name: schema.props.name } });

  const propSceneRows = props.flatMap((p) => p.sceneIds.map((sceneId) => ({ propId: p.id, sceneId })));
  if (propSceneRows.length > 0) {
    await db.insert(schema.propScenes).values(propSceneRows).onConflictDoNothing();
  }

  await db
    .insert(schema.breakdownElements)
    .values(
      breakdownElements.map((b) => ({
        id: b.id,
        productionId: theBandProduction.id,
        sceneId: b.sceneId,
        category: b.category,
        label: b.label,
        source: b.source,
      })),
    )
    .onConflictDoUpdate({ target: schema.breakdownElements.id, set: { source: schema.breakdownElements.source } });

  await db
    .insert(schema.scriptPages)
    .values(scriptPages.map((p, i) => ({ id: `sp_${p.sceneId}_${i}`, productionId: theBandProduction.id, sceneId: p.sceneId, elements: p.elements })))
    .onConflictDoUpdate({ target: schema.scriptPages.id, set: { elements: schema.scriptPages.elements } });

  await db
    .insert(schema.issues)
    .values(
      issues.map((i) => ({
        id: i.id,
        productionId: theBandProduction.id,
        severity: i.severity,
        title: i.title,
        description: i.description,
        affectedShootDayId: i.affectedShootDayId,
      })),
    )
    .onConflictDoUpdate({ target: schema.issues.id, set: { description: schema.issues.description } });

  const issueSceneRows = issues.flatMap((i) => i.affectedSceneIds.map((sceneId) => ({ issueId: i.id, sceneId })));
  if (issueSceneRows.length > 0) {
    await db.insert(schema.issueScenes).values(issueSceneRows).onConflictDoNothing();
  }

  await db
    .insert(schema.approvals)
    .values(approvals.map((a) => ({ id: a.id, productionId: theBandProduction.id, title: a.title, requestedBy: a.requestedBy, status: a.status })))
    .onConflictDoUpdate({ target: schema.approvals.id, set: { status: schema.approvals.status } });

  await db
    .insert(schema.documents)
    .values(documents.map((d) => ({ id: d.id, productionId: theBandProduction.id, name: d.name, type: d.type, status: d.status })))
    .onConflictDoUpdate({ target: schema.documents.id, set: { status: schema.documents.status } });

  await db
    .insert(schema.expenses)
    .values(expenses.map((e) => ({ id: e.id, productionId: theBandProduction.id, vendor: e.vendor, department: e.department, amount: e.amount.toString(), status: e.status })))
    .onConflictDoUpdate({ target: schema.expenses.id, set: { status: schema.expenses.status } });

  await db
    .insert(schema.budgetLines)
    .values(
      budgetLines.map((b) => ({
        id: `budget_${b.department.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
        productionId: theBandProduction.id,
        department: b.department,
        budgeted: b.budgeted.toString(),
        actual: b.actual.toString(),
      })),
    )
    .onConflictDoUpdate({ target: schema.budgetLines.id, set: { actual: schema.budgetLines.actual } });

  await db
    .insert(schema.activities)
    .values(activities.map((a) => ({ id: a.id, productionId: theBandProduction.id, actor: a.actor, description: a.description })))
    .onConflictDoNothing();

  await db
    .insert(schema.callSheets)
    .values({
      shootDayId: callSheetDay18.shootDayId,
      productionId: theBandProduction.id,
      weather: callSheetDay18.weather,
      sunrise: callSheetDay18.sunrise,
      sunset: callSheetDay18.sunset,
      hospital: callSheetDay18.hospital,
      parking: callSheetDay18.parking,
      basecamp: callSheetDay18.basecamp,
      notes: callSheetDay18.notes,
    })
    .onConflictDoUpdate({ target: schema.callSheets.shootDayId, set: { notes: schema.callSheets.notes } });

  await db
    .insert(schema.callSheetTimelineEvents)
    .values(
      callSheetDay18.timeline.map((event, idx) => ({
        id: `${callSheetDay18.shootDayId}_event_${idx}`,
        shootDayId: callSheetDay18.shootDayId,
        time: event.time,
        label: event.label,
        sortOrder: idx,
      })),
    )
    .onConflictDoUpdate({ target: schema.callSheetTimelineEvents.id, set: { label: schema.callSheetTimelineEvents.label } });

  await db
    .insert(schema.aiRecommendations)
    .values(
      aiRecommendations.map((r) => ({
        id: r.id,
        productionId: theBandProduction.id,
        severity: r.severity,
        title: r.title,
        subject: r.subject,
        conflict: r.conflict,
        affected: r.affected,
        options: r.options,
      })),
    )
    .onConflictDoUpdate({ target: schema.aiRecommendations.id, set: { conflict: schema.aiRecommendations.conflict } });

  console.log("[seed] Done.");
  await client.end();
}

main().catch((err) => {
  console.error("[seed] Failed:", err);
  process.exit(1);
});
