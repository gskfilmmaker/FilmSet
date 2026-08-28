/**
 * Shared types for the file-import pipeline (CSV/XLSX contact lists,
 * PDF/text production documents) — one flow reused across /cast, /crew,
 * /locations, and /money instead of a bespoke importer per page.
 */
export type ImportEntityType = "cast" | "crew" | "location" | "expense";

export interface ImportFieldSpec {
  key: string;
  label: string;
  required?: boolean;
  /** Header names (case-insensitive, loosely matched) this field accepts when mapping a spreadsheet column. */
  aliases: string[];
}

export const IMPORT_FIELDS: Record<ImportEntityType, ImportFieldSpec[]> = {
  cast: [
    { key: "characterName", label: "Character", required: true, aliases: ["character", "character name", "role"] },
    { key: "actorName", label: "Actor", aliases: ["actor", "actor name", "artist", "artist name", "performer", "cast"] },
    { key: "email", label: "Email", aliases: ["email", "e-mail", "email address"] },
    { key: "phone", label: "Phone", aliases: ["phone", "mobile", "contact", "contact number", "phone number"] },
  ],
  crew: [
    { key: "name", label: "Name", required: true, aliases: ["name", "full name", "crew name"] },
    { key: "department", label: "Department", aliases: ["department", "dept"] },
    { key: "role", label: "Role", aliases: ["role", "title", "position", "job title"] },
    { key: "email", label: "Email", aliases: ["email", "e-mail", "email address"] },
    { key: "phone", label: "Phone", aliases: ["phone", "mobile", "contact", "contact number", "phone number"] },
  ],
  location: [
    { key: "name", label: "Name", required: true, aliases: ["name", "location", "location name", "place"] },
    { key: "address", label: "Address", aliases: ["address", "location address"] },
  ],
  expense: [
    { key: "vendor", label: "Vendor", required: true, aliases: ["vendor", "payee", "supplier"] },
    { key: "department", label: "Department", required: true, aliases: ["department", "dept"] },
    { key: "amount", label: "Amount", required: true, aliases: ["amount", "cost", "total", "invoice amount"] },
    { key: "date", label: "Date", aliases: ["date", "invoice date"] },
    { key: "invoiceNumber", label: "Invoice #", aliases: ["invoice #", "invoice number", "invoice no", "invoice"] },
    { key: "status", label: "Status", aliases: ["status"] },
  ],
};

export interface ImportCandidate {
  id: string;
  action: "create" | "update";
  matchedId?: string;
  fields: Record<string, string>;
  selected: boolean;
}

export interface ImportPreviewResult {
  candidates: ImportCandidate[];
  /** Set only for a document/AI-assisted extraction — lets the review UI say "extracted with AI" and ties back to the audit log. */
  logId?: string;
  /** Rows or blocks the parser saw but could not confidently map — surfaced so nothing silently vanishes. */
  skipped: string[];
}
