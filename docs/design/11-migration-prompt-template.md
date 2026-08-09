# Codex route migration prompt template

Copy, fill, and use this as a Codex task.

```text
Migrate [ROUTE / SCREEN NAME] to the Obsidian Gallery OG-WDS.

TARGET
Route: [route]
Primary files: [known files if available]

READ FIRST
- AGENTS.md
- docs/design/index.md
- docs/design/screens/[screen]/spec.md
- docs/design/06-component-inventory.md
- docs/design/10-codex-migration-protocol.md

REFERENCE
- [approved route screenshot/mockup]
- [secondary state screenshots]
- Golden implementation: [route/file]

SCOPE
This is a PRESENTATION MIGRATION unless explicitly listed below.

PRESERVE
- routing/navigation behavior
- data fetching/mutations
- validation
- analytics
- loading/error/empty states
- accessibility semantics
- [route-specific behaviors]

DO NOT
- alter the database
- change APIs
- redesign information architecture
- remove functionality because it is not visible in the mockup
- invent a new material metaphor
- use raw colors/radii/shadows
- duplicate an existing v3 primitive
- change content semantics without instruction

BEFORE IMPLEMENTING
1. Inspect the current implementation.
2. List behaviors that must survive.
3. Map current visual elements to OG-WDS components.
4. Identify missing reusable components.
5. List files you expect to modify.
6. Flag any product/data ambiguity that would prevent a safe visual-only migration.

IMPLEMENTATION
- Use tokens from src/styles/og-design-tokens.css.
- Reuse src/components/v3.
- Put new reusable visual primitives in src/components/v3.
- Keep route-specific composition with the route.
- Keep functional Tier-3 UI visually quiet.
- Respect hardware/material budgets.

VISUAL ACCEPTANCE
Run the app and inspect:
- 390x844
- 768x1024
- 1440x900

Compare against the route reference and golden implementation.

Specifically verify:
- shell and page geometry
- hierarchy
- image/miniature prominence
- typography family/case/scale
- materials
- radii
- shadow meaning
- component density
- CTA hierarchy
- hardware count
- mobile overflow
- bottom-nav/safe-area clearance
- loading/error/empty states

The task is not complete when it compiles. Perform a visual difference pass and fix obvious discrepancies.

CHECKS
Run relevant typecheck/lint/tests/build checks.

FINAL REPORT
- files changed
- behaviors preserved
- components reused
- components created/extended
- checks run
- viewports inspected
- intentional deviations
- unresolved issues
```
