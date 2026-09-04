"use server";

import { requireProductionMember } from "@/lib/authz";
import { requireUser } from "@filmset/auth/server";
import { runAsUser, schema } from "@filmset/db/server";
import { and, eq } from "drizzle-orm";

/**
 * Real, data-backed Server Actions for the Equipment domain
 * (packages/db/migrations/0023_equipment_domain.sql) — the fourth
 * Logistics subdomain built on the Booking Engine, covering Camera,
 * Grip & Electric, and Sound.
 *
 * Vendor/catalog-item creation and equipment bookings themselves are open
 * to any production member, matching every other subdomain's precedent
 * for ordinary operational data. The three sign-offs the owner asked for
 * (DOP / Director / Producer) are each individually gated:
 * - Director / Producer check the real PRODUCTION_ROLES values.
 * - DOP has no dedicated PRODUCTION_ROLES value, so it checks the real
 *   Camera department's Head of Department record instead
 *   (department_head_assignments, 0017) — see requireCameraDepartmentHead
 *   below and 0023's migration header comment.
 */

const DEPARTMENTS = ["Camera", "Grip & Electric", "Sound"] as const;
type EquipmentDepartment = (typeof DEPARTMENTS)[number];

function validateDepartment(department: string): EquipmentDepartment {
  if (!DEPARTMENTS.includes(department as EquipmentDepartment)) throw new Error(`Department must be one of: ${DEPARTMENTS.join(", ")}.`);
  return department as EquipmentDepartment;
}

/** Only the Camera department's real HOD (not any "Department Head" of any department) may record a DOP sign-off — there is no dedicated DOP role in PRODUCTION_ROLES. */
async function requireCameraDepartmentHead(productionId: string) {
  const user = await requireUser();
  await requireProductionMember(productionId);
  const isCameraHod = await runAsUser(user.id, async (db) => {
    const rows = await db
      .select({ userId: schema.departmentHeadAssignments.userId })
      .from(schema.departmentHeadAssignments)
      .innerJoin(schema.departments, eq(schema.departments.id, schema.departmentHeadAssignments.departmentId))
      .where(and(eq(schema.departments.productionId, productionId), eq(schema.departments.name, "Camera"), eq(schema.departmentHeadAssignments.userId, user.id)))
      .limit(1);
    return rows.length > 0;
  });
  if (!isCameraHod) throw new Error("Only the Camera department's Head of Department (the DOP) can record this approval — assign one in Settings → Departments.");
  return user;
}

export interface EquipmentVendorInput {
  name: string;
  contact: string;
  contractTerms: string;
}

export async function createEquipmentVendor(productionId: string, input: EquipmentVendorInput) {
  const user = await requireUser();
  await requireProductionMember(productionId);
  const name = input.name.trim();
  if (!name) throw new Error("Vendor name is required.");

  const id = crypto.randomUUID();
  await runAsUser(user.id, (db) =>
    db.insert(schema.equipmentVendors).values({
      id,
      productionId,
      name,
      contact: input.contact.trim() || null,
      contractTerms: input.contractTerms.trim() || null,
    }),
  );
  return id;
}

export async function deleteEquipmentVendor(productionId: string, id: string) {
  const user = await requireUser();
  await requireProductionMember(productionId);
  await runAsUser(user.id, async (db) => {
    const itemRows = await db
      .select({ id: schema.equipmentCatalogItems.id })
      .from(schema.equipmentCatalogItems)
      .where(eq(schema.equipmentCatalogItems.vendorId, id))
      .limit(1);
    if (itemRows.length > 0) throw new Error("This vendor still has catalog items — remove those items before removing the vendor.");
    await db.delete(schema.equipmentVendors).where(and(eq(schema.equipmentVendors.id, id), eq(schema.equipmentVendors.productionId, productionId)));
  });
}

export interface EquipmentCatalogItemInput {
  vendorId: string;
  department: string;
  category: string;
  name: string;
  dailyRate: string;
  currency: string;
  notes: string;
}

function parseOptionalRate(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  if (Number.isNaN(parsed) || parsed < 0) throw new Error("Daily rate must be a non-negative number.");
  return parsed.toFixed(2);
}

