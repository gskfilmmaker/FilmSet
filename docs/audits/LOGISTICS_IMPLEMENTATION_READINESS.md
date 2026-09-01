# Logistics Implementation Readiness — P4

**What this document is, and isn't.** The owner's P4 scope named "Logistics Specification and Domain Prep ONLY." The domain spec already exists in full: `LOGISTICS_DOMAIN_MODEL.md` (entities, the Booking/Approval engines, Logistics↔Finance, Logistics↔Schedule) and `LOGISTICS_UX_SPEC.md` (Control Center layout, role-adaptive workspace, exception-driven interaction) — both written earlier in this audit and neither superseded by anything since. Re-deriving that design here would be redundant, not additive. What actually changed since those documents were written is that **P1a and P1b landed** — real Organization/Production governance and a real, seeded permission/role/department schema — and neither logistics doc was written against that foundation, because it didn't exist yet. This document is the gap check: does what P1b actually shipped satisfy what the Logistics design assumed, and exactly what schema-shaped work remains before Logistics could be built. It is **not** a new domain design, and it is **not** a draft migration — see §5 for why the migration is deliberately not attempted here.

---

## 1. What P1b already satisfies, confirmed by direct comparison

`LOGISTICS_DOMAIN_MODEL.md` §5 (Departments & HOD Model) was written as a *requirement* for logistics roles, before any of it existed. Checked line-by-line against what `packages/db/migrations/0017_authorization_foundation.sql` (P1b) actually built:

| §5 entity (as designed) | P1b's shipped equivalent | Match? |
|---|---|---|
| `Department` (productionId, name, parentDepartmentId) | `departments` table, same shape | Exact match |
| `DepartmentHeadAssignment` (departmentId, personRef) | `department_head_assignments` (departmentId+userId PK) | Exact match — and, critically, `authorize()`/`evaluateAuthorization()` (`packages/auth/src/authorize.ts`) grants HOD-only permissions **only** from this table, never from a role bundle, which is exactly the "replaces `crew_members.is_hod`'s display-only flag with something the authorization engine actually checks" requirement §5 called for |
| `DepartmentMembership` (departmentId, personRef, roleId, effective dates) | `department_memberships` (departmentId+userId PK, roleId, status, effectiveFrom/effectiveUntil) | Exact match, temporal-access fields included |
| `DepartmentPermission` (departmentId, permission string) | `department_permissions` (departmentId+permission PK) | Exact match |
| `DepartmentBudgetScope` (departmentId, budgetLineId) | `department_budget_scopes` (departmentId+budgetLineId PK, referencing the existing `budget_lines` table) | Exact match |
| `DepartmentRole` (departmentId, name, permission bundle — a *department-scoped* role template) | Not built as its own entity — P1b instead reuses the single production-wide `roles`/`role_permissions` tables (e.g. `role_department_head`, `role_department_coordinator`, `role_department_member`) referenced by `department_memberships.role_id` | **Deliberate simplification, not a gap** — see below |
| Migration note: `crew_members.is_hod`/`department` stay as display layer | Untouched by 0017 — confirmed in `packages/db/src/schema.ts`, no column removed or altered | Honored exactly as specified |

