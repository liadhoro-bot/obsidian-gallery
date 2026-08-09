# Current UI audit - OG-WDS foundation

## Audit status
- Status: `COMPLETE - FOUNDATION ONLY`
- Date: 2026-08-07
- Commit/branch: `codex/v3-dev-inspection` at `f3e2268`, dirty worktree
- Auditor: Codex
- Scope: repository inspection only. No screen redesign, route migration, database, data, auth, API, or business-logic changes.
- Design source read first: repo `AGENTS.md`; OG-WDS kit `AGENTS.md` and `docs/design/index.md` from `C:\Users\Liad\Downloads\Obsidian-Gallery-Codex-UI-Redress-Kit.zip`. The repo does not yet contain `docs/design/index.md`; the kit zip does.

## 1. App shell and layout
| Area | Current file(s) | Keep / reskin / replace | Notes |
|---|---|---|---|
| Root layout | `app/layout.tsx` | Keep, then lightly extend | Imports `./globals.css`, sets metadata/viewport, renders `ClientShell`, children, Vercel telemetry. This is the safest global CSS entry because local Next docs recommend importing global styles from the root layout. |
| Client shell/providers | `app/providers/client-shell.tsx`, `app/providers/service-worker-registrar.tsx`, `app/providers/posthog-user-identifier.tsx`, `app/providers/posthog-provider.tsx` | Keep | `ClientShell` controls service worker registration, optional PostHog identification, and mobile nav visibility. Preserve provider behavior. |
| Mobile navigation | `app/components/MobileNav.tsx`, `public/icons/nav/*.svg`, `lib/v3-preview.ts` | Reskin through primitives later | Bottom nav is the only global navigation. It already uses `v3-bottom-nav` and `v3-walnut-button` from `app/globals.css`, but still has raw hex/arbitrary Tailwind colors and preview-aware href handling. Preserve route hiding rules and preview propagation. |
| Desktop navigation | None found as a shared shell | Do not invent yet | No active shared desktop nav component was found. `app/components/NavBar.tsx` is deleted in the current worktree. Route-local top bars exist, especially `app/dashboard/dashboard-top-bar.tsx` and repeated `TopNav` helpers inside V3 previews. |
| Page container | Route-local `main` wrappers, e.g. `app/dashboard/page.tsx`, `app/projects/page.tsx`, `app/vault/page.tsx`, `app/units/new/page.tsx` | Introduce `WorkbenchShell` before broad reskin | Most pages set `min-h-screen bg-[#081018] text-white` or preview-specific `bg-[#05090b]`. Dashboard V3 preview uses `v3-material-walnut` and `v3-dashboard-shell`. |
| Loading shell | Route-local `loading.tsx` and skeleton files, e.g. `app/dashboard/loading.tsx`, `app/dashboard/dashboard-skeletons.tsx`, `app/vault/loading.tsx`, `app/settings/settings-skeletons.tsx` | Map after primitives exist | Loading states are local and visually inconsistent. Preserve Suspense boundaries and loading semantics. |

