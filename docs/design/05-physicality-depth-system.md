# Physicality and depth system

OG-WDS uses physical metaphors selectively. Physicality communicates meaning.

## Component physicality - SOURCE

| Component | Physicality |
|---|---:|
| Divider | ★☆☆☆☆ |
| Panel | ★★☆☆☆ |
| Card | ★★☆☆☆ |
| Button | ★★☆☆☆ |
| Image Mount | ★★☆☆☆ |
| Label | ★★☆☆☆ |
| Paper object | ★★★☆☆ |
| Progress Track | ★★★☆☆ |
| Swatch | ★★★☆☆ |
| Plaque / Nameplate | ★★★☆☆ |
| Drawer | ★★★☆☆ |
| Stamp | ★★★☆☆ |
| Functional Badge | ★★☆☆☆ |
| Medallion Badge | ★★★☆☆ |
| Tray | ★★★★☆ |
| Shelf | ★★★★☆ |
| Sticky Note | ★★★★☆ |
| Pin | ★★★★★ |
| Structural screws/hardware | ★★★★★ |

Physicality is not a prestige scale. A five-star pin is physically explicit, not more important than content.

## Rules by level

### 1 - almost flat
Use for separation and structure that should disappear at a glance.

Examples:
- divider,
- flat embedded UI.

No drop shadow.

### 2 - surface
Everyday components with restrained contact/elevation.

Examples:
- panel,
- card,
- button,
- image mount,
- label.

Use S/M radius based on purpose.
Use contact or very mild medium shadow only when actual elevation is implied.

### 3 - object
A deliberately tactile object.

Examples:
- progress track embedded in a surface,
- swatch,
- plaque,
- paper sheet,
- medallion,
- drawer.

The depth must explain interaction or material identity.

### 4 - environmental object
A component visibly changes the physical workspace.

Examples:
- tray,
- shelf,
- sticky note.

These should be uncommon.

### 5 - explicit hardware
Visible construction.

Examples:
- pin,
- screw.

Every instance must have a believable physical job.

## Hardware budget - SOURCE

Pins and screws share a screen-level budget:
- recommended target: 0-4,
- hard limit: 6.

Do not:
- screw every corner,
- mix head types arbitrarily,
- use screws on simple cards,
- use pins on paper that is not attached,
- treat hardware as ornament.

## Screw semantics - SOURCE

- Round head = default visible craftsmanship.
- Flat head = functional/discreet, flush with surface.
- Brass = default structural hardware.
- Steel = utility/technical hardware.

A screw proves construction. If there is no construction job, it does not belong.

## Shadow direction

All shadows on a screen must behave as if they share the same light environment.

CALIBRATED DEFAULT:
- light source roughly upper-left,
- shadows fall softly down/right,
- warm neutral shadow color,
- no dramatic black ambient occlusion on ordinary components.

## Depth and hierarchy are separate

Never use a stronger shadow merely to make an element more important.

Importance comes from:
- content,
- scale,
- placement,
- typography,
- whitespace,
- image prominence,
- semantically appropriate material.

Depth only describes spatial relationship.

## Mobile compression

On small screens, preserve the *meaning* of physicality, not literal mass.

Examples:
- Tray may become a shallow horizontal grouping rather than a deep 3D box.
- Drawer may behave like a bottom sheet while retaining a restrained workbench cue.
- Shelf may become a rare horizontal showcase strip.
- Hardware count usually decreases on mobile.
- Large shadows should be rarer because they consume visual space.
