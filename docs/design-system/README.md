# FRAME — FilmSet Design System

Status: **Foundation complete** (Constitution §91, all 21 deliverables), **all five canonical screens built** (§72–77), and wired to a **real backend**: Supabase Postgres + Auth with real Row Level Security, and a real Suggest→Explain→Preview→Approve→Commit AI pipeline against Anthropic's API. Fixture data ("THE BAND") is now a seed script rather than the only data source — see [Environment](#environment) to run it against a live database.

## Packages

| Package | Purpose |
|---|---|
| `packages/tokens` | Source of truth. TS token definitions (`src/semantic.ts`, `src/primitives.ts`) plus hand-authored motion keyframes (`src/motion.css`) compiled to CSS custom properties per theme (`dist/css/*.css`) by `scripts/build-css.ts`. Never hand-edit the generated CSS. |
| `packages/ui` | FRAME components (`@filmset/ui`). Radix + cmdk + TanStack Table primitives restyled to FRAME; components reference semantic tokens only, never raw values. Storybook lives here. |
| `packages/core` | Zod domain schemas (Scene, Production, AIRecommendation, etc.) — the shared type layer between the DB, server actions, and screens. |
| `packages/db` | Drizzle ORM schema (`src/schema.ts`), versioned SQL migrations (`migrations/*.sql`, including RLS policies), a server-only Postgres client (`@filmset/db/server`), "THE BAND" fixture data (`@filmset/db`, client-safe) used by the seed script, and `scripts/{seed,migrate}.ts`. |
| `packages/auth` | Supabase Auth wiring: browser/server clients, middleware session refresh, and the `ProductionRole` RBAC vocabulary (§79), enforced both at the app layer (`apps/web/lib/authz.ts`) and by Postgres RLS. |
| `apps/web` | Next.js App Router app. Every screen is a Server Component that reads real data through `lib/queries.ts` and mutates it through per-route Server Actions (`app/*/actions.ts`) — no screen imports fixture data directly anymore. |

## Running it

```bash
pnpm install
cp apps/web/.env.example apps/web/.env.local        # fill in Supabase + Anthropic values, see Environment below
pnpm --filter @filmset/tokens build                 # generates CSS from TS token source
pnpm --filter @filmset/db db:migrate                # applies every migration (schema + RLS) to your Supabase Postgres
pnpm storybook                                       # FRAME components, all states, 3 themes, 2 densities
pnpm --filter @filmset/web dev                       # the real app — sign up, then see Environment for demo data
```

## Environment

Four environment variables, set in `apps/web/.env.local` for local dev and in the Vercel project's Environment Variables for deploys (`apps/web/.env.example` mirrors this list):

