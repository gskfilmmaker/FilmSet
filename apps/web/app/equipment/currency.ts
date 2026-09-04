/**
 * Currency constants and validation for the Equipment domain, kept out of
 * actions.ts on purpose: a "use server" file may only export async
 * functions — exporting EQUIPMENT_CURRENCIES (an array) alongside the
 * Server Actions there crashes every request to /equipment in production
 * ("A 'use server' file can only export async functions, found object.").
 */

/** USD/INR/CAD/EUR/AED — a real, explicit choice (the owner's own list), never hard-coded to one. Empty is allowed: a line item can exist before its currency is known. */
export const EQUIPMENT_CURRENCIES = ["USD", "INR", "CAD", "EUR", "AED"] as const;
export type EquipmentCurrency = (typeof EQUIPMENT_CURRENCIES)[number];

/** Common real-world spellings a vendor price list or import file actually uses (an Indian supplier writes "Rs" or "₹", not "INR") — normalized to the canonical code before validating. */
const CURRENCY_ALIASES: Record<string, EquipmentCurrency> = {
  USD: "USD", "US$": "USD", $: "USD", USDOLLAR: "USD", DOLLAR: "USD", DOLLARS: "USD",
  INR: "INR", RS: "INR", "₹": "INR", RUPEE: "INR", RUPEES: "INR", INDIANRUPEE: "INR", INDIANRUPEES: "INR",
  CAD: "CAD", "C$": "CAD", "CA$": "CAD", CANADIANDOLLAR: "CAD", CANADIANDOLLARS: "CAD",
  EUR: "EUR", "€": "EUR", EURO: "EUR", EUROS: "EUR",
  AED: "AED", DHS: "AED", DIRHAM: "AED", DIRHAMS: "AED", DUBAIDIRHAM: "AED",
};

export function validateCurrency(currency: string): EquipmentCurrency | null {
  const trimmed = currency.trim();
  if (!trimmed) return null;
  const normalized = trimmed.toUpperCase().replace(/[\s.]/g, "");
  const match = CURRENCY_ALIASES[normalized];
  if (!match) throw new Error(`Currency must be one of: ${EQUIPMENT_CURRENCIES.join(", ")} (or a common variant like "Rs" for INR).`);
  return match;
}
