"use server";

import { requireProductionMember } from "@/lib/authz";
import { requireUser } from "@filmset/auth/server";
import { runAsUser, schema } from "@filmset/db/server";
import { and, eq } from "drizzle-orm";

/**
 * Real, data-backed Server Actions for the Catering domain
 * (packages/db/migrations/0022_catering_domain.sql,
 * docs/audits/LOGISTICS_DOMAIN_MODEL.md §6) — the third Logistics
 * subdomain built on the Booking Engine.
 *
 * Dietary profile/requirement writes are gated
 * `requireProductionMember(productionId, ["Producer"])` — the owner's
 * explicit choice, matching every prior write action in this train
 * (apps/web/app/settings/departments/actions.ts) rather than wiring the
 * real `authorize()` engine's `catering.dietary.view_individual`
 * permission, which stays deliberately unwired everywhere in this app
 * so far. Vendor/meal-service/order writes are open to any production
 * member, matching Locations/Crew/Cast/Accommodation/Transportation's
 * precedent for ordinary operational data — nobody's health information
 * is at stake there.
 */

function validatePerson(personType: "CAST" | "CREW", personId: string) {
  if (!personId) throw new Error("Choose a person.");
  return personType;
}

export async function createDietaryProfile(productionId: string, personType: "CAST" | "CREW", personId: string, notes: string) {
  const user = await requireUser();
  await requireProductionMember(productionId, ["Producer"]);
  validatePerson(personType, personId);

  const id = crypto.randomUUID();
  await runAsUser(user.id, (db) =>
    db.insert(schema.dietaryProfiles).values({
      id,
      productionId,
      personType,
      castMemberId: personType === "CAST" ? personId : null,
      crewMemberId: personType === "CREW" ? personId : null,
      notes: notes.trim() || null,
    }),
  );
  return id;
}

export async function updateDietaryProfileNotes(productionId: string, profileId: string, notes: string) {
  const user = await requireUser();
  await requireProductionMember(productionId, ["Producer"]);
  await runAsUser(user.id, (db) =>
    db
      .update(schema.dietaryProfiles)
      .set({ notes: notes.trim() || null, updatedAt: new Date() })
      .where(and(eq(schema.dietaryProfiles.id, profileId), eq(schema.dietaryProfiles.productionId, productionId))),
  );
}

export async function deleteDietaryProfile(productionId: string, profileId: string) {
  const user = await requireUser();
  await requireProductionMember(productionId, ["Producer"]);
  await runAsUser(user.id, (db) =>
    db.delete(schema.dietaryProfiles).where(and(eq(schema.dietaryProfiles.id, profileId), eq(schema.dietaryProfiles.productionId, productionId))),
  );
}

export async function addDietaryRequirement(productionId: string, profileId: string, requirementType: string, severity: "PREFERENCE" | "MILD" | "SEVERE") {
  const user = await requireUser();
  await requireProductionMember(productionId, ["Producer"]);
  const trimmedType = requirementType.trim();
  if (!trimmedType) throw new Error("Requirement type is required.");

  const id = crypto.randomUUID();
  await runAsUser(user.id, async (db) => {
    const [profile] = await db
      .select({ id: schema.dietaryProfiles.id })
      .from(schema.dietaryProfiles)
      .where(and(eq(schema.dietaryProfiles.id, profileId), eq(schema.dietaryProfiles.productionId, productionId)))
      .limit(1);
    if (!profile) throw new Error("Dietary profile not found in this production.");
    await db.insert(schema.dietaryRequirements).values({ id, profileId, requirementType: trimmedType, severity });
  });
  return id;
}

export async function deleteDietaryRequirement(productionId: string, profileId: string, requirementId: string) {
  const user = await requireUser();
  await requireProductionMember(productionId, ["Producer"]);
  await runAsUser(user.id, async (db) => {
    const [profile] = await db
      .select({ id: schema.dietaryProfiles.id })
      .from(schema.dietaryProfiles)
      .where(and(eq(schema.dietaryProfiles.id, profileId), eq(schema.dietaryProfiles.productionId, productionId)))
      .limit(1);
    if (!profile) throw new Error("Dietary profile not found in this production.");
    await db.delete(schema.dietaryRequirements).where(and(eq(schema.dietaryRequirements.id, requirementId), eq(schema.dietaryRequirements.profileId, profileId)));
  });
}

export interface VendorInput {
  name: string;
  contact: string;
  contractTerms: string;
}

export async function createVendor(productionId: string, input: VendorInput) {
  const user = await requireUser();
  await requireProductionMember(productionId);
  const name = input.name.trim();
  if (!name) throw new Error("Vendor name is required.");

  const id = crypto.randomUUID();
  await runAsUser(user.id, (db) =>
    db.insert(schema.cateringVendors).values({
      id,
      productionId,
      name,
      contact: input.contact.trim() || null,
      contractTerms: input.contractTerms.trim() || null,
    }),
  );
  return id;
}

export async function deleteVendor(productionId: string, id: string) {
  const user = await requireUser();
  await requireProductionMember(productionId);
  await runAsUser(user.id, async (db) => {
    const orderRows = await db
      .select({ id: schema.cateringOrders.id })
      .from(schema.cateringOrders)
      .where(eq(schema.cateringOrders.vendorId, id))
      .limit(1);
    if (orderRows.length > 0) throw new Error("This vendor still has catering orders — remove those orders before removing the vendor.");
    await db.delete(schema.cateringVendors).where(and(eq(schema.cateringVendors.id, id), eq(schema.cateringVendors.productionId, productionId)));
  });
}