| Variable | Where to find it |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase dashboard → Project Settings → API → Project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Same page → Project API keys → `anon` `public` (Supabase's current name for what used to be called the "anon key") |
| `DATABASE_URL` | Project Settings → Database → Connection string. Use the **Transaction pooler** (port 6543) for the running app (`apps/web/vercel` and local dev) — the **Session pooler** or direct connection (port 5432) for `db:migrate`, since migrations need a non-pooled connection. |
| `ANTHROPIC_API_KEY` | console.anthropic.com → API Keys |

None of these are ever hard-coded — every value is read from `process.env` (see `packages/auth/src/{browser,server,middleware}.ts` and `packages/db/src/client.ts`), and the service-role key is never used anywhere, including server-side: the app always connects as `authenticated` (see [Row Level Security](#row-level-security) below), and migrations run as the plain `postgres` role from `DATABASE_URL`.

### First-time setup

1. `pnpm --filter @filmset/db db:migrate` — applies every file under `packages/db/migrations/` in order (tables, RLS/trigger/grants, then later hardening/feature migrations) to your Supabase Postgres, tracked so re-running is safe.
2. Run the app (`pnpm --filter @filmset/web dev`) and sign up for an account at `/signup`. Signing up auto-creates a `profiles` row (via the Postgres trigger, not app code); a brand-new account then lands on `/onboarding` and gets an empty production with you as its `Producer`.
3. To load the full "THE BAND" demo dataset instead of starting empty: find your new user's id in Supabase → Authentication → Users, then run `SEED_OWNER_USER_ID=<that-uuid> pnpm --filter @filmset/db db:seed`. It's idempotent — safe to re-run after schema changes. (The seed script connects with the plain `postgres` role and bypasses RLS by design — it's a trusted, developer-run operation, not something end users trigger.)

If the schema ever changes: edit `packages/db/src/schema.ts`, run `pnpm --filter @filmset/db db:generate` to produce a new versioned `.sql` file under `migrations/`, review it, commit it, then `db:migrate` to apply it. RLS/trigger/grant changes are hand-written SQL (Drizzle doesn't generate policy syntax) — use `drizzle-kit generate --custom --name <description>` to get a new empty numbered file to write them into, the same way `0001_rls_and_auth_trigger.sql` was created.

No Supabase/Anthropic project available yet? The five screens still exist as pure UI — see git history before this environment section was added for the fixture-only prototype build.

**Status**: `0000_init.sql` (all 25 tables) and `0001_rls_and_auth_trigger.sql` have been applied to the live GSK PRODUCTIONS INC. FilmSet Supabase project, verified by Supabase reporting exactly 33 active RLS policies (3 on `profiles` + 4 on `productions` + 4 on `production_members` + 18 one-per-table on the remaining production-scoped tables + 4 on the join tables). `0002_cross_production_guards.sql` and `0003_active_production.sql` (below) still need to be applied the same way. All were applied via the Supabase SQL Editor rather than `db:migrate`, since this sandbox's network policy only permits outbound HTTPS and can't open a raw Postgres connection.

- **`0002_cross_production_guards.sql`** — closes two gaps found in a manual security audit of the live Preview: (1) the Team invite flow's "look up an invitee by email" query was silently blocked by `profiles`' own RLS (which correctly hides a stranger's row, but a fresh invitee isn't a co-member yet either) — fixed with a `security definer` `find_profile_for_invite(production_id, email)` function gated on the caller already being that production's Producer; (2) `prop_scenes`/`scene_cast`/`issue_scenes` policies only checked the *scene* side's production membership, so a user in two productions could attach a prop/cast member/issue from one production onto a scene in the other — fixed by requiring both linked rows to share a `production_id`.
- **`0003_active_production.sql`** — adds `profiles.active_production_id`, the persisted pointer behind the project switcher (see [Production Manager](#production-manager) below).

## Row Level Security

Every table has RLS enabled (`packages/db/migrations/0001_rls_and_auth_trigger.sql`) and it is the **real** enforcement boundary, not a formality alongside app-layer checks:

- **The problem**: `DATABASE_URL` authenticates as the `postgres` role, which owns every table and bypasses RLS by default — so naively turning RLS on wouldn't actually restrict anything the app does.
- **The fix**: `runAsUser(userId, fn)` (`packages/db/src/client.ts`) wraps every user-facing query in a transaction that runs `SET LOCAL ROLE authenticated` plus `set_config('request.jwt.claims', ...)`, so for the duration of that transaction Postgres treats the connection exactly as it would treat a request through Supabase's own API — Supabase's `auth.uid()` resolves to the real signed-in user, and the RLS policies apply for real. Every Server Action and every Server Component's data fetch (`apps/web/lib/queries.ts`, `apps/web/lib/authz.ts`, every `app/*/actions.ts`) goes through `runAsUser`; only the seed script and migrations use the unwrapped, privileged connection.
- **The policies**: keyed off `production_members` — a user can read/write a row if they're a member of that row's production (via a `security definer` helper, `is_production_member`, that avoids infinite recursion). `productions` and `production_members` themselves have narrower policies: only a `Producer` can update/delete a production or manage other members' roles; anyone can see and remove their own membership.
- **`anon` gets nothing**: no `GRANT` is issued to the `anon` role, so an unauthenticated request can't read or write any application table regardless of RLS — authentication is required before RLS is even reached.

## Production Manager

A signed-in user can belong to more than one production. `apps/web/app/production-actions.ts` holds the three server actions this needs:

- `createProduction(formData)` — creates a production, makes the caller its Producer, and makes it their active production. Used by both `/onboarding` (a brand-new account's first production) and the project switcher's "New production" form.
- `listMyProductions()` — every production the caller belongs to, for the switcher.
- `switchActiveProduction(productionId)` — re-validates membership (never trust a client-supplied id blindly) and updates `profiles.active_production_id`.

`apps/web/lib/authz.ts`'s `requireCurrentProduction` — the function every protected page calls first — reads `active_production_id` and falls back to the caller's earliest membership if it's unset or points at a production they're no longer in (an account created before this preference existed, or a stale pointer). The switcher itself lives in `apps/web/components/shell.tsx`, opened from the production name in the global bar.

## Cast, Crew, Locations, Settings

Every sidebar item now goes somewhere real — no more silent bounces to `/overview`:

- **`/cast`, `/crew`, `/locations`** — real CRUD (`apps/web/app/{cast,crew,locations}/`), each an inline list-with-edit-row page following `team-section.tsx`'s established pattern (server-fetched props from `getProductionSnapshot`, a client component, toasts, `router.refresh()` after every mutation) rather than a Dialog, per FRAME's own guidance to prefer inline editing over a modal for anything that isn't a focused/irreversible action. Cast members reference a `characters` row; `apps/web/app/cast/actions.ts`'s `findOrCreateCharacter` reuses an existing character with the same case-insensitive name in the production rather than creating a duplicate on every edit.
- **`/settings`** — a real route at last (it fired `onNavigate` before but wasn't in the id lookup array, so nothing happened); minimal for now — edit your display name, a link to the existing password-reset flow.
- **`/money`, `/documents`** — real routes with an honest "Coming soon" `EmptyState` rather than a dead link, per the audit's own recommendation: building the full budget/document workflows is future work, but a route that says so beats one that silently does nothing.

**Also hardened while touching this code**: `persistBoard` (stripboard drag-drop), `addBreakdownTag`, and the AI approve/reject/dismiss actions previously updated rows by id alone, trusting RLS as the only production boundary. RLS still blocks true cross-tenant access, but Production Manager just made "a user who belongs to two productions" a real case — so these now also verify the id belongs to the `productionId` the caller claims before writing, closing an internal reassignment path RLS's `is_production_member(production_id)` check doesn't cover on its own (it checks the row's own production_id, not that a *referenced* row like a scene actually belongs there).

## Testing this locally

After `db:migrate` (and optionally `db:seed`):

1. **Sign-in / sign-up** — visit `/signup`, create an account, confirm you land on `/onboarding` (not stuck in a redirect loop), name a production, confirm you land on `/overview` with that production's name in the top bar. Sign out (top-right user menu), confirm you're bounced to `/login`. Sign back in.
2. **Create data** — on `/schedule`, drag a strip between days and confirm the change survives a page refresh (it's now in Postgres, not just React state). On `/script`, confirm/reject an AI-suggested breakdown element and refresh — it should stay confirmed.
3. **Password reset** — from `/login`, click "Forgot password?", request a reset for your email, follow the link Supabase emails you, set a new password, confirm you land on `/overview`.
4. **Team management** — as the Producer, open the Team section on `/overview`, add a second account by email (sign up a second test account first so a `profiles` row exists for it), confirm it appears with a role selector. Change its role; remove it.
5. **Verify access control (the important one)** — sign up a *third*, unrelated account and do **not** add it to the first account's production. Signed in as that third account: it should land on `/onboarding` (no existing membership), and if you note the first production's id and try to hit its data, RLS should return nothing — there is no UI path to type a production id manually, but you can confirm this directly in the Supabase SQL Editor: `select * from productions;` run as the `postgres` role shows all productions (expected, RLS doesn't apply to migrations), while the app itself only ever shows the signed-in user's own production because every query runs through `runAsUser`.
6. **Production Manager** — from `/overview`, click the production name in the global bar; the switcher should list every production you're a member of with a checkmark on the current one. Use "New production" to create a second one — you should land on `/overview` showing the new production instead. Reopen the switcher and click back to the first one; confirm its data (not the new production's) is what renders. Invite a second real (already-signed-up) account by email in Team — this exercises `find_profile_for_invite`, the `0002` migration fix for the RLS gap that used to make every invite of a non-co-member fail with "no account found."

## Token architecture

- **Source of truth**: `packages/tokens/src/{primitives,semantic}.ts` — typed, documented, versioned. Motion keyframes are hand-authored CSS (`src/motion.css`) since keyframes are structural, not key/value pairs, but durations/easings inside them still reference the generated `--fs-motion-*` variables.
- **Generated CSS**: `--fs-*` custom properties (theme-independent: spacing, radius, typography, motion, shadow, opacity, control height, table row height, panel width, z-index) plus per-theme `--fs-color-*` blocks selected by `[data-theme]`.
- **Tailwind wiring**: `tailwind-theme.css` maps Tailwind's own `@theme inline` variables (`--color-*`, `--radius-*`, `--shadow-*`) straight onto the `--fs-*` variables, so a utility class like `bg-canvas` or `text-primary` always resolves through the token layer — Tailwind class names and token names are the same names (§71). **Spacing is deliberately not remapped this way** — see the bug writeup below.
- **Theming**: three themes (`light`, `dark`, `high-contrast`) selected via `[data-theme]` on `<html>`. Zero component duplication — verified in Storybook (`FRAME/AppShell`) and in `apps/web` via the theme/density selector, and by the full 3-theme a11y sweep.
- **Density**: `[data-density="comfortable"|"compact"]` resolves a single `--fs-control-height` / `--fs-table-row-height` variable that every component reads — no per-density component forks (§15).

### Color token inventory (§7)

`color.background.{canvas,surface,elevated,overlay}`, `color.text.{primary,secondary,tertiary,inverse}`, `color.border.{subtle,standard,strong}`, `color.action.{primary,hover,active,onPrimary}`, `color.status.{success,warning,danger,info}` — defined independently for light, dark, and high-contrast in `semantic.ts`.

`action.onPrimary` was added mid-pass — see the a11y writeup below for why `text.inverse` wasn't sufficient.

Signal red (`#E5484D` in dark mode, `#CC3238` in light mode) is the accent — used only via `color.action.*`, never for status. Danger status uses a deliberately cooler/more crimson red so it's distinguishable from Signal at a glance; still an open question below.

### Other token groups

Spacing (4px base, §14), radius, typography (Inter, 10 type roles, tabular numerals for numeric/metadata roles per §13), motion (120–240ms, §34), shadow (deliberately subtle — dark mode leans on borders/contrast, not shadow, per §9), opacity, control height, table row height, panel width, z-index.

## A real, load-bearing bug: Tailwind's numbered scale is shared across utility families

Worth documenting prominently because it's the kind of mistake that's easy to reintroduce. The first version of `tailwind-theme.css` redefined `--spacing-4`, `--spacing-8`, etc. directly to pixel values (`--spacing-4: 4px`) so that `gap-4` would mean "4px," matching the Constitution's own spacing vocabulary. That broke **every other utility family that shares Tailwind v4's numbered scale** — most importantly `leading-<N>`, which is *also* keyed off `--spacing-<N>` in v4, not a separate line-height scale like earlier Tailwind versions. `leading-4` silently became a 4px line-height instead of 16px, collapsing every `ToastTitle`/`ToastDescription` (and several other components) into overlapping, ~4px-tall text — invisible in a quick glance, obvious once two toasts stacked and their text visibly collided.

Fix: removed the `--spacing-<N>` override entirely, and every component now references spacing via explicit arbitrary values that name the token directly — `gap-[var(--fs-space-8)]`, not `gap-8`. This is slightly more verbose but removes the entire bug class: nothing in FRAME depends on what Tailwind's native numbered scale happens to resolve to, for any utility family, ever. Verified with a full component-by-component grep for bare numbered spacing/leading utilities (none remain) plus a visual re-check of the previously-broken `Toast` story.

## A second real bug: dnd-kit's SSR hydration mismatch on the Stripboard

`@dnd-kit/core` generates internal accessibility IDs (`DndDescribedBy-N`, live-region IDs) from a module-level counter by default. Under Next.js SSR, that counter can reach a different value on the server render vs. the client's first render — React flagged a hydration mismatch (`aria-describedby="DndDescribedBy-0"` server vs. `"DndDescribedBy-2"` client) on every draggable strip. Fixed by passing a stable `id="stripboard-dnd"` to `DndContext`, which makes dnd-kit derive those IDs deterministically instead of from the counter. Confirmed fixed by checking the browser console for hydration warnings before and after (present on every load beforehand, gone after).

## Five canonical screens (§72–77)

All built as interactive, high-fidelity prototypes in `apps/web`, routed at `/overview`, `/script`, `/schedule`, `/shoot-day`, `/ai`, sharing one `Shell` component (`apps/web/components/shell.tsx`) for the GlobalBar/Sidebar/command-palette/shortcut-overlay chrome so screens only build their own workspace + inspector content. Fixture data is a single consistent production — "THE BAND," a Hindi crime drama — deep enough that the same names, scenes, and locations recur meaningfully across all five screens and the command palette (`packages/db/src/fixtures.ts`).

1. **Production Command Center** (`/overview`, §73) — status in seconds: a compact schedule/budget/script/cast status row, Today/Tomorrow cards, a ranked issues list, recent changes, and a "What's at risk?" entry into FilmSet AI. No decorative charts.
2. **Script + Breakdown** (`/script`, §74) — three-pane (scene nav / screenplay / breakdown inspector). The screenplay renders in monospace with real sluglines/action/dialogue formatting. Selecting text surfaces a floating "Tag as…" control (a genuine `mouseup`-driven selection listener, not a mockup) that adds a confirmed breakdown element. The inspector reproduces Constitution §29's own worked example verbatim for Scene 47 (AI-suggested Rain/Taxi/75 Background vs. confirmed AK-47/Suitcase) with working Confirm/Reject/Confirm-all actions.
3. **Stripboard** (`/schedule`, §75) — the signature interface. Built on `@dnd-kit` (not a FRAME primitive — screen-specific, kept out of `packages/ui` until a second consumer justifies extracting it): drag-to-reorder within a day, drag across days, and full keyboard reorder (focus a strip's handle, Space to pick up, arrows to move, Space to drop) as the accessible alternative required by §43. Conflict triangles cross-reference the issues fixture live. One-level undo. Color is never the sole identifier — a day/night accent bar always pairs with the explicit `DAY`/`NIGHT` text badge (§27).
4. **Shoot Day / Call Sheet** (`/shoot-day`, §76) — Operational View (live timeline with a "Now" marker, scene progress badges) and Document View as two genuinely different layouts, not one view restyled (§30). The Document View deliberately opts out of the app's theme — literal paper white/black, not tokens — because it represents a fixed physical artifact, not application UI (§61, §65).
5. **FilmSet AI** (`/ai`, §77) — not a chat window. Default view is ranked structured recommendations reproducing §50's exact shape (conflict, affected objects, three options with impact, Preview/Compare/Dismiss), a full risk list, and a query box underneath. Confidence is communicated as "High confidence" / "Review recommended," never a fake percentage (§51). Asking something the fixture data can't answer produces the Constitution's own §52 example near-verbatim: "I can't determine the cost impact because the location rate for NH19 Highway hasn't been entered" with an "Add Location Rate" action, rather than a hallucinated number.

All five were interactively verified in a real browser (not just screenshotted): drag/keyboard reorder and cross-day drag on the Stripboard, Confirm/Reject and text-selection tagging on Script, tab switching and scene selection on Shoot Day, toast-integrated Preview/Compare/Dismiss and both the canned and "I don't know" query paths on FilmSet AI — and re-verified in dark, light, and high-contrast after the fact to confirm nothing screen-specific broke token-driven theming.

## Components shipped

**Foundation (pass 1)**: `Button` (primary/secondary/tertiary/quiet/destructive × loading/disabled/icon/icon-only), `Input` (label/description/error/numeric), `StatusBadge` (5 tones, icon+label always paired — never color-only), `GlobalBar`, `Sidebar` (expanded/collapsed, roving-tabindex keyboard nav), `Inspector` + `InspectorSection`, `AppShell` (composition of the above), `ThemeProvider`/`useTheme`, `FrameMark` (placeholder brand mark).

**This pass**: `Select`, `Tabs`, `DropdownMenu` (item/checkbox/radio/sub-menu/shortcut), `Popover`, `Tooltip`, `Checkbox`, `Dialog` (confirmation/focused-flow modal, §22), `Drawer` (side panel built on the same primitive, both slide directions), `Toast` + `Toaster` + `use-toast` (imperative `toast()` API, 5 tones), `Skeleton`, `Progress` (determinate + indeterminate, accessible name required), `EmptyState` (§36 — teaches the workflow, primary+secondary action), `ErrorState` (§37 — actionable message + optional technical `<details>`), `DataTable` (§23/§24 — see below), `CommandDialog` + `Command*` primitives (§19/§20 — the ⌘K palette, built on `cmdk`), `KeyboardShortcutsOverlay` + `useKeyboardShortcutsOverlay` (§42, opens on `?`) backed by a documented shortcut registry (`src/keyboard/shortcuts.ts`).

All components live in Storybook (`FRAME/*`) with a theme + density toolbar — 38 stories total. The command palette and shortcut overlay are also wired into the real `apps/web` app (not just Storybook) with working `⌘K` / `?` keyboard listeners, proving the pattern end-to-end rather than in isolation.

### DataTable — what's in scope for this pass, what isn't

Built on TanStack Table (headless logic) + TanStack Virtual (row virtualization), styled to FRAME. Working and verified interactively (sort, multi-select + bulk action bar, global filter, column visibility, sticky header, virtualization confirmed at 180 rows with only ~20-38 in the DOM at once, keyboard row navigation): sort, global filter, multi-select, bulk actions, column visibility, sticky header, virtualization, density-aware row height.

**Not yet built** (§23/§24 asks for these too, but each needs its own real design + a11y pass rather than a shallow stand-in): column pin, column drag-reorder, column resize persistence, grouping, saved views persistence (the *pattern* — a toolbar with named filter/sort/column presets — is implied by the existing toolbar but not implemented), inline editing, export. Flagging explicitly rather than shipping half of each.

### Focus management

Handled almost entirely by Radix primitives, which trap and restore focus correctly by default for `Dialog`, `Drawer` (built on the same Dialog primitive), `DropdownMenu`, `Select`, `Popover`, and the `CommandDialog` — closing any of them returns focus to the trigger automatically. The two places FRAME does its own focus handling:

- **Sidebar** — roving tabindex with arrow/Home/End keys moving focus between nav items (`sidebar.tsx`).
- **DataTable** — arrow-key row navigation and Enter-to-open on the row `<tr>` elements (`data-table.tsx`).

Nothing else manages focus manually — that's deliberate; hand-rolled focus traps are a common a11y failure point, and the primitives already get this right.

## Accessibility

The a11y suite (`packages/ui/a11y-tests/frame.spec.ts`) runs all 38 stories × all 3 themes — **114 checks** — through axe-core at WCAG 2.1/2.2 AA. All 114 pass. Two rounds of real findings surfaced across the two passes and were fixed at the token/component level, not papered over:

1. **Dark mode `text.tertiary`** (`graphite[400]`, `#7C8591`) measured 4.33:1 against `background.elevated` (`#1C2127`) — just under the 4.5:1 floor. Fixed by retuning the primitive to `#8890A0`.
2. **Light mode had three separate failures** from assuming dark-mode-tuned values would carry over: `text.tertiary` needed its own (darker, not lighter) step — `graphite[500]`; `Button`'s primary variant put white text on `action.primary` at 3.91:1 (fixed by adding a dedicated `action.onPrimary` token and darkening light mode's primary to `signal[600]`); `StatusBadge` tones needed the `700` step, not `600`, against their tinted chip backgrounds.
3. **`Progress`'s `role="progressbar"` had no accessible name** — the visible label text existed but wasn't programmatically associated. Fixed by connecting it via `aria-labelledby` (or accepting a manual `aria-label` when no visible label is passed).

**Tooling note**: `@storybook/test-runner` (`pnpm --filter @filmset/ui test:a11y`) is the intended standing CI command — wired via `.storybook/test-runner.ts`. This sandbox only ships full Chromium, not the headless-shell binary `jest-playwright-preset` (which `test-storybook` depends on) expects, so validation in both passes used `packages/ui/a11y-tests/frame.spec.ts` + `playwright.config.ts` directly against the pre-installed Chromium instead — same axe ruleset, same story set. Both are checked in; a real CI box with `playwright install` available can use either.

## Open design questions

1. **Danger vs. Signal hue proximity** — both are reds. Distinguished by saturation/temperature and always paired with icon + label, but worth a real side-by-side contrast review before locking.
2. **Brand mark** (`FrameMark`) is a functional placeholder only — passes the monochrome/16px legibility bar mechanically, but §54–57's full logo exploration (distance test, embroidery test, 20-year test) hasn't been done.
3. **Tailwind v4** was chosen over v3 (not specified in the brief) because its CSS-native `@theme` model maps directly onto a CSS-custom-property token architecture with no build-time indirection. Flagging since the brief didn't pin a version.
4. **`FilmSet AI` sidebar/command-palette icon** uses `Sparkles` — legible and conventional for AI wayfinding, but sits close to the "AI aesthetic" the Constitution (§53) warns against. Worth a second look once the AI screens are designed.
5. **DataTable scope** — pin/reorder/resize/grouping/saved-views-persistence/export are all named explicitly in §23/§24 and are not yet built. None of the five canonical screens happened to need them yet, but Cast/Crew/Locations list views and a real Money/Budget screen will.
6. **Stripboard is screen-specific, not a FRAME primitive** — `@dnd-kit` and the drag logic live in `apps/web/components/stripboard/`, not `packages/ui`. Deliberate: extracting a reusable "Stripboard" or generic "sortable board" component before a second consumer exists would be guessing at the wrong abstraction. Worth revisiting once, say, a shot list or a schedule-comparison view needs similar drag/drop.
7. **Fixture depth beyond the five screens** — Cast, Crew, Locations, Money, Documents sidebar items currently all route to `/overview` (no dedicated screen exists for them). Fine for this pass since none of the five canonical screens needed them as destinations, but the sidebar will feel incomplete under real use.
8. ~~**Shoot Day's scene-progress state is hardcoded**~~ — resolved: `sceneProgress()` in `apps/web/app/shoot-day/shoot-day-page-inner.tsx` now derives status from each scene's real `status` field instead of a fixed map.
9. **Cast/Crew/Locations/Money/Documents still have no dedicated screens** — the sidebar items route to `/overview`. The real data for all of them already exists in `ProductionSnapshot` (`apps/web/lib/queries.ts`); building each screen is now "another DataTable view," not new plumbing.
10. ~~**`packages/db`'s schema has no migration history**~~ — resolved: `packages/db/migrations/*.sql` are versioned, committed, and applied via `db:migrate` (see [Row Level Security](#row-level-security) and the testing checklist below).
11. **AI-approved schedule/budget options are logged, not executed** — approving an `AIRecommendation` option (`app/ai/actions.ts` → `approveRecommendationOption`) records the decision to `activities` but doesn't itself move the scene or adjust the budget line; a human still makes that specific change (e.g. on the Stripboard). Consistent with the governance model's "no direct writes," but worth deciding deliberately whether some options should auto-apply once approved.
12. **Team invites require the invitee to have already signed up** — `inviteMember` (`apps/web/app/overview/team-actions.ts`) looks up an existing `profiles` row by email; there's no invite-before-signup flow (that needs the Supabase Admin API — a service-role operation — plus an email template, deliberately out of scope here since the brief says never to use the service-role key from this app).

## Stop-and-present checkpoint (superseded)

This pass completed all 21 foundation deliverables from Constitution §91 and all five canonical screens from §72–77 as a fixture-only prototype, then stopped per Constitution §91 / brief §9 to await approval before real feature implementation.

**That approval was given** — real feature implementation is now underway: Supabase Postgres (via Drizzle, `packages/db/src/schema.ts`) replaces fixtures as the data source (fixtures now seed the DB via `db:seed` instead of being imported by screens), Supabase Auth replaces the no-op auth stub (`packages/auth`, `apps/web/app/login`, `/signup`, `/onboarding`, `middleware.ts`), and a real Suggest→Explain→Preview→Approve→Commit pipeline against Anthropic's API replaces the AI screen's canned responses (`apps/web/lib/ai.ts`, `apps/web/app/ai/actions.ts`) — see [Environment](#environment) to run it. Remaining gaps are tracked in Open design questions #9–11 above, not hidden.
