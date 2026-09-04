"use server";

import { recordAudit } from "@/lib/audit-log";
import { resolveAndEvaluateAccess } from "@/lib/access-evaluation";
import { requireProductionMember } from "@/lib/authz";
import { issueNextEntityNumber, peekNextEntityNumber } from "@/lib/id-registry";
import type { AccessDirection } from "@filmset/auth/access-control";
import { requireUser } from "@filmset/auth/server";
import { runAsUser, schema } from "@filmset/db/server";
import { and, eq } from "drizzle-orm";
import crypto from "node:crypto";
import type {
  AssuranceLevel,
  AntiPassbackMode,
  CredentialStatus,
  CredentialType,
  DayOfWeek,
  DeviceStatus,
  DeviceType,
  DirectionMode,
  OccupancyPolicy,
  OfflinePolicy,
  PersonCategory,
  ResourceType,
  SecurityClass,
  SecurityLevel,
  TemporaryGrantStatus,
} from "./constants";

/** Every write in this domain is Producer-gated (owner's spec: "no implicit superuser based merely on being production crew") — the RLS write policies (0026) are the membership backstop, this is the actual authorization check. */
async function requireSecurityAdmin(productionId: string) {
  return requireProductionMember(productionId, ["Producer"]);
}

// ============================================================================
// Identities
// ============================================================================

export interface IdentityInput {
  personCategory: PersonCategory;
  castMemberId: string | null;
  crewMemberId: string | null;
  displayName: string | null;
  company: string | null;
  securityClass: SecurityClass;
  active: boolean;
  notes: string | null;
}

function validateIdentity(input: IdentityInput) {
  if (input.personCategory === "CAST" && !input.castMemberId) throw new Error("Choose which cast member this identity belongs to.");
  if (input.personCategory === "CREW" && !input.crewMemberId) throw new Error("Choose which crew member this identity belongs to.");
  if (input.personCategory === "EXTERNAL" && !input.displayName?.trim()) throw new Error("Name is required for an external identity.");
  return {
    personCategory: input.personCategory,
    castMemberId: input.personCategory === "CAST" ? input.castMemberId : null,
    crewMemberId: input.personCategory === "CREW" ? input.crewMemberId : null,
    displayName: input.personCategory === "EXTERNAL" ? input.displayName?.trim() || null : null,
    company: input.personCategory === "EXTERNAL" ? input.company?.trim() || null : null,
    securityClass: input.securityClass,
    active: input.active,
    notes: input.notes?.trim() || null,
  };
}

export async function createIdentity(productionId: string, input: IdentityInput) {
  const user = await requireUser();
  await requireSecurityAdmin(productionId);
  const values = validateIdentity(input);
  const id = crypto.randomUUID();
  await runAsUser(user.id, async (db) => {
    await db.insert(schema.accessIdentities).values({ id, productionId, ...values });
    await recordAudit(db, { productionId, tableName: "access_identities", recordId: id, action: "INSERT", actor: user.id, after: { id, productionId, ...values } });
  });
  return id;
}

export async function updateIdentity(productionId: string, id: string, input: IdentityInput) {
  const user = await requireUser();
  await requireSecurityAdmin(productionId);
  const values = validateIdentity(input);
  await runAsUser(user.id, async (db) => {
    const [before] = await db
      .select()
      .from(schema.accessIdentities)
      .where(and(eq(schema.accessIdentities.id, id), eq(schema.accessIdentities.productionId, productionId)))
      .limit(1);
    await db.update(schema.accessIdentities).set(values).where(and(eq(schema.accessIdentities.id, id), eq(schema.accessIdentities.productionId, productionId)));
    await recordAudit(db, { productionId, tableName: "access_identities", recordId: id, action: "UPDATE", actor: user.id, before, after: { ...before, ...values } });
  });
}

export async function deleteIdentity(productionId: string, id: string) {
  const user = await requireUser();
  await requireSecurityAdmin(productionId);
  await runAsUser(user.id, async (db) => {
    const [before] = await db
      .select()
      .from(schema.accessIdentities)
      .where(and(eq(schema.accessIdentities.id, id), eq(schema.accessIdentities.productionId, productionId)))
      .limit(1);
    await db
      .update(schema.accessIdentities)
      .set({ deletedAt: new Date(), deletedBy: user.id })
      .where(and(eq(schema.accessIdentities.id, id), eq(schema.accessIdentities.productionId, productionId)));
    await recordAudit(db, { productionId, tableName: "access_identities", recordId: id, action: "DELETE", actor: user.id, before, after: null });
  });
}

// ============================================================================
// Credentials
// ============================================================================

export interface CredentialInput {
  identityId: string;
  credentialType: CredentialType;
  credentialClass: SecurityClass;
  credentialNumber: string;
  status: CredentialStatus;
  assuranceLevel: AssuranceLevel;
  validFrom: string | null;
  validUntil: string | null;
}

/**
 * Blank credentialNumber is allowed through here — createCredential fills it
 * in with an auto-issued number (see issueNextEntityNumber); updateCredential
 * requires an explicit value, since silently reassigning a new number on
 * edit would violate the "a credential's number never changes once issued"
 * convention (docs/security/ID_NUMBERING_CONVENTION.md).
 */
