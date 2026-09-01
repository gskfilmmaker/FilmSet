# FilmSet — Logistics Domain Model

**Audit deliverable 4 of 11.** Design only — nothing in this document is implemented. Covers Parts 3, 4, and 5 of the audit mandate (Travel, Accommodation, Transportation, Catering, and the Departments/HOD model that logistics roles depend on), plus the cross-cutting Booking/Approval engines from Parts 19–20 that every logistics subdomain reuses rather than reimplementing.

Today's closest equivalent is the flat `productionVehicleSchema`/`transportRunSchema` pair wired into the shoot-day call sheet (`packages/core/src/index.ts`, `app/shoot-day/`) — real, but scoped to a single shoot day with no booking lifecycle, no conflict detection, and no travel/accommodation/catering equivalent at all (`FILMSET_PLATFORM_GAP_AUDIT.md`, modules 11–15). This document supersedes that model rather than patching it — the new `Vehicle`/`Movement` entities below are meant to absorb and formalize what `productionVehicleSchema`/`transportRunSchema` already do, not duplicate them.

---

## 0. Two Engines Every Subdomain Shares

Before Travel, Accommodation, Transportation, and Catering are designed individually, two generic engines need to exist — every subdomain below is a *consumer* of these, not a reimplementation.

### 0.1 Booking Engine (Part 20)

```
Booking
  id, productionId, type: BookingType, status: BookingStatus,
  requestedBy, departmentId, subjectRef (polymorphic: which TravelJourney /
  Stay / Movement / CateringOrder / etc. this booking backs),
  vendorRef, cost, currency, createdAt, updatedAt

BookingType: TRAVEL | HOTEL | VEHICLE | LOCATION | EQUIPMENT | CATERING | SERVICE | OTHER

BookingStatus (lifecycle):
  REQUESTED → QUOTED → PENDING_APPROVAL → APPROVED → BOOKED → CONFIRMED
  → IN_USE → COMPLETED → RECONCILED
  (side branches at any point before COMPLETED: CHANGE_REQUESTED, CANCELLED,
   PARTIAL_REFUND, REFUNDED, NO_SHOW)

BookingQuote        — a vendor-supplied price/option before approval
BookingApproval     — one decision record, produced by the Approval Engine (§0.2)
BookingConfirmation — the vendor's confirmed booking reference
BookingChange       — a structured diff when a confirmed booking changes
BookingCancellation — terminal record with reason + any refund state
BookingCost         — the financial line this booking produces (see §0.3)
```

Every Travel booking, hotel Stay, vehicle Movement, and catering order **is** a `Booking` with a type-specific detail record attached via `subjectRef` — not a parallel, independently-lifecycled entity. This is what makes the Logistics Control Center (§4) a single query surface instead of four separate ones.

### 0.2 Approval Engine (Part 19)

```
ApprovalWorkflow  — a named, reusable chain of stages, scoped to a
                    production (or an org-level default), e.g.
                    "Standard Travel Approval"
ApprovalStage     — one step in a workflow: required role/permission,
                    order, optional conditions (e.g. "only if cost > $X")
ApprovalRule      — condition attached to a stage (amount threshold,
                    department, booking type)
ApprovalRequest   — one instance of a workflow running against one
                    Booking (or other approvable entity)
ApprovalDecision  — one stage's decision: approve/reject, by whom, when,
                    with an optional note — feeds the Production Audit
                    stream (`AUDIT_EVENT_CATALOG.md`)
```

Example chain, matching the audit brief's own worked example:

```
Travel Coordinator requests
  → Production Manager approves (operational requirement)
  → Booking Manager confirms (vendor booking)
  → Accounting recognizes (commitment/payment, §0.3)
```

**Explicitly**: no module gets its own hard-coded approval `if` chain. A new booking type (say, Equipment Rental) reuses `ApprovalWorkflow` with a different stage list, not new code.

### 0.3 Logistics ↔ Finance (Part 22)

```
Booking → Commitment → Invoice → Actual → Reconciliation
```

