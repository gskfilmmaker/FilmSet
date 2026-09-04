"use server";

import { createProperty, updateProperty, type PropertyInput } from "@/app/accommodation/actions";
import { createCastMember, updateCastMember, type CastMemberInput } from "@/app/cast/actions";
import { createMenuItem, createVendor, updateMenuItem, type MenuItemInput, type VendorInput } from "@/app/catering/actions";
import { createCrewMember, updateCrewMember, type CrewMemberInput } from "@/app/crew/actions";
import { createCatalogItem, createEquipmentVendor, updateCatalogItem, type EquipmentCatalogItemInput, type EquipmentVendorInput } from "@/app/equipment/actions";
import { createLocation, updateLocation, type LocationInput } from "@/app/locations/actions";
import { createExpense, type ExpenseInput } from "@/app/money/actions";
import { createDriver, createVehicle, updateVehicle, type DriverInput, type VehicleInput } from "@/app/transport/actions";
import { requireProductionMember } from "@/lib/authz";
import {
  extractCastCandidates,
  extractCrewCandidates,
  extractDriverCandidates,
  extractEquipmentCatalogItemCandidates,
  extractEquipmentVendorCandidates,
  extractLocationCandidates,
  extractPropertyCandidates,
  extractVehicleCandidates,
  extractVendorCandidates,
} from "@/lib/ai";
import { parseDocxText } from "@/lib/import/parse-docx";
import { parsePdfText } from "@/lib/import/parse-pdf";
import { candidatesFromTabular, parseTabular } from "@/lib/import/parse-tabular";
import { IMPORT_FIELDS, type ImportCandidate, type ImportEntityType, type ImportPreviewResult } from "@/lib/import/types";
import { getProductionSnapshot } from "@/lib/queries";
import type { Expense } from "@filmset/core";
import { requireUser } from "@filmset/auth/server";
import { runAsUser, schema } from "@filmset/db/server";
import { eq } from "drizzle-orm";

const MAX_IMPORT_FILE_BYTES = 10 * 1024 * 1024;

function readFile(formData: FormData): File {
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) throw new Error("No file selected.");
  if (file.size > MAX_IMPORT_FILE_BYTES) throw new Error("File must be 10MB or smaller.");
  return file;
}

