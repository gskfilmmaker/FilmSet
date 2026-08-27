# FRAME — FilmSet Design System

Status: **Foundation pass 1** (Constitution §91, deliverables 1–11 of 21; app-shell primitives only). Not yet approved for feature-screen work — see the stop-and-present note at the bottom.

## Packages

| Package | Purpose |
|---|---|
| `packages/tokens` | Source of truth. TS token definitions (`src/semantic.ts`, `src/primitives.ts`) compiled to CSS custom properties per theme (`dist/css/*.css`) by `scripts/build-css.ts`. Never hand-edit the generated CSS. |
| `packages/ui` | FRAME components (`@filmset/ui`). Radix primitives restyled to FRAME; components reference semantic tokens only, never raw values. Storybook lives here. |
| `packages/core` | Minimal production-graph shapes (Scene, Production) — typing only, no business logic. |
| `packages/db` | Fixture data ("THE BAND") backing prototypes. No schema/migrations yet — deferred per brief §0. |
| `packages/auth` | Role vocabulary only (§79). No RBAC enforcement yet — deferred per brief §0. |
| `apps/web` | Next.js App Router shell proving the token/theme architecture end-to-end. |

## Running it

```bash
pnpm install
pnpm --filter @filmset/tokens build   # generates CSS from TS token source
pnpm storybook                        # FRAME components, all states, 3 themes, 2 densities
pnpm --filter @filmset/web dev        # app shell prototype
```

## Token architecture

- **Source of truth**: `packages/tokens/src/{primitives,semantic}.ts` — typed, documented, versioned.
- **Generated CSS**: `--fs-*` custom properties (theme-independent: spacing, radius, typography, motion, shadow, opacity, control height, panel width, z-index) plus per-theme `--fs-color-*` blocks selected by `[data-theme]`.
- **Tailwind wiring**: `tailwind-theme.css` maps Tailwind's own `@theme inline` variables (`--color-*`, `--spacing-*`, `--radius-*`, `--shadow-*`) straight onto the `--fs-*` variables, so a utility class like `bg-canvas` or `text-primary` always resolves through the token layer — Tailwind class names and token names are the same names (§71).
- **Theming**: three themes (`light`, `dark`, `high-contrast`) selected via `[data-theme]` on `<html>`. Zero component duplication — verified in Storybook (`FRAME/AppShell`) and in `apps/web` via the theme/density selector.
- **Density**: `[data-density="comfortable"|"compact"]` resolves a single `--fs-control-height` / `--fs-table-row-height` variable that every component reads — no per-density component forks (§15).

### Color token inventory (§7)

`color.background.{canvas,surface,elevated,overlay}`, `color.text.{primary,secondary,tertiary,inverse}`, `color.border.{subtle,standard,strong}`, `color.action.{primary,hover,active}`, `color.status.{success,warning,danger,info}` — defined independently for light, dark, and high-contrast in `semantic.ts`.

Signal red (`#E5484D`) is the accent — used only via `color.action.*`, never for status. Danger status uses a deliberately cooler/more crimson red so it's distinguishable from Signal at a glance; documented as an open question below.

### Other token groups

Spacing (4px base, §14), radius, typography (Inter, 10 type roles, tabular numerals for numeric/metadata roles per §13), motion (120–240ms, §34), shadow (deliberately subtle — dark mode leans on borders/contrast, not shadow, per §9), opacity, control height, table row height, panel width, z-index.

## Components shipped this pass

`Button` (primary/secondary/tertiary/quiet/destructive × loading/disabled/icon/icon-only), `Input` (label/description/error/numeric), `StatusBadge` (5 tones, icon+label always paired — never color-only), `GlobalBar`, `Sidebar` (expanded/collapsed, roving-tabindex keyboard nav), `Inspector` + `InspectorSection`, `AppShell` (composition of the above), `ThemeProvider`/`useTheme`, `FrameMark` (placeholder brand mark).

