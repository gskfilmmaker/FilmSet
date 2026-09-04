import "server-only";
import type {
  Activity,
  AIRecommendation,
  Approval,
  BackgroundExtra,
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
  ProductionVehicle,
  Prop,
  Scene,
  ScriptPage,
  ShootDay,
  StandIn,
  TransportRun,
} from "@filmset/core";
import type { ProductionRole } from "@filmset/auth";
import { runAsUser, schema } from "@filmset/db/server";
import { and, asc, eq } from "drizzle-orm";

export interface TeamMember {
  userId: string;
  role: ProductionRole;
  email: string;
  fullName: string | null;
}

/**
 * Reshapes the relational schema back into the same shapes the FRAME
 * prototype screens were built against (packages/core), so screens read
 * real data with the same field names fixtures used — swapping the import
 * is most of the migration; only mutations are new.
 */
export interface ProductionSnapshot {
  production: Production;
  members: TeamMember[];
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
  backgroundExtras: BackgroundExtra[];
  standIns: StandIn[];
  vehicles: ProductionVehicle[];
  transportRuns: TransportRun[];
  aiRecommendations: AIRecommendation[];
}

/**
 * Runs entirely inside runAsUser(userId, ...) — every SELECT here is
 * subject to the production_members-based RLS policies in
 * packages/db/migrations/0001_rls_and_auth_trigger.sql, so a user who
 * isn't a member of `productionId` gets empty results (and the
 * `production` guard below throws) regardless of what this function asks
 * for.
 */
