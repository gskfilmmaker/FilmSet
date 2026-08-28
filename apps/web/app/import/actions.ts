"use server";

import { createCastMember, updateCastMember, type CastMemberInput } from "@/app/cast/actions";
import { createCrewMember, updateCrewMember, type CrewMemberInput } from "@/app/crew/actions";
import { createLocation, updateLocation, type LocationInput } from "@/app/locations/actions";
import { createExpense, type ExpenseInput } from "@/app/money/actions";
import { requireProductionMember } from "@/lib/authz";
import { extractCastCandidates, extractLocationCandidates } from "@/lib/ai";
import { parsePdfText } from "@/lib/import/parse-pdf";
import { candidatesFromTabular, parseTabular } from "@/lib/import/parse-tabular";
import type { ImportCandidate, ImportEntityType, ImportPreviewResult } from "@/lib/import/types";
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
  location: async (text) => (await extractLocationCandidates(text)).map((r) => ({ fields: { name: r.name, address: r.address, notes: r.notes } })),
};

/** Preview step for a .pdf upload — extracts text, then an AI Suggest call proposes structured candidates. Logged to ai_suggestion_log for the same audit trail every other AI suggestion gets. Never writes to production data. */
export async function previewDocumentImport(productionId: string, entityType: ImportEntityType, formData: FormData): Promise<ImportPreviewResult> {
  const user = await requireUser();
  await requireProductionMember(productionId);
  const extractor = DOCUMENT_EXTRACTORS[entityType];
  if (!extractor) throw new Error(`Document import isn't available for ${entityType} yet — try a CSV/XLSX file instead.`);

  const file = readFile(formData);
  const buffer = await file.arrayBuffer();
  const text = await parsePdfText(buffer);
  if (text.trim().length < 20) {
    throw new Error("Couldn't read text from that PDF — it may be a scanned image rather than a real document.");
  }

  const extracted = await extractor(text);
  const existingKeys = await existingKeysFor(entityType, productionId, user.id);
  const identityKey = entityType === "cast" ? "characterName" : "name";
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
