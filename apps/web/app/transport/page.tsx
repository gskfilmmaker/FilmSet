import { requireCurrentProduction } from "@/lib/authz";
import { getProductionSnapshot } from "@/lib/queries";
import { runAsUser, schema } from "@filmset/db/server";
import { eq } from "drizzle-orm";
import { TransportSection, type DriverRow, type MovementRow, type VehicleRow } from "./transport-section";

export default async function TransportPage() {
  const { user, production } = await requireCurrentProduction();
  const snapshot = await getProductionSnapshot(user.id, production.id);
  const castNameById = new Map(snapshot.castMembers.map((c) => [c.id, c.actorName]));
  const crewNameById = new Map(snapshot.crewMembers.map((c) => [c.id, c.name]));

  const { vehicles, drivers, movements } = await runAsUser(user.id, async (tx) => {
    const vehicleRows = await tx.select().from(schema.vehicles).where(eq(schema.vehicles.productionId, production.id)).orderBy(schema.vehicles.identifier);

    const driverRows = await tx.select().from(schema.drivers).where(eq(schema.drivers.productionId, production.id));
    const qualificationRows =
      driverRows.length > 0
        ? await tx
            .select()
            .from(schema.driverQualifications)
            .innerJoin(schema.drivers, eq(schema.drivers.id, schema.driverQualifications.driverId))
            .where(eq(schema.drivers.productionId, production.id))
        : [];
    const qualificationsByDriver = new Map<string, DriverRow["qualifications"]>();
    for (const row of qualificationRows) {
      const list = qualificationsByDriver.get(row.driver_qualifications.driverId) ?? [];
      list.push({
        id: row.driver_qualifications.id,
        type: row.driver_qualifications.qualificationType,
        expiryDate: row.driver_qualifications.expiryDate ? row.driver_qualifications.expiryDate.toISOString() : null,
      });
      qualificationsByDriver.set(row.driver_qualifications.driverId, list);
    }

    const drivers: DriverRow[] = driverRows.map((d) => ({
      id: d.id,
      name: d.crewMemberId ? (crewNameById.get(d.crewMemberId) ?? "Unknown crew member") : (d.externalName ?? "Unknown"),
      isExternal: d.crewMemberId === null,
      qualifications: qualificationsByDriver.get(d.id) ?? [],
    }));

    const movementRows = await tx
      .select({
        id: schema.movements.id,
        date: schema.movements.date,
        purpose: schema.movements.purpose,
        status: schema.movements.status,
      })
      .from(schema.movements)
      .where(eq(schema.movements.productionId, production.id))
      .orderBy(schema.movements.date);

    const legRows =
      movementRows.length > 0
        ? await tx
            .select({
              id: schema.movementLegs.id,
              movementId: schema.movementLegs.movementId,
              pickupLocationId: schema.movementLegs.pickupLocationId,
              pickupNotes: schema.movementLegs.pickupNotes,
              dropoffLocationId: schema.movementLegs.dropoffLocationId,
              dropoffNotes: schema.movementLegs.dropoffNotes,
              scheduledTime: schema.movementLegs.scheduledTime,
              vehicleId: schema.movementLegs.vehicleId,
              driverId: schema.movementLegs.driverId,
            })
            .from(schema.movementLegs)
            .innerJoin(schema.movements, eq(schema.movements.id, schema.movementLegs.movementId))
            .where(eq(schema.movements.productionId, production.id))
            .orderBy(schema.movementLegs.scheduledTime)
        : [];

    const passengerRows =
      legRows.length > 0
        ? await tx
            .select()
            .from(schema.movementLegPassengers)
            .innerJoin(schema.movementLegs, eq(schema.movementLegs.id, schema.movementLegPassengers.legId))
            .innerJoin(schema.movements, eq(schema.movements.id, schema.movementLegs.movementId))
            .where(eq(schema.movements.productionId, production.id))
        : [];

    const locationRows = await tx.select({ id: schema.locations.id, name: schema.locations.name }).from(schema.locations).where(eq(schema.locations.productionId, production.id));
    const locationNameById = new Map(locationRows.map((l) => [l.id, l.name]));
    const vehicleById = new Map(vehicleRows.map((v) => [v.id, v.identifier]));
    const driverById = new Map(drivers.map((d) => [d.id, d.name]));

    const passengersByLeg = new Map<string, MovementRow["legs"][number]["passengers"]>();
    for (const row of passengerRows) {
      const p = row.movement_leg_passengers;
      const list = passengersByLeg.get(p.legId) ?? [];
      const name = p.personType === "CAST" ? (castNameById.get(p.castMemberId ?? "") ?? "Unknown") : (crewNameById.get(p.crewMemberId ?? "") ?? "Unknown");
      list.push({ id: p.id, name, personType: p.personType as "CAST" | "CREW" });
      passengersByLeg.set(p.legId, list);
    }

    const legsByMovement = new Map<string, MovementRow["legs"]>();
    for (const leg of legRows) {
      const list = legsByMovement.get(leg.movementId) ?? [];
      list.push({
        id: leg.id,
        pickupLocationId: leg.pickupLocationId,
        pickupLabel: (leg.pickupLocationId ? locationNameById.get(leg.pickupLocationId) : null) ?? leg.pickupNotes ?? "—",
        dropoffLocationId: leg.dropoffLocationId,
        dropoffLabel: (leg.dropoffLocationId ? locationNameById.get(leg.dropoffLocationId) : null) ?? leg.dropoffNotes ?? "—",
        scheduledTime: leg.scheduledTime.toISOString(),
        vehicleId: leg.vehicleId,
        vehicleLabel: leg.vehicleId ? (vehicleById.get(leg.vehicleId) ?? "Unknown vehicle") : null,
        driverId: leg.driverId,
        driverLabel: leg.driverId ? (driverById.get(leg.driverId) ?? "Unknown driver") : null,
        passengers: passengersByLeg.get(leg.id) ?? [],
      });
      legsByMovement.set(leg.movementId, list);
    }

    const movements: MovementRow[] = movementRows.map((m) => ({
      id: m.id,
      date: m.date.toISOString(),
      purpose: m.purpose,
      status: m.status,
      legs: legsByMovement.get(m.id) ?? [],
    }));

    const vehicles: VehicleRow[] = vehicleRows.map((v) => ({
      id: v.id,
      type: v.type,
      identifier: v.identifier,
      capacity: v.capacity,
      notes: v.notes ?? "",
    }));

    return { vehicles, drivers, movements };
  });

  return (
    <TransportSection
      production={snapshot.production}
      scenes={snapshot.scenes}
      userEmail={user.email ?? undefined}
      productionId={production.id}
      vehicles={vehicles}
      drivers={drivers}
      movements={movements}
      locations={snapshot.locations.map((l) => ({ id: l.id, name: l.name }))}
      castMembers={snapshot.castMembers.map((c) => ({ id: c.id, name: c.actorName }))}
      crewMembers={snapshot.crewMembers.map((c) => ({ id: c.id, name: c.name }))}
    />
  );
}