export async function createMealService(productionId: string, date: string, mealType: "BREAKFAST" | "LUNCH" | "DINNER" | "CRAFT", locationId: string | null) {
  const user = await requireUser();
  await requireProductionMember(productionId);
  const parsedDate = new Date(date);
  if (Number.isNaN(parsedDate.getTime())) throw new Error("A valid date is required.");

  const id = crypto.randomUUID();
  await runAsUser(user.id, (db) => db.insert(schema.mealServices).values({ id, productionId, date: parsedDate, mealType, locationId }));
  return id;
}

export async function deleteMealService(productionId: string, id: string) {
  const user = await requireUser();
  await requireProductionMember(productionId);
  await runAsUser(user.id, (db) => db.delete(schema.mealServices).where(and(eq(schema.mealServices.id, id), eq(schema.mealServices.productionId, productionId))));
}

export async function addServiceAssignment(productionId: string, serviceId: string, personType: "CAST" | "CREW", personId: string) {
  const user = await requireUser();
  await requireProductionMember(productionId);
  validatePerson(personType, personId);

  const id = crypto.randomUUID();
  await runAsUser(user.id, async (db) => {
    const [service] = await db
      .select({ id: schema.mealServices.id })
      .from(schema.mealServices)
      .where(and(eq(schema.mealServices.id, serviceId), eq(schema.mealServices.productionId, productionId)))
      .limit(1);
    if (!service) throw new Error("Meal service not found in this production.");
    await db.insert(schema.mealServiceAssignments).values({
      id,
      serviceId,
      personType,
      castMemberId: personType === "CAST" ? personId : null,
      crewMemberId: personType === "CREW" ? personId : null,
    });
  });
  return id;
}

export async function removeServiceAssignment(productionId: string, serviceId: string, assignmentId: string) {
  const user = await requireUser();
  await requireProductionMember(productionId);
  await runAsUser(user.id, async (db) => {
    const [service] = await db
      .select({ id: schema.mealServices.id })
      .from(schema.mealServices)
      .where(and(eq(schema.mealServices.id, serviceId), eq(schema.mealServices.productionId, productionId)))
      .limit(1);
    if (!service) throw new Error("Meal service not found in this production.");
    await db
      .delete(schema.mealServiceAssignments)
      .where(and(eq(schema.mealServiceAssignments.id, assignmentId), eq(schema.mealServiceAssignments.serviceId, serviceId)));
  });
}

/** Creates a catering order: one `bookings` row (type "CATERING", subject pointing back at the new order) plus the `catering_orders` row itself, in a single transaction — mirrors bookStay()/createMovement() exactly. */
export async function createCateringOrder(productionId: string, serviceId: string, vendorId: string | null, notes: string) {
  const user = await requireUser();
  await requireProductionMember(productionId);

  const orderId = crypto.randomUUID();
  const bookingId = crypto.randomUUID();

  await runAsUser(user.id, (db) =>
    db.transaction(async (tx) => {
      const [service] = await tx
        .select({ id: schema.mealServices.id })
        .from(schema.mealServices)
        .where(and(eq(schema.mealServices.id, serviceId), eq(schema.mealServices.productionId, productionId)))
        .limit(1);
      if (!service) throw new Error("Meal service not found in this production.");

      await tx.insert(schema.bookings).values({
        id: bookingId,
        productionId,
        type: "CATERING",
        status: "BOOKED",
        requestedBy: user.id,
        subjectType: "CATERING_ORDER",
        subjectId: orderId,
      });
      await tx.insert(schema.cateringOrders).values({ id: orderId, serviceId, vendorId, bookingId, notes: notes.trim() || null });
    }),
  );

  return orderId;
}

/** Cancels a catering order's booking (status → CANCELLED + a booking_cancellations record), mirroring cancelStay/cancelMovement — the order stays as the historical record. */
export async function cancelCateringOrder(productionId: string, orderId: string, reason: string) {
  const user = await requireUser();
  await requireProductionMember(productionId);
  const trimmedReason = reason.trim() || "No reason given.";

  await runAsUser(user.id, (db) =>
    db.transaction(async (tx) => {
      const [order] = await tx
        .select({ id: schema.cateringOrders.id, bookingId: schema.cateringOrders.bookingId })
        .from(schema.cateringOrders)
        .innerJoin(schema.mealServices, eq(schema.mealServices.id, schema.cateringOrders.serviceId))
        .where(and(eq(schema.cateringOrders.id, orderId), eq(schema.mealServices.productionId, productionId)))
        .limit(1);
      if (!order) throw new Error("Catering order not found in this production.");
      if (!order.bookingId) throw new Error("This order has no associated booking to cancel.");

      await tx.update(schema.bookings).set({ status: "CANCELLED", updatedAt: new Date() }).where(eq(schema.bookings.id, order.bookingId));
      await tx.insert(schema.bookingCancellations).values({ bookingId: order.bookingId, reason: trimmedReason });
    }),
  );
}
