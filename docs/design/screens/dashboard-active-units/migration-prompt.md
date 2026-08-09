Migrate Dashboard Active Units to the Obsidian Gallery OG-WDS.

TARGET
Route: /dashboard?tab=painting-table
Primary files:
- app/dashboard/page.tsx
- app/dashboard/dashboard-tab-switcher.tsx
- app/dashboard/dashboard-top-bar.tsx
- app/dashboard/dashboard-welcome.tsx
- app/dashboard/dashboard-next-actions-card.tsx
- app/dashboard/dashboard-quick-actions.tsx
- app/dashboard/dashboard-unit-in-progress.tsx
- app/dashboard/dashboard-unit-status-list.tsx
- app/dashboard/dashboard-bench-cards.tsx
- app/dashboard/dashboard-resume-button.tsx
- app/dashboard/dashboard-start-painting-button.tsx

READ FIRST
- AGENTS.md
- docs/design/index.md
- docs/design/screens/dashboard-active-units/spec.md
- docs/design/06-component-inventory.md
- docs/design/10-codex-migration-protocol.md

REFERENCE
- No approved route mockup exists in the repo.
- Component sheets in docs/design/reference/surfaces/.
- Golden implementation: none yet; this is the first golden candidate.

SCOPE
This is a PRESENTATION MIGRATION.

PRESERVE
- routing/navigation behavior
- data fetching/mutations
- validation
- analytics
- loading/error/empty states
- accessibility semantics
- auth redirects
- dashboard preview behavior
- tab URL behavior
- display-mode localStorage and analytics
- next-action completion/dismiss optimistic behavior
- quick-action destinations and dialogs
- featured unit/open/resume destinations

DO NOT
- alter the database
- change APIs
- redesign information architecture
- remove functionality because it is not visible in a mockup
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
- Put new reusable visual primitives in src/components/v3 only if needed.
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
