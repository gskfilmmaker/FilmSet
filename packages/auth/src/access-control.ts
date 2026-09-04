/**
 * The centralized physical access decision function for the Security &
 * Access domain (see packages/db/migrations/0025_access_control_foundation.sql
 * and docs/security/ACCESS_POLICY_ACCESS_CONTROL.md). Deliberately pure —
 * no database access, no Supabase client, nothing async — matching
 * ./authorize.ts's exact architecture: every input is passed in already
 * resolved, so this is fully unit-testable without a database (see
 * access-control.test.ts) and can never silently depend on how the
 * caller loaded its data.
 *
 * Not yet called from any Server Action, API route, or scanner endpoint.
 * That wiring — resolving an EvaluateAccessInput from access_identities /
 * access_credentials / access_checkpoints / access_devices / access_grants
 * / access_restrictions / access_profile_rules / access_temporary_grants /
 * access_events — is separate, later-phase work. This module stays
 * DB-agnostic on purpose.
 */

export type DeviceStatus = "PENDING" | "TRUSTED" | "SUSPENDED" | "REVOKED";
export type CredentialStatus =
  | "DRAFT"
  | "PENDING_APPROVAL"
  | "ACTIVE"
  | "SUSPENDED"
  | "LOST"
  | "REVOKED"
  | "EXPIRED"
  | "REPLACED";
export type AssuranceLevel =
  | "LEVEL_1_BASIC"
  | "LEVEL_2_VERIFIED"
  | "LEVEL_3_DYNAMIC"
  | "LEVEL_4_SMART"
  | "LEVEL_5_HIGH";
export type AntiPassbackMode = "OFF" | "WARN" | "DENY";
export type DirectionMode = "ENTRY" | "EXIT" | "BOTH";
export type AccessDirection = "ENTRY" | "EXIT";
export type DayCode = "MON" | "TUE" | "WED" | "THU" | "FRI" | "SAT" | "SUN";

const ASSURANCE_RANK: Record<AssuranceLevel, number> = {
  LEVEL_1_BASIC: 1,
  LEVEL_2_VERIFIED: 2,
  LEVEL_3_DYNAMIC: 3,
  LEVEL_4_SMART: 4,
  LEVEL_5_HIGH: 5,
};

const DAY_CODES: readonly DayCode[] = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];

function meetsAssurance(held: AssuranceLevel, required: AssuranceLevel): boolean {
  return ASSURANCE_RANK[held] >= ASSURANCE_RANK[required];
}

export interface AccessDeviceContext {
  id: string;
  productionId: string;
  status: DeviceStatus;
}

export interface AccessCheckpointContext {
  id: string;
  productionId: string;
  resourceId: string;
  active: boolean;
  directionMode: DirectionMode;
  antiPassbackMode: AntiPassbackMode;
}

export interface AccessCredentialContext {
  id: string;
  productionId: string;
  identityId: string;
  status: CredentialStatus;
  assuranceLevel: AssuranceLevel;
  validFrom: Date | null;
  validUntil: Date | null;
}

export interface AccessIdentityContext {
  id: string;
  productionId: string;
  active: boolean;
}

export interface AccessResourceContext {
  id: string;
  productionId: string;
  active: boolean;
  minimumAssuranceLevel: AssuranceLevel;
}

/**
 * One resolved grant covering (identity, resource) — the caller has
 * already flattened access_profile_rules (via access_identity_profiles),
 * access_grants, and access_temporary_grants (status = 'APPROVED' only)
 * into this common shape, and already filtered to rows whose
 * resource_id matches the checkpoint's resource. Nothing here does that
 * resolution — same division of labor as authorize.ts's DepartmentGrant.
 */
export interface EffectiveAccessGrant {
  resourceId: string;
  validFrom: Date | null;
  validUntil: Date | null;
  daysOfWeek: readonly DayCode[] | null;
  /** "HH:MM:SS", inclusive range. Null means no restriction on that axis. */
  timeStart: string | null;
  timeEnd: string | null;
  /** Overrides the resource's own minimum only when stricter — see 0025's access_profile_rules comment. */
  minimumAssuranceLevel: AssuranceLevel | null;
  escortRequired: boolean;
}

/** A restriction with resourceId = null blocks every resource in the production. */
export interface AccessRestrictionContext {
  resourceId: string | null;
  validFrom: Date | null;
  validUntil: Date | null;
}

export interface EvaluateAccessInput {
  productionId: string;
  device: AccessDeviceContext | null;
  checkpoint: AccessCheckpointContext | null;
  credential: AccessCredentialContext | null;
  identity: AccessIdentityContext | null;
  resource: AccessResourceContext | null;
  requestedDirection: AccessDirection | null;
  /** Restrictions for this identity, already narrowed to resourceId is null OR resourceId = checkpoint.resourceId. */
  restrictions: readonly AccessRestrictionContext[];
  /** All grants for this identity, already narrowed to resourceId = checkpoint.resourceId. */
  grants: readonly EffectiveAccessGrant[];
  /** Direction of this identity's last ALLOW/WARN event at this checkpoint, for anti-passback. Null if none on record. */
  lastEventDirection: AccessDirection | null;
}

