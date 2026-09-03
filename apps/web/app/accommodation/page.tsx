import { requireCurrentProduction } from "@/lib/authz";
import { getProductionSnapshot } from "@/lib/queries";
import { runAsUser, schema } from "@filmset/db/server";
import { eq } from "drizzle-orm";
import { AccommodationSection, type PropertyRow, type StayRow } from "./accommodation-section";

export default async function AccommodationPage() {
  const { user, production } = await requireCurrentProduction();
  const snapshot = await getProductionSnapshot(user.id, production.id);

  const { properties, stays } = await runAsUser(user.id, async (tx) => {
    const propertyRows = await tx
      .select()
      .from(schema.accommodationProperties)
      .where(eq(schema.accommodationProperties.productionId, production.id))
      .orderBy(schema.accommodationProperties.name);

    const roomTypeRows =
      propertyRows.length > 0
        ? await tx
            .select()
            .from(schema.roomTypes)
            .innerJoin(schema.accommodationProperties, eq(schema.accommodationProperties.id, schema.roomTypes.propertyId))
            .where(eq(schema.accommodationProperties.productionId, production.id))
        : [];

    const roomTypesByProperty = new Map<string, PropertyRow["roomTypes"]>();
    for (const row of roomTypeRows) {
      const list = roomTypesByProperty.get(row.room_types.propertyId) ?? [];
      list.push({ id: row.room_types.id, name: row.room_types.name, capacity: row.room_types.capacity });
      roomTypesByProperty.set(row.room_types.propertyId, list);
    }

    const properties: PropertyRow[] = propertyRows.map((p) => ({
      id: p.id,
      name: p.name,
      type: p.type,
      address: p.address ?? "",
      notes: p.notes ?? "",
      roomTypes: roomTypesByProperty.get(p.id) ?? [],
    }));

    const stayRows = await tx
      .select({
        id: schema.stays.id,
        propertyId: schema.stays.propertyId,
        propertyName: schema.accommodationProperties.name,
        roomTypeId: schema.stays.roomTypeId,
        roomTypeName: schema.roomTypes.name,
        personType: schema.stays.personType,
        castMemberId: schema.stays.castMemberId,
        crewMemberId: schema.stays.crewMemberId,
        checkIn: schema.stays.checkIn,
        checkOut: schema.stays.checkOut,
        roomNumber: schema.stays.roomNumber,
        notes: schema.stays.notes,
        bookingStatus: schema.bookings.status,
      })
      .from(schema.stays)
      .innerJoin(schema.accommodationProperties, eq(schema.accommodationProperties.id, schema.stays.propertyId))
      .leftJoin(schema.roomTypes, eq(schema.roomTypes.id, schema.stays.roomTypeId))
      .leftJoin(schema.bookings, eq(schema.bookings.id, schema.stays.bookingId))
      .where(eq(schema.stays.productionId, production.id))
      .orderBy(schema.stays.checkIn);

    const castNameById = new Map(snapshot.castMembers.map((c) => [c.id, c.actorName]));
    const crewNameById = new Map(snapshot.crewMembers.map((c) => [c.id, c.name]));

    const stays: StayRow[] = stayRows.map((s) => ({
      id: s.id,
      propertyId: s.propertyId,
      propertyName: s.propertyName,
      roomTypeId: s.roomTypeId,
      roomTypeName: s.roomTypeName,
      personType: s.personType as "CAST" | "CREW",
      personId: (s.personType === "CAST" ? s.castMemberId : s.crewMemberId) ?? "",
      personName:
        (s.personType === "CAST" ? castNameById.get(s.castMemberId ?? "") : crewNameById.get(s.crewMemberId ?? "")) ?? "Unknown",
      checkIn: s.checkIn.toISOString(),
      checkOut: s.checkOut.toISOString(),
      roomNumber: s.roomNumber,
      notes: s.notes ?? "",
      status: s.bookingStatus ?? "BOOKED",
    }));

    return { properties, stays };
  });

  return (
    <AccommodationSection
      production={snapshot.production}
      scenes={snapshot.scenes}
      userEmail={user.email ?? undefined}
      productionId={production.id}
      properties={properties}
      stays={stays}
      castMembers={snapshot.castMembers.map((c) => ({ id: c.id, name: c.actorName }))}
      crewMembers={snapshot.crewMembers.map((c) => ({ id: c.id, name: c.name }))}
    />
  );
}
