"use server";

import { requireProductionMember } from "@/lib/authz";
import { requireUser } from "@filmset/auth/server";
import { runAsUser, schema } from "@filmset/db/server";
import { and, eq } from "drizzle-orm";

/**
 * Real, data-backed Server Actions for the Transportation domain
 * (packages/db/migrations/0021_transportation_domain.sql,
 * docs/audits/LOGISTICS_DOMAIN_MODEL.md §3) — the second Logistics
 * subdomain built on the Booking Engine, following the same pattern as
 * Accommodation (apps/web/app/accommodation/actions.ts).
 *
 * Gated with `requireProductionMember(productionId)` (any member, no role
 * restriction) — matching Locations/Crew/Cast/Accommodation's existing
 * precedent for day-to-day operational data.
 */

export interface VehicleInput {
  type: string;
  identifier: string;
  capacity: number;
  notes: string;
}

function validateVehicle(input: VehicleInput) {
  const identifier = input.identifier.trim();
  if (!identifier) throw new Error("Vehicle identifier is required.");
  if (!Number.isInteger(input.capacity) || input.capacity < 1) throw new Error("Capacity must be a whole number of at least 1.");
  return { type: input.type.trim() || "PRODUCTION_VEHICLE", identifier, capacity: input.capacity, notes: input.notes.trim() || null };
}

export async function createVehicle(productionId: string, input: VehicleInput) {
  const user = await requireUser();
  await requireProductionMember(productionId);
  const values = validateVehicle(input);
  const id = crypto.randomUUID();
  await runAsUser(user.id, (db) => db.insert(schema.vehicles).values({ id, productionId, ...values }));
  return id;
}

export async function updateVehicle(productionId: string, id: string, input: VehicleInput) {
  const user = await requireUser();
  await requireProductionMember(productionId);
  const values = validateVehicle(input);
  await runAsUser(user.id, (db) =>
    db.update(schema.vehicles).set(values).where(and(eq(schema.vehicles.id, id), eq(schema.vehicles.productionId, productionId))),
  );
}

/** Rejects if any movement leg still references this vehicle — same "check first, say why" pattern as deleteLocation/deleteProperty. */
export async function deleteVehicle(productionId: string, id: string) {
  const user = await requireUser();
  await requireProductionMember(productionId);
  await runAsUser(user.id, async (db) => {
    const legRows = await db.select({ id: schema.movementLegs.id }).from(schema.movementLegs).where(eq(schema.movementLegs.vehicleId, id)).limit(1);
    if (legRows.length > 0) throw new Error("This vehicle still has movement legs assigned to it — unassign it from those legs before removing it.");
    await db.delete(schema.vehicles).where(and(eq(schema.vehicles.id, id), eq(schema.vehicles.productionId, productionId)));
  });
}

export interface DriverInput {
  crewMemberId: string | null;
  externalName: string;
  notes: string;
}

export async function createDriver(productionId: string, input: DriverInput) {
  const user = await requireUser();
  await requireProductionMember(productionId);
  const externalName = input.externalName.trim();
  if (!input.crewMemberId && !externalName) throw new Error("Choose a crew member or enter an external driver name.");
  if (input.crewMemberId && externalName) throw new Error("Choose either a crew member or an external driver name, not both.");

  const id = crypto.randomUUID();
  await runAsUser(user.id, (db) =>
    db.insert(schema.drivers).values({
      id,
      productionId,
      crewMemberId: input.crewMemberId,
      externalName: input.crewMemberId ? null : externalName,
      notes: input.notes.trim() || null,
    }),
  );
  return id;
}

export async function deleteDriver(productionId: string, id: string) {
  const user = await requireUser();
  await requireProductionMember(productionId);
  await runAsUser(user.id, async (db) => {
    const legRows = await db.select({ id: schema.movementLegs.id }).from(schema.movementLegs).where(eq(schema.movementLegs.driverId, id)).limit(1);
    if (legRows.length > 0) throw new Error("This driver still has movement legs assigned to them — unassign them from those legs before removing them.");
    await db.delete(schema.drivers).where(and(eq(schema.drivers.id, id), eq(schema.drivers.productionId, productionId)));
  });
}

export async function addDriverQualification(productionId: string, driverId: string, qualificationType: string, expiryDate: string | null) {
  const user = await requireUser();
  await requireProductionMember(productionId);
  const trimmedType = qualificationType.trim();
  if (!trimmedType) throw new Error("Qualification type is required.");

  const id = crypto.randomUUID();
  await runAsUser(user.id, async (db) => {
    const [driver] = await db
      .select({ id: schema.drivers.id })
      .from(schema.drivers)
      .where(and(eq(schema.drivers.id, driverId), eq(schema.drivers.productionId, productionId)))
      .limit(1);
    if (!driver) throw new Error("Driver not found in this production.");
    await db.insert(schema.driverQualifications).values({
      id,
      driverId,
      qualificationType: trimmedType,
      expiryDate: expiryDate ? new Date(expiryDate) : null,
    });
  });
  return id;
}

