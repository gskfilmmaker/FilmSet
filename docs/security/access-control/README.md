# Security & Access — Documentation Index

The **Security & Access** module is a generic, domain-neutral physical
identity/credential/access-control platform living inside FilmSet, built to
the owner's "MASTER CLAUDE CODE IMPLEMENTATION INSTRUCTION" spec, and
architected so it can eventually ship as a standalone product outside the
film-production context. It is **not** the same thing as the existing
`/security` route (`apps/web/app/security/security-center.tsx`) — see
§0 below.

This directory is the reading order for that module. Each linked doc lives
in `docs/security/` alongside the pre-existing `SECURITY_ARCHITECTURE_V1.md`
/ `THREAT_MODEL.md` / `PERMISSION_MATRIX_V1.md` (the *account*
authentication/RBAC engine — a different, unrelated system) and is
suffixed `_ACCESS_CONTROL.md` specifically to avoid colliding with those
names.

## §0 — Naming collision, resolved

FilmSet already has a page at `/security` (`apps/web/app/security/`,
"Security Center") covering account sessions, login history, and an
`authorize()` decision-trace demo — an entirely different feature area,
predating this module (see `docs/audits/SECURITY_CENTER_UX_SPEC.md`).
Phase A does not touch that route. When Phase B adds a UI for this module,
it will live at **`/security-access`**, not `/security` — flagged here so
no future phase silently reuses the existing route.

## Reading order

1. [`ARCHITECTURE_ACCESS_CONTROL.md`](../ARCHITECTURE_ACCESS_CONTROL.md) —
   data model, tenancy, cross-tenant integrity technique, and how this
   module reuses (never duplicates) existing FilmSet identity data.
2. [`THREAT_MODEL_ACCESS_CONTROL.md`](../THREAT_MODEL_ACCESS_CONTROL.md) —
   assets, actors, and the specific attacks this design defends against.
3. [`ACCESS_POLICY_ACCESS_CONTROL.md`](../ACCESS_POLICY_ACCESS_CONTROL.md) —
   the `evaluateAccess()` policy engine: inputs, evaluation order, every
   reason code, and precedence rules (restrictions over grants, etc).
4. [`QR_SECURITY_ACCESS_CONTROL.md`](../QR_SECURITY_ACCESS_CONTROL.md) —
   what a QR code is allowed to encode, and the verification path a scan
   must always go through.
5. [`DEVICE_TRUST_ACCESS_CONTROL.md`](../DEVICE_TRUST_ACCESS_CONTROL.md) —
   why a scanner device is its own trust principal, separate from the
   operator logged into it, and the enrollment lifecycle.
6. [`OFFLINE_EDGE_PLAN_ACCESS_CONTROL.md`](../OFFLINE_EDGE_PLAN_ACCESS_CONTROL.md)
   — what is and isn't supported for connectivity-loss scenarios in this
   phase, and the interface this schema leaves for a future edge story.
7. [`PRIVACY_ACCESS_CONTROL.md`](../PRIVACY_ACCESS_CONTROL.md) — what
   personal data this module holds, retention posture, and minimization
   choices baked into the schema.
8. [`OPERATIONS_ACCESS_CONTROL.md`](../OPERATIONS_ACCESS_CONTROL.md) — how
   this ships (phase-by-phase), the cutover convention this migration
   train uses, and what a future on-call runbook needs once writes exist.

## Current phase

**Phase A only** (database + types + a pure policy engine). No Server
Action, API route, QR generation/verification endpoint, or UI page exists
yet for this module — see `packages/db/migrations/0025_access_control_foundation.sql`'s
header comment and each doc's own "Phase A status" note. Every table's
write path is RLS-DENIED by default until a later phase adds the narrow
Server Action that mediates it.