All components live in Storybook (`FRAME/*`) with a theme + density toolbar. `@storybook/test-runner` + `axe-playwright` run WCAG 2.1/2.2 AA checks against every story (`pnpm --filter @filmset/ui test:a11y`). (This sandbox only ships full Chromium, not the headless-shell binary `test-storybook` expects, so this pass's validation run used `packages/ui/a11y-tests/frame.spec.ts` against the same built Storybook instead — same axe ruleset, same 19 stories, all passing.)

### Accessibility findings fixed this pass

The a11y suite (`packages/ui/a11y-tests/frame.spec.ts`) runs all 19 stories × all 3 themes (57 checks) through axe-core at WCAG 2.1/2.2 AA. Two rounds of real findings surfaced and were fixed at the token level, not papered over per-component:

1. **Dark mode `text.tertiary`** (`graphite[400]`, `#7C8591`) measured 4.33:1 against `background.elevated` (`#1C2127`) — just under the 4.5:1 floor. Hit `Inspector`'s eyebrow labels, `GlobalBar`'s phase pill and `⌘K` hint, and the composite `AppShell` story (4 stories). Fixed by retuning the primitive to `#8890A0`.
2. **Light mode had three separate failures**, all a consequence of tuning dark mode first and assuming the same raw values would carry over:
   - `text.tertiary` reused `graphite[400]` in *both* themes — wrong on its face, since dark mode needs a lighter tertiary (receding toward a dark background) and light mode needs a darker one (receding toward white). It measured 2.96:1 against the light canvas. Fixed by giving light mode its own step: `graphite[500]`.
   - `Button`'s primary variant put white text on `action.primary` (`signal[500]`, `#E5484D`) at 3.91:1. Dark mode's equivalent used near-black text on the same red and happened to pass (4.97:1) — an accident of `text.inverse` flipping polarity per theme, not a deliberate contrast decision. Fixed properly: added a dedicated `action.onPrimary` token (distinct from `text.inverse`) and darkened light mode's `action.primary` to `signal[600]` (hover `signal[700]`, active `signal[800]`) so white-on-primary clears 5.15:1.
   - `StatusBadge`'s success/warning/info tones used the `600` step of each status scale against their own ~10%-opacity tinted chip background — 3.58–4.37:1. Bumped light mode to the `700` step (danger was already fine at `600` and left alone).

All 57 checks pass after the fixes; re-verified with a fresh Storybook build and a full 3-theme rerun, plus a visual re-screenshot of `apps/web` in light mode to confirm nothing looked broken.

**Tooling note**: `@storybook/test-runner` (`pnpm --filter @filmset/ui test:a11y`) is the intended standing CI command — it's wired via `.storybook/test-runner.ts`. This sandbox only ships full Chromium, not the headless-shell binary `jest-playwright-preset` (which `test-storybook` depends on) expects, so the validation runs in this pass used `packages/ui/a11y-tests/frame.spec.ts` + `playwright.config.ts` directly against the pre-installed Chromium instead — same axe ruleset, same story set, just a different runner. Both are checked in; a real CI box with `playwright install` available can use either.

## Open design questions

1. **Danger vs. Signal hue proximity** — both are reds. Distinguished by saturation/temperature and always paired with icon + label, but worth a real side-by-side contrast review before locking.
2. **Brand mark** (`FrameMark`) is a functional placeholder only — passes the monochrome/16px legibility bar mechanically, but §54–57's full logo exploration (distance test, embroidery test, 20-year test) hasn't been done.
3. **Tailwind v4** was chosen over v3 (not specified in the brief) because its CSS-native `@theme` model maps directly onto a CSS-custom-property token architecture with no build-time indirection. Flagging since the brief didn't pin a version.
4. **`FilmSet AI` sidebar icon** uses `Sparkles` — legible and conventional for AI wayfinding, but sits close to the "AI aesthetic" the Constitution (§53) warns against. Worth a second look once the AI screens are designed.

## Stop-and-present checkpoint

This pass covers foundation deliverables 1–11 (tokens, themes, typography, spacing, first controls, sidebar, global bar, inspector) — **not** the full 21-item list (command palette, data-table, status/loading/empty/error states, toasts, dialogs, keyboard shortcut overlay, focus management docs) and **not** the five canonical screens. Per Constitution §91 and brief §9, those come next only after this foundation is reviewed.
