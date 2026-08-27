/**
 * Primitive color scales. Never reference these directly from components —
 * they exist only as the raw material for semantic.ts. See §7 of the FilmSet
 * UX/UI Design Constitution: "components must reference semantic tokens
 * rather than raw colors."
 */

/** Cool-neutral graphite scale. Backbone of both dark and light surfaces. */
export const graphite = {
  0: "#FFFFFF",
  25: "#FAFBFB",
  50: "#F5F6F7",
  75: "#EDEFF0",
  100: "#E4E7E9",
  150: "#D5D9DD",
  200: "#C3C9CF",
  300: "#9FA7B1",
  // Tuned so text.tertiary (dark) clears 4.5:1 against background.elevated
  // (#1C2127) — #7C8591 measured 4.33:1 with axe-core; verified in a11y-tests.
  400: "#8890A0",
  500: "#5A6470",
  600: "#3D454F",
  700: "#2B323A",
  800: "#21262D",
  850: "#1C2127",
  900: "#14171B",
  950: "#0B0D0F",
} as const;

/**
 * FilmSet Signal — the brand accent. Reserved for active state, primary
 * action, live/recording indicators, selected schedule elements. Never used
 * to paint the interface (§11). Base value #E5484D per Constitution §11 —
 * exploratory, not locked without visual testing.
 */
export const signal = {
  100: "#FBD4D5",
  200: "#F7ADAF",
  300: "#F17F82",
  400: "#EB5F63",
  500: "#E5484D",
  600: "#CC3238",
  700: "#A8262B",
  800: "#821E22",
} as const;

/**
 * Status danger — deliberately a cooler, more crimson red than Signal so the
 * two remain distinguishable at a glance (Signal reads warm/orange-red;
 * danger reads cooler/magenta-red). Status color is never the sole
 * identifier — always paired with icon + label (§12, §27).
 */
export const danger = {
  100: "#FBD9DC",
  200: "#F3AEB4",
  300: "#EC838C",
  400: "#F0646F",
  500: "#DB3B49",
  600: "#B92C39",
  700: "#90212C",
} as const;

export const success = {
  100: "#D7F0E1",
  200: "#AEE0C4",
  300: "#7DCCA3",
  400: "#4CBE85",
  500: "#34A76D",
  600: "#268957",
  700: "#1C6B44",
} as const;

export const warning = {
  100: "#FBEBD1",
  200: "#F3D5A0",
  300: "#E9BC6F",
  400: "#E0A23F",
  500: "#C98A1E",
  600: "#A06A14",
  700: "#7A4F0E",
} as const;

export const info = {
  100: "#DCEBF6",
  200: "#B7D6EC",
  300: "#8FBFE0",
  400: "#6BAAE0",
  500: "#4A8FCB",
  600: "#326EA3",
  700: "#275580",
} as const;

/** High-contrast mode uses brighter, more saturated variants for AAA-level separation on pure black/white. */
export const highContrast = {
  signal: "#FF5A5F",
  signalHover: "#FF7A7E",
  signalActive: "#E5484D",
  success: "#3DDC84",
  warning: "#FFC24B",
  danger: "#FF5A5F",
  info: "#6FB8FF",
} as const;