export async function deleteDriverQualification(productionId: string, driverId: string, qualificationId: string) {
  const user = await requireUser();
  await requireProductionMember(productionId);
  await runAsUser(user.id, async (db) => {
    const [driver] = await db
      .select({ id: schema.drivers.id })
      .from(schema.drivers)
      .where(and(eq(schema.drivers.id, driverId), eq(schema.drivers.productionId, productionId)))
      .limit(1);
    if (!driver) throw new Error("Driver not found in this production.");
    await db
      .delete(schema.driverQualifications)
      .where(and(eq(schema.driverQualifications.id, qualificationId), eq(schema.driverQualifications.driverId, driverId)));
  });
}

/**
 * Creates a movement: one `bookings` row (type "VEHICLE", subject pointing
 * back at the new movement) plus the `movements` row itself, in a single
 * transaction — mirrors bookStay() exactly. Goes straight to "PLANNED"
 * status with a BOOKED underlying booking; no quote or approval step in
 * this v1.
 */
export async function createMovement(productionId: string, date: string, purpose: string) {
  const user = await requireUser();
  await requireProductionMember(productionId);
  const parsedDate = new Date(date);
  if (Number.isNaN(parsedDate.getTime())) throw new Error("A valid date is required.");
  const trimmedPurpose = purpose.trim();
  if (!trimmedPurpose) throw new Error("Purpose is required.");

  const movementId = crypto.randomUUID();
  const bookingId = crypto.randomUUID();

  await runAsUser(user.id, (db) =>
    db.transaction(async (tx) => {
      await tx.insert(schema.bookings).values({
        id: bookingId,
        productionId,
        type: "VEHICLE",
        status: "BOOKED",
        requestedBy: user.id,
        subjectType: "TRANSPORT_MOVEMENT",
        subjectId: movementId,
      });
      await tx.insert(schema.movements).values({ id: movementId, productionId, date: parsedDate, purpose: trimmedPurpose, bookingId });
    }),
  );

  return movementId;
}

/** Cancels a movement's booking (status → CANCELLED + a booking_cancellations record), mirroring cancelStay — the movement/legs stay as the historical record. */
export async function cancelMovement(productionId: string, movementId: string, reason: string) {
  const user = await requireUser();
  await requireProductionMember(productionId);
  const trimmedReason = reason.trim() || "No reason given.";

  await runAsUser(user.id, (db) =>
    db.transaction(async (tx) => {
      const [movement] = await tx
        .select({ bookingId: schema.movements.bookingId })
        .from(schema.movements)
        .where(and(eq(schema.movements.id, movementId), eq(schema.movements.productionId, productionId)))
        .limit(1);
      if (!movement) throw new Error("Movement not found in this production.");

      await tx.update(schema.movements).set({ status: "CANCELLED", updatedAt: new Date() }).where(eq(schema.movements.id, movementId));
      if (movement.bookingId) {
        await tx.update(schema.bookings).set({ status: "CANCELLED", updatedAt: new Date() }).where(eq(schema.bookings.id, movement.bookingId));
        await tx.insert(schema.bookingCancellations).values({ bookingId: movement.bookingId, reason: trimmedReason });
      }
    }),
  );
}

export interface MovementLegInput {
  pickupLocationId: string | null;
  pickupNotes: string;
  dropoffLocationId: string | null;
  dropoffNotes: string;
  scheduledTime: string;
  vehicleId: string | null;
  driverId: string | null;
}

/**
 * Adds a leg to a movement. Guards the unambiguous conflict case at write
 * time (LOGISTICS_DOMAIN_MODEL.md §3): the same vehicle or driver assigned
 * to two legs at the exact same scheduled_time cannot physically happen.
 * Finer-grained "too-tight-a-window" conflict detection is real future
 * work for a Control Center query, not invented here with an arbitrary
 * buffer.
 */
