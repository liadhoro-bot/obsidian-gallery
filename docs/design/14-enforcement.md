# Design-system enforcement

Documentation alone is not enough. The repository should gradually make the correct implementation easier than improvisation.

## Recommended enforcement

### 1. Token-only visual values
Migrated OG-WDS components should use semantic CSS variables.

Avoid raw:
- colors,
- shadows,
- radii.

### 2. Component boundary
Shared OG-WDS primitives belong in:
`src/components/v3`

Do not allow route folders to accumulate duplicate `CardV3`, `WorkbenchCard2`, `PaperPanelNew`, etc.

### 3. Visual audit
Use `scripts/design-guard.mjs` as a lightweight scan for common drift.

It is intentionally conservative and should supplement review, not replace it.

### 4. Screenshot checks
Once a golden route exists, add Playwright or the repository's preferred browser test tooling to capture stable screenshots.

Prioritize:
- shell,
- golden route,
- high-traffic routes,
- builders,
- Vault/paint color fidelity.

### 5. Deprecation
Mark legacy visual primitives as deprecated only after an OG-WDS replacement exists.

Do not mass-delete legacy CSS before route migration is complete.

## Suggested pull-request checklist

- [ ] Used OG-WDS tokens
- [ ] Reused shared v3 primitives
- [ ] No new raw colors/radii/shadows
- [ ] Materials have semantic purpose
- [ ] Hardware within budget
- [ ] Correct fonts/typography roles
- [ ] Visual QA at required viewports
- [ ] Loading/error/empty states checked
- [ ] Business behavior preserved
- [ ] Intentional deviations documented
