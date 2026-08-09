# Reference asset map

These are compressed, repository-friendly derivatives of the supplied Design DNA sheets.

## Written guides
- `reference/guides/product-and-design-constitution.pdf`
- `reference/guides/material-hierarchy.pdf`

## Materials
- `reference/materials/walnut.webp`
- `reference/materials/parchment.webp`
- `reference/materials/paper.webp`
- `reference/materials/paint.webp`
- `reference/materials/brass.webp`
- `reference/materials/steel.webp`
- `reference/materials/cork.webp`
- `reference/materials/leather.webp`
- `reference/materials/glass.webp`
- `reference/materials/wax.webp`

## Typography
- `reference/typography/obsidian-gallery-typography-system.webp`
- `reference/typography/section-structure-and-navigation.webp`
- `reference/typography/subtitle-context.webp`
- `reference/typography/body-reading-and-understanding.webp`
- `reference/typography/caption-supporting-information.webp`
- `reference/typography/label-classification-and-ui.webp`
- `reference/typography/mono-technical-precision.webp`

## Surfaces
- `reference/surfaces/panel.webp`
- `reference/surfaces/card.webp`
- `reference/surfaces/tray.webp`
- `reference/surfaces/paper-as-surface-object.webp`
- `reference/surfaces/divider.webp`
- `reference/surfaces/button.webp`
- `reference/surfaces/drawer.webp`
- `reference/surfaces/shelf.webp`
- `reference/surfaces/image-mount-photo-mount.webp`
- `reference/surfaces/stamp.webp`
- `reference/surfaces/pin.webp`
- `reference/surfaces/label.webp`
- `reference/surfaces/plaque-nameplate.webp`
- `reference/surfaces/progress-track.webp`
- `reference/surfaces/badge-medallion.webp`
- `reference/surfaces/swatch.webp`
- `reference/surfaces/sticky-note.webp`

## Shadows
- `reference/shadows/small-shadow-contact.webp`
- `reference/shadows/medium-shadow-elevated-object.webp`
- `reference/shadows/large-shadow-structural-depth.webp`
- `reference/shadows/floating-paper-shadow.webp`
- `reference/shadows/pressed-button-shadow.webp`

## Radius
- `reference/corners/corner-radius-spec-sheet.webp`
- `reference/corners/small-radius-functional.webp`
- `reference/corners/medium-radius-surface.webp`
- `reference/corners/large-radius-physical-structure.webp`

## Hardware
- `reference/hardware/screws-structural-hardware.webp`
- `reference/hardware/round-head-screw.webp`
- `reference/hardware/flat-head-screw.webp`

## How Codex should use references

Use the specific sheet for the component being implemented. Do not scan unrelated sheets and combine every interesting physical treatment into one component.

Example:
- implementing Card -> read Card sheet + material/typography/tokens.
- implementing progress -> read Progress Track sheet.
- implementing pin -> read Pin + Screw budget.
