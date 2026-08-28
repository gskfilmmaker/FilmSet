import "server-only";
import * as XLSX from "xlsx";
import { IMPORT_FIELDS, type ImportCandidate, type ImportEntityType } from "./types";

/** Reads a .csv/.xlsx/.xls file (SheetJS handles all three uniformly) into a raw header row + data rows. */
export function parseTabular(buffer: ArrayBuffer): { headers: string[]; rows: string[][] } {
  const workbook = XLSX.read(buffer, { type: "array" });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) return { headers: [], rows: [] };
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) return { headers: [], rows: [] };
  const raw = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: "" });
  const firstRow = raw[0];
  if (!firstRow) return { headers: [], rows: [] };

  const headers = firstRow.map((h) => String(h ?? "").trim());
  const rows = raw
    .slice(1)
    .filter((row) => row.some((cell) => String(cell ?? "").trim() !== ""))
    .map((row) => headers.map((_, i) => String(row[i] ?? "").trim()));
  return { headers, rows };
}

function normalize(header: string): string {
  return header.trim().toLowerCase().replace(/[_\-]+/g, " ").replace(/\s+/g, " ");
}

/** Maps spreadsheet headers to known field keys for the given entity type, by loose alias matching. */
function mapHeaders(entityType: ImportEntityType, headers: string[]): Record<number, string> {
  const specs = IMPORT_FIELDS[entityType];
  const columnToField: Record<number, string> = {};
  headers.forEach((header, index) => {
    const normalized = normalize(header);
    const match = specs.find((spec) => spec.aliases.some((alias) => normalize(alias) === normalized));
    if (match) columnToField[index] = match.key;
  });
  return columnToField;
}

/**
 * Turns parsed spreadsheet rows into ImportCandidates for the given entity
 * type. `existingKeys` is a case-insensitive lookup of "the value that
 * identifies an existing record" (character name for cast, name for
 * crew/location) to that record's id — a row matching one becomes an
 * "update" candidate instead of "create".
 */
export function candidatesFromTabular(
  entityType: ImportEntityType,
  headers: string[],
  rows: string[][],
  existingKeys: Map<string, string>,
): { candidates: ImportCandidate[]; skipped: string[] } {
  const columnToField = mapHeaders(entityType, headers);
  const specs = IMPORT_FIELDS[entityType];
  const requiredKey = specs.find((s) => s.required)?.key;
  const candidates: ImportCandidate[] = [];
  const skipped: string[] = [];

  for (const row of rows) {
    const fields: Record<string, string> = {};
    for (const [colIndex, fieldKey] of Object.entries(columnToField)) {
      const value = row[Number(colIndex)];
      if (value) fields[fieldKey] = value;
    }
    const identity = requiredKey ? fields[requiredKey] : undefined;
    if (!identity) {
      skipped.push(row.join(", "));
      continue;
    }
    const matchedId = existingKeys.get(identity.toLowerCase());
    candidates.push({
      id: crypto.randomUUID(),
      action: matchedId ? "update" : "create",
      matchedId,
      fields,
      selected: true,
    });
  }

  return { candidates, skipped };
}
