# Security & Access — Device Trust

See `docs/security/access-control/README.md` for the reading order.

## Device trust and operator authentication are two separate axes

Every scanner is a first-class, individually trusted security principal in
its own right — `access_devices` — deliberately **not** conflated with
whichever FilmSet user is logged into it as an operator
(`access_checkpoints.requires_operator_confirmation` and
`access_devices.trusted_by`/`revoked_by` reference `profiles`, but a
device's own trust state is independent of any single operator's session).
A device can be trusted while different operators rotate through shifts
using it; revoking one operator's account does not, by itself, revoke the
device's trust, and vice versa. `evaluateAccess()` checks device trust
first, before checkpoint, credential, or identity — an untrusted device
denies before any identity data is even read
(`ACCESS_POLICY_ACCESS_CONTROL.md` §evaluation order, step 1).

## Device lifecycle

`access_devices.status`: `PENDING → TRUSTED → SUSPENDED/REVOKED`. A device
starts `PENDING` and can only reach `TRUSTED` through the enrollment flow
below — never by simply existing. `trusted_at`/`trusted_by` and
`revoked_at`/`revoked_by` record who made that trust decision and when,
for the same after-the-fact-accountability reason `access_events` records
`policy_snapshot`.

## Enrollment (owner's spec §14)

`access_device_enrollments` backs a short-lived, one-time, **hashed**
token flow:

1. An admin (future Phase B UI) generates a one-time enrollment token.
   Only its hash (`token_hash`) is ever stored — the raw token is
   generated and compared at the application layer, never persisted.
2. The token has a real `expires_at` and a `status` lifecycle
   (`PENDING → CONSUMED/EXPIRED/REVOKED`).
3. A device consumes an unexpired, still-`PENDING` token exactly once
   (`consumed_by_device_id`/`consumed_at`) to become `TRUSTED`. A token
   cannot be reused after consumption or after expiry.

This migration only shapes the table; generating/hashing/comparing tokens
and the enrollment UI are later-phase, application-layer work.

## Device metadata

`last_seen_at`/`last_sync_at`/`app_version`/`capabilities` (a constrained
`jsonb`) exist so a future admin view can answer "which devices are
online, on what app version, and what can they do" without a new table per
capability. `capabilities` is documented extensibility, not a dumping
ground for fields that should be real columns.

## Revocation propagation

Revoking a device (`REVOKED`) takes effect for any future *online*
verification immediately, since the server-side verification path
(`QR_SECURITY_ACCESS_CONTROL.md`) checks device status on every scan. What
happens to a device that already has offline-cached policy data at the
moment of revocation is covered in
`OFFLINE_EDGE_PLAN_ACCESS_CONTROL.md` — not solved by this schema alone.
