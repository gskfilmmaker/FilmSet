"use server";

import { requireProductionMember } from "@/lib/authz";
import { requireUser } from "@filmset/auth/server";
import { runAsUser, schema } from "@filmset/db/server";
import { and, eq } from "drizzle-orm";

/**
 * Real, data-backed Server Actions for the Accommodation domain
 * (packages/db/migrations/0020_accommodation_domain.sql,
 * docs/audits/LOGISTICS_DOMAIN_MODEL.md §2) — the first Logistics
 * subdomain built on the Booking Engine (0018).
 *
 * Gated with `requireProductionMember(productionId)` (any member, no role
 * restriction) — matching Locations/Crew/Cast's existing precedent for
 * day-to-day operational data, not Departments' Producer-only gate.
 * Booking a hotel room is ordinary production-coordination work, not an
 * organization-governance action.
 */

export interface PropertyInput {
  name: string;
  type: string;
  address: string;
  notes: string;
}

function validateProperty(input: PropertyInput) {
  const name = input.name.trim();
  if (!name) throw new Error("Property name is required.");
  return { name, type: input.type.trim() || "HOTEL", address: input.address.trim() || null, notes: input.notes.trim() || null };
}

export async function createProperty(productionId: string, input: PropertyInput) {
  const user = await requireUser();
  await requireProductionMember(productionId);
  const values = validateProperty(input);
  const id = crypto.randomUUID();
  await runAsUser(user.id, (db) => db.insert(schema.accommodationProperties).values({ id, productionId, ...values }));
  return id;
}

export async function updateProperty(productionId: string, id: string, input: PropertyInput) {
  const user = await requireUser();
  await requireProductionMember(productionId);
  const values = validateProperty(input);
  await runAsUser(user.id, (db) =>
    db
      .update(schema.accommodationProperties)
      .set(values)
      .where(and(eq(schema.accommodationProperties.id, id), eq(schema.accommodationProperties.productionId, productionId))),
  );
}

/** Rejects if any stay still references this property — same "check first, say why" pattern as deleteLocation. */
export async function deleteProperty(productionId: string, id: string) {
  const user = await requireUser();
  await requireProductionMember(productionId);

  await runAsUser(user.id, async (db) => {
    const stayRows = await db
      .select({ id: schema.stays.id })
      .from(schema.stays)
      .where(and(eq(schema.stays.propertyId, id), eq(schema.stays.productionId, productionId)))
      .limit(1);
    if (stayRows.length > 0) {
      throw new Error("This property still has stays booked against it — cancel or move those stays before removing it.");
    }
    await db
      .delete(schema.accommodationProperties)
      .where(and(eq(schema.accommodationProperties.id, id), eq(schema.accommodationProperties.productionId, productionId)));
  });
}

export async function createRoomType(productionId: string, propertyId: string, name: string, capacity: number) {
  const user = await requireUser();
  await requireProductionMember(productionId);
  const trimmedName = name.trim();
  if (!trimmedName) throw new Error("Room type name is required.");
  if (!Number.isInteger(capacity) || capacity < 1) throw new Error("Capacity must be a whole number of at least 1.");

  const id = crypto.randomUUID();
  await runAsUser(user.id, async (db) => {
    const [property] = await db
      .select({ id: schema.accommodationProperties.id })
      .from(schema.accommodationProperties)
      .where(and(eq(schema.accommodationProperties.id, propertyId), eq(schema.accommodationProperties.productionId, productionId)))
      .limit(1);
    if (!property) throw new Error("Property not found in this production.");
    await db.insert(schema.roomTypes).values({ id, propertyId, name: trimmedName, capacity });
  });
  return id;
}

export async function deleteRoomType(productionId: string, propertyId: string, roomTypeId: string) {
  const user = await requireUser();
  await requireProductionMember(productionId);
  await runAsUser(user.id, async (db) => {
    const [property] = await db
      .select({ id: schema.accommodationProperties.id })
      .from(schema.accommodationProperties)
      .where(and(eq(schema.accommodationProperties.id, propertyId), eq(schema.accommodationProperties.productionId, productionId)))
      .limit(1);
    if (!property) throw new Error("Property not found in this production.");
    await db.delete(schema.roomTypes).where(and(eq(schema.roomTypes.id, roomTypeId), eq(schema.roomTypes.propertyId, propertyId)));
  });
}

export interface BookStayInput {
  propertyId: string;
  roomTypeId: string | null;
  personType: "CAST" | "CREW";
  personId: string;
  checkIn: string;
  checkOut: string;
  roomNumber: string;
  notes: string;
}

/**
 * Books a stay: one `bookings` row (type "HOTEL", subject pointing back at
 * the new stay) plus the `stays` row itself, in a single transaction — the
 * first real write to `bookings.subjectType`/`subjectId`
 * (LOGISTICS_DOMAIN_MODEL.md §0.1). Goes straight to "BOOKED" status; this
 * v1 has no quote or approval step to route through first (see
 * packages/db/migrations/0020_accommodation_domain.sql's header comment).
 */
