"use server";

import { requireProductionMember } from "@/lib/authz";
import { requireUser } from "@filmset/auth/server";
import { runAsUser, schema } from "@filmset/db/server";
import { and, eq } from "drizzle-orm";
import {
  parseOptionalPrice,
  validateCateringCurrency,
  validateMenuCategory,
  validateMenuDietType,
  validatePackagingType,
  validateProfileDietType,
  validateServiceStyle,
  validateSpiceLevel,
} from "./constants";

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

export interface DietaryPreferencesInput {
  notes: string;
  /** VEGETARIAN | NON_VEGETARIAN | VEGAN | EGGETARIAN | JAIN | HALAL | KOSHER — a standing preference, distinct from the graded allergy severities in dietary_requirements. */
  dietType: string;
  beveragePreference: string;
  /** MILD | MEDIUM | HOT. */
  spicePreference: string;
}

export async function createDietaryProfile(productionId: string, personType: "CAST" | "CREW", personId: string, input: DietaryPreferencesInput) {
  const user = await requireUser();
  await requireProductionMember(productionId, ["Producer"]);
  validatePerson(personType, personId);
  const dietType = validateProfileDietType(input.dietType);
  const spicePreference = validateSpiceLevel(input.spicePreference);

  const id = crypto.randomUUID();
  await runAsUser(user.id, (db) =>
    db.insert(schema.dietaryProfiles).values({
      id,
      productionId,
      personType,
      castMemberId: personType === "CAST" ? personId : null,
      crewMemberId: personType === "CREW" ? personId : null,
      notes: input.notes.trim() || null,
      dietType,
      beveragePreference: input.beveragePreference.trim() || null,
      spicePreference,
    }),
  );
  return id;
}