function validateCredential(input: CredentialInput) {
  if (!input.identityId) throw new Error("Choose which identity this credential belongs to.");
  const credentialNumber = input.credentialNumber.trim();
  const validFrom = input.validFrom?.trim() ? new Date(input.validFrom) : null;
  const validUntil = input.validUntil?.trim() ? new Date(input.validUntil) : null;
  if (validFrom && validUntil && validFrom > validUntil) throw new Error("Valid-from must be before valid-until.");
  return {
    identityId: input.identityId,
    credentialType: input.credentialType,
    credentialClass: input.credentialClass,
    credentialNumber,
    status: input.status,
    assuranceLevel: input.assuranceLevel,
    validFrom,
    validUntil,
  };
}

/**
 * The opaque, high-entropy value a QR would encode (docs/security/QR_SECURITY_ACCESS_CONTROL.md)
 * — generated server-side, never user-entered, never derived from credentialNumber or any
 * other predictable value. No QR is actually rendered yet (Phase C); this is the value
 * a future rendering step would encode.
 */
function generatePublicReference(): string {
  return crypto.randomBytes(24).toString("base64url");
}

export async function createCredential(productionId: string, input: CredentialInput) {
  const user = await requireUser();
  await requireSecurityAdmin(productionId);
  const values = validateCredential(input);
  const id = crypto.randomUUID();
  await runAsUser(user.id, async (db) => {
    const credentialNumber = values.credentialNumber || (await issueNextEntityNumber(db, productionId, "CREDENTIAL"));
    const row = { id, productionId, publicReference: generatePublicReference(), ...values, credentialNumber };
    await db.insert(schema.accessCredentials).values(row);
    await recordAudit(db, { productionId, tableName: "access_credentials", recordId: id, action: "INSERT", actor: user.id, after: row });
  });
  return id;
}

export async function updateCredential(productionId: string, id: string, input: CredentialInput) {
  const user = await requireUser();
  await requireSecurityAdmin(productionId);
  const values = validateCredential(input);
  if (!values.credentialNumber) throw new Error("Credential number is required.");
  await runAsUser(user.id, async (db) => {
    const [before] = await db
      .select()
      .from(schema.accessCredentials)
      .where(and(eq(schema.accessCredentials.id, id), eq(schema.accessCredentials.productionId, productionId)))
      .limit(1);
    await db.update(schema.accessCredentials).set(values).where(and(eq(schema.accessCredentials.id, id), eq(schema.accessCredentials.productionId, productionId)));
    await recordAudit(db, { productionId, tableName: "access_credentials", recordId: id, action: "UPDATE", actor: user.id, before, after: { ...before, ...values } });
  });
}

/** Read-only preview for the Add-credential form — see peekNextEntityNumber's own doc comment. */
export async function previewNextCredentialNumber(productionId: string): Promise<string> {
  const user = await requireUser();
  await requireSecurityAdmin(productionId);
  return runAsUser(user.id, (db) => peekNextEntityNumber(db, productionId, "CREDENTIAL"));
}

export async function deleteCredential(productionId: string, id: string) {
  const user = await requireUser();
  await requireSecurityAdmin(productionId);
  await runAsUser(user.id, async (db) => {
    const [before] = await db
      .select()
      .from(schema.accessCredentials)
      .where(and(eq(schema.accessCredentials.id, id), eq(schema.accessCredentials.productionId, productionId)))
      .limit(1);
    await db
      .update(schema.accessCredentials)
      .set({ deletedAt: new Date(), deletedBy: user.id })
      .where(and(eq(schema.accessCredentials.id, id), eq(schema.accessCredentials.productionId, productionId)));
    await recordAudit(db, { productionId, tableName: "access_credentials", recordId: id, action: "DELETE", actor: user.id, before, after: null });
  });
}

// ============================================================================
// Resources
// ============================================================================

export interface ResourceInput {
  parentResourceId: string | null;
  locationId: string | null;
  resourceType: ResourceType;
  name: string;
  code: string | null;
  description: string | null;
  active: boolean;
  securityLevel: SecurityLevel;
  minimumAssuranceLevel: AssuranceLevel;
  capacity: number | null;
  occupancyPolicy: OccupancyPolicy;
  offlinePolicy: OfflinePolicy;
}

function validateResource(input: ResourceInput) {
  const name = input.name.trim();
  if (!name) throw new Error("Name is required.");
  if (input.capacity !== null && input.capacity < 0) throw new Error("Capacity can't be negative.");
  return {
    parentResourceId: input.parentResourceId || null,
    locationId: input.locationId || null,
    resourceType: input.resourceType,
    name,
    code: input.code?.trim() || null,
    description: input.description?.trim() || null,
    active: input.active,
    securityLevel: input.securityLevel,
    minimumAssuranceLevel: input.minimumAssuranceLevel,
    capacity: input.capacity,
    occupancyPolicy: input.occupancyPolicy,
    offlinePolicy: input.offlinePolicy,
  };
}