export async function bookStay(productionId: string, input: BookStayInput) {
  const user = await requireUser();
  await requireProductionMember(productionId);

  const checkIn = new Date(input.checkIn);
  const checkOut = new Date(input.checkOut);
  if (Number.isNaN(checkIn.getTime()) || Number.isNaN(checkOut.getTime())) throw new Error("Check-in and check-out dates are required.");
  if (checkOut <= checkIn) throw new Error("Check-out must be after check-in.");
  if (!input.personId) throw new Error("Choose who this stay is for.");

  const stayId = crypto.randomUUID();
  const bookingId = crypto.randomUUID();

  await runAsUser(user.id, (db) =>
    db.transaction(async (tx) => {
      const [property] = await tx
        .select({ id: schema.accommodationProperties.id })
        .from(schema.accommodationProperties)
        .where(and(eq(schema.accommodationProperties.id, input.propertyId), eq(schema.accommodationProperties.productionId, productionId)))
        .limit(1);
      if (!property) throw new Error("Property not found in this production.");

      await tx.insert(schema.bookings).values({
        id: bookingId,
        productionId,
        type: "HOTEL",
        status: "BOOKED",
        requestedBy: user.id,
        subjectType: "ACCOMMODATION_STAY",
        subjectId: stayId,
      });

      await tx.insert(schema.stays).values({
        id: stayId,
        productionId,
        propertyId: input.propertyId,
        roomTypeId: input.roomTypeId,
        personType: input.personType,
        castMemberId: input.personType === "CAST" ? input.personId : null,
        crewMemberId: input.personType === "CREW" ? input.personId : null,
        checkIn,
        checkOut,
        roomNumber: input.roomNumber.trim() || null,
        notes: input.notes.trim() || null,
        bookingId,
      });
    }),
  );

  return stayId;
}

/** Edits a stay's dates/room, logging a structured before/after diff (LOGISTICS_DOMAIN_MODEL.md §2's AccommodationChange) — mirrors how bookingChanges tracks a booking-level change. */
export async function updateStay(
  productionId: string,
  stayId: string,
  input: { checkIn: string; checkOut: string; roomNumber: string; roomTypeId: string | null },
) {
  const user = await requireUser();
  await requireProductionMember(productionId);

  const checkIn = new Date(input.checkIn);
  const checkOut = new Date(input.checkOut);
  if (Number.isNaN(checkIn.getTime()) || Number.isNaN(checkOut.getTime())) throw new Error("Check-in and check-out dates are required.");
  if (checkOut <= checkIn) throw new Error("Check-out must be after check-in.");
  const roomNumber = input.roomNumber.trim() || null;

  await runAsUser(user.id, (db) =>
    db.transaction(async (tx) => {
      const [existing] = await tx
        .select()
        .from(schema.stays)
        .where(and(eq(schema.stays.id, stayId), eq(schema.stays.productionId, productionId)))
        .limit(1);
      if (!existing) throw new Error("Stay not found in this production.");

      await tx
        .update(schema.stays)
        .set({ checkIn, checkOut, roomNumber, roomTypeId: input.roomTypeId, updatedAt: new Date() })
        .where(eq(schema.stays.id, stayId));

      await tx.insert(schema.accommodationChanges).values({
        id: crypto.randomUUID(),
        stayId,
        changeType: "DATES_OR_ROOM_UPDATED",
        beforeState: { checkIn: existing.checkIn, checkOut: existing.checkOut, roomNumber: existing.roomNumber, roomTypeId: existing.roomTypeId },
        afterState: { checkIn, checkOut, roomNumber, roomTypeId: input.roomTypeId },
      });
    }),
  );
}

/** Cancels a stay's booking (status → CANCELLED + a booking_cancellations record) — the stay row itself is kept as the historical record, matching LOGISTICS_DOMAIN_MODEL.md §0.1's terminal-record pattern for a booking rather than deleting it. */
export async function cancelStay(productionId: string, stayId: string, reason: string) {
  const user = await requireUser();
  await requireProductionMember(productionId);
  const trimmedReason = reason.trim() || "No reason given.";

  await runAsUser(user.id, (db) =>
    db.transaction(async (tx) => {
      const [stay] = await tx
        .select({ bookingId: schema.stays.bookingId })
        .from(schema.stays)
        .where(and(eq(schema.stays.id, stayId), eq(schema.stays.productionId, productionId)))
        .limit(1);
      if (!stay) throw new Error("Stay not found in this production.");
      if (!stay.bookingId) throw new Error("This stay has no associated booking to cancel.");

      await tx.update(schema.bookings).set({ status: "CANCELLED", updatedAt: new Date() }).where(eq(schema.bookings.id, stay.bookingId));
      await tx.insert(schema.bookingCancellations).values({ bookingId: stay.bookingId, reason: trimmedReason });
    }),
  );
}
