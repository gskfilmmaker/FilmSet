import { requireCurrentProduction } from "@/lib/authz";
import { getProductionSnapshot } from "@/lib/queries";
import { runAsUser, schema } from "@filmset/db/server";
import { eq } from "drizzle-orm";
import { CateringSection, type DietaryProfileRow, type MealServiceRow, type VendorRow } from "./catering-section";

export default async function CateringPage() {
  const { user, production, role } = await requireCurrentProduction();
  const snapshot = await getProductionSnapshot(user.id, production.id);
  const castNameById = new Map(snapshot.castMembers.map((c) => [c.id, c.actorName]));
  const crewNameById = new Map(snapshot.crewMembers.map((c) => [c.id, c.name]));
  const isProducer = role === "Producer";

  const { vendors, mealServices, dietaryProfiles } = await runAsUser(user.id, async (tx) => {
    const vendorRows = await tx.select().from(schema.cateringVendors).where(eq(schema.cateringVendors.productionId, production.id)).orderBy(schema.cateringVendors.name);
    const vendors: VendorRow[] = vendorRows.map((v) => ({ id: v.id, name: v.name, contact: v.contact ?? "", contractTerms: v.contractTerms ?? "" }));

    // Dietary data is read here regardless of role -- the aggregate counts below are
    // derived from it without ever exposing a name; only isProducer gates the named list
    // (dietaryProfiles) actually sent to the client, per this app's interim Producer-only
    // gate for catering.dietary.view_individual (see actions.ts's header comment).
    const profileRows = await tx.select().from(schema.dietaryProfiles).where(eq(schema.dietaryProfiles.productionId, production.id));
    const requirementRows =
      profileRows.length > 0
        ? await tx
            .select()
            .from(schema.dietaryRequirements)
            .innerJoin(schema.dietaryProfiles, eq(schema.dietaryProfiles.id, schema.dietaryRequirements.profileId))
            .where(eq(schema.dietaryProfiles.productionId, production.id))
        : [];
    const requirementsByProfile = new Map<string, DietaryProfileRow["requirements"]>();
    for (const row of requirementRows) {
      const list = requirementsByProfile.get(row.dietary_requirements.profileId) ?? [];
      list.push({ id: row.dietary_requirements.id, type: row.dietary_requirements.requirementType, severity: row.dietary_requirements.severity });
      requirementsByProfile.set(row.dietary_requirements.profileId, list);
    }
    const profileByPerson = new Map<string, { profileId: string; requirements: DietaryProfileRow["requirements"] }>();
    for (const p of profileRows) {
      const key = p.personType === "CAST" ? `CAST:${p.castMemberId}` : `CREW:${p.crewMemberId}`;
      profileByPerson.set(key, { profileId: p.id, requirements: requirementsByProfile.get(p.id) ?? [] });
    }

    const dietaryProfiles: DietaryProfileRow[] = isProducer
      ? profileRows.map((p) => ({
          id: p.id,
          personType: p.personType as "CAST" | "CREW",
          personId: (p.personType === "CAST" ? p.castMemberId : p.crewMemberId) ?? "",
          personName: (p.personType === "CAST" ? castNameById.get(p.castMemberId ?? "") : crewNameById.get(p.crewMemberId ?? "")) ?? "Unknown",
          notes: p.notes ?? "",
          requirements: requirementsByProfile.get(p.id) ?? [],
        }))
      : [];

    const serviceRows = await tx.select().from(schema.mealServices).where(eq(schema.mealServices.productionId, production.id)).orderBy(schema.mealServices.date);
    const locationRows = await tx.select({ id: schema.locations.id, name: schema.locations.name }).from(schema.locations).where(eq(schema.locations.productionId, production.id));
    const locationNameById = new Map(locationRows.map((l) => [l.id, l.name]));

    const assignmentRows =
      serviceRows.length > 0
        ? await tx
            .select()
            .from(schema.mealServiceAssignments)
            .innerJoin(schema.mealServices, eq(schema.mealServices.id, schema.mealServiceAssignments.serviceId))
            .where(eq(schema.mealServices.productionId, production.id))
        : [];

    const orderRows =
      serviceRows.length > 0
        ? await tx
            .select({
              id: schema.cateringOrders.id,
              serviceId: schema.cateringOrders.serviceId,
              vendorId: schema.cateringOrders.vendorId,
              notes: schema.cateringOrders.notes,
              bookingStatus: schema.bookings.status,
            })
            .from(schema.cateringOrders)
            .innerJoin(schema.mealServices, eq(schema.mealServices.id, schema.cateringOrders.serviceId))
            .leftJoin(schema.bookings, eq(schema.bookings.id, schema.cateringOrders.bookingId))
            .where(eq(schema.mealServices.productionId, production.id))
        : [];
    const vendorNameById = new Map(vendorRows.map((v) => [v.id, v.name]));
    const ordersByService = new Map<string, MealServiceRow["orders"]>();
    for (const o of orderRows) {
      const list = ordersByService.get(o.serviceId) ?? [];
      list.push({ id: o.id, vendorName: o.vendorId ? (vendorNameById.get(o.vendorId) ?? "Unknown vendor") : null, notes: o.notes ?? "", status: o.bookingStatus ?? "BOOKED" });
      ordersByService.set(o.serviceId, list);
    }

    const assignmentsByService = new Map<string, MealServiceRow["assignments"]>();
    const summaryByService = new Map<string, MealServiceRow["dietarySummary"]>();
    for (const row of assignmentRows) {
      const a = row.meal_service_assignments;
      const list = assignmentsByService.get(a.serviceId) ?? [];
      const name = a.personType === "CAST" ? (castNameById.get(a.castMemberId ?? "") ?? "Unknown") : (crewNameById.get(a.crewMemberId ?? "") ?? "Unknown");
      list.push({ id: a.id, name, personType: a.personType as "CAST" | "CREW" });
      assignmentsByService.set(a.serviceId, list);

      // Anonymized aggregate: counts by requirement severity for this service's assigned
      // people, with no names attached -- matches catering.counts.view_aggregate /
      // catering.dietary.view_operational's intent, available to any production member.
      const key = a.personType === "CAST" ? `CAST:${a.castMemberId}` : `CREW:${a.crewMemberId}`;
      const profile = profileByPerson.get(key);
      if (profile) {
        const summary = summaryByService.get(a.serviceId) ?? {};
        for (const req of profile.requirements) {
          summary[req.severity] = (summary[req.severity] ?? 0) + 1;
        }
        summaryByService.set(a.serviceId, summary);
      }
    }

    const mealServices: MealServiceRow[] = serviceRows.map((s) => ({
      id: s.id,
      date: s.date.toISOString(),
      mealType: s.mealType,
      locationId: s.locationId,
      locationName: s.locationId ? (locationNameById.get(s.locationId) ?? null) : null,
      assignments: assignmentsByService.get(s.id) ?? [],
      dietarySummary: summaryByService.get(s.id) ?? {},
      orders: ordersByService.get(s.id) ?? [],
    }));

    return { vendors, mealServices, dietaryProfiles };
  });

  return (
    <CateringSection
      production={snapshot.production}
      scenes={snapshot.scenes}
      userEmail={user.email ?? undefined}
      productionId={production.id}
      isProducer={isProducer}
      vendors={vendors}
      mealServices={mealServices}
      dietaryProfiles={dietaryProfiles}
      locations={snapshot.locations.map((l) => ({ id: l.id, name: l.name }))}
      castMembers={snapshot.castMembers.map((c) => ({ id: c.id, name: c.actorName }))}
      crewMembers={snapshot.crewMembers.map((c) => ({ id: c.id, name: c.name }))}
    />
  );
}
