# Codex UI migration protocol

This is the operating procedure for redressing the existing application.

## Why this protocol exists

Codex should not be asked to infer a design system, redesign information architecture, understand legacy business logic, and implement a route in one creative leap.

The migration constrains the problem:

**existing behavior + approved OG-WDS primitives + route reference -> migrated presentation**

## Phase 0 - Foundation audit (run once before broad migration)

Ask Codex to:

1. Inspect:
   - app/router structure,
   - global CSS,
   - Tailwind/theme configuration,
   - component libraries,
   - current shared UI primitives,
   - layout/navigation components.
2. Find all places that define:
   - colors,
   - fonts,
   - radii,
   - shadows,
   - spacing,
   - button/input/card styles.
3. Classify existing components:
   - preserve as functional/business component,
   - wrap/re-skin,
   - replace with OG-WDS primitive,
   - deprecate after migration.
4. Identify the smallest way to introduce `src/styles/og-design-tokens.css` without destabilizing the app.
5. Produce a migration map. Do not redesign routes yet.

Deliverable:
`docs/design/migration/current-ui-audit.md`

## Phase 1 - Install foundation

Implement:
- approved fonts using the project's normal Next.js/font strategy,
- token CSS,
- base focus state,
- page background/workbench shell tokens,
- typography primitives,
- Button,
- FunctionalControls,
- Panel,
- Card,
- Divider,
- ImageMount,
- Label,
- ProgressTrack,
- Swatch,
- Badge.

Do not migrate every route during this step.

## Phase 2 - Build the golden route

Choose one representative route containing:
- title/header,
- image/miniature content,
- metadata,
- controls,
- status/progress,
- cards/panels,
- mobile behavior.

Implement it to premium quality.

Iterate visually until approved.

Then document:
`docs/design/golden-implementation.md`

This route becomes the coding truth for practical spacing/density and responsive behavior.

## Phase 3 - Migrate the app shell

Migrate:
- global frame/background,
- top/bottom navigation,
- page container/gutters,
- safe areas,
- global loading shell.

Do not force every route's content into physical walnut framing.

## Phase 4 - Route-by-route migration

Each route is its own task.

### A. Audit
Before editing, Codex must identify:
- route files,
- data sources,
- mutations,
- analytics,
- states,
- interactions,
- existing reusable components.

Write a **preservation list**.

### B. Map
Produce a small table:

| Existing element | OG-WDS target | Reuse/new | Notes |
|---|---|---|---|

Examples:
- generic card -> `EntityCard`
- section wrapper -> `SurfacePanel`
- progress bar -> `ProgressTrack`
- photo -> `ImageMount`
- status pill -> `Label`
- ordinary CTA -> `Button`

If no component fits, decide whether:
1. it is a route composition, or
2. a genuinely missing reusable primitive.

Do not invent a new material metaphor unless both are false and the design system genuinely lacks the concept.

### C. Scope lock
State what will **not** change.

Default:
- no data model,
- no API,
- no route behavior,
- no IA,
- no analytics semantics.

### D. Implement
Use tokens and shared primitives.

New shared primitive:
- lives in `src/components/v3`,
- documented in registry/contracts,
- uses token values,
- includes relevant states.

Route-specific layout:
- stays route-specific.

### E. Functional verification
Run the repository's relevant:
- typecheck,
- lint,
- tests,
- build checks.

Fix regressions caused by the migration.

### F. Visual verification
Run the application.

Inspect:
- 390x844,
- 768x1024,
- 1440x900,
unless the task says otherwise.

Compare to:
1. route reference,
2. golden implementation,
3. component sheets.

### G. Difference loop
Perform at least one deliberate visual comparison pass after the first implementation.

Check:
- macro geometry,
- spacing,
- typography,
- material assignment,
- physicality,
- hardware count,
- mobile overflow.

Do not stop at "looks close."

### H. Report
Codex reports:
- files changed,
- preserved behavior,
- shared components reused/created,
- checks run,
- viewports inspected,
- intentional reference deviations,
- unresolved issues.

## Task size limit

A single migration task should normally contain:
- one route, or
- one cohesive component family.

Split the task when it would otherwise include both significant backend refactoring and substantial UI migration.

## Legacy migration rule

Prefer "strangler" migration:
- add OG-WDS primitives,
- migrate route,
- remove legacy styling only after no migrated route depends on it.

Do not globally rewrite classes/styles first and hope every screen survives.

## The no-invention rule

When uncertain visually:
1. look at route reference,
2. look at golden implementation,
3. look at component sheet,
4. look at tokens/material rules.

Only then make the smallest neutral choice.

Do not solve ambiguity by making the component more decorative.

## Visual acceptance language for prompts

Use:
> The task is not complete when it compiles. Run the page, inspect it at the target viewport, compare against the reference and golden implementation, and correct obvious differences in layout, hierarchy, spacing, typography, surface treatment, component sizing and mobile overflow.

## Foundation-audit prompt

```text
Perform the OG-WDS foundation audit before any broad visual migration.

Read:
- AGENTS.md
- docs/design/index.md
- docs/design/04-token-spec.md
- docs/design/06-component-inventory.md
- docs/design/10-codex-migration-protocol.md

Inspect the existing repository's frontend architecture and current shared UI.

Create docs/design/migration/current-ui-audit.md with:
1. app shell/layout files,
2. global styles/theme sources,
3. current shared visual primitives,
4. hard-coded design values and where they live,
5. component mapping to OG-WDS,
6. safe foundation insertion plan,
7. recommended candidate for the first golden route,
8. risks and likely regressions.

Do not redesign routes or alter business logic in this task.
```