/** Case-insensitive "identifying value → existing record id" lookup, used to decide create vs. update for each parsed row. */
async function existingKeysFor(entityType: ImportEntityType, productionId: string, userId: string): Promise<Map<string, string>> {
  const snapshot = await getProductionSnapshot(userId, productionId);
  const map = new Map<string, string>();
  if (entityType === "cast") {
    for (const member of snapshot.castMembers) {
      const characterName = snapshot.characters.find((c) => c.id === member.characterId)?.name;
      if (characterName) map.set(characterName.toLowerCase(), member.id);
    }
  } else if (entityType === "crew") {
    for (const member of snapshot.crewMembers) map.set(member.name.toLowerCase(), member.id);
  } else if (entityType === "location") {
    for (const location of snapshot.locations) map.set(location.name.toLowerCase(), location.id);
  } else if (entityType === "vehicle") {
    const rows = await runAsUser(userId, (db) =>
      db.select({ id: schema.vehicles.id, identifier: schema.vehicles.identifier }).from(schema.vehicles).where(eq(schema.vehicles.productionId, productionId)),
    );
    for (const v of rows) map.set(v.identifier.toLowerCase(), v.id);
  } else if (entityType === "driver") {
    const rows = await runAsUser(userId, (db) =>
      db
        .select({ id: schema.drivers.id, externalName: schema.drivers.externalName, crewMemberId: schema.drivers.crewMemberId })
        .from(schema.drivers)
        .where(eq(schema.drivers.productionId, productionId)),
    );
    const crewNameById = new Map(snapshot.crewMembers.map((c) => [c.id, c.name]));
    for (const d of rows) {
      const name = d.externalName ?? (d.crewMemberId ? crewNameById.get(d.crewMemberId) : undefined);
      if (name) map.set(name.toLowerCase(), d.id);
    }
  } else if (entityType === "property") {
    const rows = await runAsUser(userId, (db) =>
      db
        .select({ id: schema.accommodationProperties.id, name: schema.accommodationProperties.name })
        .from(schema.accommodationProperties)
        .where(eq(schema.accommodationProperties.productionId, productionId)),
    );
    for (const p of rows) map.set(p.name.toLowerCase(), p.id);
  } else if (entityType === "vendor") {
    const rows = await runAsUser(userId, (db) =>
      db.select({ id: schema.cateringVendors.id, name: schema.cateringVendors.name }).from(schema.cateringVendors).where(eq(schema.cateringVendors.productionId, productionId)),
    );
    for (const v of rows) map.set(v.name.toLowerCase(), v.id);
  } else if (entityType === "equipmentVendor") {
    const rows = await runAsUser(userId, (db) =>
      db.select({ id: schema.equipmentVendors.id, name: schema.equipmentVendors.name }).from(schema.equipmentVendors).where(eq(schema.equipmentVendors.productionId, productionId)),
    );
    for (const v of rows) map.set(v.name.toLowerCase(), v.id);
  } else if (entityType === "equipmentCatalogItem") {
    const rows = await runAsUser(userId, (db) =>
      db.select({ id: schema.equipmentCatalogItems.id, name: schema.equipmentCatalogItems.name }).from(schema.equipmentCatalogItems).where(eq(schema.equipmentCatalogItems.productionId, productionId)),
    );
    for (const i of rows) map.set(i.name.toLowerCase(), i.id);
  } else if (entityType === "cateringMenuItem") {
    const rows = await runAsUser(userId, (db) =>
      db.select({ id: schema.menuItems.id, name: schema.menuItems.name }).from(schema.menuItems).where(eq(schema.menuItems.productionId, productionId)),
    );
    for (const i of rows) map.set(i.name.toLowerCase(), i.id);
  }
  return map;
}

/** Preview step for a .csv/.xlsx/.xls upload — deterministic column mapping, no AI call. Never writes to production data. */
export async function previewTabularImport(productionId: string, entityType: ImportEntityType, formData: FormData): Promise<ImportPreviewResult> {
  const user = await requireUser();
  await requireProductionMember(productionId);
  const file = readFile(formData);

  const buffer = await file.arrayBuffer();
  const { headers, rows } = parseTabular(buffer);
  if (headers.length === 0) throw new Error("Couldn't read any rows from that file.");

  const existingKeys = await existingKeysFor(entityType, productionId, user.id);
  const { candidates, skipped } = candidatesFromTabular(entityType, headers, rows, existingKeys);
  if (candidates.length === 0) throw new Error("No usable rows found — check that the file has a column matching what this import expects.");

  return { candidates, skipped };
}

const DOCUMENT_EXTRACTORS: Partial<Record<ImportEntityType, (text: string) => Promise<{ fields: Record<string, string> }[]>>> = {
  cast: async (text) => (await extractCastCandidates(text)).map((r) => ({ fields: { characterName: r.characterName, actorName: r.actorName, notes: r.notes } })),
  crew: async (text) => (await extractCrewCandidates(text)).map((r) => ({ fields: { name: r.name, department: r.department, role: r.role, notes: r.notes } })),
  location: async (text) => (await extractLocationCandidates(text)).map((r) => ({ fields: { name: r.name, address: r.address, notes: r.notes } })),
  vehicle: async (text) => (await extractVehicleCandidates(text)).map((r) => ({ fields: { identifier: r.identifier, type: r.type, capacity: r.capacity, notes: r.notes } })),
  driver: async (text) => (await extractDriverCandidates(text)).map((r) => ({ fields: { name: r.name, notes: r.notes } })),
  property: async (text) => (await extractPropertyCandidates(text)).map((r) => ({ fields: { name: r.name, type: r.type, address: r.address, notes: r.notes } })),
  vendor: async (text) => (await extractVendorCandidates(text)).map((r) => ({ fields: { name: r.name, contact: r.contact, contractTerms: r.contractTerms } })),
  equipmentVendor: async (text) => (await extractEquipmentVendorCandidates(text)).map((r) => ({ fields: { name: r.name, contact: r.contact, contractTerms: r.contractTerms } })),
  equipmentCatalogItem: async (text) =>
    (await extractEquipmentCatalogItemCandidates(text)).map((r) => ({
      fields: { name: r.name, department: r.department, category: r.category, vendor: r.vendor, dailyRate: r.dailyRate, currency: r.currency, notes: r.notes },
    })),
};