/** Read-only preview for the Add-resource form — shown as the field's placeholder, never prefilled as real text (see issueNextEntityNumber's own doc comment for why). */
export async function previewNextResourceCode(productionId: string): Promise<string> {
  const user = await requireUser();
  await requireSecurityAdmin(productionId);
  return runAsUser(user.id, (db) => peekNextEntityNumber(db, productionId, "RESOURCE"));
}

/** Left blank, a resource gets an auto-issued code on create; a typed value is used as-is. Editing to blank clears it — a resource's code, unlike a credential's number, isn't core to what the record is. */
export async function createResource(productionId: string, input: ResourceInput) {
  const user = await requireUser();
  await requireSecurityAdmin(productionId);
  const values = validateResource(input);
  const id = crypto.randomUUID();
  await runAsUser(user.id, async (db) => {
    const code = values.code ?? (await issueNextEntityNumber(db, productionId, "RESOURCE"));
    const row = { id, productionId, ...values, code };
    await db.insert(schema.accessResources).values(row);
    await recordAudit(db, { productionId, tableName: "access_resources", recordId: id, action: "INSERT", actor: user.id, after: row });
  });
  return id;
}

export async function updateResource(productionId: string, id: string, input: ResourceInput) {
  const user = await requireUser();
  await requireSecurityAdmin(productionId);
  const values = validateResource(input);
  if (values.parentResourceId === id) throw new Error("A resource can't be its own parent.");
  await runAsUser(user.id, async (db) => {
    const [before] = await db
      .select()
      .from(schema.accessResources)
      .where(and(eq(schema.accessResources.id, id), eq(schema.accessResources.productionId, productionId)))
      .limit(1);
    await db.update(schema.accessResources).set(values).where(and(eq(schema.accessResources.id, id), eq(schema.accessResources.productionId, productionId)));
    await recordAudit(db, { productionId, tableName: "access_resources", recordId: id, action: "UPDATE", actor: user.id, before, after: { ...before, ...values } });
  });
}

export async function deleteResource(productionId: string, id: string) {
  const user = await requireUser();
  await requireSecurityAdmin(productionId);
  await runAsUser(user.id, async (db) => {
    const [before] = await db
      .select()
      .from(schema.accessResources)
      .where(and(eq(schema.accessResources.id, id), eq(schema.accessResources.productionId, productionId)))
      .limit(1);
    await db
      .update(schema.accessResources)
      .set({ deletedAt: new Date(), deletedBy: user.id })
      .where(and(eq(schema.accessResources.id, id), eq(schema.accessResources.productionId, productionId)));
    await recordAudit(db, { productionId, tableName: "access_resources", recordId: id, action: "DELETE", actor: user.id, before, after: null });
  });
}

// ============================================================================
// Checkpoints
// ============================================================================

export interface CheckpointInput {
  resourceId: string;
  name: string;
  code: string | null;
  directionMode: DirectionMode;
  active: boolean;
  antiPassbackMode: AntiPassbackMode;
  requiresOperatorConfirmation: boolean;
}

function validateCheckpoint(input: CheckpointInput) {
  if (!input.resourceId) throw new Error("Choose which resource this checkpoint guards.");
  const name = input.name.trim();
  if (!name) throw new Error("Name is required.");
  return {
    resourceId: input.resourceId,
    name,
    code: input.code?.trim() || null,
    directionMode: input.directionMode,
    active: input.active,
    antiPassbackMode: input.antiPassbackMode,
    requiresOperatorConfirmation: input.requiresOperatorConfirmation,
  };
}

/** Read-only preview for the Add-checkpoint form — shown as the field's placeholder, never prefilled as real text (see issueNextEntityNumber's own doc comment for why). */
export async function previewNextCheckpointCode(productionId: string): Promise<string> {
  const user = await requireUser();
  await requireSecurityAdmin(productionId);
  return runAsUser(user.id, (db) => peekNextEntityNumber(db, productionId, "CHECKPOINT"));
}

/** Left blank, a checkpoint gets an auto-issued code on create; a typed value is used as-is. */
export async function createCheckpoint(productionId: string, input: CheckpointInput) {
  const user = await requireUser();
  await requireSecurityAdmin(productionId);
  const values = validateCheckpoint(input);
  const id = crypto.randomUUID();
  await runAsUser(user.id, async (db) => {
    const code = values.code ?? (await issueNextEntityNumber(db, productionId, "CHECKPOINT"));
    const row = { id, productionId, ...values, code };
    await db.insert(schema.accessCheckpoints).values(row);
    await recordAudit(db, { productionId, tableName: "access_checkpoints", recordId: id, action: "INSERT", actor: user.id, after: row });
  });
  return id;
}

export async function updateCheckpoint(productionId: string, id: string, input: CheckpointInput) {
  const user = await requireUser();
  await requireSecurityAdmin(productionId);
  const values = validateCheckpoint(input);
  await runAsUser(user.id, async (db) => {
    const [before] = await db
      .select()
      .from(schema.accessCheckpoints)
      .where(and(eq(schema.accessCheckpoints.id, id), eq(schema.accessCheckpoints.productionId, productionId)))
      .limit(1);
    await db.update(schema.accessCheckpoints).set(values).where(and(eq(schema.accessCheckpoints.id, id), eq(schema.accessCheckpoints.productionId, productionId)));
    await recordAudit(db, { productionId, tableName: "access_checkpoints", recordId: id, action: "UPDATE", actor: user.id, before, after: { ...before, ...values } });
  });
}

