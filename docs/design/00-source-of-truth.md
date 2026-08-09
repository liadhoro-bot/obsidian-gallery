# Source of truth and provenance

## Primary supplied sources

The kit was derived from the supplied Design DNA package.

Primary written references:
- `reference/guides/product-and-design-constitution.pdf`
- `reference/guides/material-hierarchy.pdf`

Primary visual systems:
- `reference/materials/`
- `reference/typography/`
- `reference/surfaces/`
- `reference/shadows/`
- `reference/corners/`
- `reference/hardware/`

## Provenance labels used in this kit

### SOURCE

Explicitly defined by the supplied material.

Examples:
- Cormorant Garamond for Title and Section.
- Source Sans 3 for Subtitle, Body, Caption, Label.
- IBM Plex Mono for technical data.
- Radius S ~6px, M ~12px, L ~18px.
- Walnut/Parchment material frequency.
- Pins/screws hardware target 0-4, hard maximum 6.
- A card represents one discrete entity.
- A divider separates and must not become a container.

Treat SOURCE rules as fixed unless the design system is deliberately revised.

### CALIBRATED DEFAULT

A browser implementation value needed to realize a SOURCE rule when the supplied sheet does not give an exact CSS number.

Examples:
- exact shadow blur/opacity,
- spacing scale,
- mobile/desktop title sizes,
- animation duration,
- sampled palette hex values.

Calibrated defaults are **global starting values**, not page-level artistic suggestions. If tuning is needed, tune the token once after comparison against an approved golden screen.

### SCREEN-SPECIFIC

A route-specific decision that belongs in `docs/design/screens/...`.

Examples:
- exact order of panels on Unit Overview,
- whether a route uses a Tray,
- how many cards are visible before scrolling,
- a particular responsive breakpoint.

Do not promote a screen-specific choice into a global rule unless it repeats across the product.

## What the optimized reference images are

The `.webp` files under `reference/` are visually faithful, compressed derivatives of the supplied PNG sheets so they can live in the repository without adding roughly 100+ MB.

They are for design interpretation and implementation reference. Keep the original source archive externally if archival fidelity is required.