## 2. Global style and theme sources
| Concern | Current source | OG-WDS target | Risk |
|---|---|---|---|
| Framework styling | `package.json` uses `next` `^16.2.4`, React `19.2.4`, Tailwind `^4`, `@tailwindcss/postcss`; `postcss.config.mjs` enables `@tailwindcss/postcss` | Keep Tailwind v4; add OG variables as CSS source of truth | No `tailwind.config.*` was found, so Tailwind tokens are currently driven by CSS `@theme inline` and arbitrary utilities. |
| Global CSS import | `app/layout.tsx` imports `app/globals.css`; `app/globals.css` starts with `@import "tailwindcss";` | Keep this import chain; add token import before any CSS rules | CSS order matters in Next production chunking. Do not scatter global imports into route files. |
| Fonts | `app/globals.css` defines `--font-geist-sans: Arial, Helvetica, sans-serif` and `--font-geist-mono`; `@theme inline` maps `--font-sans`/`--font-mono`; route code also uses Tailwind `font-serif`, `font-mono`, `font-black` | OG-WDS fonts: Cormorant Garamond for display/section, Source Sans 3 for UI/body, IBM Plex Mono for technical values | Fonts are not installed/loaded through `next/font` or assets. `font-serif` currently depends on Tailwind defaults, not OG-WDS. |
| Colors | `app/globals.css` `--background: #0a0a0a`, `--foreground: #ededed`; many raw `#081018`, `#05090b`, `#111821`, cyan palette utilities, `rgba(...)`, and arbitrary `bg-[...]` across `app` and `components` | `src/styles/og-design-tokens.css` semantic variables, then primitive classes/components | Very high drift. Raw route colors will continue to override tokens until components are migrated. |
| Radius | Mostly Tailwind `rounded-xl`, `rounded-2xl`, `rounded-3xl`, `rounded-full`, plus arbitrary `rounded-[8px]`, `[10px]`, `[12px]`, `[14px]`, `[18px]`, `[28px]` | `--og-radius-s: 6px`, `--og-radius-m: 12px`, `--og-radius-l: 18px` | Current arbitrary values accidentally overlap OG values but are not semantically enforced. |
| Shadows | Arbitrary `shadow-[...]`, `shadow-xl`, `shadow-2xl`, glow shadows, and V3 material CSS in `app/globals.css` | `--og-shadow-contact`, `--og-shadow-medium`, `--og-shadow-large`, `--og-shadow-pressed`, component-owned floating paper | Cyan glows and large shadows currently imply importance, which conflicts with OG-WDS depth semantics. |
| Spacing | Tailwind utilities route-by-route: `gap-*`, `p-*`, `px-*`, `pb-24`, `pb-28`, safe-area classes in `app/globals.css` | OG 4px rhythm variables, with route layout owning only composition | No single spacing authority; mobile bottom nav padding is a hard dependency. |
| Existing V3 material CSS | `app/globals.css` selectors `.v3-material-walnut`, `.v3-dashboard-shell`, `.v3-walnut-header`, `.v3-bottom-nav`, `.v3-parchment-panel`, `.v3-paper-card`, `.v3-photo-mount`, `.v3-brass-*`, `.v3-progress-*`; assets in `public/v3-raster/*` | Move meaning into `src/components/v3` primitives after tokens land | These classes are useful prototypes but global, route-biased, and still use raw calibrated values. |
| Interaction/mobile helpers | `app/globals.css` `.tap-target`, `.tap-press`, `.tap-card`, `.micro-button`, `.micro-toggle`, `.mobile-sheet*`, `.mobile-scroll`, `.nav-pill` | Keep behavior; gradually wrap in `Button`, `EntityCard`, `Drawer`/dialog primitives | These are behavior helpers, not complete visual primitives. |
| Special-case global CSS | `app/globals.css` `.recipe-guide-*`, `.stage-photo-loading-pattern` | Leave until owning route/component migration | Large route-specific style blocks already live globally, so import-order and selector collisions are realistic risks. |

## 3. Current shared UI primitives
There is no repo-local `components/ui` or `src/components/v3` primitive library yet. Shared UI is split between `app/components/*`, root `components/*`, and route-local component folders.