export async function deleteCheckpoint(productionId: string, id: string) {
  const user = await requireUser();
  await requireSecurityAdmin(productionId);
  await runAsUser(user.id, async (db) => {
    const [before] = await db
      .select()
      .from(schema.accessCheckpoints)
      .where(and(eq(schema.accessCheckpoints.id, id), eq(schema.accessCheckpoints.productionId, productionId)))
      .limit(1);
    await db
      .update(schema.accessCheckpoints)
      .set({ deletedAt: new Date(), deletedBy: user.id })
      .where(and(eq(schema.accessCheckpoints.id, id), eq(schema.accessCheckpoints.productionId, productionId)));
    await recordAudit(db, { productionId, tableName: "access_checkpoints", recordId: id, action: "DELETE", actor: user.id, before, after: null });
  });
}

// ============================================================================
// Devices
// ============================================================================

export interface DeviceInput {
  checkpointId: string | null;
  name: string;
  deviceType: DeviceType;
  deviceIdentifier: string;
  status: DeviceStatus;
}

function validateDevice(input: DeviceInput) {
  const name = input.name.trim();
  if (!name) throw new Error("Name is required.");
  const deviceIdentifier = input.deviceIdentifier.trim();
  if (!deviceIdentifier) throw new Error("Device identifier is required.");
  return {
    checkpointId: input.checkpointId || null,
    name,
    deviceType: input.deviceType,
    deviceIdentifier,
    status: input.status,
  };
}

/**
 * Phase B ships direct admin control of device status (no secure hashed-token
 * enrollment flow yet — that's owner's spec §14, deferred to a later phase per
 * docs/security/DEVICE_TRUST_ACCESS_CONTROL.md). A Producer can mark a device
 * TRUSTED/SUSPENDED/REVOKED directly here; trustedAt/trustedBy and
 * revokedAt/revokedBy are stamped to match, same accountability the real
 * enrollment flow will also produce.
 */
function stampStatusTransition(
  user: { id: string },
  previousStatus: DeviceStatus | null,
  nextStatus: DeviceStatus,
): { trustedAt?: Date; trustedBy?: string; revokedAt?: Date; revokedBy?: string } {
  const stamps: { trustedAt?: Date; trustedBy?: string; revokedAt?: Date; revokedBy?: string } = {};
  if (nextStatus === "TRUSTED" && previousStatus !== "TRUSTED") {
    stamps.trustedAt = new Date();
    stamps.trustedBy = user.id;
  }
  if (nextStatus === "REVOKED" && previousStatus !== "REVOKED") {
    stamps.revokedAt = new Date();
    stamps.revokedBy = user.id;
  }
  return stamps;
}

export async function createDevice(productionId: string, input: DeviceInput) {
  const user = await requireUser();
  await requireSecurityAdmin(productionId);
  const values = validateDevice(input);
  const id = crypto.randomUUID();
  const stamps = stampStatusTransition(user, null, values.status);
  await runAsUser(user.id, async (db) => {
    const row = { id, productionId, ...values, ...stamps };
    await db.insert(schema.accessDevices).values(row);
    await recordAudit(db, { productionId, tableName: "access_devices", recordId: id, action: "INSERT", actor: user.id, after: row });
  });
  return id;
}

export async function updateDevice(productionId: string, id: string, input: DeviceInput) {
  const user = await requireUser();
  await requireSecurityAdmin(productionId);
  const values = validateDevice(input);
  await runAsUser(user.id, async (db) => {
    const [before] = await db
      .select()
      .from(schema.accessDevices)
      .where(and(eq(schema.accessDevices.id, id), eq(schema.accessDevices.productionId, productionId)))
      .limit(1);
    const stamps = stampStatusTransition(user, (before?.status as DeviceStatus) ?? null, values.status);
    await db
      .update(schema.accessDevices)
      .set({ ...values, ...stamps })
      .where(and(eq(schema.accessDevices.id, id), eq(schema.accessDevices.productionId, productionId)));
    await recordAudit(db, { productionId, tableName: "access_devices", recordId: id, action: "UPDATE", actor: user.id, before, after: { ...before, ...values, ...stamps } });
  });
}

export async function deleteDevice(productionId: string, id: string) {
  const user = await requireUser();
  await requireSecurityAdmin(productionId);
  await runAsUser(user.id, async (db) => {
    const [before] = await db
      .select()
      .from(schema.accessDevices)
      .where(and(eq(schema.accessDevices.id, id), eq(schema.accessDevices.productionId, productionId)))
      .limit(1);
    await db
      .update(schema.accessDevices)
      .set({ deletedAt: new Date(), deletedBy: user.id })
      .where(and(eq(schema.accessDevices.id, id), eq(schema.accessDevices.productionId, productionId)));
    await recordAudit(db, { productionId, tableName: "access_devices", recordId: id, action: "DELETE", actor: user.id, before, after: null });
  });
}

// ============================================================================
// Access Profiles (Phase B, Part 2) — named, reusable templates. §9.
// ============================================================================