**On the one delta**: §5 imagined a department could define its own bespoke role ("Costume HOD" with a different bundle than "Camera HOD"). P1b instead gives every department the same three system-template roles (Head/Coordinator/Member), scoped per-department only by *membership*, not by a per-department role definition. This is simpler than the original design, not a missing piece — it satisfies the actual requirement ("Wardrobe HOD sees Wardrobe budget, not Camera budget," §5's own example) without needing `DepartmentRole` as a separate table. If a real future need for department-specific role customization emerges (e.g. a department wanting a bundle no system template covers), `roles.organizationId`/`isSystemTemplate` already leaves room for a custom, non-template role — the schema doesn't foreclose it, it just wasn't needed yet.

## 2. Permission vocabulary — already fully seeded, not a gap

Every logistics-specific permission `LOGISTICS_DOMAIN_MODEL.md` implies was seeded by P1b's migration, confirmed by direct read of `0017_authorization_foundation.sql`:

| Subdomain (`LOGISTICS_DOMAIN_MODEL.md` §) | Seeded permissions |
|---|---|
| Travel (§1) | `travel.view`, `travel.manage`, `travel.approve` |
| Accommodation (§2) | `accommodation.view`, `accommodation.manage`, `accommodation.approve` |
| Transportation (§3) | `transport.view`, `transport.manage`, `transport.approve` |
| Catering (§6) — including the explicit dietary-sensitivity permission split §6 required | `catering.dietary.view_individual`, `catering.dietary.view_operational`, `catering.counts.view_aggregate`, `catering.manage`, `catering.approve` |
| Booking Engine (§0.1), cross-cutting | `bookings.view`, `bookings.manage`, `bookings.approve` |

And the named logistics roles are seeded with exactly the bundles their job descriptions imply — also already in `0017`:

- **Travel Coordinator**: `travel.view`, `travel.manage`, `travel.approve`, `catering.dietary.view_operational`
- **Transport Coordinator**: `transport.view`, `transport.manage`, `transport.approve`
- **Catering Head**: `catering.manage`, `catering.approve`, `catering.dietary.view_individual`, `catering.dietary.view_operational`, `catering.counts.view_aggregate`
- **Booking Manager**: `bookings.view`, `bookings.manage`, `bookings.approve`
- **Cast/Background** (the roles most likely to just need to see their own logistics, not manage it) already carry `travel.view`/`accommodation.view` alongside their existing schedule/call-sheet view permissions

**Conclusion of §1–2**: the authorization foundation Logistics needs — department scoping, HOD enforcement, the full permission vocabulary, and every named logistics role — is not a future dependency. It shipped in PR #25, is stacked and tested, and needs only the wiring P1c already planned (`AUTHORIZATION_WIRING_PLAN.md`'s Phase 8, "Future logistics," explicitly named as a placeholder for exactly this).

## 3. What has no schema yet — the real remaining gap

Everything in `LOGISTICS_DOMAIN_MODEL.md` §0–4 and §6–8 beyond the Department/permission layer above. Confirmed by search — none of the following exist in `packages/db/src/schema.ts` today:

- **Booking Engine** (§0.1): `Booking`, `BookingQuote`, `BookingApproval`, `BookingConfirmation`, `BookingChange`, `BookingCancellation`, `BookingCost` — the shared substrate every subdomain below sits on.
- **Approval Engine** (§0.2): `ApprovalWorkflow`, `ApprovalStage`, `ApprovalRule`, `ApprovalRequest`, `ApprovalDecision`.
- **Logistics↔Finance** (§0.3): the `Commitment`/`Invoice` stages between `Booking` and today's real `Expense`/`Actual` rows.
- **Travel** (§1): `TravelJourney`, `TravelSegment`, `TravelBooking`, `PassengerAssignment`, `TravelItinerary`, `TravelChange`, `TravelApproval`.
- **Accommodation** (§2): `AccommodationProperty`, `AccommodationContract`, `RoomBlock`, `RoomType`, `RoomAssignment`, `Stay`, `AccommodationBooking`, `AccommodationChange`.
- **Transportation** (§3): `Vehicle`, `VehicleType`, `VehicleBooking`, `Driver`, `DriverQualification`, `Movement`, `MovementLeg`, `PassengerManifest`, `MovementAssignment`, `Route`, `PickupPoint` — today's only real equivalent is the flat, single-shoot-day-scoped `productionVehicleSchema`/`transportRunSchema` pair in `packages/core/src/index.ts`, unchanged since the original gap audit.
- **Catering** (§6): `DietaryProfile`, `DietaryRequirement`, `MealService`, `MealServiceAssignment`, `CateringVendor`, `CateringOrder`, `CraftService`, `MealCount`, `MealAdjustment`.
- **Logistics↔Schedule integration** (§7): the impact-check surface (`ScheduleChanged`/`ShootDayChanged`/etc. → computed impact against Travel/Accommodation/Transport/Catering/Cost) has no home without the entities above existing first.
- **Logistics documents** (§8): all 17 named generated documents are views over the entities above — none can be built before their sources exist.

None of this is a surprise; `LOGISTICS_DOMAIN_MODEL.md` was always design-only. This section exists so the remaining work is a checklist against real schema state, not a re-read of the whole domain doc.

## 4. Recommended build order, once building Logistics is separately authorized

Not authorized by this document — this is a sequencing recommendation for whenever that separate authorization happens, following the same dependency logic `AUTHORIZATION_GAP_ANALYSIS.md` §11 used for the Role/Permission → Department chain:

1. **Booking Engine + Approval Engine (§0.1–0.2)** first, and necessarily first — every subdomain table below attaches to a `Booking` via `subjectRef` and every approval flow reuses the same `ApprovalWorkflow`/`ApprovalStage` shape. Building any subdomain before this exists would mean either blocking on it anyway or building bespoke lifecycle logic per subdomain that then has to be torn out — exactly the kind of rework the domain model's §0 was designed to prevent.
2. **Transportation (§3)** next among the subdomains — it has the most existing real code to migrate *from* (`productionVehicleSchema`/`transportRunSchema`, already wired into the live call sheet), so it's the highest-value, most-grounded next slice, and its conflict-detection logic (vehicle/driver/passenger/capacity conflicts) is a natural, well-scoped first exercise of the Booking Engine once it exists.
3. **Travel and Accommodation (§1–2)** together — they share the traveler-facing shape (`TravelItinerary` cross-references `Stay` for the Arrival/Departure List mismatch-detection §2 specifies) and are naturally built as a pair.
4. **Catering (§6)** last among the subdomains — it's the most independent of the four (no shared entities with Travel/Accommodation/Transport beyond `MealServiceAssignment` deriving from `Schedule`), and its dietary-sensitivity permission split, while already seeded (§2 above), needs the most careful UI treatment given the data's sensitivity — worth having the other three subdomains' patterns established first.
5. **Logistics↔Schedule integration (§7) and the Logistics Control Center (`LOGISTICS_UX_SPEC.md`)** last — both are consumers of everything above, not buildable in isolation.

## 5. Why no draft migration ships in this PR

The owner's P4 instruction allows a draft migration when schema design is needed ("prepare as draft migration only, locally tested, stacked, included in the consolidated cutover plan"). This document deliberately does not attempt one, for a reason specific to Logistics rather than a blanket refusal: §3 above lists roughly 35 new entities across two shared engines and four subdomains — the single largest schema surface in the entire roadmap, larger than P1a+P1b combined. Drafting it now, as an extension of "domain prep," would be the first real step toward *implementing* Logistics rather than preparing for it, and risks locking in schema decisions (e.g. exact `Booking.subjectRef` polymorphism, `ApprovalRule` condition shape) that deserve their own explicit review rather than arriving bundled into a readiness check. Recommendation: treat "draft the Booking + Approval Engine migration" as its own future phase, explicitly authorized on its own, once P1c's wiring (or at least Phase 8's placeholder) is closer to real — not folded into P4 by default.

## 6. Cutover plan impact

None. This document adds no migration, no schema change, no code. `docs/audits/CONSOLIDATED_SUPABASE_CUTOVER_PLAN.md` remains accurate as-is, still covering only migrations 0016 (PR #24) and 0017 (PR #25).
