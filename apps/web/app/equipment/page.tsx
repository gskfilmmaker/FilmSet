import { requireCurrentProduction } from "@/lib/authz";
import { getProductionSnapshot } from "@/lib/queries";
import { runAsUser, schema } from "@filmset/db/server";
import { and, eq } from "drizzle-orm";
import { EquipmentSection, type BookingRow, type CatalogItemRow } from "./equipment-section";

export default async function EquipmentPage() {
  const { user, production, role } = await requireCurrentProduction();
  const snapshot = await getProductionSnapshot(user.id, production.id);

  const { vendors, catalogItems, bookings, isCameraHod } = await runAsUser(user.id, async (tx) => {
    const vendorRows = await tx.select().from(schema.equipmentVendors).where(eq(schema.equipmentVendors.productionId, production.id)).orderBy(schema.equipmentVendors.name);

    const itemRows = await tx
      .select()
      .from(schema.equipmentCatalogItems)
      .where(eq(schema.equipmentCatalogItems.productionId, production.id))
      .orderBy(schema.equipmentCatalogItems.department, schema.equipmentCatalogItems.name);
    const vendorNameById = new Map(vendorRows.map((v) => [v.id, v.name]));

    const catalogItems: CatalogItemRow[] = itemRows.map((i) => ({
      id: i.id,
      vendorId: i.vendorId,
      vendorName: vendorNameById.get(i.vendorId) ?? "Unknown vendor",
      department: i.department,
      category: i.category ?? "",
      name: i.name,
      dailyRate: i.dailyRate,
      currency: i.currency ?? "",
      dopApproved: i.dopApproved,
      notes: i.notes ?? "",
    }));
    const itemById = new Map(catalogItems.map((i) => [i.id, i]));

    const bookingRows = await tx
      .select()
      .from(schema.equipmentBookings)
      .where(eq(schema.equipmentBookings.productionId, production.id))
      .orderBy(schema.equipmentBookings.shootDayId);

    const bookings: BookingRow[] = bookingRows.map((b) => {
      const item = itemById.get(b.catalogItemId);
      return {
        id: b.id,
        shootDayId: b.shootDayId,
        catalogItemId: b.catalogItemId,
        itemName: item?.name ?? "Unknown item",
        department: item?.department ?? "",
        vendorName: item?.vendorName ?? "Unknown vendor",
        quantity: b.quantity,
        rate: b.rate,
        currency: b.currency ?? "",
        dopApproved: b.dopApproved,
        directorApproved: b.directorApproved,
        producerApproved: b.producerApproved,
        notes: b.notes ?? "",
      };
    });

    const isCameraHod = await tx
      .select({ userId: schema.departmentHeadAssignments.userId })
      .from(schema.departmentHeadAssignments)
      .innerJoin(schema.departments, eq(schema.departments.id, schema.departmentHeadAssignments.departmentId))
      .where(and(eq(schema.departments.productionId, production.id), eq(schema.departments.name, "Camera"), eq(schema.departmentHeadAssignments.userId, user.id)))
      .limit(1)
      .then((rows) => rows.length > 0);

    return { vendors: vendorRows, catalogItems, bookings, isCameraHod };
  });

  return (
    <EquipmentSection
      production={snapshot.production}
      scenes={snapshot.scenes}
      userEmail={user.email ?? undefined}
      productionId={production.id}
      shootDays={snapshot.shootDays.map((d) => ({ id: d.id, dayNumber: d.dayNumber, date: d.date }))}
      vendors={vendors.map((v) => ({ id: v.id, name: v.name, contact: v.contact ?? "", contractTerms: v.contractTerms ?? "" }))}
      catalogItems={catalogItems}
      bookings={bookings}
      canApproveDop={isCameraHod}
      canApproveDirector={role === "Director"}
      canApproveProducer={role === "Producer"}
    />
  );
}
