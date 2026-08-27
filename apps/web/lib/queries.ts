import "server-only";
import type {
  Activity,
  AIRecommendation,
  Approval,
  BreakdownElement,
  BudgetLine,
  CallSheet,
  CastMember,
  Character,
  CrewMember,
  DocumentRecord,
  Expense,
  Issue,
  Location,
  Production,
  Prop,
  Scene,
  ScriptPage,
  ShootDay,
} from "@filmset/core";
import { getDb, schema } from "@filmset/db/server";
import { and, asc, eq } from "drizzle-orm";

/**
 * Reshapes the relational schema back into the same shapes the FRAME
 * prototype screens were built against (packages/core), so screens read
 * real data with the same field names fixtures used — swapping the import
 * is most of the migration; only mutations are new.
 */
export interface ProductionSnapshot {
  production: Production;
  characters: Character[];
  castMembers: CastMember[];
  crewMembers: CrewMember[];
  locations: Location[];
  props: Prop[];
  scenes: Scene[];
  shootDays: ShootDay[];
  breakdownElements: BreakdownElement[];
  scriptPages: ScriptPage[];
  issues: Issue[];
  approvals: Approval[];
  documents: DocumentRecord[];
  expenses: Expense[];
  budgetLines: BudgetLine[];
  activities: Activity[];
  callSheets: CallSheet[];
  aiRecommendations: AIRecommendation[];
}