export async function createCatalogItem(productionId: string, input: EquipmentCatalogItemInput) {
  const user = await requireUser();
  await requireProductionMember(productionId);
  const name = input.name.trim();
  if (!name) throw new Error("Item name is required.");
  const department = validateDepartment(input.department);
  const dailyRate = parseOptionalRate(input.dailyRate);

  const id = crypto.randomUUID();
  await runAsUser(user.id, async (db) => {
    const [vendor] = await db
      .select({ id: schema.equipmentVendors.id })
      .from(schema.equipmentVendors)
      .where(and(eq(schema.equipmentVendors.id, input.vendorId), eq(schema.equipmentVendors.productionId, productionId)))
      .limit(1);
    if (!vendor) throw new Error("Vendor not found in this production.");
    await db.insert(schema.equipmentCatalogItems).values({
      id,
      productionId,
      vendorId: input.vendorId,
      department,
      category: input.category.trim() || null,
      name,
      dailyRate,
      currency: input.currency.trim() || null,
      notes: input.notes.trim() || null,
    });
  });
  return id;
}

export async function updateCatalogItem(productionId: string, itemId: string, input: EquipmentCatalogItemInput) {
  const user = await requireUser();
  await requireProductionMember(productionId);
  const name = input.name.trim();
  if (!name) throw new Error("Item name is required.");
  const department = validateDepartment(input.department);
  const dailyRate = parseOptionalRate(input.dailyRate);

  await runAsUser(user.id, (db) =>
    db
      .update(schema.equipmentCatalogItems)
      .set({
        department,
        category: input.category.trim() || null,
        name,
        dailyRate,
        currency: input.currency.trim() || null,
        notes: input.notes.trim() || null,
        updatedAt: new Date(),
      })
      .where(and(eq(schema.equipmentCatalogItems.id, itemId), eq(schema.equipmentCatalogItems.productionId, productionId))),
  );
}

export async function deleteCatalogItem(productionId: string, itemId: string) {
  const user = await requireUser();
  await requireProductionMember(productionId);
  await runAsUser(user.id, async (db) => {
    const bookingRows = await db
      .select({ id: schema.equipmentBookings.id })
      .from(schema.equipmentBookings)
      .where(eq(schema.equipmentBookings.catalogItemId, itemId))
      .limit(1);
    if (bookingRows.length > 0) throw new Error("This item still has equipment bookings — cancel those bookings before removing the item.");
    await db.delete(schema.equipmentCatalogItems).where(and(eq(schema.equipmentCatalogItems.id, itemId), eq(schema.equipmentCatalogItems.productionId, productionId)));
  });
}

/** Toggles the catalog item's DOP pre-approval — gated to the Camera department's real HOD. */
export async function setCatalogItemDopApproval(productionId: string, itemId: string, approved: boolean) {
  const user = await requireCameraDepartmentHead(productionId);
  await runAsUser(user.id, (db) =>
    db
      .update(schema.equipmentCatalogItems)
      .set({
        dopApproved: approved,
        dopApprovedBy: approved ? user.id : null,
        dopApprovedAt: approved ? new Date() : null,
        updatedAt: new Date(),
      })
      .where(and(eq(schema.equipmentCatalogItems.id, itemId), eq(schema.equipmentCatalogItems.productionId, productionId))),
  );
}

