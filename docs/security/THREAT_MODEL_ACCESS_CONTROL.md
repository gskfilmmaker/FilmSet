# Security & Access — Threat Model

See `docs/security/access-control/README.md` for the reading order. This is
a distinct threat model from the pre-existing `docs/security/THREAT_MODEL.md`
(account authentication) — this one is about physical access to real spaces
via credentials and scanning devices.

## Assets

- **Physical spaces** the module gates (sets, basecamps, equipment areas,
  vehicle gates) — the thing an attacker ultimately wants unauthorized
  entry to.
- **Credential material** (`access_credentials.public_reference`) — the
  opaque value a QR encodes. Its compromise is a cloning/impersonation risk,
  not a data-exposure risk (it carries no PII by design).
- **The access ledger** (`access_events`) — the record an investigation
  after an incident depends on; its integrity matters as much as its
  existence.
- **Device trust** (`access_devices`) — a trusted scanner is itself a
  capability; a stolen or cloned trusted device can grant/deny access on
  its own authority until revoked.
- **Identity/credential metadata** — company, visitor purpose, incident
  details: lower sensitivity than payment or biometric data, but still
  real personal data (see `PRIVACY_ACCESS_CONTROL.md`).

## Actors

- **Production members** using the eventual admin UI (Phase B+) to manage
  identities, credentials, and profiles.
- **Checkpoint operators** — crew stationed at a gate holding a trusted
  device.
- **Credential holders** — cast, crew, vendors, visitors carrying a QR.
- **External attackers** with no legitimate FilmSet access, attempting
  physical entry.
- **A different production's member**, testing whether tenant isolation
  actually holds (the cross-production leak this migration's composite FKs
  exist to make impossible at the database level — see
  `ARCHITECTURE_ACCESS_CONTROL.md`).
- **A malicious or compromised operator/device**, testing whether the
  system trusts client-reported data it shouldn't.

## Threats and mitigations (Phase A scope)

| Threat | Mitigation in this phase |
| --- | --- |
| QR contains enough info to forge a badge or identify a person by scanning alone | `public_reference` is opaque, high-entropy, globally unique, carries zero personnel data — see `QR_SECURITY_ACCESS_CONTROL.md`. |
| Cross-production data leak (Production A staff reading/matching against Production B's checkpoints/resources) | Composite `(id, production_id)` foreign keys make this a database-level impossibility, not just an RLS/app-layer check — directly tested against real Postgres during development. |
| A revoked/suspended credential still being honored | `evaluateAccess()` treats credential `status` as a real lifecycle and checks it before any grant is even considered (`ACCESS_POLICY_ACCESS_CONTROL.md` §evaluation order); denial is unconditional regardless of what grants/profiles exist. |
| An untrusted or previously-revoked device being used to make access decisions | Device trust is evaluated first, before checkpoint/credential/identity — an untrusted device denies before any identity data is even read (`access-control.ts`, checks 1). |
| A grant silently outliving its intended window | `valid_from`/`valid_until` are evaluated against server time (`now`) inside the pure policy engine, not a cleanup job — an expired grant stops applying on its own, per owner's spec §30. |
| An explicit restriction being bypassed by an overlapping grant | Restrictions are checked (and can DENY) before grant matching runs at all — see the "restrictions override grants" precedence in `ACCESS_POLICY_ACCESS_CONTROL.md`. |
| Badge sharing / anti-passback (same credential entering twice without an intervening exit) | `access_checkpoints.anti_passback_mode` (`OFF`/`WARN`/`DENY`) plus `lastEventDirection` in the policy engine; DENY mode blocks a repeated direction outright, WARN mode allows but flags it. |
| Tampering with the access ledger after the fact | `access_events` has a SELECT-only RLS policy and, in this phase, no write policy at all (nothing can write to it yet). When the writing Server Action ships, it will be the only write path — never a direct client/table write — and the ledger's `policy_snapshot` column is designed so an admin can reconstruct *why* a decision was made after the fact (owner's spec §49). |
| Facial recognition / biometric / continuous-tracking overreach | Explicitly out of scope for this release (owner's spec §84) — no such table, column, or code path exists anywhere in Phase A. |
| A Server Action or RLS policy silently opening a write path before it's actually ready | Every table in this migration ships with RLS enabled and a read-only policy; there is no INSERT/UPDATE/DELETE policy on any of the 15 tables — verified directly via `pg_policies` during development (exactly one SELECT policy per table). |

## Explicitly out of scope for this release (owner's spec §84)

Facial/fingerprint/iris recognition, continuous location tracking, secret
GPS tracking, weapons screening, police-database integrations, hardware
door relays, NFC/DESFire/OSDP hardware integration, and complex ML-driven
anomaly enforcement. None of these have any schema, code, or documentation
footprint in this module today; a future phase that wants any of them
starts a new, explicitly-authorized design discussion — this list is not a
roadmap.

## Deferred to a later phase, not forgotten

- Rate limiting / brute-force protection on any future scan-verification
  endpoint (no such endpoint exists yet in Phase A).
- Minimal-field-exposure API responses (a scanner should receive only what
  it needs to render a decision, never a full identity record) — an
  application/API-boundary concern for the phase that builds that
  endpoint, same posture the catering migration (0022) already documents
  for its own sensitive tables.
- Device-compromise response procedures (revocation propagation timing,
  offline-cache invalidation) — depends on the offline story in
  `OFFLINE_EDGE_PLAN_ACCESS_CONTROL.md`, itself future-phase work.
