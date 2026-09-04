# Security & Access — Offline / Edge Plan

See `docs/security/access-control/README.md` for the reading order.

## Phase A status: interface only, no implementation

No offline verification path, edge gateway, or local-cache sync protocol
is built in Phase A. This doc records the schema hooks already in place so
a future phase can implement offline support without a schema migration,
and records what is explicitly deferred.

## What the schema already anticipates

- **`access_resources.offline_policy`** (`DENY` | `ALLOW_CACHED` |
  `ALLOW_HIGH_ASSURANCE_CACHED`, default `DENY`) — per-resource control
  over whether a scanner is even allowed to make an offline decision at
  that resource at all, and if so, whether a cached decision is acceptable
  only for high-assurance credentials. Default-deny: a resource says
  nothing about offline behavior only when its owner has explicitly opted
  it in.
- **`access_events.verification_mode`** (`ONLINE` | `OFFLINE_CACHED` |
  `MANUAL`) — every event records how the decision was actually made, so a
  later audit can distinguish "the server evaluated this" from "a device
  used cached policy data" from "an operator manually overrode it."
- **`access_events.client_occurred_at` vs. `server_received_at`** — kept as
  two separate timestamps specifically so an offline-recorded event
  (queued on-device, synced later) can be reconciled against when it
  actually happened vs. when the server learned about it, without losing
  either fact.
- **`access_devices.last_sync_at`** — when a device last synchronized
  (whatever "sync" means for the eventual offline protocol), separate from
  `last_seen_at` (last time it was online at all).

## Explicitly deferred, not designed here

- The actual cache format and sync protocol a scanner PWA would use to
  hold a bounded, revocable snapshot of policy data for offline decisions.
- Revocation propagation timing while a device is offline (how stale can a
  cached "this credential is still ACTIVE" answer be before the resource's
  `offline_policy` should refuse it outright).
- Conflict resolution when two offline-queued events for the same
  anti-passback-tracked identity/checkpoint sync out of order.
- Any edge-gateway or local-controller hardware integration (explicitly
  out of scope for this release per the owner's spec §84 — see
  `THREAT_MODEL_ACCESS_CONTROL.md`).

Building any of this is real, security-sensitive design work — precisely
why it isn't rushed into Phase A alongside the base schema. A future phase
that tackles it starts from `access_resources.offline_policy` and
`access_events.verification_mode` as its given constraints, not from a
blank slate.