/** Preview step for a .pdf or .docx upload — extracts text, then an AI Suggest call proposes structured candidates. Logged to ai_suggestion_log for the same audit trail every other AI suggestion gets. Never writes to production data. */
export async function previewDocumentImport(productionId: string, entityType: ImportEntityType, formData: FormData): Promise<ImportPreviewResult> {
  const user = await requireUser();
  await requireProductionMember(productionId);
  const extractor = DOCUMENT_EXTRACTORS[entityType];
  if (!extractor) throw new Error(`Document import isn't available for ${entityType} yet — try a CSV/XLSX file instead.`);

  const file = readFile(formData);
  const buffer = await file.arrayBuffer();
  const isDocx = /\.docx$/i.test(file.name);
  const text = isDocx ? await parseDocxText(buffer) : await parsePdfText(buffer);
  if (text.trim().length < 20) {
    throw new Error(`Couldn't read text from that ${isDocx ? "document" : "PDF"} — it may be a scanned image rather than real text.`);
  }

  const extracted = await extractor(text);
  const existingKeys = await existingKeysFor(entityType, productionId, user.id);
  const identityKey = IMPORT_FIELDS[entityType].find((f) => f.required)?.key ?? "name";
  const candidates: ImportCandidate[] = extracted.map((record) => {
    const identity = record.fields[identityKey];
    const matchedId = identity ? existingKeys.get(identity.toLowerCase()) : undefined;
    return { id: crypto.randomUUID(), action: matchedId ? "update" : "create", matchedId, fields: record.fields, selected: true };
  });

  const logId = crypto.randomUUID();
  await runAsUser(user.id, (db) =>
    db.insert(schema.aiSuggestionLog).values({
      id: logId,
      productionId,
      requestedBy: user.id,
      kind: `import:${entityType}`,
      input: { filename: file.name, textLength: text.length },
      suggestion: { candidates },
      explanation: `Extracted ${candidates.length} ${entityType} candidate(s) from "${file.name}".`,
      status: "suggested",
    }),
  );

  return { candidates, logId, skipped: [] };
}

