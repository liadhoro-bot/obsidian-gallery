# Token specification

This document distinguishes source-defined values from browser-calibrated defaults.

Machine-readable values live in:
- `src/styles/og-design-tokens.json`
- `src/styles/og-design-tokens.css`

## Radius - SOURCE

Reference: `reference/corners/corner-radius-spec-sheet.webp`

- `radius-s`: ~6px - functional controls and compact information.
- `radius-m`: ~12px - default everyday surfaces.
- `radius-l`: ~18px - physical structure/mass.

Rules:
- S = functional and restrained.
- M = default surface radius.
- L = physical structure.
- Avoid 0px sharpness unless a specific material demands it.
- Avoid excessive pill/soft rounding unless the component semantics require it.

Do not introduce arbitrary intermediate radii page by page.

## Palette

The source defines material character, not canonical hex values. The values below are **CALIBRATED DEFAULTS sampled from the supplied visual sheets**.

### Structural / neutral

| Token | Value | Role |
|---|---|---|
| `walnut-950` | `#2B1C13` | recess/deep structure |
| `walnut-900` | `#3B281C` | dark structural walnut |
| `walnut-800` | `#563824` | sampled core walnut |
| `walnut-700` | `#6D4930` | lifted walnut |
| `parchment-50` | `#F7EFE4` | light parchment |
| `parchment-100` | `#F1E3CF` | default parchment surface |
| `parchment-200` | `#EAD6BC` | sampled parchment |
| `paper-50` | `#F8F4EE` | light paper |
| `paper-100` | `#ECE2D3` | sampled archival paper |
| `paper-200` | `#DED0BD` | deeper paper edge |
| `ink-950` | `#241B15` | primary text |
| `ink-800` | `#3A2D23` | strong secondary |
| `ink-650` | `#5D5043` | secondary text |
| `ink-500` | `#776B5D` | quiet metadata |

### Materials

| Token | Value |
|---|---|
| `brass-500` | `#B78942` |
| `brass-700` | `#815B2C` |
| `steel-500` | `#85817D` |
| `steel-700` | `#474541` |
| `leather-500` | `#5C3121` |
| `leather-700` | `#412A1D` |

### Semantic status colors - CALIBRATED DEFAULT

These must remain muted and secondary to miniature/paint imagery.

- info/in-progress: deep desaturated blue
- success/completed: olive green
- warning/on-hold: muted ochre
- danger/cancelled: brick red
- curator/special: muted plum
- archived/draft: neutral ink/steel

Use semantic tokens, not page-specific colors.

## Spacing - CALIBRATED DEFAULT

Base rhythm: 4px.

- `space-1`: 4px
- `space-2`: 8px
- `space-3`: 12px
- `space-4`: 16px
- `space-5`: 20px
- `space-6`: 24px
- `space-8`: 32px
- `space-10`: 40px
- `space-12`: 48px
- `space-16`: 64px

Primary composition should mostly use 8/12/16/24/32.

Tiny decorative offsets should not create a second spacing system.

## Shadows

References:
- `reference/shadows/small-shadow-contact.webp`
- `reference/shadows/medium-shadow-elevated-object.webp`
- `reference/shadows/large-shadow-structural-depth.webp`
- `reference/shadows/floating-paper-shadow.webp`
- `reference/shadows/pressed-button-shadow.webp`

The source specifies shadow meaning, not CSS values.

### Contact - SOURCE meaning / CALIBRATED CSS
Communicates contact, not elevation.

Use:
- card on panel,
- swatch on paper,
- label,
- image mount,
- functional badge.

Never use on:
- divider,
- text,
- progress track,
- flat embedded controls.

### Medium
Communicates a real object above a surface.

Use:
- important card,
- sticky note,
- prominent image mount,
- physical plaque,
- drawer front,
- medallion,
- physical objects in a tray.

### Large
Communicates environmental/structural depth, **not importance**.

Use:
- open drawer,
- deep tray,
- shelf,
- large overlay,
- structural elements whose depth changes the space.

Never make an ordinary card "important" by giving it Large Shadow.

### Floating paper
Paper shadow follows the lifted paper edge, not a symmetric box.

Implement with a component-specific pseudo-element/shape where practical. Do not use a generic four-sided card shadow.

### Pressed
Pressed state changes depth:
- element moves down subtly,
- external shadow reduces,
- small inset/contact shadow appears,
- top highlight reduces,
- release restores smoothly.

Do not add gloss, bevel, or decorative effects during press.

## Border / line tokens - CALIBRATED DEFAULT

Use warm, low-contrast borders:
- hairline: 1px with low-opacity ink/brass/walnut depending on material.
- medium structural line: 1px-2px only where construction requires it.

Avoid nested borders. A panel should not look like a stack of bordered rectangles.

## Control sizing - CALIBRATED DEFAULT

- minimum touch target: 44 x 44px
- default button/input height: 44px
- large CTA: 52px
- compact desktop-only control: 36px minimum, while retaining adequate hit area
- icon button: 44 x 44px minimum on touch layouts

## Page spacing - CALIBRATED DEFAULT

- mobile page gutter: 16px
- tablet: 24px
- desktop content gutter: 32px
- bottom navigation/safe-area padding must be included in usable layout height

## Texture

Textures should be subtle enough that text and imagery remain primary.

Implementation rule:
- texture is a low-frequency material cue,
- not a noisy background,
- not applied independently to every nested surface,
- never used to fake distressed/dirty age.

When no approved texture asset exists in code, use a flat calibrated material color rather than generating a random CSS texture.