export interface ProfileInput {
  name: string;
  description: string | null;
}

function validateProfile(input: ProfileInput) {
  const name = input.name.trim();
  if (!name) throw new Error("Name is required.");
  return { name, description: input.description?.trim() || null };
}

export async function createProfile(productionId: string, input: ProfileInput) {
  const user = await requireUser();
  await requireSecurityAdmin(productionId);
  const values = validateProfile(input);
  const id = crypto.randomUUID();
  await runAsUser(user.id, async (db) => {
    await db.insert(schema.accessProfiles).values({ id, productionId, ...values });
    await recordAudit(db, { productionId, tableName: "access_profiles", recordId: id, action: "INSERT", actor: user.id, after: { id, productionId, ...values } });
  });
  return id;
}

export async function updateProfile(productionId: string, id: string, input: ProfileInput) {
  const user = await requireUser();
  await requireSecurityAdmin(productionId);
  const values = validateProfile(input);
  await runAsUser(user.id, async (db) => {
    const [before] = await db
      .select()
      .from(schema.accessProfiles)
      .where(and(eq(schema.accessProfiles.id, id), eq(schema.accessProfiles.productionId, productionId)))
      .limit(1);
    await db.update(schema.accessProfiles).set(values).where(and(eq(schema.accessProfiles.id, id), eq(schema.accessProfiles.productionId, productionId)));
    await recordAudit(db, { productionId, tableName: "access_profiles", recordId: id, action: "UPDATE", actor: user.id, before, after: { ...before, ...values } });
  });
}

export async function deleteProfile(productionId: string, id: string) {
  const user = await requireUser();
  await requireSecurityAdmin(productionId);
  await runAsUser(user.id, async (db) => {
    const [before] = await db
      .select()
      .from(schema.accessProfiles)
      .where(and(eq(schema.accessProfiles.id, id), eq(schema.accessProfiles.productionId, productionId)))
      .limit(1);
    await db
      .update(schema.accessProfiles)
      .set({ deletedAt: new Date(), deletedBy: user.id })
      .where(and(eq(schema.accessProfiles.id, id), eq(schema.accessProfiles.productionId, productionId)));
    await recordAudit(db, { productionId, tableName: "access_profiles", recordId: id, action: "DELETE", actor: user.id, before, after: null });
  });
}

// ============================================================================
// Access Profile Rules — one allowed-resource rule within a profile.
// ============================================================================

export interface ProfileRuleInput {
  profileId: string;
  resourceId: string;
  daysOfWeek: DayOfWeek[] | null;
  timeStart: string | null;
  timeEnd: string | null;
  minimumAssuranceLevel: AssuranceLevel | null;
  escortRequired: boolean;
}

function validateProfileRule(input: ProfileRuleInput) {
  if (!input.profileId) throw new Error("Choose which profile this rule belongs to.");
  if (!input.resourceId) throw new Error("Choose which resource this rule allows.");
  const timeStart = input.timeStart?.trim() || null;
  const timeEnd = input.timeEnd?.trim() || null;
  if (timeStart && timeEnd && timeStart > timeEnd) throw new Error("Time start must be before time end.");
  return {
    profileId: input.profileId,
    resourceId: input.resourceId,
    daysOfWeek: input.daysOfWeek && input.daysOfWeek.length > 0 ? input.daysOfWeek : null,
    timeStart,
    timeEnd,
    minimumAssuranceLevel: input.minimumAssuranceLevel,
    escortRequired: input.escortRequired,
  };
}

export async function createProfileRule(productionId: string, input: ProfileRuleInput) {
  const user = await requireUser();
  await requireSecurityAdmin(productionId);
  const values = validateProfileRule(input);
  const id = crypto.randomUUID();
  await runAsUser(user.id, async (db) => {
    await db.insert(schema.accessProfileRules).values({ id, productionId, ...values });
    await recordAudit(db, { productionId, tableName: "access_profile_rules", recordId: id, action: "INSERT", actor: user.id, after: { id, productionId, ...values } });
  });
  return id;
}

export async function updateProfileRule(productionId: string, id: string, input: ProfileRuleInput) {
  const user = await requireUser();
  await requireSecurityAdmin(productionId);
  const values = validateProfileRule(input);
  await runAsUser(user.id, async (db) => {
    const [before] = await db
      .select()
      .from(schema.accessProfileRules)
      .where(and(eq(schema.accessProfileRules.id, id), eq(schema.accessProfileRules.productionId, productionId)))
      .limit(1);
    await db.update(schema.accessProfileRules).set(values).where(and(eq(schema.accessProfileRules.id, id), eq(schema.accessProfileRules.productionId, productionId)));
    await recordAudit(db, { productionId, tableName: "access_profile_rules", recordId: id, action: "UPDATE", actor: user.id, before, after: { ...before, ...values } });
  });
}

