import "server-only";
import type {
  AccessDecision,
  AccessDirection,
  AccessRestrictionContext,
  AntiPassbackMode,
  AssuranceLevel,
  CredentialStatus,
  DayCode,
  DeviceStatus,
  DirectionMode,
  EffectiveAccessGrant,
} from "@filmset/auth/access-control";
import { evaluateAccess } from "@filmset/auth/access-control";
import type { Tx } from "@filmset/db/server";
import { schema } from "@filmset/db/server";
import { and, desc, eq, inArray, isNull } from "drizzle-orm";

export interface ScanInput {
  productionId: string;
  checkpointId: string;
  deviceId: string;
  publicReference: string;
  requestedDirection: AccessDirection | null;
}

export interface ScanResolution {
  decision: AccessDecision;
  identityId: string | null;
  credentialId: string | null;
  /** checkpoint.resourceId, unaffected by whether the resource row itself resolved — see this function's own comment. */
  resourceId: string | null;
}

/**
 * Resolves every input evaluateAccess() (packages/auth) needs straight
 * from the database, then calls it — the policy engine itself stays
 * DB-agnostic. Everything a soft-delete has since removed from view
 * (deleted_at is not null) is treated exactly like it never existed,
 * which is what makes a soft-deleted credential/identity/resource/grant
 * stop working immediately without the app needing a second code path.
 *
 * resourceId in the return value comes from checkpoint.resourceId
 * directly, not from the (possibly null, if soft-deleted) resource row
 * — access_events.resource_id is NOT NULL and only needs a resource to
 * still exist as a row, not to still be active/undeleted.
 */
export async function resolveAndEvaluateAccess(db: Tx, input: ScanInput): Promise<ScanResolution> {
  const { productionId, checkpointId, deviceId, publicReference, requestedDirection } = input;

  const [deviceRow] = await db
    .select()
    .from(schema.accessDevices)
    .where(and(eq(schema.accessDevices.id, deviceId), eq(schema.accessDevices.productionId, productionId), isNull(schema.accessDevices.deletedAt)))
    .limit(1);

  const [checkpointRow] = await db
    .select()
    .from(schema.accessCheckpoints)
    .where(and(eq(schema.accessCheckpoints.id, checkpointId), eq(schema.accessCheckpoints.productionId, productionId), isNull(schema.accessCheckpoints.deletedAt)))
    .limit(1);

  const [credentialRow] = await db
    .select()
    .from(schema.accessCredentials)
    .where(
      and(
        eq(schema.accessCredentials.publicReference, publicReference),
        eq(schema.accessCredentials.productionId, productionId),
        isNull(schema.accessCredentials.deletedAt),
      ),
    )
    .limit(1);

  const [identityRow] = credentialRow
    ? await db
        .select()
        .from(schema.accessIdentities)
        .where(
          and(
            eq(schema.accessIdentities.id, credentialRow.identityId),
            eq(schema.accessIdentities.productionId, productionId),
            isNull(schema.accessIdentities.deletedAt),
          ),
        )
        .limit(1)
    : [undefined];

  const [resourceRow] = checkpointRow
    ? await db
        .select()
        .from(schema.accessResources)
        .where(
          and(
            eq(schema.accessResources.id, checkpointRow.resourceId),
            eq(schema.accessResources.productionId, productionId),
            isNull(schema.accessResources.deletedAt),
          ),
        )
        .limit(1)
    : [undefined];

  const restrictions: AccessRestrictionContext[] =
    identityRow && checkpointRow
      ? (
          await db
            .select({
              resourceId: schema.accessRestrictions.resourceId,
              validFrom: schema.accessRestrictions.validFrom,
              validUntil: schema.accessRestrictions.validUntil,
            })
            .from(schema.accessRestrictions)
            .where(
              and(
                eq(schema.accessRestrictions.identityId, identityRow.id),
                eq(schema.accessRestrictions.productionId, productionId),
                isNull(schema.accessRestrictions.deletedAt),
              ),
            )
        ).filter((r) => r.resourceId === null || r.resourceId === checkpointRow.resourceId)
      : [];

  const grants: EffectiveAccessGrant[] =
    identityRow && checkpointRow ? await resolveEffectiveGrants(db, productionId, identityRow.id, checkpointRow.resourceId) : [];

  const lastEventDirection =
    identityRow && checkpointRow ? await resolveLastEventDirection(db, productionId, identityRow.id, checkpointRow.id) : null;

  const decision = evaluateAccess({
    productionId,
    device: deviceRow ? { id: deviceRow.id, productionId: deviceRow.productionId, status: deviceRow.status as DeviceStatus } : null,
    checkpoint: checkpointRow
      ? {
          id: checkpointRow.id,
          productionId: checkpointRow.productionId,
          resourceId: checkpointRow.resourceId,
          active: checkpointRow.active,
          directionMode: checkpointRow.directionMode as DirectionMode,
          antiPassbackMode: checkpointRow.antiPassbackMode as AntiPassbackMode,
        }
      : null,
    credential: credentialRow
      ? {
          id: credentialRow.id,
          productionId: credentialRow.productionId,
          identityId: credentialRow.identityId,
          status: credentialRow.status as CredentialStatus,
          assuranceLevel: credentialRow.assuranceLevel as AssuranceLevel,
          validFrom: credentialRow.validFrom,
          validUntil: credentialRow.validUntil,
        }
      : null,
    identity: identityRow ? { id: identityRow.id, productionId: identityRow.productionId, active: identityRow.active } : null,
    resource: resourceRow
      ? {
          id: resourceRow.id,
          productionId: resourceRow.productionId,
          active: resourceRow.active,
          minimumAssuranceLevel: resourceRow.minimumAssuranceLevel as AssuranceLevel,
        }
      : null,
    requestedDirection,
    restrictions,
    grants,
    lastEventDirection,
  });

  return {
    decision,
    identityId: identityRow?.id ?? null,
    credentialId: credentialRow?.id ?? null,
    resourceId: checkpointRow?.resourceId ?? null,
  };
}

