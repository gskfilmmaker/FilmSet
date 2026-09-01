# FilmSet Platform Gap Audit

**Audit deliverable 1 of 11 (Part 2 of the mandated audit).** Every classification below was verified by tracing UI → Server Action → authorization → persistence in the actual repository, per `CURRENT_ARCHITECTURE_MAP.md` — not inferred from the presence of a nav item. Where a module's UI exists but the underlying capability doesn't, it's marked `UI ONLY`, not `COMPLETE`.

**Classification legend**

| Label | Meaning |
|---|---|
| `COMPLETE` | Real UI, real Server Action, real persistence, real authorization check. Production-usable for its stated scope. |
| `PARTIAL` | Works, but a meaningfully-sized piece of the expected capability is missing. |
| `UI ONLY` | A screen/nav entry exists; no working data path behind some or all of it. |
| `BACKEND ONLY` | Schema and/or server logic exists; no UI surfaces it. |
| `ARCHITECTURALLY WEAK` | Works today, but the design won't hold under the scale/rigor this platform needs (named explicitly, not just "needs polish"). |
| `MISSING` | Nothing exists — no schema, no UI, no server logic. |
| `BLOCKED` | Missing, and cannot be safely built until a named prerequisite lands. |

---

## Summary Table

| # | Module | Classification | Severity |
|---|---|---|---|
| 1 | Overview | COMPLETE | — |
| 2 | Write (screenwriting) | MISSING | Low |
| 3 | Script | PARTIAL | Medium |
| 4 | Breakdown | PARTIAL | Medium |
| 5 | Schedule | PARTIAL | Medium |
| 6 | Cast | COMPLETE | — |
| 7 | Crew | PARTIAL | Medium |
| 8 | Locations | COMPLETE | — |
| 9 | Production Office | MISSING | Medium |
| 10 | Shoot Day / Call Sheet | PARTIAL | Medium |
| 11 | Logistics (Travel/Accom/Transport/Catering) | MISSING | High |
| 12 | Travel | MISSING | High |
| 13 | Accommodation | MISSING | High |
| 14 | Transportation | PARTIAL (schema only, see below) | Medium |
| 15 | Catering | MISSING | High |
| 16 | Documents | PARTIAL | Medium |
| 17 | Tasks | MISSING | Medium |
| 18 | Money | PARTIAL | High |
| 19 | Post | MISSING | Low |
| 20 | Rights | MISSING | Low |
| 21 | Delivery | MISSING | Low |
| 22 | Distribution | MISSING | Low |
| 23 | FilmSet AI | PARTIAL | Medium |
| 24 | Administration | UI ONLY / MISSING | High |
| 25 | Security | MISSING | **Critical** |
| 26 | Permissions | ARCHITECTURALLY WEAK | **Critical** |
| 27 | Audit | MISSING | **Critical** |

---

## Detailed Findings

### 1. Overview — `COMPLETE`
- **Present**: `/overview` shows production phase, computed health indicators, pending AI recommendations, pending approvals (`app/notifications-actions.ts`).
- **Desired behavior**: matches present behavior for a pre-production/production-phase status dashboard.
- **Dependencies**: Money, Documents, Schedule data feeding its health indicators.
- **Security implications**: none beyond standard production-scoped RLS.
- **DB impact**: none proposed.
- **UX impact**: none proposed at this scope; will need new tiles as Logistics/Tasks land.
- **Milestone**: none required now; revisit after P4 (Logistics core).

