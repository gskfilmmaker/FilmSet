# FilmSet — Permission Matrix V1

**Audit deliverable 8 of 11.** The concrete permission vocabulary (Part 8) and how the seed role templates (Part 7, elaborated in `AUTHORIZATION_GAP_ANALYSIS.md` §3) map to it. This is the artifact `authorize()` (`SECURITY_ARCHITECTURE_V1.md` §1) evaluates against — every permission here is a `resource.action` string, never a job title.

**Scoping note**: a literal full cross-product table (every one of the ~24 seed roles × every permission below) would run to several hundred mostly-redundant rows and isn't more useful than the tiered bundles in §4 — roles inherit a bundle by tier, with named exceptions called out explicitly rather than repeating the whole grid per role.

---

## 1. Action Vocabulary

Applied consistently across every resource domain below — not every action is meaningful for every domain (e.g. `publish` doesn't apply to `contracts`), but the vocabulary itself is shared:

| Action | Meaning |
|---|---|
| `view` | See the resource at its general/non-sensitive level |
| `view_sensitive` | See sensitive fields within the resource (per `PART 9 — Data Sensitivity`) |
| `create` | Add a new instance |
| `edit` | Modify any instance in scope |
| `edit_own` | Modify only instances the principal authored/owns |
| `manage` | Full CRUD within scope, short of approval/publish |
| `approve` | Move an `ApprovalRequest`/`Booking` forward a stage |
| `publish` | Make a draft/internal resource visible beyond its authors (e.g. publish a call sheet) |
| `export` | Produce a structured export (CSV/PDF) of the resource set |
| `download` | Retrieve a stored file |
| `download_original` | Retrieve the unwatermarked/unredacted original, where a distinction exists |
| `share` | Create an external-facing share of the resource |
| `archive` | Soft-remove without deleting |
| `delete` | Hard-remove |
| `administer` | Manage the resource domain's own configuration (not its data) |

## 2. Resource Domains & Permissions

| Domain | Permissions |
|---|---|
| `schedule` | `schedule.view`, `schedule.manage`, `schedule.publish` |
| `script` | `script.view`, `script.manage`, `script.import` |
| `breakdown` | `breakdown.view`, `breakdown.manage` |
| `cast` | `cast.view`, `cast.view_sensitive`, `cast.manage` |
| `crew` | `crew.view`, `crew.view_sensitive`, `crew.manage` |
| `locations` | `locations.view`, `locations.manage` |
| `callsheet` | `callsheet.view`, `callsheet.manage`, `callsheet.publish`, `callsheet.distribute` |
| `budget` | `budget.view_summary`, `budget.view_detail`, `budget.manage`, `budget.approve` |
| `expenses` | `expenses.view`, `expenses.create`, `expenses.approve` |
| `documents` | `documents.view`, `documents.upload`, `documents.download_original`, `documents.delete` |
| `contracts` | `contracts.view`, `contracts.view_sensitive`, `contracts.manage` |
| `travel` | `travel.view`, `travel.manage`, `travel.approve` |
| `accommodation` | `accommodation.view`, `accommodation.manage`, `accommodation.approve` |
| `transport` | `transport.view`, `transport.manage`, `transport.approve` |
| `catering.dietary` | `catering.dietary.view_individual`, `catering.dietary.view_operational`, `catering.counts.view_aggregate` |
| `catering` | `catering.manage`, `catering.approve` |
| `bookings` | `bookings.view`, `bookings.manage`, `bookings.approve` (cross-cutting — see `LOGISTICS_DOMAIN_MODEL.md` §0.1) |
| `departments` | `departments.view`, `departments.manage`, `departments.assign_hod` |
| `ai` | `ai.suggest.trigger`, `ai.suggestion.approve`, `ai.log.view` |
| `security.users` | `security.users.view`, `security.users.manage` |
| `security.roles` | `security.roles.view`, `security.roles.manage` |
| `security.sessions` | `security.sessions.view`, `security.sessions.revoke` |
| `security.audit` | `security.audit.view`, `security.audit.export` |
| `security.api` | `security.api.manage` (privileged, step-up-gated — `SECURITY_ARCHITECTURE_V1.md` §4) |
| `permissions` | `permissions.view`, `permissions.manage` (step-up-gated) |
| `production` | `production.manage`, `production.delete` (step-up-gated) |
| `organization` | `organization.manage` (once Organization exists — `AUTHORIZATION_GAP_ANALYSIS.md` §2) |

## 3. Sensitivity-Gated Fields (cross-reference to Part 9)

| Field/resource | Base permission | `view_sensitive` unlocks |
|---|---|---|
| Cast/crew contact info | `cast.view` / `crew.view` | Full phone/email vs. masked |
| Cast/crew sizing (potential minors) | `cast.view` | Full sizing detail |
| Deal memo / contract terms | `contracts.view` | Compensation figures, bank/payment info |
| Dietary profile | `catering.dietary.view_operational` | Named individual profile (`catering.dietary.view_individual`) |
| Travel documents (passport/ID numbers, if ever captured) | `travel.view` | Government identifier fields |

## 4. Role Tier → Permission Bundle

Each tier grants a bundle; a named role within a tier either inherits it as-is or has an explicit exception noted.

| Tier | Roles | Bundle |
|---|---|---|
| Platform | Platform Security Admin | All `security.*`, `permissions.*` across every org/production — the only role with cross-org reach. |
| Organization | Organization Owner, Organization Admin | `organization.manage`, `security.users.*`, `security.roles.*`, `production.manage` (create new productions). Owner additionally holds `production.delete` org-wide; Admin does not (named exception). |
| Production leadership | Production Super Admin | Every permission listed in §2 within their production, including step-up-gated ones. |
| | Executive Producer, Producer, Line Producer, UPM | Full `view`/`manage` across all domains except `security.*`/`permissions.manage`; `budget.approve` and `bookings.approve` included. |
| Production management | Production Manager, Production Coordinator, APOC, 1st AD, 2nd AD | `manage` on `schedule`, `callsheet`, `crew`, `cast`; `view` (not `manage`) on `budget`/`contracts`; `bookings.view` + `travel.view`/`accommodation.view`/`transport.view` (not `manage` — they see logistics status, Logistics roles below own the bookings). |
| Department | Department Head | `departments.manage` **scoped to their own `DepartmentHeadAssignment`** (`LOGISTICS_DOMAIN_MODEL.md` §5) — this scoping is the entire point of the department model; a Costume HOD's grant does not extend to Camera's resources. `budget.view_detail` scoped to their `DepartmentBudgetScope` only. |
| | Department Coordinator | Same domain access as Department Head, `manage` narrowed to `edit`/`edit_own` — cannot reassign the HOD or approve. |
| | Department Member | `view` within their department scope; `edit_own` on resources they authored (e.g. their own continuity notes). |
| Finance | Production Accountant | `budget.*`, `expenses.*`, `bookings.approve` (the Accounting stage in the Booking→Commitment chain, `LOGISTICS_DOMAIN_MODEL.md` §0.3) — no `schedule.manage`/`crew.manage`. |
| Logistics | Travel Coordinator | `travel.manage`, `travel.approve` at the "operational requirement" stage only (not final booking confirmation — see the worked approval chain, `LOGISTICS_DOMAIN_MODEL.md` §0.2); `catering.dietary.view_operational` (needs to know dietary needs while booking meals in transit) but **not** `view_individual`. |
| | Transport Coordinator | `transport.manage`, `transport.approve`. |
| | Catering Head | `catering.manage`, `catering.dietary.view_individual` (the one role that legitimately needs named dietary data), `catering.approve`. |
| | Booking Manager | `bookings.manage`, `bookings.approve` at the "confirm with vendor" stage across Travel/Accommodation/Transport/Catering — the cross-domain confirmation role the worked approval chain names. |
| External | Cast, Background | `view` only, scoped to their own call times/travel/accommodation — no production-wide visibility at all. |
| | Vendor | `view` scoped strictly to the booking(s) naming them — never general production data. |
| | External Viewer | `view` on an explicitly, individually granted resource set only — the default-deny floor of the system, useful for a client/studio reviewer. |

## 5. Custom Roles

Per Part 7's explicit requirement, the above is a **seed set**, not a closed list. A custom role is a named bundle of the §2 permission strings, created and edited through the Security Center's Roles section (`SECURITY_ARCHITECTURE_V1.md` §5) — never by writing new code. `PERMISSION_MATRIX_V1.md` is the vocabulary custom roles compose from; it does not need to change when a production invents a new role title.