/**
 * Flattens the three ways an identity can be allowed at a resource —
 * a profile's rules (via its assignment), a direct individual grant, and
 * an approved temporary grant — into evaluateAccess's one common shape.
 * See EffectiveAccessGrant's own doc comment for why this resolution
 * lives here and not in the policy engine itself.
 */
async function resolveEffectiveGrants(db: Tx, productionId: string, identityId: string, resourceId: string): Promise<EffectiveAccessGrant[]> {
  const direct = await db
    .select({
      resourceId: schema.accessGrants.resourceId,
      validFrom: schema.accessGrants.validFrom,
      validUntil: schema.accessGrants.validUntil,
      daysOfWeek: schema.accessGrants.daysOfWeek,
      timeStart: schema.accessGrants.timeStart,
      timeEnd: schema.accessGrants.timeEnd,
    })
    .from(schema.accessGrants)
    .where(
      and(
        eq(schema.accessGrants.identityId, identityId),
        eq(schema.accessGrants.resourceId, resourceId),
        eq(schema.accessGrants.productionId, productionId),
        isNull(schema.accessGrants.deletedAt),
      ),
    );

  const assignedProfiles = await db
    .select({ profileId: schema.accessIdentityProfiles.profileId })
    .from(schema.accessIdentityProfiles)
    .where(
      and(
        eq(schema.accessIdentityProfiles.identityId, identityId),
        eq(schema.accessIdentityProfiles.productionId, productionId),
        isNull(schema.accessIdentityProfiles.deletedAt),
      ),
    );

  const profileRules =
    assignedProfiles.length > 0
      ? await db
          .select({
            resourceId: schema.accessProfileRules.resourceId,
            daysOfWeek: schema.accessProfileRules.daysOfWeek,
            timeStart: schema.accessProfileRules.timeStart,
            timeEnd: schema.accessProfileRules.timeEnd,
            minimumAssuranceLevel: schema.accessProfileRules.minimumAssuranceLevel,
            escortRequired: schema.accessProfileRules.escortRequired,
          })
          .from(schema.accessProfileRules)
          .where(
            and(
              inArray(
                schema.accessProfileRules.profileId,
                assignedProfiles.map((p) => p.profileId),
              ),
              eq(schema.accessProfileRules.resourceId, resourceId),
              eq(schema.accessProfileRules.productionId, productionId),
              isNull(schema.accessProfileRules.deletedAt),
            ),
          )
      : [];

  const temporary = await db
    .select({
      resourceId: schema.accessTemporaryGrants.resourceId,
      validFrom: schema.accessTemporaryGrants.validFrom,
      validUntil: schema.accessTemporaryGrants.validUntil,
    })
    .from(schema.accessTemporaryGrants)
    .where(
      and(
        eq(schema.accessTemporaryGrants.identityId, identityId),
        eq(schema.accessTemporaryGrants.resourceId, resourceId),
        eq(schema.accessTemporaryGrants.productionId, productionId),
        eq(schema.accessTemporaryGrants.status, "APPROVED"),
        isNull(schema.accessTemporaryGrants.deletedAt),
      ),
    );

  return [
    ...direct.map(
      (g): EffectiveAccessGrant => ({
        resourceId: g.resourceId,
        validFrom: g.validFrom,
        validUntil: g.validUntil,
        daysOfWeek: (g.daysOfWeek as DayCode[] | null) ?? null,
        timeStart: g.timeStart,
        timeEnd: g.timeEnd,
        minimumAssuranceLevel: null,
        escortRequired: false,
      }),
    ),
    ...profileRules.map(
      (r): EffectiveAccessGrant => ({
        resourceId: r.resourceId,
        validFrom: null,
        validUntil: null,
        daysOfWeek: (r.daysOfWeek as DayCode[] | null) ?? null,
        timeStart: r.timeStart,
        timeEnd: r.timeEnd,
        minimumAssuranceLevel: (r.minimumAssuranceLevel as AssuranceLevel | null) ?? null,
        escortRequired: r.escortRequired,
      }),
    ),
    ...temporary.map(
      (t): EffectiveAccessGrant => ({
        resourceId: t.resourceId,
        validFrom: t.validFrom,
        validUntil: t.validUntil,
        daysOfWeek: null,
        timeStart: null,
        timeEnd: null,
        minimumAssuranceLevel: null,
        escortRequired: false,
      }),
    ),
  ];
}

/** The direction of this identity's most recent successful (ALLOW/WARN) event at this checkpoint — anti-passback's own memory. */
async function resolveLastEventDirection(db: Tx, productionId: string, identityId: string, checkpointId: string): Promise<AccessDirection | null> {
  const [row] = await db
    .select({ direction: schema.accessEvents.direction })
    .from(schema.accessEvents)
    .where(
      and(
        eq(schema.accessEvents.identityId, identityId),
        eq(schema.accessEvents.checkpointId, checkpointId),
        eq(schema.accessEvents.productionId, productionId),
        inArray(schema.accessEvents.decision, ["ALLOW", "WARN"]),
      ),
    )
    .orderBy(desc(schema.accessEvents.occurredAt))
    .limit(1);
  return (row?.direction as AccessDirection | null) ?? null;
}
