"use server";

import { requireProductionMember } from "@/lib/authz";
import { requireUser } from "@filmset/auth/server";
import { runAsUser, schema } from "@filmset/db/server";
import { and, eq } from "drizzle-orm";

export interface CastCallEntryInput {
  personId: string;
  callTime: string;
  status: string | null;
  onCall: boolean;
  pickupTime: string | null;
  makeupCallTime: string | null;
  hairCallTime: string | null;
  wardrobeCallTime: string | null;
  rehearsalCallTime: string | null;
}

export interface BackgroundExtraInput {
  id: string;
  description: string;
  headcount: number;
  callTime: string | null;
  instructions: string | null;
}

export interface StandInInput {
  id: string;
  name: string;
  standsInForCastMemberId: string | null;
  phone: string | null;
  callTime: string | null;
}

export interface VehicleInput {
  id: string;
  type: string;
  description: string;
  driverName: string | null;
  driverPhone: string | null;
  notes: string | null;
}

export interface TransportRunInput {
  id: string;
  driverName: string | null;
  pickupTime: string | null;
  pickupLocation: string | null;
  dropoffLocation: string | null;
  passengers: string | null;
  notes: string | null;
}

export interface CallSheetInput {
  weather: string;
  sunrise: string;
  sunset: string;
  hospital: string;
  parking: string;
  basecamp: string;
  notes: string;
  timeline: { time: string; label: string }[];
  /** A cast member absent here uses the day's general crew call — only explicit overrides are persisted. */
  castCallTimes: CastCallEntryInput[];
  crewCallTimes: { personId: string; callTime: string }[];
  backgroundExtras: BackgroundExtraInput[];
  standIns: StandInInput[];
  vehicles: VehicleInput[];
  transportRuns: TransportRunInput[];
}

/**
 * call_sheets is keyed by shoot_day_id (one row per day) and
 * call_sheet_timeline_events references that key — so timeline events
 * can't exist without a call_sheets row, hence the upsert here rather than
 * assuming one already exists (a freshly-created shoot day has none yet).
 */
export async function saveCallSheet(productionId: string, shootDayId: string, input: CallSheetInput) {
  const user = await requireUser();
  await requireProductionMember(productionId);

  await runAsUser(user.id, (db) =>
    db.transaction(async (tx) => {
      const [shootDay] = await tx
        .select({ id: schema.shootDays.id })
        .from(schema.shootDays)
        .where(and(eq(schema.shootDays.id, shootDayId), eq(schema.shootDays.productionId, productionId)))
        .limit(1);
      if (!shootDay) throw new Error("Shoot day not found in this production.");

      const fields = {
        weather: input.weather,
        sunrise: input.sunrise,
        sunset: input.sunset,
        hospital: input.hospital,
        parking: input.parking,
        basecamp: input.basecamp,
        notes: input.notes,
      };

      await tx
        .insert(schema.callSheets)
        .values({ shootDayId, productionId, ...fields })
        .onConflictDoUpdate({ target: schema.callSheets.shootDayId, set: fields });

      await tx.delete(schema.callSheetTimelineEvents).where(eq(schema.callSheetTimelineEvents.shootDayId, shootDayId));
      if (input.timeline.length > 0) {
        await tx.insert(schema.callSheetTimelineEvents).values(
          input.timeline.map((event, index) => ({
            id: crypto.randomUUID(),
            shootDayId,
            time: event.time,
            label: event.label,
            sortOrder: index,
          })),
        );
      }

      await tx.delete(schema.shootDayCastCallTimes).where(eq(schema.shootDayCastCallTimes.shootDayId, shootDayId));
      if (input.castCallTimes.length > 0) {
        await tx.insert(schema.shootDayCastCallTimes).values(
          input.castCallTimes.map((c) => ({
            shootDayId,
            castMemberId: c.personId,
            callTime: c.callTime,
            status: c.status,
            onCall: c.onCall,
            pickupTime: c.pickupTime,
            makeupCallTime: c.makeupCallTime,
            hairCallTime: c.hairCallTime,
            wardrobeCallTime: c.wardrobeCallTime,
            rehearsalCallTime: c.rehearsalCallTime,
          })),
        );
      }

      await tx.delete(schema.shootDayCrewCallTimes).where(eq(schema.shootDayCrewCallTimes.shootDayId, shootDayId));
      if (input.crewCallTimes.length > 0) {
        await tx
          .insert(schema.shootDayCrewCallTimes)
          .values(input.crewCallTimes.map((c) => ({ shootDayId, crewMemberId: c.personId, callTime: c.callTime })));
      }

      await tx.delete(schema.backgroundExtras).where(eq(schema.backgroundExtras.shootDayId, shootDayId));
      if (input.backgroundExtras.length > 0) {
        await tx.insert(schema.backgroundExtras).values(
          input.backgroundExtras.map((e) => ({
            id: e.id,
            shootDayId,
            description: e.description,
            headcount: e.headcount,
            callTime: e.callTime,
            instructions: e.instructions,
          })),
        );
      }

      await tx.delete(schema.standIns).where(eq(schema.standIns.shootDayId, shootDayId));
      if (input.standIns.length > 0) {
        await tx.insert(schema.standIns).values(
          input.standIns.map((s) => ({
            id: s.id,
            shootDayId,
            name: s.name,
            standsInForCastMemberId: s.standsInForCastMemberId,
            phone: s.phone,
            callTime: s.callTime,
          })),
        );
      }

      await tx.delete(schema.productionVehicles).where(eq(schema.productionVehicles.shootDayId, shootDayId));
      if (input.vehicles.length > 0) {
        await tx.insert(schema.productionVehicles).values(
          input.vehicles.map((v) => ({
            id: v.id,
            shootDayId,
            type: v.type,
            description: v.description,
            driverName: v.driverName,
            driverPhone: v.driverPhone,
            notes: v.notes,
          })),
        );
      }

      await tx.delete(schema.transportRuns).where(eq(schema.transportRuns.shootDayId, shootDayId));
      if (input.transportRuns.length > 0) {
        await tx.insert(schema.transportRuns).values(
          input.transportRuns.map((r) => ({
            id: r.id,
            shootDayId,
            driverName: r.driverName,
            pickupTime: r.pickupTime,
            pickupLocation: r.pickupLocation,
            dropoffLocation: r.dropoffLocation,
            passengers: r.passengers,
            notes: r.notes,
          })),
        );
      }
    }),
  );
}