A `Commitment` is created when a `Booking` reaches `APPROVED` — it's a forward-looking financial obligation, not yet an `Expense`. It becomes an `Invoice` when the vendor bills it, and an `Actual` (today's `expenses` table, `app/money/actions.ts`) when paid/approved, at which point `recomputeActual()` already correctly rolls it into the department budget — **that part doesn't change**. What's new is the `Commitment` stage, which lets Money show "committed but not yet spent" instead of only "spent," and lets a Booking's cost be visible in the budget *before* an actual expense row exists. No vendor or cost data is duplicated between Money and Logistics — the `Booking` is the single source, `Commitment`/`Invoice`/`Actual` are its financial states, not copies.

---

## 1. Travel

| Entity | Key fields | Notes |
|---|---|---|
| `TravelJourney` | id, personRef, purpose, itinerary grouping | The traveler-facing whole trip; groups one or more segments. |
| `TravelSegment` | journeyId, mode (`AIR`\|`RAIL`\|`BUS`\|`CAR`\|`FERRY`\|`OTHER`), origin, destination, departure (timestamp+timezone), arrival (timestamp+timezone), carrier, journeyNumber | One leg. Timezone stored explicitly per endpoint — never assume production-local time for travel. |
| `TravelBooking` | segmentId, `Booking` (§0.1), confirmationRef, ticketRef | The bookable/vendor-facing side of a segment. |
| `PassengerAssignment` | bookingId, personRef, seatRef, baggage, specialAssistance | One passenger on one booking — supports group bookings. |
| `TravelItinerary` | personRef, generated view over that person's journeys/segments | Read model backing the "Individual Itinerary" document (Part 23). |
| `TravelChange` | segmentId, changeType, before/after snapshot, reason | Feeds `BookingChange` + the Production Audit stream. |
| `TravelApproval` | `ApprovalRequest` against a `TravelBooking` | Uses the generic Approval Engine, not bespoke logic. |

**Booking status** reuses `BookingStatus` (§0.1) — no separate travel-specific lifecycle.

## 2. Accommodation

| Entity | Key fields | Notes |
|---|---|---|
| `AccommodationProperty` | name, type (`HOTEL`\|`APARTMENT`\|`HOUSE`\|`TRAILER`\|`OTHER`), address | The physical place. |
| `AccommodationContract` | propertyId, negotiatedRate, taxes, depositTerms, cancellationDeadline | Production-level agreement with the property, independent of any one stay. |
| `RoomBlock` | contractId, dateRange, roomTypeId, quantity held | What was reserved in bulk. |
| `RoomType` | propertyId, name, capacity | Standard/suite/etc. |
| `RoomAssignment` | roomBlockId, personRef(s), sharing flag | Who's in which room — supports shared rooms explicitly, not as an edge case. |
| `Stay` | personRef, propertyId, checkIn, checkOut | The traveler-facing record. |
| `AccommodationBooking` | `Booking` (§0.1) subtype backing a `RoomBlock` or individual `Stay` | |
| `AccommodationChange` | structured diff on a `Stay`/`RoomAssignment` change | |

**Required generated documents** (Part 23, structured-data-derived — never hand-typed):

- Rooming List — every person, property, room, dates
- Arrival List / Departure List — derived from `Stay.checkIn`/`checkOut`, cross-referenced against `TravelSegment.arrival`/`departure` to flag mismatches (someone arriving with no matching hotel check-in, or vice versa)
- Occupancy Report — `RoomBlock` capacity vs. `RoomAssignment` fill
- Unassigned Rooms Report — held-but-unassigned rooms in a block
- Accommodation Cost Report — rolls up via §0.3's `Commitment`/`Actual` chain

## 3. Transportation