export async function updateDietaryProfile(productionId: string, profileId: string, input: DietaryPreferencesInput) {
  const user = await requireUser();
  await requireProductionMember(productionId, ["Producer"]);
  const dietType = validateProfileDietType(input.dietType);
  const spicePreference = validateSpiceLevel(input.spicePreference);
  await runAsUser(user.id, (db) =>
    db
      .update(schema.dietaryProfiles)
      .set({
        notes: input.notes.trim() || null,
        dietType,
        beveragePreference: input.beveragePreference.trim() || null,
        spicePreference,
        updatedAt: new Date(),
      })
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

export interface HospitalityDetailsInput {
  /** BUFFET | PLATED | PACKED_BOXES | FAMILY_STYLE. */
  serviceStyle: string;
  /** DISPOSABLE_ECO | DISPOSABLE_STANDARD | REUSABLE | PLATED. */
  packagingType: string;
  /** Free-text clock time (e.g. "12:30 PM") — the service's own `date` already carries the day. */
  serviceTime: string;
  headcountConfirmed: string;
  hospitalityNotes: string;
}

function parseOptionalHeadcount(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  if (!Number.isInteger(parsed) || parsed < 0) throw new Error("Confirmed headcount must be a non-negative whole number.");
  return parsed;
}

export async function createMealService(
  productionId: string,
  date: string,
  mealType: "BREAKFAST" | "LUNCH" | "DINNER" | "CRAFT",
  locationId: string | null,
  hospitality?: HospitalityDetailsInput,
) {
  const user = await requireUser();
  await requireProductionMember(productionId);
  const parsedDate = new Date(date);
  if (Number.isNaN(parsedDate.getTime())) throw new Error("A valid date is required.");
  const serviceStyle = hospitality ? validateServiceStyle(hospitality.serviceStyle) : null;
  const packagingType = hospitality ? validatePackagingType(hospitality.packagingType) : null;
  const headcountConfirmed = hospitality ? parseOptionalHeadcount(hospitality.headcountConfirmed) : null;

  const id = crypto.randomUUID();
  await runAsUser(user.id, (db) =>
    db.insert(schema.mealServices).values({
      id,
      productionId,
      date: parsedDate,
      mealType,
      locationId,
      serviceStyle,
      packagingType,
      serviceTime: hospitality?.serviceTime.trim() || null,
      headcountConfirmed,
      hospitalityNotes: hospitality?.hospitalityNotes.trim() || null,
    }),
  );
  return id;
}

export async function updateMealServiceDetails(productionId: string, serviceId: string, hospitality: HospitalityDetailsInput) {
  const user = await requireUser();
  await requireProductionMember(productionId);
  const serviceStyle = validateServiceStyle(hospitality.serviceStyle);
  const packagingType = validatePackagingType(hospitality.packagingType);
  const headcountConfirmed = parseOptionalHeadcount(hospitality.headcountConfirmed);

  await runAsUser(user.id, (db) =>
    db
      .update(schema.mealServices)
      .set({
        serviceStyle,
        packagingType,
        serviceTime: hospitality.serviceTime.trim() || null,
        headcountConfirmed,
        hospitalityNotes: hospitality.hospitalityNotes.trim() || null,
        updatedAt: new Date(),
      })
      .where(and(eq(schema.mealServices.id, serviceId), eq(schema.mealServices.productionId, productionId))),
  );
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

export interface CateringOrderItemInput {
  menuItemId: string;
  quantity: number;
}

/** Creates a catering order: one `bookings` row (type "CATERING", subject pointing back at the new order), the `catering_orders` row, and optionally one `catering_order_items` row per selected menu item, all in a single transaction — mirrors bookStay()/createMovement() exactly. Items are optional (a vendor-only order with details TBD is still valid). */
export async function createCateringOrder(productionId: string, serviceId: string, vendorId: string | null, notes: string, items: CateringOrderItemInput[] = []) {
  const user = await requireUser();
  await requireProductionMember(productionId);
  for (const item of items) {
    if (!item.menuItemId) throw new Error("Choose a menu item for each order line.");
    if (!Number.isInteger(item.quantity) || item.quantity < 1) throw new Error("Quantity must be a positive whole number.");
  }

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

      if (items.length > 0) {
        const menuItemIds = new Set(
          (
            await tx
              .select({ id: schema.menuItems.id })
              .from(schema.menuItems)
              .where(eq(schema.menuItems.productionId, productionId))
          ).map((r) => r.id),
        );
        for (const item of items) {
          if (!menuItemIds.has(item.menuItemId)) throw new Error("Menu item not found in this production.");
        }
      }

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
      if (items.length > 0) {
        await tx.insert(schema.cateringOrderItems).values(items.map((item) => ({ id: crypto.randomUUID(), orderId, menuItemId: item.menuItemId, quantity: item.quantity })));
      }
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

export interface MenuItemInput {
  vendorId: string;
  name: string;
  category: string;
  cuisine: string;
  dietType: string;
  spiceLevel: string;
  packagingType: string;
  price: string;
  currency: string;
  notes: string;
}

/** Creates a menu catalog item — vendorId is optional (a dish can exist before it's tied to a specific vendor). */
export async function createMenuItem(productionId: string, input: MenuItemInput) {
  const user = await requireUser();
  await requireProductionMember(productionId);
  const name = input.name.trim();
  if (!name) throw new Error("Item name is required.");
  const category = validateMenuCategory(input.category);
  const dietType = validateMenuDietType(input.dietType);
  const spiceLevel = validateSpiceLevel(input.spiceLevel);
  const packagingType = validatePackagingType(input.packagingType);
  const price = parseOptionalPrice(input.price);
  const currency = validateCateringCurrency(input.currency);

  const id = crypto.randomUUID();
  await runAsUser(user.id, async (db) => {
    if (input.vendorId) {
      const [vendor] = await db
        .select({ id: schema.cateringVendors.id })
        .from(schema.cateringVendors)
        .where(and(eq(schema.cateringVendors.id, input.vendorId), eq(schema.cateringVendors.productionId, productionId)))
        .limit(1);
      if (!vendor) throw new Error("Vendor not found in this production.");
    }
    await db.insert(schema.menuItems).values({
      id,
      productionId,
      vendorId: input.vendorId || null,
      name,
      category,
      cuisine: input.cuisine.trim() || null,
      dietType,
      spiceLevel,
      packagingType,
      price,
      currency,
      notes: input.notes.trim() || null,
    });
  });
  return id;
}

export async function updateMenuItem(productionId: string, itemId: string, input: MenuItemInput) {
  const user = await requireUser();
  await requireProductionMember(productionId);
  const name = input.name.trim();
  if (!name) throw new Error("Item name is required.");
  const category = validateMenuCategory(input.category);
  const dietType = validateMenuDietType(input.dietType);
  const spiceLevel = validateSpiceLevel(input.spiceLevel);
  const packagingType = validatePackagingType(input.packagingType);
  const price = parseOptionalPrice(input.price);
  const currency = validateCateringCurrency(input.currency);

  await runAsUser(user.id, async (db) => {
    if (input.vendorId) {
      const [vendor] = await db
        .select({ id: schema.cateringVendors.id })
        .from(schema.cateringVendors)
        .where(and(eq(schema.cateringVendors.id, input.vendorId), eq(schema.cateringVendors.productionId, productionId)))
        .limit(1);
      if (!vendor) throw new Error("Vendor not found in this production.");
    }
    await db
      .update(schema.menuItems)
      .set({
        vendorId: input.vendorId || null,
        name,
        category,
        cuisine: input.cuisine.trim() || null,
        dietType,
        spiceLevel,
        packagingType,
        price,
        currency,
        notes: input.notes.trim() || null,
        updatedAt: new Date(),
      })
      .where(and(eq(schema.menuItems.id, itemId), eq(schema.menuItems.productionId, productionId)));
  });
}

export async function deleteMenuItem(productionId: string, itemId: string) {
  const user = await requireUser();
  await requireProductionMember(productionId);
  await runAsUser(user.id, async (db) => {
    const orderItemRows = await db
      .select({ id: schema.cateringOrderItems.id })
      .from(schema.cateringOrderItems)
      .where(eq(schema.cateringOrderItems.menuItemId, itemId))
      .limit(1);
    if (orderItemRows.length > 0) throw new Error("This item is used on a catering order — remove it from that order before deleting the item.");
    await db.delete(schema.menuItems).where(and(eq(schema.menuItems.id, itemId), eq(schema.menuItems.productionId, productionId)));
  });
}
