# FilmSet — Implementation Roadmap

**Audit deliverable 11 of 11.** Covers Part 31 (priorities), Part 27 (test plan), and Part 30 items 12–15 (proposed schema changes, migration strategy, test strategy, risk register) — consolidated here rather than as four more separate files, since all four are properties of *how* this roadmap gets executed, not independent subjects. This is the last document produced under this audit's mandate. **Per Part 32, this is a proposal — nothing below is authorized for implementation until the production owner says so explicitly.**

Complexity is sized `S`/`M`/`L`/`XL` only. No calendar estimates are given — development capacity isn't known, and the mandate explicitly says not to fabricate dates.

---

## Priority Tiers

### P0 — Security defects / structural blockers

The only tier that isn't new construction — it's closing a currently-live gap before building more on top of the current model.

| Item | Complexity | Why first |
|---|---|---|
| Fix `getSessionUser()`'s unbounded `supabase.auth.getUser()` call (`AUTHORIZATION_GAP_ANALYSIS.md` §1) | S | Live availability bug, same class as the incident already fixed once today in middleware — this is its untreated twin, on every page load and Server Action |
| Add automated tenant-isolation test coverage for existing tables (a subset of the P1 test plan, pulled forward) | M | `THREAT_MODEL.md` #13 — nothing today catches a future table shipping without RLS |
| Stand up minimal CI (typecheck + build + the tests above, on every PR) | M | Zero CI exists today (`CURRENT_ARCHITECTURE_MAP.md` §1) — every later phase's "push only once validated" discipline needs somewhere automated to validate against |

### P1 — Authorization foundation

| Item | Complexity |
|---|---|
| `authorize(principal, action, resource)` engine (`SECURITY_ARCHITECTURE_V1.md` §1) | XL |
| Role/permission tables replacing the `text` role column + TS-union enforcement | L |
| `PERMISSION_MATRIX_V1.md`'s vocabulary, seeded | M |
| Temporal access (`effectiveFrom`/`effectiveUntil`/status on membership) | M |
| Sensitivity classification columns (Part 9) on the fields named in `AUTHORIZATION_GAP_ANALYSIS.md` §6 | M |
| Role-adaptive sidebar filter (`LOGISTICS_UX_SPEC.md` §2) | S |
| Full authorization test suite (`§Test Strategy` below) | L |

**Nothing in P2 onward should start before P1 lands** — every later tier assumes a real permission engine exists to extend, per `AUTHORIZATION_GAP_ANALYSIS.md` §11's dependency chain.

### P2 — Departments / HOD

| Item | Complexity |
|---|---|
| `Department`/`DepartmentMembership`/`DepartmentHeadAssignment`/`DepartmentPermission`/`DepartmentBudgetScope` (`LOGISTICS_DOMAIN_MODEL.md` §5) | L |
| Migrate `crew_members.is_hod`/`department` to read from the new tables (display layer preserved, source of truth moved — see Migration Strategy) | M |
| Department-scoped budget visibility (`DepartmentBudgetScope` wired into Money) | M |
| Department-adaptive workspace views (Costume/Transport/Catering examples, `LOGISTICS_UX_SPEC.md` §2) | L |

### P3 — Sessions / Audit / Security Center

| Item | Complexity |
|---|---|
| `Session`/`SessionDevice`/`AuthenticationEvent` (`SECURITY_ARCHITECTURE_V1.md` §2), populated from Supabase Auth events | L |
| Two-stream audit tables + append-only grants (`AUDIT_EVENT_CATALOG.md`) | L |
| Security Center UI (Users/Roles/Permissions/Departments/Sessions/Login History/Security Events/Audit Log — `SECURITY_ARCHITECTURE_V1.md` §5) | XL |
| Permission Simulator + "why do I have access" explain view (§6) | M |
| Permission Change Preview (§7) | M |
| MFA enrollment/challenge UI (§3) | L |
| Step-up authentication framework (§4) | M |

### P4 — Logistics core

| Item | Complexity |
|---|---|
| Booking Engine (`LOGISTICS_DOMAIN_MODEL.md` §0.1) | L |
| Approval Engine (§0.2) | L |
| Logistics Control Center shell (`LOGISTICS_UX_SPEC.md` §3), pre-populated only with what already exists (call-sheet-level vehicles/transport) | M |

