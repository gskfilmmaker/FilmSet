# Security & Access — Privacy

See `docs/security/access-control/README.md` for the reading order.

## What personal data this module holds

- **`access_identities`**: for `EXTERNAL` identities only, `display_name`,
  `company`, `photo_path`. For `CAST`/`CREW` identities, no new personal
  data at all — the row is a pointer (`cast_member_id`/`crew_member_id`)
  into the existing person record, which this module never copies.
- **`access_visitor_details`**: `purpose`, `vehicle_info` — visit-specific
  context, not identity data.
- **`access_incidents`**: free-text `title`/`description` fields that
  could, depending on what a reporter writes, contain personal data about
  the people involved. This is inherent to incident reporting and not
  something the schema can constrain away; a future phase's UI/retention
  policy is the actual control point.
- **`access_events`**: no direct PII columns (identity is referenced by
  `identity_id`, not duplicated), but is, by nature, a record of where a
  specific identity was and when — the most sensitive data this module
  produces even though no single column looks sensitive.

## What this module deliberately does not hold

- **No credential ever carries PII.** See `QR_SECURITY_ACCESS_CONTROL.md`
  — `access_credentials` has no name/photo/contact columns at all, by
  design, so a compromised QR or a leaked `public_reference` cannot itself
  expose personal data.
- **No biometric data of any kind** (facial, fingerprint, iris) — see
  `THREAT_MODEL_ACCESS_CONTROL.md`'s explicitly-out-of-scope list. There is
  no column anywhere in this migration shaped to hold biometric templates.
- **No continuous or secret location tracking.** `access_events` records
  discrete checkpoint-crossing events an identity's credential was used
  for, not a continuous position feed — and only for checkpoints the
  identity actually presented a credential at.

## Minimization choices already in the schema

- `access_identities.security_class` and `person_category` are closed
  vocabularies (check constraints), not free text — preventing
  ad-hoc sensitive labels from accumulating uncontrolled in a column meant
  to be a simple classification.
- `access_credentials.metadata` and `access_resources.metadata` /
  `access_devices.capabilities` are `jsonb` extensibility columns
  explicitly documented (in the migration's own comments) as
  extensibility-only, never a dumping ground for fields that should be
  real, reviewed columns — this is a privacy control as much as a schema
  hygiene one, since an unreviewed free-form column is exactly where
  unplanned PII tends to accumulate.

## Access to this data

Every table in this migration has RLS enabled with a single SELECT policy:
readable by any authenticated member of the same production
(`is_production_member(production_id)`), and by no one else — the same
posture every other production-scoped table in this schema already uses.
Phase A adds no additional, more restrictive read tier (e.g. "only
security-role members can read incident details") — that is documented
here as a real gap to close in a later phase's RLS/Server-Action design,
not an oversight to silently work around.

## Retention

No retention/deletion policy or job exists yet for `access_events` or any
other table in this migration. Given `access_events` is an append-only
audit ledger, a retention policy is a deliberate future decision (how long
does an access record need to be kept for incident investigation vs. how
long is it reasonable to hold per-person movement data) rather than
something to default silently — flagged here so it isn't forgotten before
this module goes further.