export async function getProductionSnapshot(productionId: string): Promise<ProductionSnapshot> {
  const db = getDb();

  const [
    productionRow,
    characterRows,
    castRows,
    crewRows,
    locationRows,
    propRows,
    propSceneRows,
    sceneRows,
    sceneCastRows,
    shootDayRows,
    breakdownRows,
    scriptPageRows,
    issueRows,
    issueSceneRows,
    approvalRows,
    documentRows,
    expenseRows,
    budgetLineRows,
    activityRows,
    callSheetRows,
    callSheetEventRows,
    aiRecommendationRows,
  ] = await Promise.all([
    db.select().from(schema.productions).where(eq(schema.productions.id, productionId)).limit(1),
    db.select().from(schema.characters).where(eq(schema.characters.productionId, productionId)),
    db.select().from(schema.castMembers).where(eq(schema.castMembers.productionId, productionId)),
    db.select().from(schema.crewMembers).where(eq(schema.crewMembers.productionId, productionId)),
    db.select().from(schema.locations).where(eq(schema.locations.productionId, productionId)),
    db.select().from(schema.props).where(eq(schema.props.productionId, productionId)),
    db.select().from(schema.propScenes),
    db.select().from(schema.scenes).where(eq(schema.scenes.productionId, productionId)).orderBy(asc(schema.scenes.scheduleOrder)),
    db.select().from(schema.sceneCast),
    db.select().from(schema.shootDays).where(eq(schema.shootDays.productionId, productionId)).orderBy(asc(schema.shootDays.dayNumber)),
    db.select().from(schema.breakdownElements).where(eq(schema.breakdownElements.productionId, productionId)),
    db.select().from(schema.scriptPages).where(eq(schema.scriptPages.productionId, productionId)),
    db.select().from(schema.issues).where(eq(schema.issues.productionId, productionId)),
    db.select().from(schema.issueScenes),
    db.select().from(schema.approvals).where(eq(schema.approvals.productionId, productionId)),
    db.select().from(schema.documents).where(eq(schema.documents.productionId, productionId)),
    db.select().from(schema.expenses).where(eq(schema.expenses.productionId, productionId)),
    db.select().from(schema.budgetLines).where(eq(schema.budgetLines.productionId, productionId)),
    db.select().from(schema.activities).where(eq(schema.activities.productionId, productionId)).orderBy(asc(schema.activities.timestamp)),
    db.select().from(schema.callSheets).where(eq(schema.callSheets.productionId, productionId)),
    db.select().from(schema.callSheetTimelineEvents).orderBy(asc(schema.callSheetTimelineEvents.sortOrder)),
    db
      .select()
      .from(schema.aiRecommendations)
      .where(and(eq(schema.aiRecommendations.productionId, productionId), eq(schema.aiRecommendations.status, "pending"))),
  ]);

  const production = productionRow[0];
  if (!production) throw new Error(`Production ${productionId} not found.`);

  const sceneIdsByShootDay = new Map<string, string[]>();
  for (const scene of sceneRows) {
    if (!scene.shootDayId) continue;
    const list = sceneIdsByShootDay.get(scene.shootDayId) ?? [];
    list.push(scene.id);
    sceneIdsByShootDay.set(scene.shootDayId, list);
  }

  const castIdsByScene = new Map<string, string[]>();
  for (const row of sceneCastRows) {
    const list = castIdsByScene.get(row.sceneId) ?? [];
    list.push(row.castMemberId);
    castIdsByScene.set(row.sceneId, list);
  }

  const sceneIdsByProp = new Map<string, string[]>();
  for (const row of propSceneRows) {
    const list = sceneIdsByProp.get(row.propId) ?? [];
    list.push(row.sceneId);
    sceneIdsByProp.set(row.propId, list);
  }

  const sceneIdsByIssue = new Map<string, string[]>();
  for (const row of issueSceneRows) {
    const list = sceneIdsByIssue.get(row.issueId) ?? [];
    list.push(row.sceneId);
    sceneIdsByIssue.set(row.issueId, list);
  }

  const eventsByShootDay = new Map<string, { time: string; label: string }[]>();
  for (const event of callSheetEventRows) {
    const list = eventsByShootDay.get(event.shootDayId) ?? [];
    list.push({ time: event.time, label: event.label });
    eventsByShootDay.set(event.shootDayId, list);
  }

  return {
    production: { id: production.id, name: production.name, phase: production.phase as Production["phase"] },
    characters: characterRows.map((c) => ({ id: c.id, name: c.name })),
    castMembers: castRows.map((c) => ({
      id: c.id,
      characterId: c.characterId,
      actorName: c.actorName,
      status: c.status as CastMember["status"],
      contract: c.contract as CastMember["contract"],
    })),
    crewMembers: crewRows.map((c) => ({ id: c.id, name: c.name, department: c.department, role: c.role })),
    locations: locationRows.map((l) => ({
      id: l.id,
      name: l.name,
      address: l.address,
      permitStatus: l.permitStatus as Location["permitStatus"],
      permitExpiry: l.permitExpiry,
    })),
    props: propRows.map((p) => ({ id: p.id, name: p.name, sceneIds: sceneIdsByProp.get(p.id) ?? [] })),
    scenes: sceneRows.map((s) => ({
      id: s.id,
      number: s.number,
      intExt: s.intExt as Scene["intExt"],
      setName: s.setName,
      dayNight: s.dayNight as Scene["dayNight"],
      synopsis: s.synopsis,
      pageCount: s.pageCount,
      status: s.status as Scene["status"],
      shootDayId: s.shootDayId,
      castIds: castIdsByScene.get(s.id) ?? [],
      locationId: s.locationId,
    })),
    shootDays: shootDayRows.map((d) => ({
      id: d.id,
      dayNumber: d.dayNumber,
      totalDays: d.totalDays,
      date: d.date,
      locationId: d.locationId,
      status: d.status as ShootDay["status"],
      callTime: d.callTime,
      wrapTime: d.wrapTime,
      sceneIds: sceneIdsByShootDay.get(d.id) ?? [],
      unit: d.unit as ShootDay["unit"],
    })),
    breakdownElements: breakdownRows.map((b) => ({
      id: b.id,
      sceneId: b.sceneId,
      category: b.category as BreakdownElement["category"],
      label: b.label,
      source: b.source as BreakdownElement["source"],
    })),
    scriptPages: scriptPageRows.map((p) => ({ sceneId: p.sceneId, elements: p.elements as ScriptPage["elements"] })),
    issues: issueRows.map((i) => ({
      id: i.id,
      severity: i.severity as Issue["severity"],
      title: i.title,
      description: i.description,
      affectedSceneIds: sceneIdsByIssue.get(i.id) ?? [],
      affectedShootDayId: i.affectedShootDayId,
    })),
    approvals: approvalRows.map((a) => ({ id: a.id, title: a.title, requestedBy: a.requestedBy, status: a.status as Approval["status"] })),
    documents: documentRows.map((d) => ({
      id: d.id,
      name: d.name,
      type: d.type as DocumentRecord["type"],
      status: d.status as DocumentRecord["status"],
      updatedAt: d.updatedAt.toISOString(),
    })),
    expenses: expenseRows.map((e) => ({ id: e.id, vendor: e.vendor, department: e.department, amount: Number(e.amount), status: e.status as Expense["status"] })),
    budgetLines: budgetLineRows.map((b) => ({ department: b.department, budgeted: Number(b.budgeted), actual: Number(b.actual) })),
    activities: activityRows.map((a) => ({ id: a.id, timestamp: a.timestamp.toISOString(), actor: a.actor, description: a.description })),
    callSheets: callSheetRows.map((c) => ({
      shootDayId: c.shootDayId,
      weather: c.weather,
      sunrise: c.sunrise,
      sunset: c.sunset,
      hospital: c.hospital,
      parking: c.parking,
      basecamp: c.basecamp,
      timeline: eventsByShootDay.get(c.shootDayId) ?? [],
      notes: c.notes,
    })),
    aiRecommendations: aiRecommendationRows.map((r) => ({
      id: r.id,
      severity: r.severity as AIRecommendation["severity"],
      title: r.title,
      subject: r.subject,
      conflict: r.conflict,
      explanation: r.explanation ?? undefined,
      affected: r.affected,
      options: r.options,
      status: r.status as AIRecommendation["status"],
    })),
  };
}