export async function deleteProfileRule(productionId: string, id: string) {
  const user = await requireUser();
  await requireSecurityAdmin(productionId);
  await runAsUser(user.id, async (db) => {
    const [before] = await db
      .select()
      .from(schema.accessProfileRules)
      .where(and(eq(schema.accessProfileRules.id, id), eq(schema.accessProfileRules.productionId, productionId)))
      .limit(1);
    await db
      .update(schema.accessProfileRules)
      .set({ deletedAt: new Date(), deletedBy: user.id })
      .where(and(eq(schema.accessProfileRules.id, id), eq(schema.accessProfileRules.productionId, productionId)));
    await recordAudit(db, { productionId, tableName: "access_profile_rules", recordId: id, action: "DELETE", actor: user.id, before, after: null });
  });
}

// ============================================================================
// Access Identity Profiles — assign/unassign only, never edited in place
// (matches migration 0026's own header comment).
// ============================================================================

export interface IdentityProfileInput {
  identityId: string;
  profileId: string;
}

export async function assignProfile(productionId: string, input: IdentityProfileInput) {
  const user = await requireUser();
  await requireSecurityAdmin(productionId);
  if (!input.identityId) throw new Error("Choose which identity to assign.");
  if (!input.profileId) throw new Error("Choose which profile to assign.");
  const id = crypto.randomUUID();
  await runAsUser(user.id, async (db) => {
    const row = { id, productionId, identityId: input.identityId, profileId: input.profileId, assignedBy: user.id };
    await db.insert(schema.accessIdentityProfiles).values(row);
    await recordAudit(db, { productionId, tableName: "access_identity_profiles", recordId: id, action: "INSERT", actor: user.id, after: row });
  });
  return id;
}

export async function unassignProfile(productionId: string, id: string) {
  const user = await requireUser();
  await requireSecurityAdmin(productionId);
  await runAsUser(user.id, async (db) => {
    const [before] = await db
      .select()
      .from(schema.accessIdentityProfiles)
      .where(and(eq(schema.accessIdentityProfiles.id, id), eq(schema.accessIdentityProfiles.productionId, productionId)))
      .limit(1);
    await db
      .update(schema.accessIdentityProfiles)
      .set({ deletedAt: new Date(), deletedBy: user.id })
      .where(and(eq(schema.accessIdentityProfiles.id, id), eq(schema.accessIdentityProfiles.productionId, productionId)));
    await recordAudit(db, { productionId, tableName: "access_identity_profiles", recordId: id, action: "DELETE", actor: user.id, before, after: null });
  });
}

// ============================================================================
// Access Grants — direct, individual resource overrides. §9.
// ============================================================================

export interface GrantInput {
  identityId: string;
  resourceId: string;
  validFrom: string | null;
  validUntil: string | null;
  daysOfWeek: DayOfWeek[] | null;
  timeStart: string | null;
  timeEnd: string | null;
  reason: string | null;
}

function validateGrant(input: GrantInput) {
  if (!input.identityId) throw new Error("Choose which identity this grant is for.");
  if (!input.resourceId) throw new Error("Choose which resource this grant allows.");
  const validFrom = input.validFrom?.trim() ? new Date(input.validFrom) : null;
  const validUntil = input.validUntil?.trim() ? new Date(input.validUntil) : null;
  if (validFrom && validUntil && validFrom > validUntil) throw new Error("Valid-from must be before valid-until.");
  const timeStart = input.timeStart?.trim() || null;
  const timeEnd = input.timeEnd?.trim() || null;
  if (timeStart && timeEnd && timeStart > timeEnd) throw new Error("Time start must be before time end.");
  return {
    identityId: input.identityId,
    resourceId: input.resourceId,
    validFrom,
    validUntil,
    daysOfWeek: input.daysOfWeek && input.daysOfWeek.length > 0 ? input.daysOfWeek : null,
    timeStart,
    timeEnd,
    reason: input.reason?.trim() || null,
  };
}

export async function createGrant(productionId: string, input: GrantInput) {
  const user = await requireUser();
  await requireSecurityAdmin(productionId);
  const values = validateGrant(input);
  const id = crypto.randomUUID();
  await runAsUser(user.id, async (db) => {
    const row = { id, productionId, grantedBy: user.id, ...values };
    await db.insert(schema.accessGrants).values(row);
    await recordAudit(db, { productionId, tableName: "access_grants", recordId: id, action: "INSERT", actor: user.id, after: row });
  });
  return id;
}

export async function updateGrant(productionId: string, id: string, input: GrantInput) {
  const user = await requireUser();
  await requireSecurityAdmin(productionId);
  const values = validateGrant(input);
  await runAsUser(user.id, async (db) => {
    const [before] = await db
      .select()
      .from(schema.accessGrants)
      .where(and(eq(schema.accessGrants.id, id), eq(schema.accessGrants.productionId, productionId)))
      .limit(1);
    await db.update(schema.accessGrants).set(values).where(and(eq(schema.accessGrants.id, id), eq(schema.accessGrants.productionId, productionId)));
    await recordAudit(db, { productionId, tableName: "access_grants", recordId: id, action: "UPDATE", actor: user.id, before, after: { ...before, ...values } });
  });
}

