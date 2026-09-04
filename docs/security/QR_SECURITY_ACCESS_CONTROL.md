# Security & Access — QR Security

See `docs/security/access-control/README.md` for the reading order.

## What a QR code is allowed to encode

The **only** thing a QR code for this module is ever meant to encode is
`access_credentials.public_reference` — a high-entropy, non-sequential,
globally-unique opaque string. Globally unique (not merely unique within a
production) so a scanner can resolve it without first knowing which
production it belongs to.

No name, photo, department, contact information, or any other personnel
data is ever encoded in the QR itself, and none of that data lives on
`access_credentials` — that table exists precisely so scanning a QR alone
can never leak PII, even to someone who captures the raw code image. This
is a hard design constraint from the owner's spec, not an optimization.

## Verification must always be server-mediated

A scan resolves `public_reference` through a server-side verification path
(to be built in a later phase — no such endpoint exists in Phase A) that
looks up the credential, its identity, the checkpoint, the device, and
calls `evaluateAccess()` (`ACCESS_POLICY_ACCESS_CONTROL.md`). It is never a
direct client read of `access_credentials` or any other table in this
domain — RLS on these tables is read-only for authenticated production
members precisely so a scanning device's own client can't be the thing
deciding access; only a server-side path that has actually run the policy
engine can.

## Credential number vs. public reference

`access_credentials` deliberately has two distinct identifiers:

- `credential_number` — a human-readable badge number (e.g.
  `VMPA-CR-000482`), searchable by admins in a future UI, meant for
  visual/manual reference on a printed badge. **Never** encoded in the QR.
- `public_reference` — the opaque value the QR actually carries. Never
  shown to a human as the "badge number"; never predictable from
  `credential_number` or from another credential's `public_reference`
  (sequential numbering would let an attacker enumerate valid credentials).

## Credential lifecycle as the real security boundary

Because the QR itself carries no meaningful secret beyond "this opaque
string exists," the real security boundary is the credential's `status`
lifecycle (`DRAFT → PENDING_APPROVAL → ACTIVE → SUSPENDED/LOST/REVOKED/
EXPIRED/REPLACED`) plus `assurance_level`. A lost or stolen badge is
neutralized by moving its credential to `LOST`/`REVOKED` — a decision that
takes effect immediately for every future scan, since `evaluateAccess()`
checks `status` before granting anything (`ACCESS_POLICY_ACCESS_CONTROL.md`
§evaluation order, step 3). `replaced_by_credential_id` lets an admin issue
a new credential to the same identity without losing the audit trail
linking the old one to its replacement.

## Assurance levels

`assurance_level` (`LEVEL_1_BASIC` → `LEVEL_5_HIGH`) is an explicit,
ordered axis, independent of credential *type* (`QR`, `BARCODE`, `NFC`,
`SMART_CARD`, `MOBILE`, `BLE`, `PIN`, `EXTERNAL`). A resource can require a
minimum assurance level (`access_resources.minimum_assurance_level`)
stricter than a plain static QR can satisfy, forcing a higher-assurance
credential type for sensitive resources — this is schema-ready today even
though Phase A implements no dynamic/rotating QR mechanism yet. A future
phase implementing `LEVEL_3_DYNAMIC` (time-rotating QR) or higher does so
without any schema change to this table.

## Explicitly not in scope

No NFC/DESFire/OSDP hardware integration, no biometric binding of a
credential to a face/fingerprint, in this release (owner's spec §84, see
`THREAT_MODEL_ACCESS_CONTROL.md`).