/** Creates an equipment booking: one `bookings` row (type "EQUIPMENT") plus the `equipment_bookings` row itself, in one transaction — mirrors createMovement()/createCateringOrder() exactly. Rate defaults to the catalog item's reference dailyRate when not given explicitly. */
export async function createEquipmentBooking(productionId: string, shootDayId: string, catalogItemId: string, quantity: number, rate: string, notes: string) {
  const user = await requireUser();
  await requireProductionMember(productionId);
  if (!Number.isInteger(quantity) || quantity < 1) throw new Error("Quantity must be a positive whole number.");
  const parsedRate = parseOptionalRate(rate);

  const equipmentBookingId = crypto.randomUUID();
  const bookingId = crypto.randomUUID();

  await runAsUser(user.id, (db) =>
    db.transaction(async (tx) => {
      const [shootDay] = await tx
        .select({ id: schema.shootDays.id })
        .from(schema.shootDays)
        .where(and(eq(schema.shootDays.id, shootDayId), eq(schema.shootDays.productionId, productionId)))
        .limit(1);
      if (!shootDay) throw new Error("Shoot day not found in this production.");

      const [catalogItem] = await tx
        .select({ id: schema.equipmentCatalogItems.id, dailyRate: schema.equipmentCatalogItems.dailyRate, currency: schema.equipmentCatalogItems.currency })
        .from(schema.equipmentCatalogItems)
        .where(and(eq(schema.equipmentCatalogItems.id, catalogItemId), eq(schema.equipmentCatalogItems.productionId, productionId)))
        .limit(1);
      if (!catalogItem) throw new Error("Catalog item not found in this production.");

      await tx.insert(schema.bookings).values({
        id: bookingId,
        productionId,
        type: "EQUIPMENT",
        status: "BOOKED",
        requestedBy: user.id,
        subjectType: "EQUIPMENT_BOOKING",
        subjectId: equipmentBookingId,
      });
      await tx.insert(schema.equipmentBookings).values({
        id: equipmentBookingId,
        productionId,
        shootDayId,
        catalogItemId,
        quantity,
        rate: parsedRate ?? catalogItem.dailyRate,
        currency: catalogItem.currency,
        bookingId,
        notes: notes.trim() || null,
      });
    }),
  );

  return equipmentBookingId;
}

/** Cancels an equipment booking's booking row (status → CANCELLED + a booking_cancellations record), mirroring cancelMovement()/cancelCateringOrder() — the row stays as the historical record. */
export async function cancelEquipmentBooking(productionId: string, equipmentBookingId: string, reason: string) {
  const user = await requireUser();
  await requireProductionMember(productionId);
  const trimmedReason = reason.trim() || "No reason given.";

  await runAsUser(user.id, (db) =>
    db.transaction(async (tx) => {
      const [row] = await tx
        .select({ id: schema.equipmentBookings.id, bookingId: schema.equipmentBookings.bookingId })
        .from(schema.equipmentBookings)
        .where(and(eq(schema.equipmentBookings.id, equipmentBookingId), eq(schema.equipmentBookings.productionId, productionId)))
        .limit(1);
      if (!row) throw new Error("Equipment booking not found in this production.");
      if (!row.bookingId) throw new Error("This booking has no associated booking record to cancel.");

      await tx.update(schema.bookings).set({ status: "CANCELLED", updatedAt: new Date() }).where(eq(schema.bookings.id, row.bookingId));
      await tx.insert(schema.bookingCancellations).values({ bookingId: row.bookingId, reason: trimmedReason });
    }),
  );
}

async function setApprovalColumn(
  productionId: string,
  equipmentBookingId: string,
  approved: boolean,
  approverId: string,
  columns: { approved: "dopApproved" | "directorApproved" | "producerApproved"; by: "dopApprovedBy" | "directorApprovedBy" | "producerApprovedBy"; at: "dopApprovedAt" | "directorApprovedAt" | "producerApprovedAt" },
) {
  await runAsUser(approverId, (db) =>
    db
      .update(schema.equipmentBookings)
      .set({
        [columns.approved]: approved,
        [columns.by]: approved ? approverId : null,
        [columns.at]: approved ? new Date() : null,
        updatedAt: new Date(),
      })
      .where(and(eq(schema.equipmentBookings.id, equipmentBookingId), eq(schema.equipmentBookings.productionId, productionId))),
  );
}

export async function setDopApproval(productionId: string, equipmentBookingId: string, approved: boolean) {
  const user = await requireCameraDepartmentHead(productionId);
  await setApprovalColumn(productionId, equipmentBookingId, approved, user.id, { approved: "dopApproved", by: "dopApprovedBy", at: "dopApprovedAt" });
}

export async function setDirectorApproval(productionId: string, equipmentBookingId: string, approved: boolean) {
  const user = await requireUser();
  await requireProductionMember(productionId, ["Director"]);
  await setApprovalColumn(productionId, equipmentBookingId, approved, user.id, { approved: "directorApproved", by: "directorApprovedBy", at: "directorApprovedAt" });
}

export async function setProducerApproval(productionId: string, equipmentBookingId: string, approved: boolean) {
  const user = await requireUser();
  await requireProductionMember(productionId, ["Producer"]);
  await setApprovalColumn(productionId, equipmentBookingId, approved, user.id, { approved: "producerApproved", by: "producerApprovedBy", at: "producerApprovedAt" });
}