export type AccessReasonCode =
  | "ACCESS_ALLOWED"
  | "DEVICE_NOT_FOUND"
  | "DEVICE_NOT_TRUSTED"
  | "DEVICE_SUSPENDED"
  | "DEVICE_REVOKED"
  | "PRODUCTION_MISMATCH"
  | "CHECKPOINT_NOT_FOUND"
  | "CHECKPOINT_INACTIVE"
  | "DIRECTION_NOT_ALLOWED"
  | "CREDENTIAL_NOT_FOUND"
  | "CREDENTIAL_NOT_ACTIVE"
  | "CREDENTIAL_SUSPENDED"
  | "CREDENTIAL_LOST"
  | "CREDENTIAL_REVOKED"
  | "CREDENTIAL_REPLACED"
  | "CREDENTIAL_EXPIRED"
  | "CREDENTIAL_NOT_YET_VALID"
  | "IDENTITY_NOT_FOUND"
  | "IDENTITY_INACTIVE"
  | "IDENTITY_CREDENTIAL_MISMATCH"
  | "INSUFFICIENT_ASSURANCE"
  | "RESTRICTED"
  | "RESOURCE_NOT_FOUND"
  | "RESOURCE_INACTIVE"
  | "NO_GRANT"
  | "GRANT_NOT_YET_VALID"
  | "GRANT_EXPIRED"
  | "OUTSIDE_ALLOWED_DAY"
  | "OUTSIDE_ALLOWED_TIME"
  | "ANTI_PASSBACK_VIOLATION"
  | "ANTI_PASSBACK_WARNING"
  | "INTERNAL_ERROR";

export type AccessDecisionValue = "ALLOW" | "DENY" | "WARN";

export interface AccessDecision {
  allowed: boolean;
  decision: AccessDecisionValue;
  reasonCode: AccessReasonCode;
  reason: string;
  escortRequired: boolean;
}

function deny(reasonCode: AccessReasonCode, reason: string): AccessDecision {
  return { allowed: false, decision: "DENY", reasonCode, reason, escortRequired: false };
}

function currentDayCode(now: Date): DayCode {
  return DAY_CODES[now.getDay()]!;
}

function currentTimeOfDay(now: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
}

function isGrantCurrentlyInWindow(grant: EffectiveAccessGrant, now: Date): AccessReasonCode | null {
  if (grant.validFrom && now < grant.validFrom) return "GRANT_NOT_YET_VALID";
  if (grant.validUntil && now > grant.validUntil) return "GRANT_EXPIRED";
  if (grant.daysOfWeek && grant.daysOfWeek.length > 0 && !grant.daysOfWeek.includes(currentDayCode(now))) {
    return "OUTSIDE_ALLOWED_DAY";
  }
  if (grant.timeStart && grant.timeEnd) {
    const nowTime = currentTimeOfDay(now);
    if (nowTime < grant.timeStart || nowTime > grant.timeEnd) return "OUTSIDE_ALLOWED_TIME";
  }
  return null;
}

/**
 * Single decision function — ALLOW, WARN, or DENY(reason), never a
 * partial/ambiguous result. Evaluation order follows the owner's spec
 * §10: device -> checkpoint -> credential -> person -> assurance ->
 * restrictions -> resource/grant -> date-time -> anti-passback, so the
 * cheapest/most-decisive device and checkpoint trust checks short-circuit
 * before any identity data is even considered. Default is DENY — an
 * identity with no matching grant for this resource is inaccessible,
 * full stop (same inversion authorize.ts already applies to permissions).
 */