| Existing component/source | Usage | OG-WDS mapping | Action |
|---|---|---|---|
| `app/components/MobileNav.tsx` | Global bottom navigation with preview-aware routing and route exclusions | `WorkbenchShell` app chrome + `Button`/navigation item primitive | Preserve behavior; reskin after token import and nav primitive exists. |
| `app/components/prefetch-link.tsx` | `PrefetchLink`, `PrefetchButton`, `useRoutePrefetch`; used by project/unit tiles | Behavioral wrapper for `EntityCard` and `Button` | Keep. Do not bury prefetch behavior inside visual-only primitive without preserving event handling. |
| `app/components/SubmitButton.tsx` | Server action submit button with `useFormStatus` pending state | `Button` with loading state | Wrap/reskin. Keep pending/disabled semantics. |
| `app/components/back-button.tsx` | Client back/fallback navigation | `Button` icon/tertiary variant | Wrap/reskin. Preserve fallback behavior. |
| `components/display-mode-toggle.tsx` | Cards/tiles segmented control | `FunctionalControls` segmented control | Good first extraction candidate; currently uses raw cyan glow and custom icons. |
| `components/projects/project-tile.tsx`, `components/units/unit-tile.tsx` | Shared project/unit cards for legacy lists | `EntityCard` + `ImageMount` + `Label`/metadata | Replace visual shell with primitives while preserving links/images/actions. |
| `components/contests/contest-card.tsx`, `components/contests/contest-phase-badge.tsx` | Contest card and status badge | `EntityCard`, `ImageMount`, `Badge`/`Label`, `Button` | Reskin after core card/badge primitives exist. |
| `app/components/gallery/gallery-image-card.tsx`, `app/components/gallery/zoomable-gallery-image.tsx` | Gallery thumbnail, modal zoom, feature action, color sampling action | `ImageMount`, `Button`, `Drawer`/dialog overlay | Needs accessibility and modal behavior preservation. |
| `components/paints/paint-picker-dialog.tsx` | Paint selection dialog with filters and mobile sheet | `Drawer`/dialog, `FunctionalControls`, `PaintSwatch`, `Button` | High-value but higher risk because it is interactive and data-heavy. |
| `components/color-sampler/*` | Color sampling dialog, image source picker, toolbar, sampled preview | `Drawer`, `FunctionalControls`, `PaintSwatch`, `TechnicalValue` | Preserve canvas/image behavior; visual migration should be later. |
| `components/share/ObsidianShareCardFrame.tsx` and share components | Generated share-card visual frame and actions | Separate share-card artifact system; partly `PaperSheet`/`Plaque` but not general app primitive | Do not use as app-wide OG-WDS source. It has specialized dimensions and heavy decorative treatment. |
| `app/components/v3-preview-page.tsx` | Generic preview scaffold for unfinished V3 routes | Temporary route composition | Deprecate after actual route migrations. Not a golden primitive source. |
| `app/components/v3-perf-indicator.tsx` | Performance markers and debug indicator | Non-visual instrumentation | Keep outside visual primitive library. |
| Route-local `TopNav`, `Tabs`, `Sheet`, `TextField`, `PrimaryButton` helpers in `app/projects/projects-v3-preview.tsx` and `app/paints/paints-v3-preview.tsx` | Local preview controls | `FunctionalControls`, `Button`, `SurfacePanel`, `Drawer` | Extract only after behavior and states are inventoried. |

## 4. Hard-coded visual drift
- Dark shell colors repeat across routes: `#081018`, `#05090b`, `#07111b`, `#10161d`, `#111821`, `#0b1622`.
- Cyan is the dominant action/accent system: `cyan-300`, `cyan-400`, `#22d3ee`, `rgba(34,211,238,...)` appear in navigation, cards, buttons, focus, glows, progress, skeletons, and dialogs.
- Cards commonly use `rounded-2xl border border-white/10 bg-white/[0.04]` or `bg-white/[0.05]`, with hover cyan borders. Examples: `components/projects/project-tile.tsx`, `components/units/unit-tile.tsx`, `components/contests/contest-card.tsx`.
- Dashboard V3 preview uses OG-like classes from `app/globals.css`, but still hard-codes many borders, text colors, radii, and shadows inside `app/dashboard/dashboard-v3-preview.tsx`.
- Projects/Paints V3 previews are gated production code, but they still use dark modern cyan styling and route-local primitives in `app/projects/projects-v3-preview.tsx` and `app/paints/paints-v3-preview.tsx`.
- Global CSS includes route-specific recipe guide styles (`.recipe-guide-*`) and V3 dashboard material classes, so global stylesheet growth is already a maintenance risk.
- The current repo has no `src/styles/og-design-tokens.css`, no `src/components/v3`, and no repo-local `docs/design` tree before this audit file.

## 5. Foundation insertion plan for `src/styles/og-design-tokens.css`
1. Create `src/styles/og-design-tokens.css` and `src/styles/og-design-tokens.json` from the OG-WDS kit without changing any route imports or class names.
2. In `app/globals.css`, add `@import "../src/styles/og-design-tokens.css";` immediately after `@import "tailwindcss";` and before `:root`. This preserves the current Next/Tailwind root-global pattern from `app/layout.tsx`.
3. Do not immediately remap `--background`, `--foreground`, or `@theme inline` to OG tokens. First verify that adding inert variables causes no CSS ordering/build issue.
4. Add fonts as a separate follow-up. Use the approved families from tokens, but avoid switching global `body` typography until at least one route can be visually checked.
5. Create `src/components/v3` with low-level visual primitives only: `WorkbenchShell`, `SurfacePanel`, `EntityCard`, `Button`, `FunctionalControls`, typography primitives, `ImageMount`, `Label`, `Divider`, `ProgressTrack`, `PaintSwatch`, `Badge`.
6. Migrate one component family or one route behind existing preview gating. Keep `PrefetchLink`, submit pending state, auth/session redirects, server actions, analytics, and API calls untouched.
7. After first visual approval, record the golden implementation before removing or rewriting legacy global classes.

