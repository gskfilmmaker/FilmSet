"use server";

import { requireProductionMember } from "@/lib/authz";
import { requireUser } from "@filmset/auth/server";
import { runAsUser, schema } from "@filmset/db/server";
import { and, eq } from "drizzle-orm";

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
  castCallTimes: { personId: string; callTime: string }[];
  crewCallTimes: { personId: string; callTime: string }[];
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
        await tx
          .insert(schema.shootDayCastCallTimes)
          .values(input.castCallTimes.map((c) => ({ shootDayId, castMemberId: c.personId, callTime: c.callTime })));
      }

      await tx.delete(schema.shootDayCrewCallTimes).where(eq(schema.shootDayCrewCallTimes.shootDayId, shootDayId));
      if (input.crewCallTimes.length > 0) {
        await tx
          .insert(schema.shootDayCrewCallTimes)
          .values(input.crewCallTimes.map((c) => ({ shootDayId, crewMemberId: c.personId, callTime: c.callTime })));
      }
    }),
  );
}
