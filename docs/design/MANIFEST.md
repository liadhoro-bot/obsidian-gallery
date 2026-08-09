# Kit manifest

## Source-derived design documentation

- `00-source-of-truth.md` — authority and precedence.
- `01-design-constitution.md` — product/design principles.
- `02-material-system.md` — semantic material hierarchy.
- `03-typography-system.md` — font roles and anti-patterns.
- `04-token-spec.md` — SOURCE values vs CALIBRATED DEFAULTS.
- `05-physicality-depth-system.md` — tactile hierarchy, shadows and hardware.
- `06-component-inventory.md` — semantic component set.
- `07-composition-rules.md` — how primitives combine.
- `08-responsive-accessibility.md` — mobile/accessibility behavior.
- `09-visual-qa.md` — acceptance process.

## Codex operating system

- `/AGENTS.md` — persistent agent instructions.
- `10-codex-migration-protocol.md` — staged migration procedure.
- `11-migration-prompt-template.md` — issue-like migration task template.
- `12-screen-spec-template.md` — route-specific implementation contract.
- `14-enforcement.md` — drift prevention and review rules.
- `15-repo-architecture.md` — target layer/repository architecture.
- `golden-implementation.md` — approval record for canonical route.

## Machine-readable implementation layer

- `component-registry.json` — semantic registry for visual primitives.
- `src/styles/og-design-tokens.css` — CSS custom properties.
- `src/styles/og-design-tokens.json` — token data.
- `src/components/v3/README.md` — implementation boundary.
- `src/components/v3/COMPONENT-CONTRACTS.md` — starter component APIs/contracts.
- `scripts/design-guard.mjs` — lightweight drift detector.

## Visual source archive

`reference/` contains optimized WebP copies of the supplied PNG reference sheets and copies of the two governing PDFs. Images are optimized for practical in-repository agent inspection; they are visual references, not runtime application assets.
- `16-premium-quality-bar.md` — premium visual/interaction acceptance gates.