## 6. Likely regressions and risks
| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Global token import changes CSS ordering | Medium | Medium | Add token CSS as inert variables first; run build/lint; inspect at least dashboard/projects/paints. |
| Fonts cause layout overflow or reflow | High | Medium | Install/load fonts in a separate step; inspect mobile widths, nav labels, dense cards, and dialogs. |
| Tailwind arbitrary classes override OG tokens | High | Medium | Migrate through primitives; do not expect variables alone to change visuals. |
| Existing `.v3-*` global classes conflict with future primitives | Medium | Medium | Treat current `.v3-*` classes as legacy/prototype; avoid reusing their names for new component internals. |
| Mobile bottom nav overlaps content after shell changes | Medium | High | Preserve `pb-24`/`pb-28` route padding and safe-area behavior until `WorkbenchShell` owns it. |
| Preview routes mix live data with local state | Medium | High | Preserve page-level auth/data branches in `app/dashboard/page.tsx`, `app/projects/page.tsx`, `app/paints/page.tsx`; visual changes only below them. |
| Hardware/material overuse spreads from dashboard prototype | Medium | Medium | Enforce component contracts and hardware budget before promoting any route to golden. |
| Dirty worktree obscures ownership | High | Medium | Keep foundation audit doc-only; do not revert or normalize existing modified/deleted files. |

## 7. Candidates for the first golden route
Do not mark any route golden before visual approval.

| Candidate | Why it is representative | Required states | Risks |
|---|---|---|---|
| `/dashboard?preview=1` | Closest to OG-WDS already: uses walnut/parchment/paper/photo mount/progress classes, live dashboard data, next actions, tabs, and global mobile nav. Good source for shell, panel, card, progress, and nav behavior. | Active Units tab, My Progress tab, empty/no active unit, feature guide overlay, pending next action, mobile 390x844, tablet 768x1024, desktop 1440x900. | Most visually complex; has many raw values and some hardware/pin treatment that may need approval before becoming canonical. |
| `/projects?preview=1` | Good operational library route: search, sort, segmented tabs, grid/list cards, create sheet, project/unit entities. Strong candidate for `EntityCard`, `FunctionalControls`, `Drawer`, and pagination patterns. | Projects tab, Units tab, empty search, create project sheet, create unit sheet, grid/list modes, mobile overflow. | Current preview is dark/cyan and not OG-WDS materialized; needs more design work before golden status. |
| `/paints?preview=1` | Paint is central to the product hierarchy and exercises `PaintSwatch`, filters, ownership, export, and bottom info panel. | Owned/library tabs, filters, selected paint panel, ownership pending/error fallback, export dialog, custom mix dialog, no-results state. | High interaction/data risk; color accuracy must not be distorted by decorative material treatment. |

## 8. Recommended migration order
1. Land docs/design source files and token CSS files from the kit into the repo.
2. Import token CSS inertly through `app/globals.css`; verify no build/order regression.
3. Add `src/components/v3` primitives with constrained APIs and no domain data.
4. Wrap shared behavior helpers (`SubmitButton`, `PrefetchButton`, `DisplayModeToggle`) with OG-WDS controls.
5. Convert shared entity cards (`ProjectTile`, `UnitTile`, `ContestCard`) to `EntityCard`/`ImageMount`/`Label`.
6. Choose and visually approve one golden route, likely `/dashboard?preview=1` if hardware/material use is accepted after review.
7. Use the golden route to migrate adjacent component families and only then retire legacy `.v3-*` and cyan/dark shell patterns.

## 9. Explicit non-goals
- No database, Supabase policy, migration, seed, or schema refactor.
- No data fetching, API, auth, server action, analytics, or business-logic changes.
- No product information architecture redesign.
- No route migration in this task.
- No mass deletion of legacy CSS or global `.v3-*` classes before route ownership is known.
- No declaration of a golden implementation before visual approval.
