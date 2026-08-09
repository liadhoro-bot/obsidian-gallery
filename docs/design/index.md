# OG-WDS design map

This file is the entry point for anyone implementing or migrating Obsidian Gallery UI.

## The one-sentence rule

**Obsidian Gallery is a calm, premium digital miniature-painting workbench where physical craft gives meaning to the interface without competing with the hobby itself.**

## Read order

For any UI task:

1. `00-source-of-truth.md`
2. `01-design-constitution.md`
3. `02-material-system.md`
4. `03-typography-system.md`
5. `04-token-spec.md`
6. `05-physicality-depth-system.md`
7. `06-component-inventory.md`
8. `07-composition-rules.md`
9. `08-responsive-accessibility.md`
10. route-specific spec, if present
11. `09-visual-qa.md`
12. `10-codex-migration-protocol.md`

Use `11-migration-prompt-template.md` to create Codex tasks.
Use `12-screen-spec-template.md` when defining a route.

## Source references

Optimized references are in `reference/`. The original supplied PDFs are retained in `reference/guides/`.

The visual references are not a buffet of decorative ideas. Each sheet defines a semantic role and usually includes explicit "never" rules.

## Design layers

OG-WDS is organized into five layers:

1. **Product constitution** - why the UI exists.
2. **Material and typography semantics** - what visual language means.
3. **Tokens** - global implementation values.
4. **Components** - reusable semantic objects.
5. **Compositions/screens** - route-specific arrangements.

A screen should not bypass layers 2-4 with one-off styling.

## Status of route-specific mockups

Route-specific mockups should live under:

`docs/design/screens/<route-or-feature>/`

Each route directory should contain:
- `spec.md`
- approved reference images,
- optional comparison screenshots,
- links to the golden implementation it follows.

If no approved screen reference exists, derive composition from OG-WDS components; do not invent a new aesthetic direction.

## Golden implementation

A "golden implementation" is a production route whose OG-WDS implementation has been explicitly approved.

Once designated, add it to `docs/design/golden-implementation.md` and use it as the primary coding reference for spacing, density, real component behavior, and responsive treatment.

Until then, the source pack and component contracts remain authoritative.

## Implementation architecture

- `15-repo-architecture.md` — separation of design truth, primitives, domain components, routes and business/data layers.
- `components/core-surfaces.md` — low-physicality surface family.
- `components/functional-ui.md` — intentionally quiet functional controls.
- `components/physical-objects.md` — high-physicality vocabulary and budget.
- `MANIFEST.md` — complete kit map.
- `16-premium-quality-bar.md` — release gates for fidelity, restraint, consistency, interaction finish and behavioral preservation.
