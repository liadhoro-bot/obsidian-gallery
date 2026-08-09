# OG-WDS repository architecture

This is the target architecture for implementing the supplied Design DNA in the existing Obsidian Gallery application without coupling visual migration to product/business refactors.

The architecture assumes the current web application remains a Next.js App Router application with Tailwind/CSS available. If a local folder name differs, preserve the layer boundaries below rather than forcing the literal path.

## Architecture principle

Keep five concerns separate:

1. **Design truth** — source rules, references, tokens, component semantics.
2. **Visual primitives** — reusable low-level OG-WDS components.
3. **Domain components** — Project, Unit, Paint, Guide, Contest, etc. that know product data.
4. **Route compositions** — page-specific layout and orchestration.
5. **Business/data layer** — queries, mutations, auth, analytics and persistence.

A UI redress should move mostly through layers 1–4 while leaving layer 5 unchanged.

## Target repository shape

```text
/
├── AGENTS.md
├── docs/
│   └── design/
│       ├── index.md
│       ├── 00-source-of-truth.md
│       ├── 01-design-constitution.md
│       ├── 02-material-system.md
│       ├── 03-typography-system.md
│       ├── 04-token-spec.md
│       ├── 05-physicality-depth-system.md
│       ├── 06-component-inventory.md
│       ├── 07-composition-rules.md
│       ├── 08-responsive-accessibility.md
│       ├── 09-visual-qa.md
│       ├── 10-codex-migration-protocol.md
│       ├── 11-migration-prompt-template.md
│       ├── 12-screen-spec-template.md
│       ├── 13-reference-asset-map.md
│       ├── 14-enforcement.md
│       ├── 15-repo-architecture.md
│       ├── component-registry.json
│       ├── golden-implementation.md
│       ├── components/
│       │   ├── core-surfaces.md
│       │   ├── functional-ui.md
│       │   └── physical-objects.md
│       ├── migration/
│       │   ├── current-ui-audit.md       # created during Phase 0
│       │   └── route-name.md             # one migration record per route
│       ├── screens/
│       │   └── route-name.md             # approved screen contract when available
│       └── reference/
│           ├── guides/
│           ├── materials/
│           ├── surfaces/
│           ├── typography/
│           ├── shadows/
│           ├── corners/
│           └── hardware/
├── src/
│   ├── styles/
│   │   ├── og-design-tokens.css
│   │   └── og-design-tokens.json
│   ├── components/
│   │   ├── v3/                           # visual primitives only
│   │   │   ├── README.md
│   │   │   ├── surfaces/
│   │   │   ├── controls/
│   │   │   ├── typography/
│   │   │   ├── media/
│   │   │   ├── feedback/
│   │   │   └── composition/
│   │   └── domain/                       # optional; product-aware components
│   │       ├── units/
│   │       ├── projects/
│   │       ├── paints/
│   │       ├── guides/
│   │       └── contests/
│   └── app/                              # route compositions
└── scripts/
    └── design-guard.mjs
```

## Layer contracts

### 1. Design truth

Everything under `docs/design` and `src/styles/og-design-tokens.*` describes *what the interface is allowed to mean and look like*.

Rules:
- route code does not redefine the design system;
- source reference sheets outrank aesthetic invention;
- calibrated values are tuned globally, not per page;
- screen specs may specialize composition but may not silently contradict the constitution/material semantics.

### 2. OG-WDS primitives — `src/components/v3`

Primitives know visual semantics but **do not know domain data**.

Good primitive APIs:

```tsx
<SurfacePanel density="default" elevation="flat">…</SurfacePanel>
<Label tone="neutral">Owned</Label>
<ImageMount aspect="4/3">…</ImageMount>
<ProgressTrack value={62} />
```

Bad primitive APIs:

```tsx
<ProjectCard project={project} />       // domain-aware
<PaintOwnedLabel paintId={id} />        // business-aware
<ContestNominationDrawer query={...} /> // data-aware
```

Visual primitives may expose constrained semantic variants. They should not expose free-form `material`, arbitrary `shadow`, arbitrary `radius`, or raw color props that let route code reconstruct a second design system.

### 3. Domain components

Domain components combine primitives with product concepts and data shapes.

Examples:
- `UnitSummaryCard`
- `ProjectPalette`
- `PaintCollectionItem`
- `GuideDeckCard`
- `ContestNominationCard`

A domain component can know a Unit or Paint. It should still receive data/handlers rather than own unrelated persistence when practical.

### 4. Route composition

Routes decide:
- sequence and hierarchy,
- responsive composition,
- which domain components appear,
- loading/error/empty states,
- route-specific actions.

Routes should not:
- introduce one-off shadow/radius/color values,
- reproduce primitive internals,
- create local material metaphors to fill empty space.

### 5. Business/data layer

During a presentation migration, this is a preservation boundary.

Keep stable unless the task explicitly authorizes changes:
- Supabase access and mutations,
- auth and authorization,
- data models,
- server actions/API contracts,
- analytics semantics,
- navigation semantics,
- form validation/business rules.

## CSS and Tailwind integration

`src/styles/og-design-tokens.css` is the semantic source for visual values. Tailwind may consume those variables, but Tailwind palette names should not become a parallel source of truth.

Preferred pattern:

```css
background: var(--og-surface-parchment);
color: var(--og-ink-primary);
border-radius: var(--og-radius-m);
```

If Tailwind utility aliases are added, map them to CSS variables:

```ts
// illustrative only; adapt to local Tailwind version
colors: {
  'og-parchment': 'var(--og-surface-parchment)',
  'og-ink': 'var(--og-ink-primary)',
}
```

Do not copy token hex values into Tailwind configuration.

## Ownership of responsive behavior

- Primitive: internal legibility and state behavior.
- Domain component: its compact/expanded presentation when semantically meaningful.
- Route: layout mode, columns, ordering, horizontal overflow, sticky regions.

The mobile UI is not a scaled-down desktop workbench. Physical metaphors simplify as space narrows.

## State architecture

Every reusable interactive component must define:
- default,
- hover where pointer exists,
- focus-visible,
- active/pressed,
- disabled,
- selected where applicable,
- loading where applicable,
- error only when semantically relevant.

Do not encode validation/error meaning only through material texture or color.

## Reference architecture for a route migration

```text
Existing route
    ↓ audit behavior
Preservation list
    ↓ map visuals
OG-WDS primitives + existing domain behavior
    ↓ compose
Migrated route
    ↓ verify
Functional checks + viewport screenshots + reference comparison
```

The design system should make each later route migration progressively less creative and more mechanical.

## Golden implementation dependency

Do not promote a screen to "golden" simply because it is the first migrated route. It must be visually approved.

After approval, record in `golden-implementation.md`:
- route,
- approved viewport(s),
- screenshot paths,
- reusable component paths,
- any calibrated token changes made during approval,
- patterns other routes should copy,
- patterns unique to that route that must *not* spread.

## Deprecation strategy

Use a strangler migration:

1. introduce OG-WDS tokens/primitives beside legacy UI;
2. migrate one route or component family;
3. mark legacy visual primitives deprecated;
4. remove a legacy primitive only when no active route depends on it.

Avoid a global class-name/theme rewrite before route-level visual verification. It increases blast radius and makes regressions difficult to attribute.
