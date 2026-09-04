"use server";

import { requireProductionMember } from "@/lib/authz";
import { issueNextEntityNumber, peekNextEntityNumber } from "@/lib/id-registry";
import { requireUser } from "@filmset/auth/server";
import { runAsUser, schema } from "@filmset/db/server";
import { and, eq } from "drizzle-orm";
import crypto from "node:crypto";
import type {
  AssuranceLevel,
  AntiPassbackMode,
  CredentialStatus,
  CredentialType,
  DeviceStatus,
  DeviceType,
  DirectionMode,
  OccupancyPolicy,
  OfflinePolicy,
  PersonCategory,
  ResourceType,
  SecurityClass,
  SecurityLevel,
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
  await runAsUser(user.id, (db) => db.insert(schema.accessIdentities).values({ id, productionId, ...values }));
  return id;
}

export async function updateIdentity(productionId: string, id: string, input: IdentityInput) {
  const user = await requireUser();
  await requireSecurityAdmin(productionId);
  const values = validateIdentity(input);
  await runAsUser(user.id, (db) =>
    db.update(schema.accessIdentities).set(values).where(and(eq(schema.accessIdentities.id, id), eq(schema.accessIdentities.productionId, productionId))),
  );
}

export async function deleteIdentity(productionId: string, id: string) {
  const user = await requireUser();
  await requireSecurityAdmin(productionId);
  await runAsUser(user.id, (db) =>
    db.delete(schema.accessIdentities).where(and(eq(schema.accessIdentities.id, id), eq(schema.accessIdentities.productionId, productionId))),
  );
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
    await db.insert(schema.accessCredentials).values({ id, productionId, publicReference: generatePublicReference(), ...values, credentialNumber });
  });
  return id;
}

export async function updateCredential(productionId: string, id: string, input: CredentialInput) {
  const user = await requireUser();
  await requireSecurityAdmin(productionId);
  const values = validateCredential(input);
  if (!values.credentialNumber) throw new Error("Credential number is required.");
  await runAsUser(user.id, (db) =>
    db.update(schema.accessCredentials).set(values).where(and(eq(schema.accessCredentials.id, id), eq(schema.accessCredentials.productionId, productionId))),
  );
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
  await runAsUser(user.id, (db) =>
    db.delete(schema.accessCredentials).where(and(eq(schema.accessCredentials.id, id), eq(schema.accessCredentials.productionId, productionId))),
  );
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
    await db.insert(schema.accessResources).values({ id, productionId, ...values, code });
  });
  return id;
}

export async function updateResource(productionId: string, id: string, input: ResourceInput) {
  const user = await requireUser();
  await requireSecurityAdmin(productionId);
  const values = validateResource(input);
  if (values.parentResourceId === id) throw new Error("A resource can't be its own parent.");
  await runAsUser(user.id, (db) =>
    db.update(schema.accessResources).set(values).where(and(eq(schema.accessResources.id, id), eq(schema.accessResources.productionId, productionId))),
  );
}

export async function deleteResource(productionId: string, id: string) {
  const user = await requireUser();
  await requireSecurityAdmin(productionId);
  await runAsUser(user.id, (db) =>
    db.delete(schema.accessResources).where(and(eq(schema.accessResources.id, id), eq(schema.accessResources.productionId, productionId))),
  );
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
    await db.insert(schema.accessCheckpoints).values({ id, productionId, ...values, code });
  });
  return id;
}

export async function updateCheckpoint(productionId: string, id: string, input: CheckpointInput) {
  const user = await requireUser();
  await requireSecurityAdmin(productionId);
  const values = validateCheckpoint(input);
  await runAsUser(user.id, (db) =>
    db.update(schema.accessCheckpoints).set(values).where(and(eq(schema.accessCheckpoints.id, id), eq(schema.accessCheckpoints.productionId, productionId))),
  );
}

export async function deleteCheckpoint(productionId: string, id: string) {
  const user = await requireUser();
  await requireSecurityAdmin(productionId);
  await runAsUser(user.id, (db) =>
    db.delete(schema.accessCheckpoints).where(and(eq(schema.accessCheckpoints.id, id), eq(schema.accessCheckpoints.productionId, productionId))),
  );
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
  await runAsUser(user.id, (db) => db.insert(schema.accessDevices).values({ id, productionId, ...values, ...stamps }));
  return id;
}

export async function updateDevice(productionId: string, id: string, input: DeviceInput) {
  const user = await requireUser();
  await requireSecurityAdmin(productionId);
  const values = validateDevice(input);
  await runAsUser(user.id, async (db) => {
    const [existing] = await db
      .select({ status: schema.accessDevices.status })
      .from(schema.accessDevices)
      .where(and(eq(schema.accessDevices.id, id), eq(schema.accessDevices.productionId, productionId)))
      .limit(1);
    const stamps = stampStatusTransition(user, (existing?.status as DeviceStatus) ?? null, values.status);
    await db
      .update(schema.accessDevices)
      .set({ ...values, ...stamps })
      .where(and(eq(schema.accessDevices.id, id), eq(schema.accessDevices.productionId, productionId)));
  });
}

export async function deleteDevice(productionId: string, id: string) {
  const user = await requireUser();
  await requireSecurityAdmin(productionId);
  await runAsUser(user.id, (db) =>
    db.delete(schema.accessDevices).where(and(eq(schema.accessDevices.id, id), eq(schema.accessDevices.productionId, productionId))),
  );
}