export async function addMovementLeg(productionId: string, movementId: string, input: MovementLegInput) {
  const user = await requireUser();
  await requireProductionMember(productionId);
  const scheduledTime = new Date(input.scheduledTime);
  if (Number.isNaN(scheduledTime.getTime())) throw new Error("A valid scheduled time is required.");

  const id = crypto.randomUUID();
  await runAsUser(user.id, async (db) =>
    db.transaction(async (tx) => {
      const [movement] = await tx
        .select({ id: schema.movements.id })
        .from(schema.movements)
        .where(and(eq(schema.movements.id, movementId), eq(schema.movements.productionId, productionId)))
        .limit(1);
      if (!movement) throw new Error("Movement not found in this production.");

      if (input.vehicleId) {
        const conflicts = await tx
          .select({ id: schema.movementLegs.id })
          .from(schema.movementLegs)
          .where(and(eq(schema.movementLegs.vehicleId, input.vehicleId), eq(schema.movementLegs.scheduledTime, scheduledTime)));
        if (conflicts.length > 0) throw new Error("This vehicle is already assigned to another leg at that exact time.");
      }
      if (input.driverId) {
        const conflicts = await tx
          .select({ id: schema.movementLegs.id })
          .from(schema.movementLegs)
          .where(and(eq(schema.movementLegs.driverId, input.driverId), eq(schema.movementLegs.scheduledTime, scheduledTime)));
        if (conflicts.length > 0) throw new Error("This driver is already assigned to another leg at that exact time.");
      }

      await tx.insert(schema.movementLegs).values({
        id,
        movementId,
        pickupLocationId: input.pickupLocationId,
        pickupNotes: input.pickupNotes.trim() || null,
        dropoffLocationId: input.dropoffLocationId,
        dropoffNotes: input.dropoffNotes.trim() || null,
        scheduledTime,
        vehicleId: input.vehicleId,
        driverId: input.driverId,
      });
    }),
  );
  return id;
}

export async function deleteMovementLeg(productionId: string, movementId: string, legId: string) {
  const user = await requireUser();
  await requireProductionMember(productionId);
  await runAsUser(user.id, async (db) => {
    const [movement] = await db
      .select({ id: schema.movements.id })
      .from(schema.movements)
      .where(and(eq(schema.movements.id, movementId), eq(schema.movements.productionId, productionId)))
      .limit(1);
    if (!movement) throw new Error("Movement not found in this production.");
    await db.delete(schema.movementLegs).where(and(eq(schema.movementLegs.id, legId), eq(schema.movementLegs.movementId, movementId)));
  });
}

/** Adds a passenger to a leg's manifest, rejecting if it would exceed the assigned vehicle's capacity (LOGISTICS_DOMAIN_MODEL.md §3's capacity conflict) — a leg with no vehicle assigned yet has no capacity to check against. */
export async function addLegPassenger(productionId: string, legId: string, personType: "CAST" | "CREW", personId: string) {
  const user = await requireUser();
  await requireProductionMember(productionId);
  if (!personId) throw new Error("Choose a person.");

  const id = crypto.randomUUID();
  await runAsUser(user.id, (db) =>
    db.transaction(async (tx) => {
      const [leg] = await tx
        .select({ id: schema.movementLegs.id, vehicleId: schema.movementLegs.vehicleId })
        .from(schema.movementLegs)
        .innerJoin(schema.movements, eq(schema.movements.id, schema.movementLegs.movementId))
        .where(and(eq(schema.movementLegs.id, legId), eq(schema.movements.productionId, productionId)))
        .limit(1);
      if (!leg) throw new Error("Leg not found in this production.");

      if (leg.vehicleId) {
        const [vehicle] = await tx.select({ capacity: schema.vehicles.capacity }).from(schema.vehicles).where(eq(schema.vehicles.id, leg.vehicleId)).limit(1);
        const passengerRows = await tx.select({ id: schema.movementLegPassengers.id }).from(schema.movementLegPassengers).where(eq(schema.movementLegPassengers.legId, legId));
        if (vehicle && passengerRows.length >= vehicle.capacity) {
          throw new Error(`This vehicle's capacity (${vehicle.capacity}) is already full for this leg.`);
        }
      }

      await tx.insert(schema.movementLegPassengers).values({
        id,
        legId,
        personType,
        castMemberId: personType === "CAST" ? personId : null,
        crewMemberId: personType === "CREW" ? personId : null,
      });
    }),
  );
  return id;
}

export async function removeLegPassenger(productionId: string, legId: string, passengerId: string) {
  const user = await requireUser();
  await requireProductionMember(productionId);
  await runAsUser(user.id, async (db) => {
    const [leg] = await db
      .select({ id: schema.movementLegs.id })
      .from(schema.movementLegs)
      .innerJoin(schema.movements, eq(schema.movements.id, schema.movementLegs.movementId))
      .where(and(eq(schema.movementLegs.id, legId), eq(schema.movements.productionId, productionId)))
      .limit(1);
    if (!leg) throw new Error("Leg not found in this production.");
    await db
      .delete(schema.movementLegPassengers)
      .where(and(eq(schema.movementLegPassengers.id, passengerId), eq(schema.movementLegPassengers.legId, legId)));
  });
}