### 2. Write (screenwriting authoring) — `MISSING`
- **Present**: nothing. FilmSet only *imports* a finished/near-finished script (PDF, DOCX, plain text, Fountain) — there is no in-app writing/editing surface for the screenplay text itself.
- **Desired behavior**: out of scope for this audit's mandate (logistics + IAM); noted for completeness only, per the module list.
- **Severity**: Low — this is a deliberate product-scope decision, not a defect. FilmSet positions itself as production management, not a screenwriting tool (industry-standard writing tools already exist and are not this product's differentiator).
- **Proposed milestone**: none. Recommend explicitly descoping "Write" from the roadmap unless product strategy changes.

### 3. Script — `PARTIAL`
- **Present**: import (PDF/DOCX/TXT/Fountain) with scene-heading/action/dialogue parsing (`app/script/import-actions.ts`, `apps/web/lib/import/parse-pdf.ts`, `parse-docx.ts`); every speaking character auto-creates a linked Cast slot; revision tracking by industry-standard color (`REVISION_COLORS`, `packages/core/src/index.ts`); revision re-import only touches changed scenes (`importRevision`).
- **Desired behavior**: also needs Final Draft (`.fdx`) import (explicitly out of scope today — no reliable open-source `.fdx` parser was found; noted honestly in the feature's own PR description) and a per-scene script-page reading view distinct from the breakdown/editing view.
- **Severity**: Medium — the gap (`.fdx`) blocks studios/productions whose source-of-truth is Final Draft, a large share of the professional market.
- **Dependencies**: none blocking.
- **DB impact**: none for `.fdx` support beyond what already exists; would need a dedicated parser dependency.
- **Proposed milestone**: P10 (hardening) or a dedicated future milestone if `.fdx` support becomes a customer blocker.

### 4. Breakdown — `PARTIAL`
- **Present**: `breakdownElement`/`breakdownCategory` schemas exist and are wired into the Script page's live state (`app/script/script-page-inner.tsx`), letting elements be tagged per scene by category.
- **Desired behavior**: a dedicated breakdown sheet/report view (props list, wardrobe list, vehicles list, cast-by-scene grid) separate from the script-editing screen; cross-department breakdown exports.
- **Severity**: Medium — the underlying data model is sound; the missing piece is presentation/reporting, not architecture.
- **Dependencies**: none.
- **Proposed milestone**: P2–P3 range (department-scoped work naturally produces per-department breakdown views).

### 5. Schedule — `PARTIAL`
- **Present**: stripboard scheduling tied to real scenes (`app/schedule/`), shoot-day creation/status.
- **Desired behavior**: the event relationships Part 21 requires (`SceneMoved`, `ShootDayChanged`, `CastWorkDayChanged` propagating to dependent modules) do not exist — a schedule change today does not notify or flag downstream Logistics/Money impact, because those downstream modules mostly don't exist yet either.
- **Severity**: Medium, rising to High once Logistics ships (a schedule change silently invalidating a travel/hotel booking is a real operational risk).
- **Dependencies**: Logistics core (P4) must exist before schedule-integration event relationships (P8) are meaningful.
- **Proposed milestone**: P8.

### 6. Cast — `COMPLETE`
- **Present**: full CRUD, contract status, sizing, contact info, headshot upload, CSV/XLSX/PDF/DOCX import with AI extraction (`app/cast/`).
- **Security implications**: cast records include phone/email (`contactInfoSchema`) and sizing (potentially sensitive for minors) — currently visible to **any** production member regardless of role (see Authorization Gap Analysis §3). This is a genuine gap, tracked there rather than duplicated here.

### 7. Crew — `PARTIAL`
- **Present**: full CRUD, standard department picklist (`STANDARD_DEPARTMENTS`, 25 entries), HOD gap-flagging (`isHod` boolean), contract status, CSV/XLSX/PDF/DOCX import.
- **Desired behavior**: `department` is free-text (no FK, no `CHECK` constraint — `packages/core/src/index.ts:111` comment confirms this is deliberate for flexibility, but it means "Camera" and "camera" *can* still silently become two departments if entered inconsistently outside the picklist UI, e.g. via CSV import). `isHod` carries no authorization meaning (see Part 5 finding in Authorization Gap Analysis).
- **Severity**: Medium.
- **Proposed milestone**: P2 (Departments/HOD) — see `LOGISTICS_DOMAIN_MODEL.md` §5 and `AUTHORIZATION_GAP_ANALYSIS.md` §4.

### 8. Locations — `COMPLETE`
- **Present**: permit status/expiry, photo upload with AI-suggested scene matching, CSV/XLSX/PDF/DOCX import.

### 9. Production Office — `MISSING`
- **Present**: no dedicated module. Team/contact management is spread across Cast, Crew, and the Team-invite flow (`app/production-actions.ts`) rather than unified under a "Production Office" concept.
- **Desired behavior**: unclear from the current product — this needs a product decision (is "Production Office" a distinct module, or just framing over Cast+Crew+Documents?) before it's designed.
- **Severity**: Medium — flagged as a scoping question for the product owner, not a build item yet.
- **Proposed milestone**: needs decision before scheduling.

### 10. Shoot Day / Call Sheet — `PARTIAL`
- **Present**: full call sheet editor (timeline events, per-person call times), cast call status (Work/Hold/Travel/Start/Work-Finish/Finish), background extras, stand-ins, production vehicles, transport runs (`app/shoot-day/call-sheet-actions.ts`), call sheet distribution.
- **Desired behavior**: "transport runs" here is a simple per-shoot-day list, not the full `Movement`/`MovementLeg`/conflict-detection model Part 3 specifies (see Module 14, Transportation, below) — this is the same underlying gap viewed from the call-sheet side.
- **Severity**: Medium.
- **Proposed milestone**: P6 (Transportation/Movement) will subsume and formalize this.

### 11. Logistics (umbrella: Travel/Accommodation/Transportation/Catering) — `MISSING`
- **Present**: no `Booking`, `ApprovalWorkflow`, or Logistics Control Center concept anywhere. What exists (call-sheet-level vehicles/transport, per module 10) is production-day logistics, not the full prep-through-wrap booking lifecycle Part 3 specifies.
- **Severity**: High — this is the single largest gap in the audit relative to the mandate's scope, and the reason Parts 3–4, 20–23, and 29 of the source brief exist. Full design in `LOGISTICS_DOMAIN_MODEL.md` and `LOGISTICS_UX_SPEC.md`.
- **Proposed milestone**: P4 (Logistics core) onward.

### 12. Travel — `MISSING`
- No `TravelJourney`, `TravelSegment`, `TravelBooking`, or any related entity exists. Full design in `LOGISTICS_DOMAIN_MODEL.md` §1.
- **Proposed milestone**: P5.

### 13. Accommodation — `MISSING`
- No `AccommodationProperty`, `RoomBlock`, `Stay`, or related entity exists. No Rooming List/Arrival List/Occupancy Report generation of any kind. Full design in `LOGISTICS_DOMAIN_MODEL.md` §2.
- **Proposed milestone**: P5.

### 14. Transportation — schema-adjacent only, effectively `MISSING` for the Part 3 model
- **Present**: `productionVehicleSchema`, `transportRunSchema`, `vehicleTypeSchema` exist in `packages/core/src/index.ts` and are wired into the call-sheet UI (module 10). This is real but is a flat, single-shoot-day list — no `Movement`/`MovementLeg`/`PassengerManifest` state machine, no driver entity, no conflict detection (vehicle/driver/passenger/capacity), no route/pickup-point modeling.
- **Severity**: Medium today (the simple version covers a single shoot day adequately); would be High if left as the permanent design, since it cannot detect the conflicts Part 3 requires.
- **Proposed milestone**: P6.

### 15. Catering — `MISSING`
- No `DietaryProfile`, `MealService`, `CateringOrder`, or related entity exists anywhere. No meal-count generation from schedule/attendance. Full design in `LOGISTICS_DOMAIN_MODEL.md` §3.
- **Proposed milestone**: P7.

### 16. Documents — `PARTIAL`
- **Present**: deal memos and compliance documents, storable and linkable to a cast/crew/location record, with expiry tracking (`documentTypeSchema`, `app/documents/`).
- **Desired behavior**: no document-level sensitivity classification (Part 9) — every document is visible to every production member regardless of role, same gap as storage RLS generally (see Architecture Map §5). No document versioning.
- **Severity**: Medium.
- **Proposed milestone**: P3 (once Security Center / classification exists) or P9.

### 17. Tasks — `MISSING`
- No task/checklist entity exists anywhere in the schema or UI. Zero matches for "task" as a domain concept in the entire codebase.
- **Severity**: Medium — a generic task list is common in comparable tools but wasn't in this audit's explicit module list detail; flagged for product-owner scoping.
- **Proposed milestone**: needs decision before scheduling.

### 18. Money — `PARTIAL`
- **Present**: department-level budgets with auto-computed Actuals derived from approved expenses (`recomputeActual()`, `app/money/actions.ts`), expense CRUD with approval status, CSV import.
- **Desired behavior**: Part 22 (Logistics↔Finance) requires a `Booking → Commitment → Invoice → Actual → Reconciliation` chain; today expenses are entered manually with no link to any booking (because bookings don't exist yet — see module 11).
- **Severity**: High — this is explicitly the dependency Part 20/22 name, and Money is real revenue/spend data, so its current lack of any approval-workflow engine (every "approval" is a single boolean-ish status field, not `ApprovalWorkflow`/`ApprovalStage`) is a genuine architectural gap, not just a missing feature.
- **Proposed milestone**: P9 (Logistics↔Finance), after the generic Approval Engine and Booking Engine (P4/P19–20 in the source brief's numbering) exist.

### 19–22. Post, Rights, Delivery, Distribution — `MISSING`
- **Present**: nothing. Zero schema, zero UI, zero server logic for any post-production, rights-management, delivery, or distribution workflow. The only appearance of these terms in the codebase is "Post-Production" as one entry in the Crew department picklist (a department name, not a workflow module) and a single doc-comment in `packages/core/src/index.ts` explicitly listing "rights" as a *not-yet-modeled* concept.
- **Severity**: Low — FilmSet's entire current feature set is pre-production/production-phase. These are post-wrap-phase modules; building them now, before the core production and logistics/security work lands, would be premature scope expansion.
- **Proposed milestone**: not sequenced in this roadmap; revisit only after P0–P9 land and product strategy confirms post-phase is in scope.

### 23. FilmSet AI — `PARTIAL`
- **Present**: production-wide recommendations (severity/conflict/explanation/options) and Universal Import extraction, both following the real Suggest→Explain→Preview→Approve→Commit chain (see Architecture Map §7) with an audit trail (`ai_suggestion_log`).
- **Desired behavior**: the AI layer is architecturally sound for what it does; the gap is coverage, not trust — it doesn't yet reason across the Logistics/Money domains that don't exist yet.
- **Severity**: Medium, and mostly downstream of other modules landing.
- **Proposed milestone**: extend module-by-module as Logistics/Money mature.

### 24. Administration — `UI ONLY` / `MISSING`
- **Present**: `/settings` lets a user edit their own display name and link to password reset. Team invite/remove exists (`app/production-actions.ts`) but is not surfaced as a distinct "Administration" area — it's folded into Settings.
- **Desired behavior**: no Security Center, no organization-level administration (there is no "organization" entity above "production" at all today — see Authorization Gap Analysis §2), no role/permission management UI, no audit log viewer.
- **Severity**: High — Administration is the surface every capability in Parts 6–18 of the source brief needs to be reachable from, and none of it exists yet.
- **Proposed milestone**: P3 (Security Center) is the first real Administration surface.

### 25. Security — `MISSING`
- **Present**: RLS tenant isolation (real) and HTTPS/Vercel-platform defaults. No session tracking, no MFA, no login history, no security event logging, no step-up authentication, no IP/device visibility. See Architecture Map §3 and §6.
- **Severity**: **Critical** — not because anything is currently exploited, but because zero of the visibility this platform needs to be "trusted infrastructure for professional productions" (the audit's own stated goal) exists yet.
- **Proposed milestone**: P3, informed by `SECURITY_ARCHITECTURE_V1.md` and `THREAT_MODEL.md`.

### 26. Permissions — `ARCHITECTURALLY WEAK`
- **Present**: a working, real, but flat 7-value role enum, enforced by convention (`assertRole()` calls that must be remembered per Server Action) rather than by a queryable, DENY-by-default authorization engine. No department scoping, no ABAC, no custom roles, no permission-change auditing. Full analysis in `AUTHORIZATION_GAP_ANALYSIS.md`.
- **Severity**: **Critical** — this is the load-bearing gap behind Parts 5–18 of the source brief; almost every other Security/Logistics capability assumes a permission engine that doesn't exist yet.
- **Proposed milestone**: P1, before any department- or logistics-scoped feature work (P2 onward) — building department-scoped features on top of the current flat-role model would create the exact technical debt the audit's mandate warns against.

### 27. Audit — `MISSING`
- **Present**: `ai_suggestion_log` only (AI actions, not general changes). No Production Audit stream, no Security Audit stream, no append-only/immutable storage, no before/after diffs on manual edits.
- **Severity**: **Critical** — same reasoning as Security/Permissions above; full design in `AUDIT_EVENT_CATALOG.md`.
- **Proposed milestone**: P3, built alongside Security Center since the two are one feature in practice (a security center with nothing to show is not a security center).