export async function deleteGrant(productionId: string, id: string) {
  const user = await requireUser();
  await requireSecurityAdmin(productionId);
  await runAsUser(user.id, async (db) => {
    const [before] = await db
      .select()
      .from(schema.accessGrants)
      .where(and(eq(schema.accessGrants.id, id), eq(schema.accessGrants.productionId, productionId)))
      .limit(1);
    await db
      .update(schema.accessGrants)
      .set({ deletedAt: new Date(), deletedBy: user.id })
      .where(and(eq(schema.accessGrants.id, id), eq(schema.accessGrants.productionId, productionId)));
    await recordAudit(db, { productionId, tableName: "access_grants", recordId: id, action: "DELETE", actor: user.id, before, after: null });
  });
}

// ============================================================================
// Access Restrictions — explicit blocks, override grants. §31.
// ============================================================================

export interface RestrictionInput {
  identityId: string;
  resourceId: string | null;
  reason: string;
  validFrom: string | null;
  validUntil: string | null;
}

function validateRestriction(input: RestrictionInput) {
  if (!input.identityId) throw new Error("Choose which identity this restriction applies to.");
  const reason = input.reason.trim();
  if (!reason) throw new Error("A reason is required for a restriction.");
  const validFrom = input.validFrom?.trim() ? new Date(input.validFrom) : null;
  const validUntil = input.validUntil?.trim() ? new Date(input.validUntil) : null;
  if (validFrom && validUntil && validFrom > validUntil) throw new Error("Valid-from must be before valid-until.");
  return {
    identityId: input.identityId,
    resourceId: input.resourceId || null,
    reason,
    validFrom,
    validUntil,
  };
}

export async function createRestriction(productionId: string, input: RestrictionInput) {
  const user = await requireUser();
  await requireSecurityAdmin(productionId);
  const values = validateRestriction(input);
  const id = crypto.randomUUID();
  await runAsUser(user.id, async (db) => {
    const row = { id, productionId, createdBy: user.id, ...values };
    await db.insert(schema.accessRestrictions).values(row);
    await recordAudit(db, { productionId, tableName: "access_restrictions", recordId: id, action: "INSERT", actor: user.id, after: row });
  });
  return id;
}

export async function updateRestriction(productionId: string, id: string, input: RestrictionInput) {
  const user = await requireUser();
  await requireSecurityAdmin(productionId);
  const values = validateRestriction(input);
  await runAsUser(user.id, async (db) => {
    const [before] = await db
      .select()
      .from(schema.accessRestrictions)
      .where(and(eq(schema.accessRestrictions.id, id), eq(schema.accessRestrictions.productionId, productionId)))
      .limit(1);
    await db.update(schema.accessRestrictions).set(values).where(and(eq(schema.accessRestrictions.id, id), eq(schema.accessRestrictions.productionId, productionId)));
    await recordAudit(db, { productionId, tableName: "access_restrictions", recordId: id, action: "UPDATE", actor: user.id, before, after: { ...before, ...values } });
  });
}

export async function deleteRestriction(productionId: string, id: string) {
  const user = await requireUser();
  await requireSecurityAdmin(productionId);
  await runAsUser(user.id, async (db) => {
    const [before] = await db
      .select()
      .from(schema.accessRestrictions)
      .where(and(eq(schema.accessRestrictions.id, id), eq(schema.accessRestrictions.productionId, productionId)))
      .limit(1);
    await db
      .update(schema.accessRestrictions)
      .set({ deletedAt: new Date(), deletedBy: user.id })
      .where(and(eq(schema.accessRestrictions.id, id), eq(schema.accessRestrictions.productionId, productionId)));
    await recordAudit(db, { productionId, tableName: "access_restrictions", recordId: id, action: "DELETE", actor: user.id, before, after: null });
  });
}

// ============================================================================
// Access Temporary Grants — time-boxed requests with a request/approve
// workflow (requestedBy stamped at create; approvedBy stamped the first
// time status moves to APPROVED, mirroring stampStatusTransition above).
// ============================================================================

export interface TemporaryGrantInput {
  identityId: string;
  resourceId: string;
  validFrom: string;
  validUntil: string;
  reason: string | null;
  status: TemporaryGrantStatus;
}

function validateTemporaryGrant(input: TemporaryGrantInput) {
  if (!input.identityId) throw new Error("Choose which identity this request is for.");
  if (!input.resourceId) throw new Error("Choose which resource this request is for.");
  if (!input.validFrom?.trim()) throw new Error("Valid-from is required.");
  if (!input.validUntil?.trim()) throw new Error("Valid-until is required.");
  const validFrom = new Date(input.validFrom);
  const validUntil = new Date(input.validUntil);
  if (validFrom > validUntil) throw new Error("Valid-from must be before valid-until.");
  return {
    identityId: input.identityId,
    resourceId: input.resourceId,
    validFrom,
    validUntil,
    reason: input.reason?.trim() || null,
    status: input.status,
  };
}

function stampApproval(user: { id: string }, previousStatus: TemporaryGrantStatus | null, nextStatus: TemporaryGrantStatus): { approvedBy?: string } {
  if (nextStatus === "APPROVED" && previousStatus !== "APPROVED") return { approvedBy: user.id };
  return {};
}

