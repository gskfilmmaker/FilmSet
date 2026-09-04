/**
 * Shared types for the file-import pipeline (CSV/XLSX contact lists,
 * PDF/text production documents) — one flow reused across /cast, /crew,
 * /locations, /money, /transport, /accommodation, /catering, and
 * /equipment instead of a bespoke importer per page.
 */
export type ImportEntityType = "cast" | "crew" | "location" | "expense" | "vehicle" | "driver" | "property" | "vendor" | "equipmentVendor" | "equipmentCatalogItem" | "cateringMenuItem";

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
  vehicle: [
    { key: "identifier", label: "Identifier", required: true, aliases: ["identifier", "vehicle", "vehicle name", "plate", "name"] },
    { key: "type", label: "Type", aliases: ["type", "vehicle type"] },
    { key: "capacity", label: "Capacity", aliases: ["capacity", "seats", "seating"] },
    { key: "notes", label: "Notes", aliases: ["notes", "comment", "comments"] },
  ],
  driver: [
    { key: "name", label: "Name", required: true, aliases: ["name", "driver", "driver name", "full name"] },
    { key: "notes", label: "Notes", aliases: ["notes", "comment", "comments"] },
  ],
  property: [
    { key: "name", label: "Name", required: true, aliases: ["name", "property", "property name", "hotel", "hotel name"] },
    { key: "type", label: "Type", aliases: ["type", "property type"] },
    { key: "address", label: "Address", aliases: ["address"] },
    { key: "notes", label: "Notes", aliases: ["notes", "comment", "comments"] },
  ],
  vendor: [
    { key: "name", label: "Name", required: true, aliases: ["name", "vendor", "vendor name", "company"] },
    { key: "contact", label: "Contact", aliases: ["contact", "phone", "email", "contact info"] },
    { key: "contractTerms", label: "Contract terms", aliases: ["contract", "contract terms", "terms"] },
  ],
  equipmentVendor: [
    { key: "name", label: "Name", required: true, aliases: ["name", "vendor", "vendor name", "company", "rental house"] },
    { key: "contact", label: "Contact", aliases: ["contact", "phone", "email", "contact info"] },
    { key: "contractTerms", label: "Contract terms", aliases: ["contract", "contract terms", "terms"] },
  ],
  equipmentCatalogItem: [
    { key: "name", label: "Item", required: true, aliases: ["name", "item", "item name", "equipment", "equipment name"] },
    { key: "department", label: "Department", aliases: ["department", "dept"] },
    { key: "category", label: "Category", aliases: ["category", "type"] },
    { key: "vendor", label: "Vendor", aliases: ["vendor", "vendor name", "rental house", "supplier"] },
    { key: "dailyRate", label: "Daily rate", aliases: ["daily rate", "dailyrate", "rate", "price", "day rate", "cost"] },
    { key: "currency", label: "Currency", aliases: ["currency"] },
    { key: "notes", label: "Notes", aliases: ["notes", "comment", "comments"] },
  ],
  cateringMenuItem: [
    { key: "name", label: "Item", required: true, aliases: ["name", "item", "item name", "dish", "dish name"] },
    { key: "category", label: "Category", aliases: ["category", "type", "course"] },
    { key: "vendor", label: "Vendor", aliases: ["vendor", "vendor name", "caterer", "supplier"] },
    { key: "cuisine", label: "Cuisine", aliases: ["cuisine"] },
    { key: "dietType", label: "Diet", aliases: ["diet", "diet type", "diettype", "dietary type", "veg/non-veg"] },
    { key: "spiceLevel", label: "Spice level", aliases: ["spice", "spice level", "spicelevel", "spiciness"] },
    { key: "packagingType", label: "Packaging", aliases: ["packaging", "packaging type", "packagingtype", "package"] },
    { key: "price", label: "Price", aliases: ["price", "rate", "cost"] },
    { key: "currency", label: "Currency", aliases: ["currency"] },
    { key: "notes", label: "Notes", aliases: ["notes", "comment", "comments"] },
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
