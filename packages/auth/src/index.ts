/**
 * Role vocabulary only — no policy enforcement yet. Roles personalize
 * workspace emphasis (Constitution §79); they do not gate access in this
 * pass. Real RBAC, project isolation, and session handling belong to the
 * feature-implementation phase.
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
