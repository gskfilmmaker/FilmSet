/**
 * Role vocabulary — safe to import from anywhere (client or server), no
 * Supabase/Next dependency. Personalizes workspace emphasis (Constitution
 * §79) and gates membership-scoped actions (see "./server").
 */
export const PRODUCTION_ROLES = [
  "Producer",
  "Director",
  "1st AD",
  "UPM",
  "Production Accountant",
  "Department Head",
  "Crew",
] as const;

export type ProductionRole = (typeof PRODUCTION_ROLES)[number];