/** Commit step — only reached after a human has reviewed/edited/deselected candidates in the preview UI. Writes go through the same create/update actions the manual forms use, so validation and RLS scoping are identical either way. */
export async function commitImport(productionId: string, entityType: ImportEntityType, candidates: ImportCandidate[], logId?: string) {
  const user = await requireUser();
  await requireProductionMember(productionId);
  const selected = candidates.filter((c) => c.selected);
  if (selected.length === 0) return { created: 0, updated: 0 };

  const snapshot = await getProductionSnapshot(user.id, productionId);
  const existingVehicles =
    entityType === "vehicle" ? await runAsUser(user.id, (db) => db.select().from(schema.vehicles).where(eq(schema.vehicles.productionId, productionId))) : [];
  const existingProperties =
    entityType === "property"
      ? await runAsUser(user.id, (db) => db.select().from(schema.accommodationProperties).where(eq(schema.accommodationProperties.productionId, productionId)))
      : [];
  const existingEquipmentCatalogItems =
    entityType === "equipmentCatalogItem"
      ? await runAsUser(user.id, (db) => db.select().from(schema.equipmentCatalogItems).where(eq(schema.equipmentCatalogItems.productionId, productionId)))
      : [];
  const equipmentVendorIdByName = new Map<string, string>();
  if (entityType === "equipmentCatalogItem") {
    const rows = await runAsUser(user.id, (db) => db.select().from(schema.equipmentVendors).where(eq(schema.equipmentVendors.productionId, productionId)));
    for (const v of rows) equipmentVendorIdByName.set(v.name.toLowerCase(), v.id);
  }
  const existingMenuItems =
    entityType === "cateringMenuItem"
      ? await runAsUser(user.id, (db) => db.select().from(schema.menuItems).where(eq(schema.menuItems.productionId, productionId)))
      : [];
  const cateringVendorIdByName = new Map<string, string>();
  if (entityType === "cateringMenuItem") {
    const rows = await runAsUser(user.id, (db) => db.select().from(schema.cateringVendors).where(eq(schema.cateringVendors.productionId, productionId)));
    for (const v of rows) cateringVendorIdByName.set(v.name.toLowerCase(), v.id);
  }
  let created = 0;
  let updated = 0;

  for (const candidate of selected) {
    if (entityType === "cast") {
      const existing = candidate.matchedId ? snapshot.castMembers.find((c) => c.id === candidate.matchedId) : undefined;
      const characterName = candidate.fields.characterName ?? (existing ? snapshot.characters.find((c) => c.id === existing.characterId)?.name : undefined);
      if (!characterName) continue;
      const input: CastMemberInput = {
        characterName,
        actorName: candidate.fields.actorName ?? existing?.actorName ?? "",
        status: existing?.status ?? "Offer Out",
        contract: existing?.contract ?? "Pending",
        email: candidate.fields.email ?? existing?.email ?? "",
        phone: candidate.fields.phone ?? existing?.phone ?? "",
        emergencyContactName: existing?.emergencyContactName ?? "",
        emergencyContactPhone: existing?.emergencyContactPhone ?? "",
        agentName: existing?.agentName ?? "",
        agentPhone: existing?.agentPhone ?? "",
        agentEmail: existing?.agentEmail ?? "",
        height: existing?.height ?? "",
        shirtSize: existing?.shirtSize ?? "",
        pantSize: existing?.pantSize ?? "",
        shoeSize: existing?.shoeSize ?? "",
        sizingNotes: existing?.sizingNotes ?? "",
      };
      if (existing) {
        await updateCastMember(productionId, existing.id, input);
        updated++;
      } else {
        await createCastMember(productionId, input);
        created++;
      }
    } else if (entityType === "crew") {
      const existing = candidate.matchedId ? snapshot.crewMembers.find((c) => c.id === candidate.matchedId) : undefined;
      const name = candidate.fields.name ?? existing?.name;
      if (!name) continue;
      const input: CrewMemberInput = {
        name,
        department: candidate.fields.department ?? existing?.department ?? "Production",
        role: candidate.fields.role ?? existing?.role ?? "",
        isHod: existing?.isHod ?? false,
        contract: existing?.contract ?? "Pending",
        walkieChannel: existing?.walkieChannel ?? "",
        email: candidate.fields.email ?? existing?.email ?? "",
        phone: candidate.fields.phone ?? existing?.phone ?? "",
        emergencyContactName: existing?.emergencyContactName ?? "",
        emergencyContactPhone: existing?.emergencyContactPhone ?? "",
        agentName: existing?.agentName ?? "",
        agentPhone: existing?.agentPhone ?? "",
        agentEmail: existing?.agentEmail ?? "",
      };
      if (existing) {
        await updateCrewMember(productionId, existing.id, input);
        updated++;
      } else {
        await createCrewMember(productionId, input);
        created++;
      }
    } else if (entityType === "location") {
      const existing = candidate.matchedId ? snapshot.locations.find((l) => l.id === candidate.matchedId) : undefined;
      const name = candidate.fields.name ?? existing?.name;
      if (!name) continue;
      const input: LocationInput = {
        name,
        address: candidate.fields.address ?? existing?.address ?? "",
        permitStatus: existing?.permitStatus ?? "Missing",
        permitExpiry: existing?.permitExpiry ?? null,
      };
      if (existing) {
        await updateLocation(productionId, existing.id, input);
        updated++;
      } else {
        await createLocation(productionId, input);
        created++;
      }
    } else if (entityType === "expense") {
      const vendor = candidate.fields.vendor;
      const department = candidate.fields.department;
      const amount = Number(candidate.fields.amount?.replace(/[^0-9.-]/g, ""));
      if (!vendor || !department || !Number.isFinite(amount)) continue;
      const input: ExpenseInput = {
        vendor,
        department,
        amount,
        status: (candidate.fields.status as Expense["status"]) || "Pending",
        date: candidate.fields.date ?? "",
        invoiceNumber: candidate.fields.invoiceNumber ?? "",
      };
      await createExpense(productionId, input);
      created++;
    } else if (entityType === "vehicle") {
      const existing = candidate.matchedId ? existingVehicles.find((v) => v.id === candidate.matchedId) : undefined;
      const identifier = candidate.fields.identifier ?? existing?.identifier;
      if (!identifier) continue;
      const parsedCapacity = candidate.fields.capacity ? Number(candidate.fields.capacity.replace(/[^0-9]/g, "")) : undefined;
      const input: VehicleInput = {
        identifier,
        type: candidate.fields.type ?? existing?.type ?? "PRODUCTION_VEHICLE",
        capacity: parsedCapacity && Number.isFinite(parsedCapacity) && parsedCapacity > 0 ? parsedCapacity : (existing?.capacity ?? 1),
        notes: candidate.fields.notes ?? existing?.notes ?? "",
      };
      if (existing) {
        await updateVehicle(productionId, existing.id, input);
        updated++;
      } else {
        await createVehicle(productionId, input);
        created++;
      }
    } else if (entityType === "driver") {
      // No updateDriver action exists — a matched row already has a driver record, so there's nothing to change; skip rather than duplicate.
      if (candidate.matchedId) continue;
      const name = candidate.fields.name;
      if (!name) continue;
      const crewMatch = snapshot.crewMembers.find((c) => c.name.toLowerCase() === name.toLowerCase());
      const input: DriverInput = crewMatch
        ? { crewMemberId: crewMatch.id, externalName: "", notes: candidate.fields.notes ?? "" }
        : { crewMemberId: null, externalName: name, notes: candidate.fields.notes ?? "" };
      await createDriver(productionId, input);
      created++;
    } else if (entityType === "property") {
      const existing = candidate.matchedId ? existingProperties.find((p) => p.id === candidate.matchedId) : undefined;
      const name = candidate.fields.name ?? existing?.name;
      if (!name) continue;
      const input: PropertyInput = {
        name,
        type: candidate.fields.type ?? existing?.type ?? "HOTEL",
        address: candidate.fields.address ?? existing?.address ?? "",
        notes: candidate.fields.notes ?? existing?.notes ?? "",
      };
      if (existing) {
        await updateProperty(productionId, existing.id, input);
        updated++;
      } else {
        await createProperty(productionId, input);
        created++;
      }
    } else if (entityType === "vendor") {
      // No updateVendor action exists — a matched row already has a vendor record; skip rather than duplicate.
      if (candidate.matchedId) continue;
      const name = candidate.fields.name;
      if (!name) continue;
      const input: VendorInput = { name, contact: candidate.fields.contact ?? "", contractTerms: candidate.fields.contractTerms ?? "" };
      await createVendor(productionId, input);
      created++;
    } else if (entityType === "equipmentVendor") {
      // No updateEquipmentVendor action exists — a matched row already has a vendor record; skip rather than duplicate.
      if (candidate.matchedId) continue;
      const name = candidate.fields.name;
      if (!name) continue;
      const input: EquipmentVendorInput = { name, contact: candidate.fields.contact ?? "", contractTerms: candidate.fields.contractTerms ?? "" };
      await createEquipmentVendor(productionId, input);
      created++;
    } else if (entityType === "equipmentCatalogItem") {
      const existing = candidate.matchedId ? existingEquipmentCatalogItems.find((i) => i.id === candidate.matchedId) : undefined;
      const name = candidate.fields.name ?? existing?.name;
      if (!name) continue;
      // A catalog item always needs a vendor — resolve the row's vendor text against vendors already created this
      // import (or already in the production), auto-creating a new equipment vendor the first time a name is seen,
      // same as the driver importer auto-linking/creating against the crew list.
      const vendorText = candidate.fields.vendor?.trim();
      let vendorId = vendorText ? equipmentVendorIdByName.get(vendorText.toLowerCase()) : (existing?.vendorId ?? undefined);
      if (!vendorId && vendorText) {
        vendorId = await createEquipmentVendor(productionId, { name: vendorText, contact: "", contractTerms: "" });
        equipmentVendorIdByName.set(vendorText.toLowerCase(), vendorId);
      }
      if (!vendorId) continue;
      const input: EquipmentCatalogItemInput = {
        vendorId,
        department: candidate.fields.department ?? existing?.department ?? "Camera",
        category: candidate.fields.category ?? existing?.category ?? "",
        name,
        dailyRate: candidate.fields.dailyRate ?? existing?.dailyRate ?? "",
        currency: candidate.fields.currency ?? existing?.currency ?? "",
        notes: candidate.fields.notes ?? existing?.notes ?? "",
      };
      if (existing) {
        await updateCatalogItem(productionId, existing.id, input);
        updated++;
      } else {
        await createCatalogItem(productionId, input);
        created++;
      }
    } else if (entityType === "cateringMenuItem") {
      const existing = candidate.matchedId ? existingMenuItems.find((i) => i.id === candidate.matchedId) : undefined;
      const name = candidate.fields.name ?? existing?.name;
      if (!name) continue;
      // Vendor is optional on a menu item (unlike equipmentCatalogItem) — resolve/auto-create
      // only when the row actually names one, same auto-linking pattern as equipmentCatalogItem.
      const vendorText = candidate.fields.vendor?.trim();
      let vendorId = vendorText ? cateringVendorIdByName.get(vendorText.toLowerCase()) : (existing?.vendorId ?? undefined);
      if (!vendorId && vendorText) {
        vendorId = await createVendor(productionId, { name: vendorText, contact: "", contractTerms: "" });
        cateringVendorIdByName.set(vendorText.toLowerCase(), vendorId);
      }
      const input: MenuItemInput = {
        vendorId: vendorId ?? "",
        name,
        category: candidate.fields.category ?? existing?.category ?? "",
        cuisine: candidate.fields.cuisine ?? existing?.cuisine ?? "",
        dietType: candidate.fields.dietType ?? existing?.dietType ?? "",
        spiceLevel: candidate.fields.spiceLevel ?? existing?.spiceLevel ?? "",
        packagingType: candidate.fields.packagingType ?? existing?.packagingType ?? "",
        price: candidate.fields.price ?? existing?.price ?? "",
        currency: candidate.fields.currency ?? existing?.currency ?? "",
        notes: candidate.fields.notes ?? existing?.notes ?? "",
      };
      if (existing) {
        await updateMenuItem(productionId, existing.id, input);
        updated++;
      } else {
        await createMenuItem(productionId, input);
        created++;
      }
    }
  }

  if (logId) {
    await runAsUser(user.id, (db) =>
      db
        .update(schema.aiSuggestionLog)
        .set({ status: "approved", decidedAt: new Date() })
        .where(eq(schema.aiSuggestionLog.id, logId)),
    );
  }

  return { created, updated };
}
