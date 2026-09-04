# Security & Access — Policy Engine

See `docs/security/access-control/README.md` for the reading order. This
documents `packages/auth/src/access-control.ts`'s `evaluateAccess()` — the
single decision function for physical access, mirroring
`packages/auth/src/authorize.ts`'s exact architecture (pure, synchronous,
no database access, fully unit-tested without a database in
`access-control.test.ts`).

## Phase A status

`evaluateAccess()` exists and is unit-tested, but **nothing calls it yet**.
Resolving an `EvaluateAccessInput` from `access_identities` /
`access_credentials` / `access_checkpoints` / `access_devices` /
`access_grants` / `access_restrictions` / `access_profile_rules` /
`access_temporary_grants` / `access_events` is separate, later-phase,
schema-specific work — this module stays DB-agnostic on purpose, exactly
like `authorize.ts` does today.

## Shape

```
evaluateAccess(input: EvaluateAccessInput, now: Date = new Date()): AccessDecision
```

`AccessDecision` is always one of `ALLOW`, `WARN` (allowed, but flagged —
currently only anti-passback WARN mode produces this), or `DENY`, each
carrying a machine-readable `reasonCode` and a human-readable `reason`.
Never a partial or ambiguous result.

## Division of labor with the caller

Exactly like `authorize.ts`'s `AuthorizationPrincipal`, the caller resolves
everything before calling — `evaluateAccess()` never queries anything. In
particular:

- `input.restrictions` must already be narrowed to this identity, with
  `resourceId` either `null` (blanket) or equal to the checkpoint's
  resource.
- `input.grants` must already be the flattened union of applicable
  `access_profile_rules` (via `access_identity_profiles`), `access_grants`,
  and `access_temporary_grants` (status `APPROVED` only) for this identity,
  narrowed to the checkpoint's resource. Resource-hierarchy resolution
  (e.g. a grant on a parent zone implying access to a child room) is a
  future-phase concern for whatever builds this resolution step — the pure
  function itself has no opinion on the resource tree.
- `input.lastEventDirection` is this identity's last `ALLOW`/`WARN`
  direction at this checkpoint, for anti-passback.

## Evaluation order (owner's spec §10)

Cheapest/most-decisive checks first, so a DENY short-circuits before any
identity data is even considered:

1. **Device trust** — not found / wrong production / not `TRUSTED` /
   `SUSPENDED` / `REVOKED`.
2. **Checkpoint** — not found / wrong production / inactive / requested
   direction not permitted by `directionMode`.
3. **Credential lifecycle** — not found / wrong production / every
   non-`ACTIVE` status maps to its own reason code
   (`CREDENTIAL_SUSPENDED`, `CREDENTIAL_LOST`, `CREDENTIAL_REVOKED`,
   `CREDENTIAL_REPLACED`, `CREDENTIAL_EXPIRED`, `CREDENTIAL_NOT_ACTIVE` for
   `DRAFT`/`PENDING_APPROVAL`) — plus a `valid_from`/`valid_until` check
   even when status is `ACTIVE` (defense in depth against a status that
   hasn't been rolled over yet).
4. **Person / identity** — not found / wrong production / credential's
   `identityId` doesn't match the resolved identity / inactive.
5. **Resource + baseline assurance** — not found / wrong production /
   resource doesn't match the checkpoint's own `resourceId` (an
   `INTERNAL_ERROR` — this is a caller-consistency bug, not a real-world
   access scenario) / credential's `assuranceLevel` below the resource's
   `minimumAssuranceLevel`.
6. **Restrictions** — checked and can `DENY` (`RESTRICTED`) **before**
   grant matching runs at all. See "restrictions override grants" below.
7. **Resource active** — checked after restrictions so an explicit block
   always surfaces as `RESTRICTED`, never masked by `RESOURCE_INACTIVE`.
8. **Grant matching** — no grant at all covering this resource is
   `NO_GRANT`. Each candidate grant is tried in order; a grant fails its
   own date/time window (`GRANT_NOT_YET_VALID`, `GRANT_EXPIRED`,
   `OUTSIDE_ALLOWED_DAY`, `OUTSIDE_ALLOWED_TIME`) or its own stricter
   assurance requirement (`INSUFFICIENT_ASSURANCE`) without stopping
   evaluation — the next candidate is tried. The reported reason on a
   full `DENY` here is whichever failure the last-tried candidate hit.
9. **Anti-passback** — evaluated last, only once every other check has
   already passed. `OFF` never blocks. `DENY` blocks a repeated direction
   outright (`ANTI_PASSBACK_VIOLATION`). `WARN` still allows but returns
   decision `WARN` with `ANTI_PASSBACK_WARNING`.

## Restrictions override grants (owner's spec §31)

A restriction is checked, and can deny, **before** the function even looks
at whether a valid grant exists. A restriction with `resourceId = null`
blocks every resource in the production; one with a specific `resourceId`
blocks only that resource. A restriction outside its own
`validFrom`/`validUntil` window simply doesn't apply — it isn't treated as
present.

## Grant-level assurance override (owner's spec §9)

A grant's own `minimumAssuranceLevel`, when set, overrides the resource's
baseline **only when stricter** — enforced by requiring the credential to
satisfy both the resource's baseline (step 5) and, independently, each
candidate grant's own minimum (step 8) before that grant is allowed to
match.

## Reason codes

Every code in `AccessReasonCode` is reachable and covered by
`access-control.test.ts`: `ACCESS_ALLOWED`, `DEVICE_NOT_FOUND`,
`DEVICE_NOT_TRUSTED`, `DEVICE_SUSPENDED`, `DEVICE_REVOKED`,
`PRODUCTION_MISMATCH`, `CHECKPOINT_NOT_FOUND`, `CHECKPOINT_INACTIVE`,
`DIRECTION_NOT_ALLOWED`, `CREDENTIAL_NOT_FOUND`, `CREDENTIAL_NOT_ACTIVE`,
`CREDENTIAL_SUSPENDED`, `CREDENTIAL_LOST`, `CREDENTIAL_REVOKED`,
`CREDENTIAL_REPLACED`, `CREDENTIAL_EXPIRED`, `CREDENTIAL_NOT_YET_VALID`,
`IDENTITY_NOT_FOUND`, `IDENTITY_INACTIVE`, `IDENTITY_CREDENTIAL_MISMATCH`,
`INSUFFICIENT_ASSURANCE`, `RESTRICTED`, `RESOURCE_NOT_FOUND`,
`RESOURCE_INACTIVE`, `NO_GRANT`, `GRANT_NOT_YET_VALID`, `GRANT_EXPIRED`,
`OUTSIDE_ALLOWED_DAY`, `OUTSIDE_ALLOWED_TIME`, `ANTI_PASSBACK_VIOLATION`,
`ANTI_PASSBACK_WARNING`, `INTERNAL_ERROR`.

`access_events.reason_code` (a plain `text` column, deliberately not a DB
enum, since this vocabulary is expected to grow) is meant to store exactly
this value once a later phase wires the writing Server Action, and
`access_events.policy_snapshot` is meant to store enough of the matched
grant/profile/restriction identifiers that an administrator can reconstruct
*why* a specific decision was made after the fact (owner's spec §49).

## Invariants tested

- **Default-deny**: an input with nothing resolved (`device: null`,
  `checkpoint: null`, etc.) denies, not merely "unspecified."
- **Mutation safety**: `evaluateAccess()` never mutates its input.
- **Determinism**: identical inputs always produce an identical decision.