export async function getProductionSnapshot(userId: string, productionId: string): Promise<ProductionSnapshot> {
  const [
    productionRow,
    memberRows,
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
    castCallTimeRows,
    crewCallTimeRows,
    backgroundExtraRows,
    standInRows,
    vehicleRows,
    transportRunRows,
    aiRecommendationRows,
  ] = await runAsUser(userId, (db) =>
    Promise.all([
      db.select().from(schema.productions).where(eq(schema.productions.id, productionId)).limit(1),
      db
        .select({
          userId: schema.productionMembers.userId,
          role: schema.productionMembers.role,
          email: schema.profiles.email,
          fullName: schema.profiles.fullName,
        })
        .from(schema.productionMembers)
        .innerJoin(schema.profiles, eq(schema.profiles.id, schema.productionMembers.userId))
        .where(eq(schema.productionMembers.productionId, productionId)),
      db.select().from(schema.characters).where(eq(schema.characters.productionId, productionId)),
      db.select().from(schema.castMembers).where(eq(schema.castMembers.productionId, productionId)),
      db.select().from(schema.crewMembers).where(eq(schema.crewMembers.productionId, productionId)),
      db.select().from(schema.locations).where(eq(schema.locations.productionId, productionId)),
      db.select().from(schema.props).where(eq(schema.props.productionId, productionId)),
      // No production_id column on join tables — scope by joining through
      // the scene they attach to, which does have one. Now that a user can
      // belong to more than one production (see production-actions.ts), an
      // unscoped select here would pull in every production's join rows;
      // RLS still keeps a stranger's rows out, but not a co-member's other
      // production's rows.
      db
        .select({ propId: schema.propScenes.propId, sceneId: schema.propScenes.sceneId })
        .from(schema.propScenes)
        .innerJoin(schema.scenes, and(eq(schema.scenes.id, schema.propScenes.sceneId), eq(schema.scenes.productionId, productionId))),
      db.select().from(schema.scenes).where(eq(schema.scenes.productionId, productionId)).orderBy(asc(schema.scenes.scheduleOrder)),
      db
        .select({ sceneId: schema.sceneCast.sceneId, castMemberId: schema.sceneCast.castMemberId })
        .from(schema.sceneCast)
        .innerJoin(schema.scenes, and(eq(schema.scenes.id, schema.sceneCast.sceneId), eq(schema.scenes.productionId, productionId))),
      db.select().from(schema.shootDays).where(eq(schema.shootDays.productionId, productionId)).orderBy(asc(schema.shootDays.dayNumber)),
      db.select().from(schema.breakdownElements).where(eq(schema.breakdownElements.productionId, productionId)),
      db.select().from(schema.scriptPages).where(eq(schema.scriptPages.productionId, productionId)),
      db.select().from(schema.issues).where(eq(schema.issues.productionId, productionId)),
      db
        .select({ issueId: schema.issueScenes.issueId, sceneId: schema.issueScenes.sceneId })
        .from(schema.issueScenes)
        .innerJoin(schema.scenes, and(eq(schema.scenes.id, schema.issueScenes.sceneId), eq(schema.scenes.productionId, productionId))),
      db.select().from(schema.approvals).where(eq(schema.approvals.productionId, productionId)),
      db.select().from(schema.documents).where(eq(schema.documents.productionId, productionId)),
      db.select().from(schema.expenses).where(eq(schema.expenses.productionId, productionId)),
      db.select().from(schema.budgetLines).where(eq(schema.budgetLines.productionId, productionId)),
      db.select().from(schema.activities).where(eq(schema.activities.productionId, productionId)).orderBy(asc(schema.activities.timestamp)),
      db.select().from(schema.callSheets).where(eq(schema.callSheets.productionId, productionId)),
      db
        .select({
          id: schema.callSheetTimelineEvents.id,
          shootDayId: schema.callSheetTimelineEvents.shootDayId,
          time: schema.callSheetTimelineEvents.time,
          label: schema.callSheetTimelineEvents.label,
          sortOrder: schema.callSheetTimelineEvents.sortOrder,
        })
        .from(schema.callSheetTimelineEvents)
        .innerJoin(schema.shootDays, and(eq(schema.shootDays.id, schema.callSheetTimelineEvents.shootDayId), eq(schema.shootDays.productionId, productionId)))
        .orderBy(asc(schema.callSheetTimelineEvents.sortOrder)),
      db
        .select({
          shootDayId: schema.shootDayCastCallTimes.shootDayId,
          castMemberId: schema.shootDayCastCallTimes.castMemberId,
          callTime: schema.shootDayCastCallTimes.callTime,
          status: schema.shootDayCastCallTimes.status,
          onCall: schema.shootDayCastCallTimes.onCall,
          pickupTime: schema.shootDayCastCallTimes.pickupTime,
          makeupCallTime: schema.shootDayCastCallTimes.makeupCallTime,
          hairCallTime: schema.shootDayCastCallTimes.hairCallTime,
          wardrobeCallTime: schema.shootDayCastCallTimes.wardrobeCallTime,
          rehearsalCallTime: schema.shootDayCastCallTimes.rehearsalCallTime,
        })
        .from(schema.shootDayCastCallTimes)
        .innerJoin(schema.shootDays, and(eq(schema.shootDays.id, schema.shootDayCastCallTimes.shootDayId), eq(schema.shootDays.productionId, productionId))),
      db
        .select({
          shootDayId: schema.shootDayCrewCallTimes.shootDayId,
          crewMemberId: schema.shootDayCrewCallTimes.crewMemberId,
          callTime: schema.shootDayCrewCallTimes.callTime,
        })
        .from(schema.shootDayCrewCallTimes)
        .innerJoin(schema.shootDays, and(eq(schema.shootDays.id, schema.shootDayCrewCallTimes.shootDayId), eq(schema.shootDays.productionId, productionId))),
      db
        .select({
          id: schema.backgroundExtras.id,
          shootDayId: schema.backgroundExtras.shootDayId,
          description: schema.backgroundExtras.description,
          headcount: schema.backgroundExtras.headcount,
          callTime: schema.backgroundExtras.callTime,
          instructions: schema.backgroundExtras.instructions,
        })
        .from(schema.backgroundExtras)
        .innerJoin(schema.shootDays, and(eq(schema.shootDays.id, schema.backgroundExtras.shootDayId), eq(schema.shootDays.productionId, productionId))),
      db
        .select({
          id: schema.standIns.id,
          shootDayId: schema.standIns.shootDayId,
          name: schema.standIns.name,
          standsInForCastMemberId: schema.standIns.standsInForCastMemberId,
          phone: schema.standIns.phone,
          callTime: schema.standIns.callTime,
        })
        .from(schema.standIns)
        .innerJoin(schema.shootDays, and(eq(schema.shootDays.id, schema.standIns.shootDayId), eq(schema.shootDays.productionId, productionId))),
      db
        .select({
          id: schema.productionVehicles.id,
          shootDayId: schema.productionVehicles.shootDayId,
          type: schema.productionVehicles.type,
          description: schema.productionVehicles.description,
          driverName: schema.productionVehicles.driverName,
          driverPhone: schema.productionVehicles.driverPhone,
          notes: schema.productionVehicles.notes,
        })
        .from(schema.productionVehicles)
        .innerJoin(schema.shootDays, and(eq(schema.shootDays.id, schema.productionVehicles.shootDayId), eq(schema.shootDays.productionId, productionId))),
      db
        .select({
          id: schema.transportRuns.id,
          shootDayId: schema.transportRuns.shootDayId,
          driverName: schema.transportRuns.driverName,
          pickupTime: schema.transportRuns.pickupTime,
          pickupLocation: schema.transportRuns.pickupLocation,
          dropoffLocation: schema.transportRuns.dropoffLocation,
          passengers: schema.transportRuns.passengers,
          notes: schema.transportRuns.notes,
        })
        .from(schema.transportRuns)
        .innerJoin(schema.shootDays, and(eq(schema.shootDays.id, schema.transportRuns.shootDayId), eq(schema.shootDays.productionId, productionId))),
      db
        .select()
        .from(schema.aiRecommendations)
        .where(and(eq(schema.aiRecommendations.productionId, productionId), eq(schema.aiRecommendations.status, "pending"))),
    ]),
  );

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

  const castCallTimesByShootDay = new Map<string, CallSheet["castCallTimes"]>();
  for (const row of castCallTimeRows) {
    const list = castCallTimesByShootDay.get(row.shootDayId) ?? [];
    list.push({
      personId: row.castMemberId,
      callTime: row.callTime,
      status: row.status as CallSheet["castCallTimes"][number]["status"],
      onCall: row.onCall,
      pickupTime: row.pickupTime,
      makeupCallTime: row.makeupCallTime,
      hairCallTime: row.hairCallTime,
      wardrobeCallTime: row.wardrobeCallTime,
      rehearsalCallTime: row.rehearsalCallTime,
    });
    castCallTimesByShootDay.set(row.shootDayId, list);
  }


  const crewCallTimesByShootDay = new Map<string, { personId: string; callTime: string }[]>();
  for (const row of crewCallTimeRows) {
    const list = crewCallTimesByShootDay.get(row.shootDayId) ?? [];
    list.push({ personId: row.crewMemberId, callTime: row.callTime });
    crewCallTimesByShootDay.set(row.shootDayId, list);
  }

  return {
    production: {
      id: production.id,
      name: production.name,
      phase: production.phase as Production["phase"],
      scriptRevisionColor: production.scriptRevisionColor,
      logoPath: production.logoPath,
      brandColor: production.brandColor,
      shortCode: production.shortCode,
    },
    members: memberRows.map((m) => ({ userId: m.userId, role: m.role as ProductionRole, email: m.email, fullName: m.fullName })),
    characters: characterRows.map((c) => ({ id: c.id, name: c.name })),
    castMembers: castRows.map((c) => ({
      id: c.id,
      characterId: c.characterId,
      actorName: c.actorName,
      status: c.status as CastMember["status"],
      contract: c.contract as CastMember["contract"],
      email: c.email,
      phone: c.phone,
      emergencyContactName: c.emergencyContactName,
      emergencyContactPhone: c.emergencyContactPhone,
      agentName: c.agentName,
      agentPhone: c.agentPhone,
      agentEmail: c.agentEmail,
      height: c.height,
      shirtSize: c.shirtSize,
      pantSize: c.pantSize,
      shoeSize: c.shoeSize,
      sizingNotes: c.sizingNotes,
      photoPath: c.photoPath,
    })),
    crewMembers: crewRows.map((c) => ({
      id: c.id,
      name: c.name,
      department: c.department,
      role: c.role,
      isHod: c.isHod,
      contract: c.contract as CrewMember["contract"],
      walkieChannel: c.walkieChannel,
      email: c.email,
      phone: c.phone,
      emergencyContactName: c.emergencyContactName,
      emergencyContactPhone: c.emergencyContactPhone,
      agentName: c.agentName,
      agentPhone: c.agentPhone,
      agentEmail: c.agentEmail,
      photoPath: c.photoPath,
    })),
    locations: locationRows.map((l) => ({
      id: l.id,
      name: l.name,
      address: l.address,
      permitStatus: l.permitStatus as Location["permitStatus"],
      permitExpiry: l.permitExpiry,
      photoPath: l.photoPath,
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
      revisionColor: s.revisionColor,
      continuityNotes: s.continuityNotes,
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
      filePath: d.filePath,
      expiryDate: d.expiryDate,
      linkedCastMemberId: d.linkedCastMemberId,
      linkedCrewMemberId: d.linkedCrewMemberId,
      linkedLocationId: d.linkedLocationId,
    })),
    expenses: expenseRows.map((e) => ({
      id: e.id,
      vendor: e.vendor,
      department: e.department,
      amount: Number(e.amount),
      status: e.status as Expense["status"],
      date: e.date,
      invoiceNumber: e.invoiceNumber,
      documentPath: e.documentPath,
    })),
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
      castCallTimes: castCallTimesByShootDay.get(c.shootDayId) ?? [],
      crewCallTimes: crewCallTimesByShootDay.get(c.shootDayId) ?? [],
    })),
    backgroundExtras: backgroundExtraRows,
    standIns: standInRows,
    vehicles: vehicleRows.map((v) => ({ ...v, type: v.type as ProductionVehicle["type"] })),
    transportRuns: transportRunRows,
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
