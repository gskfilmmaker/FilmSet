# FilmSet — Logistics UX Spec

**Audit deliverable 10 of 11.** Covers Parts 28 and 29 of the audit mandate: role-adaptive workspaces and the Logistics Control Center's interaction design. Grounded in FilmSet's existing FRAME design system (`packages/ui`, `docs/design-system/README.md`) — this spec reuses real, already-built primitives (`EmptyState`, `StatusBadge`, the global sidebar/nav pattern in `apps/web/components/shell.tsx`) rather than inventing a new visual language for logistics.

---

## 1. Current Navigation — What's Actually There

`apps/web/components/shell.tsx`'s `navItems` is a single, flat list shown to every production member regardless of role: Overview, Script, Breakdown, Schedule, Cast, Crew, Contact Sheet, Wardrobe & Continuity, Locations, Set, Money, Documents — plus FilmSet AI and Settings. There is no role-based filtering of this list at all today. A `Crew`-role member sees the identical sidebar as a `Producer`.

**This is the literal problem Part 28 names**: "A restricted user should not merely see the Super Admin interface with disabled controls." Today it's not even disabled controls — every nav item is fully live for every role, gated only by whatever `assertRole()` check (if any) exists inside the page/action it links to (`AUTHORIZATION_GAP_ANALYSIS.md` §2–§4). A Costume department member currently sees Money and Documents in their sidebar with no indication those aren't really "theirs."

## 2. Role-Adaptive Workspace — Design Principle

The sidebar (and command palette, `packages/ui`'s `command-palette`) should render **only** what `authorize()` (`SECURITY_ARCHITECTURE_V1.md` §1) grants `*.view` on for the current principal — computed server-side, not hidden client-side after the fact (hiding a nav item with CSS while the underlying page remains reachable by URL is not access control). This is a filter over the same nav-item data structure that exists today, not a rewrite of the shell component.

**Worked examples, per the mandate:**

| Role | Sidebar shows |
|---|---|
| Costume HOD | Costume, Characters, Looks, Fittings, Continuity, Inventory, Purchases, Schedule, Call Sheets, Documents, Tasks |
| Transport HOD | Movements, Vehicles, Drivers, Passengers, Schedule, Locations, Call Sheets |
| Catering Head | Meal Services, Counts, Dietary Operations, Locations, Vendors, Schedule |
| Production Super Admin | Every authorized production module — the current full list, unchanged for this role |

**Implementation note**: "Costume" above maps to today's Wardrobe & Continuity module plus the new department-scoped views §5 of `LOGISTICS_DOMAIN_MODEL.md` enables ("Looks," "Fittings," "Inventory," "Purchases" are new, department-specific sub-views this audit's Departments model unlocks — not yet built, flagged as P2+ work, not implied to exist today).

## 3. Logistics Control Center — Layout

Single-page, exception-first, following FRAME's existing density/empty-state conventions (`packages/ui`'s `EmptyState`, `StatusBadge` — reused, not reinvented):

```
┌─────────────────────────────────────────────────────────┐
│  Logistics Control Center                    [date nav] │
├─────────────────────────────────────────────────────────┤
│  EXCEPTIONS (only section always visible, top of page)  │
│  ─ Vehicle conflicts (2)      ─ Late pickups (1)         │
│  ─ Unassigned passengers (3)  ─ Approvals pending (4)    │
├───────────────────┬───────────────────┬─────────────────┤
│  Today's Arrivals  │  Today's Departures│  Hotel Changes  │
│  (list)            │  (list)            │  (list)         │
├───────────────────┼───────────────────┼─────────────────┤
│  Active Movements  │  Delayed Movements │  Catering Counts│
│  (live status)     │  (list, red)       │  (summary)      │
└───────────────────┴───────────────────┴─────────────────┘
```

**Calm-when-healthy principle (Part 29's explicit instruction)**: the Exceptions band is the only section that visually escalates (uses `StatusBadge`'s existing `danger`/`warning` tones) — and it **collapses to a single quiet "No exceptions" state** when empty, rather than showing a row of green checkmarks that still demands to be read. The remaining tiles (Arrivals/Departures/Hotel Changes/Movements/Catering) are informational, neutral-toned, and don't compete visually with real exceptions. This mirrors the same restraint principle FRAME already documents for status color elsewhere in the app (status color is never the sole identifier, never used to "paint the interface" — `docs/design-system/README.md`'s cited Constitution §11).

## 4. Exception-Driven Interaction

Each exception type (§3 of `LOGISTICS_DOMAIN_MODEL.md`) is a single-line, click-through item: summary text, severity tone, and a direct link into the specific `MovementLeg`/`RoomAssignment`/`Booking` that needs attention — never a generic "go check the schedule" link. This matches the pattern FilmSet's Overview page already uses for AI recommendations and pending approvals (`app/notifications-actions.ts`) — the Control Center's exceptions list is architecturally the same *shape* of feature, applied to logistics data instead of AI/approval data, and should reuse that existing UI pattern rather than invent a new one.

## 5. What Ships When

This spec assumes the entities in `LOGISTICS_DOMAIN_MODEL.md` exist — it is not buildable before P4 (Logistics core) lands, and the Control Center itself is properly a P4/P8 deliverable (it needs real `Movement`/`Stay`/`Booking` data to have exceptions to show). The role-adaptive sidebar filter (§2) is independent of Logistics and should ship with the permission engine itself (P1) — it's a direct, immediate visual payoff of `authorize()` existing, not something that needs to wait for Logistics.