### P5 — Travel & Accommodation

| Item | Complexity |
|---|---|
| Travel entities (`LOGISTICS_DOMAIN_MODEL.md` §1) | L |
| Accommodation entities (§2) | L |
| Rooming/Arrival/Departure/Occupancy/Unassigned-Rooms/Cost reports | M |

### P6 — Transportation / Movement

| Item | Complexity |
|---|---|
| `Vehicle`/`Movement`/`MovementLeg`/`PassengerManifest`/`Driver` entities, superseding today's flat schema (§3) | L |
| Conflict detection (vehicle/driver/passenger/capacity/late/route/dependency) | L |
| Migrate today's `productionVehicleSchema`/`transportRunSchema` data into the new model | M |

### P7 — Catering

| Item | Complexity |
|---|---|
| `DietaryProfile`/`MealService`/`CateringOrder` entities + the three-tier dietary permission split (§6) | L |
| Meal-count derivation from schedule/attendance | M |
| Daily Meal Count / Dietary Summary / Catering Order / Unit Catering Report | M |

### P8 — Logistics ↔ Schedule integration

| Item | Complexity |
|---|---|
| `ScheduleChanged`/`SceneMoved`/etc. impact-check pipeline against Travel/Accommodation/Transport/Catering (`LOGISTICS_DOMAIN_MODEL.md` §7) | L |
| Advisory alert/approval surfacing (never automatic rebooking) | M |

### P9 — Logistics ↔ Finance integration

| Item | Complexity |
|---|---|
| `Booking → Commitment → Invoice → Actual → Reconciliation` chain (§0.3) | L |
| Money module updated to show committed-but-unspent alongside today's Actuals | M |

### P10 — Hardening / compliance readiness