| Entity | Key fields | Notes |
|---|---|---|
| `Vehicle` | typeId, plate/identifier, capacity | Supersedes today's flat `productionVehicleSchema`. |
| `VehicleType` | name (`Production Vehicle`\|`Cast Car`\|`VIP Vehicle`\|`Shuttle`\|`Bus`\|`Van`\|`Equipment Vehicle`\|`Picture Vehicle`\|`External Taxi/Chauffeur`) | Picture vehicles are flagged distinctly since they're a script/continuity asset, not just transport. |
| `VehicleBooking` | `Booking` (§0.1) subtype | |
| `Driver` | personRef, qualifications | |
| `DriverQualification` | driverId, qualificationType, expiry | Feeds conflict detection (§0's expired-qualification case). |
| `Movement` | date, purpose, status | Supersedes today's flat `transportRunSchema`. |
| `MovementLeg` | movementId, pickupPointId, dropoffPointId, scheduledTime, vehicleId, driverId | One leg of a movement — a movement can have multiple legs (multi-stop run). |
| `PassengerManifest` | legId, personRef list | |
| `MovementAssignment` | legId, vehicleId, driverId | Separated from `MovementLeg` so reassignment doesn't rewrite the leg's schedule. |
| `Route` | named/reusable path (e.g. "Hotel → Set") | |
| `PickupPoint` | name, location, notes | |

**Movement statuses**: `PLANNED` → `CONFIRMED` → `DRIVER_ASSIGNED` → `READY` → `BOARDING` → `EN_ROUTE` → `ARRIVED` → `COMPLETED` (side branch: `CANCELLED`).

**Conflict detection** (computed, not stored — run as a query against active `MovementAssignment`/`PassengerManifest` rows, surfaced in the Logistics Control Center, §4):

- **Vehicle conflict**: same `vehicleId` assigned to two overlapping legs.
- **Driver conflict**: same `driverId` assigned to two overlapping legs, or assigned past a qualification expiry.
- **Passenger conflict**: same person on two overlapping legs.
- **Capacity conflict**: `PassengerManifest` size exceeds `Vehicle.capacity`.
- **Late pickup**: current time past `scheduledTime` with leg still `PLANNED`/`CONFIRMED`.
- **Overlapping routes**: two legs sharing a `Route`/`PickupPoint` within a window too tight to be physically possible (parametrized, not hardcoded).
- **Schedule dependency conflict**: a `MovementLeg`'s time doesn't leave enough buffer against the `Schedule` module's call time it's meant to serve (§ Logistics↔Schedule integration below).

## 4. Logistics Control Center

A real-time operational surface — **not a decorative dashboard**, per the mandate's explicit instruction. Every tile below is a live query result, not a static metric:

- Today's arrivals / departures (from `TravelSegment` + `Stay`)
- Hotel check-ins / check-outs
- Active movements (`Movement` in `EN_ROUTE`/`BOARDING`)
- Delayed movements (past `scheduledTime`, not yet `ARRIVED`)
- Transport exceptions (any conflict from §3's conflict list)
- Missing assignments (a `MovementLeg` with no `MovementAssignment`, a confirmed `Stay` with no `RoomAssignment`)
- Booking changes (recent `BookingChange`/`TravelChange`/`AccommodationChange`)
- Capacity issues (§3)
- Schedule impacts (§ below)

**UX principle** (Part 29, carried into `LOGISTICS_UX_SPEC.md`): the Control Center should be *calm* when nothing needs attention — an empty exceptions list is the success state, not a wall of green checkmarks demanding to be read. Full interaction design is in `LOGISTICS_UX_SPEC.md`.

## 5. Departments & HOD Model

Referenced by every logistics role above (Travel Coordinator, Transport Coordinator, Catering Head are department-scoped roles) — designed here because Logistics is the first domain that actually needs it, though it's a cross-cutting fix, not a logistics-only one (see `AUTHORIZATION_GAP_ANALYSIS.md` §5 for why today's `isHod` boolean can't carry this weight).

| Entity | Key fields | Notes |
|---|---|---|
| `Department` | productionId (or orgId for a reusable template), name, parentDepartmentId? | Configurable per production; seeded from a default list (Production, AD, Camera, Grip, Electric, Sound, Art, Construction, Set Decoration, Props, Costume, Hair, Makeup, Locations, Transport, Travel, Catering, Accounting, DIT, VFX, SFX, Stunts, Security, Editorial, Other) — a superset reconciling today's `STANDARD_DEPARTMENTS` picklist with the mandate's list. |
| `DepartmentRole` | departmentId, name, permission bundle | Department-scoped role template (e.g. "Costume HOD" vs. "Costume Assistant"). |
| `DepartmentMembership` | departmentId, personRef, roleId, effective dates (see Authorization Gap Analysis §7) | |
| `DepartmentHeadAssignment` | departmentId, personRef | The authoritative "who is HOD of *this* department" record — replaces `crew_members.is_hod`'s display-only flag with something the authorization engine actually checks. |
| `DepartmentPermission` | departmentId, permission string | Department-scoped permission grants layered on top of the production-wide `PERMISSION_MATRIX_V1.md`. |
| `DepartmentBudgetScope` | departmentId, budgetLineId(s) | Ties a department to the `budget_lines` rows (already in `packages/db/src/schema.ts`) it should see/manage — this is what makes "Wardrobe HOD sees Wardrobe budget, not Camera budget" actually enforceable. |

**Migration note**: `crew_members.is_hod` and the free-text `department` column are not deleted in this design — they become the *display* layer (sort order, Contact Sheet grouping) that reads from the new first-class `DepartmentHeadAssignment`/`Department` tables as the source of truth, avoiding a breaking rewrite of Crew screens that already work.

## 6. Catering

| Entity | Key fields | Notes |
|---|---|---|
| `DietaryProfile` | personRef, requirements (free text + structured allergens) | **Individually identifiable** — see the permission split below. |
| `DietaryRequirement` | profileId, requirement type, severity | Structured half of the profile (e.g. "Nut allergy — severe" vs. free-text notes). |
| `MealService` | date, locationRef, mealType (breakfast/lunch/dinner/craft) | |
| `MealServiceAssignment` | serviceId, personRef | Who's expected at this service — derived from `Schedule`/`Movement` attendance where possible, not re-entered by hand. |
| `CateringVendor` | name, contact, contract terms | |
| `CateringOrder` | vendorId, serviceId, `Booking` (§0.1) subtype | |
| `CraftService` | locationRef, standing/ongoing service, distinct from scheduled `MealService` | |
| `MealCount` | serviceId, aggregate counts by dietary category | The **anonymized** output — see permission split. |
| `MealAdjustment` | mealCountId, delta, reason | Manual correction to a derived count. |

**Permission split** (Part 4's explicit requirement — dietary information is sensitive):

| Permission | Grants |
|---|---|
| `catering.dietary.view_individual` | See a named person's `DietaryProfile`/`DietaryRequirement` — tightly scoped (Catering Head, medic, that person themselves). |
| `catering.dietary.view_operational` | See what a *service* needs to accommodate (e.g. "2 vegan, 1 severe nut allergy at Table 3") without names attached, for kitchen/serving staff. |
| `catering.counts.view_aggregate` | See `MealCount` totals only — no individual dietary detail at all, for general crew-facing meal-count visibility. |

**Required generated documents** (Part 23): Daily Meal Count, Dietary Summary, Catering Order, Location Service Schedule, Unit Catering Report — all derived from `Schedule`/`MealServiceAssignment`, never manually reconciled totals.

---

## 7. Logistics ↔ Schedule Integration (Part 21)

The `Schedule` module (real today, `app/schedule/`) needs to emit — not silently apply — impact signals when it changes:

```
ScheduleChanged / ShootDayChanged / SceneMoved / CastWorkDayChanged / LocationChanged
  → computed impact check against:
      Travel (does any TravelSegment now land on the wrong day?)
      Accommodation (does any Stay's date range now mismatch the shoot dates?)
      Transport (does any MovementLeg's schedule dependency now conflict?)
      Catering (does any MealServiceAssignment's date now mismatch?)
      Equipment / other bookings
      Cost (would a change trigger a cancellation fee or rebooking cost?)
  → surfaced as a proposed-change/alert requiring approval — never an
    automatic rebooking or automatic financial commitment
```

This is explicitly **advisory**, per the mandate's own constraint ("Do NOT introduce hidden automatic financial commitments... Generate proposed changes/alerts where approval is needed"). It reuses the Approval Engine (§0.2) — a schedule-triggered logistics impact becomes an `ApprovalRequest` against the affected `Booking`(s), not a direct mutation.

## 8. Logistics Documents (Part 23)

All of the following are **generated views over the structured entities above** — never a separately-maintained document:

Travel Manifest, Individual Itinerary, Arrival Report, Departure Report, Rooming List, Hotel Arrival List, Hotel Departure List, Occupancy Report, Movement Order, Passenger Manifest, Driver Sheet, Vehicle Assignment, Airport Pickup Sheet, Daily Transport Plan, Daily Catering Count, Dietary Summary, Catering Order, Logistics Daily Report.

This reuses whatever the eventual `Document Engine` pattern is (today, Documents are static uploaded files, per `FILMSET_PLATFORM_GAP_AUDIT.md` module 16 — these logistics documents are a **different** kind of "document": rendered output, not uploaded input. The two should share a naming/export convention but not the same storage-bucket model).