export async function createTemporaryGrant(productionId: string, input: TemporaryGrantInput) {
  const user = await requireUser();
  await requireSecurityAdmin(productionId);
  const values = validateTemporaryGrant(input);
  const id = crypto.randomUUID();
  const stamps = stampApproval(user, null, values.status);
  await runAsUser(user.id, async (db) => {
    const row = { id, productionId, requestedBy: user.id, ...values, ...stamps };
    await db.insert(schema.accessTemporaryGrants).values(row);
    await recordAudit(db, { productionId, tableName: "access_temporary_grants", recordId: id, action: "INSERT", actor: user.id, after: row });
  });
  return id;
}

export async function updateTemporaryGrant(productionId: string, id: string, input: TemporaryGrantInput) {
  const user = await requireUser();
  await requireSecurityAdmin(productionId);
  const values = validateTemporaryGrant(input);
  await runAsUser(user.id, async (db) => {
    const [before] = await db
      .select()
      .from(schema.accessTemporaryGrants)
      .where(and(eq(schema.accessTemporaryGrants.id, id), eq(schema.accessTemporaryGrants.productionId, productionId)))
      .limit(1);
    const stamps = stampApproval(user, (before?.status as TemporaryGrantStatus) ?? null, values.status);
    await db
      .update(schema.accessTemporaryGrants)
      .set({ ...values, ...stamps })
      .where(and(eq(schema.accessTemporaryGrants.id, id), eq(schema.accessTemporaryGrants.productionId, productionId)));
    await recordAudit(db, { productionId, tableName: "access_temporary_grants", recordId: id, action: "UPDATE", actor: user.id, before, after: { ...before, ...values, ...stamps } });
  });
}

export async function deleteTemporaryGrant(productionId: string, id: string) {
  const user = await requireUser();
  await requireSecurityAdmin(productionId);
  await runAsUser(user.id, async (db) => {
    const [before] = await db
      .select()
      .from(schema.accessTemporaryGrants)
      .where(and(eq(schema.accessTemporaryGrants.id, id), eq(schema.accessTemporaryGrants.productionId, productionId)))
      .limit(1);
    await db
      .update(schema.accessTemporaryGrants)
      .set({ deletedAt: new Date(), deletedBy: user.id })
      .where(and(eq(schema.accessTemporaryGrants.id, id), eq(schema.accessTemporaryGrants.productionId, productionId)));
    await recordAudit(db, { productionId, tableName: "access_temporary_grants", recordId: id, action: "DELETE", actor: user.id, before, after: null });
  });
}

// ============================================================================
// Scan verification — the actual "scan a badge and get an allow/deny" flow.
// Any production member may operate the scanner (matching access_events'
// own RLS: is_production_member, not Producer-only) — a security guard
// running the gate doesn't need to be a Producer to check someone in.
// ============================================================================

export interface ScanInput {
  checkpointId: string;
  deviceId: string;
  publicReference: string;
  direction: AccessDirection | null;
}

export interface ScanOutcome {
  allowed: boolean;
  decision: "ALLOW" | "DENY" | "WARN";
  reasonCode: string;
  reason: string;
  escortRequired: boolean;
}

/**
 * Runs evaluateAccess() (packages/auth) against freshly-resolved database
 * state and records the outcome to access_events — the append-only
 * verification ledger 0025/0026 reserved for exactly this. No audit-log
 * entry: access_events already IS this domain's own immutable trail for
 * scan decisions (see migration 0029's header comment), so writing to
 * access_audit_log too would just duplicate it.
 */
export async function verifyAccess(productionId: string, input: ScanInput): Promise<ScanOutcome> {
  const user = await requireUser();
  await requireProductionMember(productionId);
  const publicReference = input.publicReference.trim();
  if (!publicReference) throw new Error("Scan or enter a credential reference.");
  if (!input.checkpointId) throw new Error("Choose which checkpoint this scan is at.");
  if (!input.deviceId) throw new Error("Choose which device is performing this scan.");

  return runAsUser(user.id, async (db) => {
    const resolution = await resolveAndEvaluateAccess(db, {
      productionId,
      checkpointId: input.checkpointId,
      deviceId: input.deviceId,
      publicReference,
      requestedDirection: input.direction,
    });

    // resourceId is only null when the device or checkpoint itself failed to
    // resolve (both NOT NULL FKs on access_events) — see resolveAndEvaluateAccess's
    // own comment. That's an edge case (the operator picked from a live
    // dropdown), not the ordinary deny path, so there is nothing to log.
    if (resolution.resourceId) {
      await db.insert(schema.accessEvents).values({
        id: crypto.randomUUID(),
        productionId,
        identityId: resolution.identityId,
        credentialId: resolution.credentialId,
        deviceId: input.deviceId,
        checkpointId: input.checkpointId,
        resourceId: resolution.resourceId,
        operatorUserId: user.id,
        eventType: "ACCESS_ATTEMPT",
        direction: input.direction,
        decision: resolution.decision.decision,
        reasonCode: resolution.decision.reasonCode,
        policySnapshot: { checkpointId: input.checkpointId, deviceId: input.deviceId },
      });
    }

    return {
      allowed: resolution.decision.allowed,
      decision: resolution.decision.decision,
      reasonCode: resolution.decision.reasonCode,
      reason: resolution.decision.reason,
      escortRequired: resolution.decision.escortRequired,
    };
  });
}