| Item | Complexity |
|---|---|
| Audit log immutable archive + hash chaining (`AUDIT_EVENT_CATALOG.md` §5) | M |
| Rate limiting (`THREAT_MODEL.md` #8) | M |
| Dependency-vulnerability scanning in CI | S |
| Content classification extended to watermarking/forensic marking (`CONTENT_SECURITY_ROADMAP.md` §1) | L |
| Formal incident response plan (organizational, not code) | — |

---

## Test Strategy (Part 27)

**Principle**: authorization tests are written *before* the features they gate ship, not after — starting with P1, since P1 *is* the authorization engine.

| Category | Automated? |
|---|---|
| Tenant isolation | **Required automated** — pulled into P0 |
| Project/production isolation | **Required automated** |
| Department isolation | **Required automated** (P2) |
| Role permissions | **Required automated** (P1) |
| Field masking (sensitivity) | **Required automated** (P1) |
| Expired membership | **Required automated** (P1) |
| Revoked membership | **Required automated** (P1) |
| Cross-project access | **Required automated** |
| Cross-department access | **Required automated** (P2) |
| Admin access | **Required automated** |
| HOD access | **Required automated** (P2) |
| Vendor access | Automated once Vendor role ships (P4+) |
| Cast access | Automated once Cast external-viewer scoping ships |
| Authorization failures (DENY path) | **Required automated** — as important as the ALLOW path |
| Audit creation | **Required automated** (P3) — every mutation in a test should assert the expected audit event was written |
| Session revocation | **Required automated** (P3) |

**"High-risk tests must be automated"** (the mandate's own words) — every row above marked required is a CI gate, not a manual QA checklist item. This is also why P0 stands up CI first: none of this is meaningful without somewhere for it to run on every change.

## Proposed Database / Schema Changes

Grouped by phase — full entity field lists live in `LOGISTICS_DOMAIN_MODEL.md` and `SECURITY_ARCHITECTURE_V1.md`; this is the migration-sequencing view.

- **P1**: `roles`, `permissions`, `role_permissions`, membership status/temporal columns on `production_members`, sensitivity classification columns on existing sensitive fields.
- **P2**: `departments`, `department_memberships`, `department_head_assignments`, `department_permissions`, `department_budget_scopes`.
- **P3**: `sessions`, `session_devices`, `authentication_events`, `production_audit_log`, `security_audit_log` (separate schema, restricted grants per `AUDIT_EVENT_CATALOG.md` §5).
- **P4**: `bookings`, `booking_quotes`, `booking_approvals`, `booking_confirmations`, `booking_changes`, `approval_workflows`, `approval_stages`, `approval_rules`, `approval_requests`, `approval_decisions`.
- **P5**: `travel_journeys`, `travel_segments`, `travel_bookings`, `passenger_assignments`, `travel_changes`; `accommodation_properties`, `accommodation_contracts`, `room_blocks`, `room_types`, `room_assignments`, `stays`.
- **P6**: `vehicles`, `vehicle_types`, `drivers`, `driver_qualifications`, `movements`, `movement_legs`, `passenger_manifests`, `movement_assignments`, `routes`, `pickup_points` — superseding (not just adding alongside) the existing `production_vehicles`/`transport_runs`-shaped data.
- **P7**: `dietary_profiles`, `dietary_requirements`, `meal_services`, `meal_service_assignments`, `catering_vendors`, `catering_orders`, `craft_services`, `meal_counts`, `meal_adjustments`.
- **P9**: `commitments`, `invoices` (or an `invoice` state on `bookings`/`commitments` if a separate table proves unnecessary once designed in detail — a decision for the P9 implementation, not fixed here).

Every new table follows the existing convention: RLS enabled on creation (never added later), migration committed as a reviewed `.sql` file under `packages/db/migrations/`, matching this repo's established `drizzle-kit generate` + hand-written policy pattern (`docs/design-system/README.md`'s "Row Level Security" section).

## Migration Strategy

- **No breaking rewrites of working screens.** Per `LOGISTICS_DOMAIN_MODEL.md` §5's explicit note: `crew_members.is_hod` and the free-text `department` column become a *display* layer reading from the new `Department`/`DepartmentHeadAssignment` tables once those exist, rather than being deleted and forcing a Crew-screen rewrite in the same phase.
- **P6 supersedes, and must backfill, P-existing transport data**: today's `production_vehicles`/`transport_runs` rows need a one-time migration into the new `vehicles`/`movements` shape before the old schema is retired — not a parallel/duplicate system running alongside it.
- **Every phase ships its own RLS policies with its own migration** — never a schema-only migration followed by a "policies later" step, per this repo's own established discipline (every existing migration that adds a table adds its policies in the same file).
- **Backward-compatible rollout for authorization**: P1's `authorize()` should initially run in a shadow/log-only mode against real traffic (logging what it *would* deny, without actually denying) for a short verification period before flipping to enforcing — this catches an overly strict default-DENY posture accidentally blocking legitimate existing usage before it does so in production. This is the one place in this roadmap where a staged rollout is explicitly recommended over a direct cutover, because P1 is the change with the largest blast radius if wrong.

## Risk Register

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| P1's default-DENY posture breaks legitimate existing workflows the current flat-role model quietly allowed | Medium | High | Shadow-mode rollout (above); comprehensive test suite before enforcing |
| Department migration (P2) leaves a gap where `is_hod` and the new `DepartmentHeadAssignment` disagree during rollout | Medium | Medium | Single migration script that seeds `DepartmentHeadAssignment` directly from every current `is_hod=true` row, run before the display layer switches source |
| Audit log volume (P3) grows faster than anticipated, affecting DB performance or cost | Low–Medium | Medium | Retention policy defined at launch, not deferred (`AUDIT_EVENT_CATALOG.md` §5); index `occurredAt`/`productionId` from the first migration |
| Logistics scope (P4–P9) is large enough that partial completion leaves the product in a confusing half-migrated state (e.g. Travel shipped, Accommodation not) | Medium | Medium | Each phase (P5, P6, P7) is independently shippable and independently useful — sequencing doesn't require all of Logistics to land together |
| No development-capacity estimate exists for any of this | Certain | — | Explicitly out of this audit's scope per Part 31's own instruction; the production owner supplies capacity, this document supplies sequencing and complexity only |
| CI didn't exist before P0 — introducing it alongside the very first security fix could surface pre-existing, unrelated failures | Medium | Low | Expect and budget time for this in P0 itself; it's a one-time cost of catching up, not a recurring one |

---

## Closing Note

This roadmap, together with the other ten documents this audit produced, is the complete deliverable set required by Part 30. **No implementation should begin from this roadmap without explicit authorization** — see the summary report below (delivered as this audit's final message, per Part 32) for the specific decisions that need an owner's sign-off before P0 starts.
