/**
 * Vocabulary mirrors packages/db/migrations/0025_access_control_foundation.sql's
 * check constraints exactly — this file is the only place that vocabulary is
 * duplicated, and it must stay in sync with that migration if either changes.
 *
 * Deliberately NOT in actions.ts: that file has "use server" at the top, and
 * Next.js forbids a "use server" file from exporting anything but async
 * functions — the exact bug already fixed once in apps/web/app/equipment/
 * (see currency.ts's own header comment).
 */
export const PERSON_CATEGORIES = ["CAST", "CREW", "EXTERNAL"] as const;
export type PersonCategory = (typeof PERSON_CATEGORIES)[number];

export const SECURITY_CLASSES = [
  "CREW", "CAST", "HOD", "DIRECTOR", "PRODUCER", "BACKGROUND", "DAY_PLAYER", "VENDOR", "CONTRACTOR",
  "VISITOR", "MEDIA", "SECURITY", "DRIVER", "VIP", "TEMPORARY", "LOCATION_STAFF", "CUSTOM",
] as const;
export type SecurityClass = (typeof SECURITY_CLASSES)[number];

export const CREDENTIAL_TYPES = ["QR", "BARCODE", "NFC", "SMART_CARD", "MOBILE", "BLE", "PIN", "EXTERNAL"] as const;
export type CredentialType = (typeof CREDENTIAL_TYPES)[number];

export const CREDENTIAL_STATUSES = [
  "DRAFT", "PENDING_APPROVAL", "ACTIVE", "SUSPENDED", "LOST", "REVOKED", "EXPIRED", "REPLACED",
] as const;
export type CredentialStatus = (typeof CREDENTIAL_STATUSES)[number];

export const ASSURANCE_LEVELS = ["LEVEL_1_BASIC", "LEVEL_2_VERIFIED", "LEVEL_3_DYNAMIC", "LEVEL_4_SMART", "LEVEL_5_HIGH"] as const;
export type AssuranceLevel = (typeof ASSURANCE_LEVELS)[number];

export const RESOURCE_TYPES = [
  "SITE", "LOCATION", "ZONE", "GATE", "DOOR", "ROOM", "SET", "STAGE", "BASECAMP", "HOLDING_AREA",
  "OFFICE", "EQUIPMENT_AREA", "VEHICLE_GATE", "PARKING", "CUSTOM",
] as const;
export type ResourceType = (typeof RESOURCE_TYPES)[number];

export const SECURITY_LEVELS = ["STANDARD", "ELEVATED", "RESTRICTED"] as const;
export type SecurityLevel = (typeof SECURITY_LEVELS)[number];

export const OCCUPANCY_POLICIES = ["IGNORE", "WARN", "DENY"] as const;
export type OccupancyPolicy = (typeof OCCUPANCY_POLICIES)[number];

export const OFFLINE_POLICIES = ["DENY", "ALLOW_CACHED", "ALLOW_HIGH_ASSURANCE_CACHED"] as const;
export type OfflinePolicy = (typeof OFFLINE_POLICIES)[number];

export const DIRECTION_MODES = ["ENTRY", "EXIT", "BOTH"] as const;
export type DirectionMode = (typeof DIRECTION_MODES)[number];

export const ANTI_PASSBACK_MODES = ["OFF", "WARN", "DENY"] as const;
export type AntiPassbackMode = (typeof ANTI_PASSBACK_MODES)[number];

export const DEVICE_TYPES = ["MOBILE_SCANNER", "TABLET_SCANNER", "FIXED_SCANNER", "EDGE_GATEWAY", "CONTROLLER", "KIOSK", "OTHER"] as const;
export type DeviceType = (typeof DEVICE_TYPES)[number];

export const DEVICE_STATUSES = ["PENDING", "TRUSTED", "SUSPENDED", "REVOKED"] as const;
export type DeviceStatus = (typeof DEVICE_STATUSES)[number];

export const DAYS_OF_WEEK = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"] as const;
export type DayOfWeek = (typeof DAYS_OF_WEEK)[number];

export const TEMPORARY_GRANT_STATUSES = ["PENDING", "APPROVED", "DENIED", "EXPIRED", "REVOKED"] as const;
export type TemporaryGrantStatus = (typeof TEMPORARY_GRANT_STATUSES)[number];
