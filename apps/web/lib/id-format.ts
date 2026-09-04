/**
 * Pure formatting helpers for the ID-numbering system — safe to import from
 * client components (no "server-only", no DB access). The atomic
 * issue/preview functions that actually touch the database live in
 * id-registry.ts instead.
 */
export const ENTITY_CODES = {
  CREDENTIAL: "CR",
  RESOURCE: "RS",
  CHECKPOINT: "CP",
} as const;
export type EntityType = keyof typeof ENTITY_CODES;

const SEQUENCE_DIGITS = 6;

/** Falls back to this whenever a production has no name at all (never happens in practice, but keeps the format well-formed). */
const DEFAULT_SHORT_CODE = "GEN";

/** Derives "VMPA" from "Vrindavan Mein Param Aanand" — first letter of each word, uppercased, capped at 8 chars (matches productions_short_code_format's DB check). A producer can override this via Settings; this is only the zero-setup default. */
export function deriveShortCode(productionName: string): string {
  const initials = productionName
    .split(/\s+/)
    .map((word) => word.replace(/[^a-zA-Z0-9]/g, "").charAt(0))
    .filter(Boolean)
    .join("")
    .toUpperCase();
  return (initials || DEFAULT_SHORT_CODE).slice(0, 8);
}

export function formatEntityNumber(shortCode: string, entityType: EntityType, sequence: number): string {
  return `${shortCode}-${ENTITY_CODES[entityType]}-${String(sequence).padStart(SEQUENCE_DIGITS, "0")}`;
}
