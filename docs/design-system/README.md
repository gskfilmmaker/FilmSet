# FRAME — FilmSet Design System

Status: **Foundation complete** (Constitution §91, all 21 deliverables). Not yet approved for feature-screen work — see the stop-and-present note at the bottom. The five canonical screens have not been started.

## Packages

| Package | Purpose |
|---|---|
| `packages/tokens` | Source of truth. TS token definitions (`src/semantic.ts`, `src/primitives.ts`) plus hand-authored motion keyframes (`src/motion.css`) compiled to CSS custom properties per theme (`dist/css/*.css`) by `scripts/build-css.ts`. Never hand-edit the generated CSS. |
| `packages/ui` | FRAME components (`@filmset/ui`). Radix + cmdk + TanStack Table primitives restyled to FRAME; components reference semantic tokens only, never raw values. Storybook lives here. |
| `packages/core` | Minimal production-graph shapes (Scene, Production) — typing only, no business logic. |
| `packages/db` | Fixture data ("THE BAND") backing prototypes. No schema/migrations yet — deferred per brief §0. |
| `packages/auth` | Role vocabulary only (§79). No RBAC enforcement yet — deferred per brief §0. |
| `apps/web` | Next.js App Router shell proving the token/theme architecture end-to-end — including a real, working ⌘K command palette and keyboard shortcut overlay, not just Storybook demos. |

## Running it

```bash
pnpm install
pnpm --filter @filmset/tokens build   # generates CSS from TS token source
pnpm storybook                        # FRAME components, all states, 3 themes, 2 densities
pnpm --filter @filmset/web dev        # app shell prototype — try ⌘K and "?"
```

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
5. **DataTable scope** — pin/reorder/resize/grouping/saved-views-persistence/export are all named explicitly in §23/§24 and are not yet built (see above). Worth prioritizing against the five canonical screens: Stripboard and the Money/Budget screens will likely need some of these sooner than others.

## Stop-and-present checkpoint

This pass completes all 21 foundation deliverables from Constitution §91: tokens, three themes, typography, spacing, icon strategy, core controls (button/input/select/menu/tabs), sidebar, global bar, inspector, command palette, data-table foundation, status system, loading states, empty states, error states, toast system, dialog/drawer/popover primitives, keyboard navigation conventions + shortcut overlay, focus management, accessibility tests, and Storybook documentation.

**Not started**: the five canonical screens (Production Command Center, Script + Breakdown, Stripboard, Shoot Day, FilmSet AI). Per Constitution §91 and brief §9, those come next only after this foundation is reviewed and approved.