export function evaluateAccess(input: EvaluateAccessInput, now: Date = new Date()): AccessDecision {
  const { device, checkpoint, credential, identity, resource } = input;

  // 1. Device trust.
  if (!device) return deny("DEVICE_NOT_FOUND", "Scanning device is not registered");
  if (device.productionId !== input.productionId) {
    return deny("PRODUCTION_MISMATCH", "Device belongs to a different production");
  }
  if (device.status === "SUSPENDED") return deny("DEVICE_SUSPENDED", "Device is suspended");
  if (device.status === "REVOKED") return deny("DEVICE_REVOKED", "Device trust has been revoked");
  if (device.status !== "TRUSTED") return deny("DEVICE_NOT_TRUSTED", "Device has not completed trust enrollment");

  // 2. Checkpoint.
  if (!checkpoint) return deny("CHECKPOINT_NOT_FOUND", "Checkpoint is not registered");
  if (checkpoint.productionId !== input.productionId) {
    return deny("PRODUCTION_MISMATCH", "Checkpoint belongs to a different production");
  }
  if (!checkpoint.active) return deny("CHECKPOINT_INACTIVE", "Checkpoint is inactive");
  if (
    input.requestedDirection &&
    checkpoint.directionMode !== "BOTH" &&
    checkpoint.directionMode !== input.requestedDirection
  ) {
    return deny("DIRECTION_NOT_ALLOWED", `Checkpoint does not permit ${input.requestedDirection}`);
  }

  // 3. Credential lifecycle.
  if (!credential) return deny("CREDENTIAL_NOT_FOUND", "Credential was not recognized");
  if (credential.productionId !== input.productionId) {
    return deny("PRODUCTION_MISMATCH", "Credential belongs to a different production");
  }
  switch (credential.status) {
    case "SUSPENDED":
      return deny("CREDENTIAL_SUSPENDED", "Credential is suspended");
    case "LOST":
      return deny("CREDENTIAL_LOST", "Credential was reported lost");
    case "REVOKED":
      return deny("CREDENTIAL_REVOKED", "Credential has been revoked");
    case "REPLACED":
      return deny("CREDENTIAL_REPLACED", "Credential has been replaced by a newer one");
    case "EXPIRED":
      return deny("CREDENTIAL_EXPIRED", "Credential has expired");
    case "DRAFT":
    case "PENDING_APPROVAL":
      return deny("CREDENTIAL_NOT_ACTIVE", `Credential status is ${credential.status}, not ACTIVE`);
    case "ACTIVE":
      break;
  }
  if (credential.validFrom && now < credential.validFrom) {
    return deny("CREDENTIAL_NOT_YET_VALID", "Credential is not yet valid");
  }
  if (credential.validUntil && now > credential.validUntil) {
    return deny("CREDENTIAL_EXPIRED", "Credential has expired");
  }

  // 4. Person / identity.
  if (!identity) return deny("IDENTITY_NOT_FOUND", "No identity is linked to this credential");
  if (identity.productionId !== input.productionId) {
    return deny("PRODUCTION_MISMATCH", "Identity belongs to a different production");
  }
  if (credential.identityId !== identity.id) {
    return deny("IDENTITY_CREDENTIAL_MISMATCH", "Credential does not belong to the resolved identity");
  }
  if (!identity.active) return deny("IDENTITY_INACTIVE", "Identity is inactive");

  // 5. Resource resolution + baseline assurance.
  if (!resource) return deny("RESOURCE_NOT_FOUND", "Resource is not registered");
  if (resource.productionId !== input.productionId) {
    return deny("PRODUCTION_MISMATCH", "Resource belongs to a different production");
  }
  if (resource.id !== checkpoint.resourceId) {
    return deny("INTERNAL_ERROR", "Resource does not match the checkpoint's resource");
  }
  if (!meetsAssurance(credential.assuranceLevel, resource.minimumAssuranceLevel)) {
    return deny("INSUFFICIENT_ASSURANCE", `Resource requires at least ${resource.minimumAssuranceLevel}`);
  }

  // 6. Restrictions — override any grant (owner's spec §31), checked before resource/grant matching.
  for (const restriction of input.restrictions) {
    if (restriction.resourceId !== null && restriction.resourceId !== resource.id) continue;
    if (restriction.validFrom && now < restriction.validFrom) continue;
    if (restriction.validUntil && now > restriction.validUntil) continue;
    return deny("RESTRICTED", "Identity is explicitly restricted from this resource");
  }

  if (!resource.active) return deny("RESOURCE_INACTIVE", "Resource is inactive");

  // 7. Resource/grant matching — every grant candidate is already narrowed to this resource by the caller.
  const candidates = input.grants.filter((g) => g.resourceId === resource.id);
  if (candidates.length === 0) return deny("NO_GRANT", "No grant covers this resource for this identity");

  let bestReason: AccessReasonCode = "NO_GRANT";
  let matched: EffectiveAccessGrant | null = null;
  for (const grant of candidates) {
    if (grant.minimumAssuranceLevel && !meetsAssurance(credential.assuranceLevel, grant.minimumAssuranceLevel)) {
      bestReason = "INSUFFICIENT_ASSURANCE";
      continue;
    }
    const windowFailure = isGrantCurrentlyInWindow(grant, now);
    if (windowFailure) {
      bestReason = windowFailure;
      continue;
    }
    matched = grant;
    break;
  }

  // 8. Date/time window — already folded into the grant-matching loop above; a fall-through here
  // means every candidate grant failed its own date/time or assurance window.
  if (!matched) {
    return deny(
      bestReason,
      bestReason === "INSUFFICIENT_ASSURANCE"
        ? "Every grant covering this resource requires higher assurance than this credential holds"
        : "No grant covering this resource is currently within its valid window",
    );
  }

  // 9. Anti-passback — evaluated last, only once every other check has already passed.
  if (
    checkpoint.antiPassbackMode !== "OFF" &&
    input.requestedDirection &&
    input.lastEventDirection === input.requestedDirection
  ) {
    if (checkpoint.antiPassbackMode === "DENY") {
      return deny("ANTI_PASSBACK_VIOLATION", `Identity's last recorded event was already ${input.requestedDirection}`);
    }
    return {
      allowed: true,
      decision: "WARN",
      reasonCode: "ANTI_PASSBACK_WARNING",
      reason: `Identity's last recorded event was already ${input.requestedDirection}`,
      escortRequired: matched.escortRequired,
    };
  }

  return {
    allowed: true,
    decision: "ALLOW",
    reasonCode: "ACCESS_ALLOWED",
    reason: "Access granted",
    escortRequired: matched.escortRequired,
  };
}
