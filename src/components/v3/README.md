# `src/components/v3` — OG-WDS primitives

This directory is reserved for reusable visual primitives governed by `docs/design/`.

## Boundary

A v3 primitive may know:
- visual semantics,
- material semantics,
- physicality level,
- interaction state,
- responsive internal behavior.

It must not know:
- Supabase,
- route params,
- Project/Unit/Paint/Guide business objects,
- analytics event names,
- permissions,
- persistence rules.

Those belong in domain or route layers.

## Required implementation rules

- Consume OG-WDS tokens; no raw visual values unless documented as a temporary migration exception.
- Prefer semantic props (`tone="danger"`, `elevation="contact"`) over arbitrary values.
- Do not expose arbitrary material props on components whose material is part of their meaning.
- Preserve native semantics: buttons are buttons, links are links, labels label controls.
- Support `className` only for layout/composition; consumers must not use it to override the visual contract.
- All interactive primitives need visible keyboard focus.
- Touch targets should meet the calibrated 44px target on touch layouts.
- Reduced-motion users must not depend on physical motion to understand state.

## Suggested folders

```text
v3/
├── surfaces/      SurfacePanel, EntityCard, Tray, Drawer, Shelf, PaperSheet
├── controls/      Button, IconButton, SegmentedControl, Field, Select, Checkbox, Switch
├── typography/    PageTitle, SectionTitle, Subtitle, BodyText, Caption, LabelText, TechnicalText
├── media/         ImageMount, PaintSwatch
├── feedback/      Label, Badge, Medallion, Stamp, ProgressTrack
└── composition/   WorkbenchShell, Section, HudTabs, ActionBar
```

Only create a primitive after checking `docs/design/06-component-inventory.md` and `docs/design/component-registry.json`.
