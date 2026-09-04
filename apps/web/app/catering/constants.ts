/**
 * Shared constants/validators for the Catering domain's menu catalog,
 * food/beverage preferences, and service-standard fields
 * (packages/db/migrations/0024_catering_menu_and_preferences.sql). Kept
 * out of actions.ts on purpose: a "use server" file may only export async
 * functions — see apps/web/app/equipment/currency.ts for the exact same
 * lesson learned there.
 */

export const MENU_CATEGORIES = ["STARTER", "MAIN", "DESSERT", "BEVERAGE", "SNACK", "BREAD", "SIDE"] as const;
export type MenuCategory = (typeof MENU_CATEGORIES)[number];

/** A dish's own classification — narrower than a person's diet identity below (no HALAL/KOSHER: those are about sourcing/prep, not the dish's ingredients alone). */
export const MENU_DIET_TYPES = ["VEGETARIAN", "NON_VEGETARIAN", "VEGAN", "EGGETARIAN", "JAIN"] as const;
export type MenuDietType = (typeof MENU_DIET_TYPES)[number];

/** A person's standing diet identity — wider than a dish's own classification (adds HALAL/KOSHER). */
export const PROFILE_DIET_TYPES = ["VEGETARIAN", "NON_VEGETARIAN", "VEGAN", "EGGETARIAN", "JAIN", "HALAL", "KOSHER"] as const;
export type ProfileDietType = (typeof PROFILE_DIET_TYPES)[number];

export const SPICE_LEVELS = ["MILD", "MEDIUM", "HOT"] as const;
export type SpiceLevel = (typeof SPICE_LEVELS)[number];

export const PACKAGING_TYPES = ["DISPOSABLE_ECO", "DISPOSABLE_STANDARD", "REUSABLE", "PLATED"] as const;
export type PackagingType = (typeof PACKAGING_TYPES)[number];

export const SERVICE_STYLES = ["BUFFET", "PLATED", "PACKED_BOXES", "FAMILY_STYLE"] as const;
export type ServiceStyle = (typeof SERVICE_STYLES)[number];

/** Same explicit five-currency list as Equipment (apps/web/app/equipment/currency.ts) — a menu item's price is a real, explicit choice, never hard-coded to one. */
export const CATERING_CURRENCIES = ["USD", "INR", "CAD", "EUR", "AED"] as const;
export type CateringCurrency = (typeof CATERING_CURRENCIES)[number];

const CURRENCY_ALIASES: Record<string, CateringCurrency> = {
  USD: "USD", "US$": "USD", $: "USD", USDOLLAR: "USD", DOLLAR: "USD", DOLLARS: "USD",
  INR: "INR", RS: "INR", "₹": "INR", RUPEE: "INR", RUPEES: "INR", INDIANRUPEE: "INR", INDIANRUPEES: "INR",
  CAD: "CAD", "C$": "CAD", "CA$": "CAD", CANADIANDOLLAR: "CAD", CANADIANDOLLARS: "CAD",
  EUR: "EUR", "€": "EUR", EURO: "EUR", EUROS: "EUR",
  AED: "AED", DHS: "AED", DIRHAM: "AED", DIRHAMS: "AED", DUBAIDIRHAM: "AED",
};

export function validateCateringCurrency(currency: string): CateringCurrency | null {
  const trimmed = currency.trim();
  if (!trimmed) return null;
  const normalized = trimmed.toUpperCase().replace(/[\s.]/g, "");
  const match = CURRENCY_ALIASES[normalized];
  if (!match) throw new Error(`Currency must be one of: ${CATERING_CURRENCIES.join(", ")} (or a common variant like "Rs" for INR).`);
  return match;
}

function validateEnum<T extends string>(value: string, allowed: readonly T[], label: string): T | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const normalized = trimmed.toUpperCase().replace(/[\s-]/g, "_");
  const match = allowed.find((a) => a === normalized);
  if (!match) throw new Error(`${label} must be one of: ${allowed.join(", ")}.`);
  return match;
}

export function validateMenuCategory(value: string): MenuCategory | null {
  return validateEnum(value, MENU_CATEGORIES, "Category");
}
export function validateMenuDietType(value: string): MenuDietType | null {
  return validateEnum(value, MENU_DIET_TYPES, "Diet type");
}
export function validateProfileDietType(value: string): ProfileDietType | null {
  return validateEnum(value, PROFILE_DIET_TYPES, "Diet type");
}
export function validateSpiceLevel(value: string): SpiceLevel | null {
  return validateEnum(value, SPICE_LEVELS, "Spice level");
}
export function validatePackagingType(value: string): PackagingType | null {
  return validateEnum(value, PACKAGING_TYPES, "Packaging type");
}
export function validateServiceStyle(value: string): ServiceStyle | null {
  return validateEnum(value, SERVICE_STYLES, "Service style");
}

export function parseOptionalPrice(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  if (Number.isNaN(parsed) || parsed < 0) throw new Error("Price must be a non-negative number.");
  return parsed.toFixed(2);
}
