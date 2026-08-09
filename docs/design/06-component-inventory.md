# Component inventory

Reference sheets live in `reference/surfaces/`.

This is the semantic inventory Codex should map legacy UI onto.

## Foundation components

### `WorkbenchShell`
**Role:** app-level workspace environment.

Material:
- walnut structure,
- parchment/paper content surfaces.

Does:
- establish background, safe areas, app chrome, layout rhythm.

Does not:
- wrap every child in wood,
- compete with the active content.

### `SurfacePanel`
Reference: `reference/surfaces/panel.webp`

**Role:** primary workspace container.

SOURCE:
- parchment/premium paper,
- optional walnut inset,
- medium radius,
- low visual weight,
- large uninterrupted areas,
- no decorative hardware by default.

Variants:
- `default`
- `section`
- `stacked`
- `walnutInset` (rare; structural justification required)

A panel organizes the interface. It should not become the interface.

### `EntityCard`
Reference: `reference/surfaces/card.webp`

**Role:** one discrete entity: project, unit/miniature, paint, guide, collection item.

SOURCE:
- paper by default,
- parchment for more important cards,
- image/content dominates material treatment,
- controlled radius,
- slight elevation,
- clear hierarchy,
- optional restrained selection accent.

Never:
- antique-document treatment on every card,
- pins/screws,
- default decorative frames,
- excessive texture.

### `Tray`
Reference: `reference/surfaces/tray.webp`

**Role:** groups a real collection of related objects.

SOURCE:
- walnut,
- optional cork/paper inner bed,
- shallow physical depth,
- objects sit inside it.

Use:
- paint collection group,
- project palette,
- achievements,
- bench objects.

Never use a Tray simply to create a fancy border around arbitrary UI.

### `Drawer`
Reference: `reference/surfaces/drawer.webp`

**Role:** reveal/hide secondary content.

SOURCE:
- interaction metaphor, not always literal,
- emerges from established surface,
- secondary content stays clean,
- smooth natural motion.

Use:
- details,
- notes,
- history,
- supporting controls.

Never keep a drawer permanently open merely for atmosphere.

### `Shelf`
Reference: `reference/surfaces/shelf.webp`

**Role:** presentation/showcase.

Use:
- paint collection highlights,
- finished miniatures,
- achievements,
- curated items.

Never use as general page layout structure.

### `PaperSheet`
Reference: `reference/surfaces/paper-as-surface-object.webp`

**Role:** freeform information surface.

Use:
- notes,
- guides,
- recipes,
- sketches,
- documentation.

SOURCE:
- thin,
- matte,
- warm off-white,
- liftable,
- subtle edge variation,
- may overlap.

Never:
- distressed/grungy,
- decorative frame,
- heavy texture.

### `StickyNote`
Reference: `reference/surfaces/sticky-note.webp`

**Role:** temporary, personal, contextual information.

Use:
- Curator comments,
- reminders,
- quick notes,
- suggestions.

Signals: personal and temporary.

Never use for important permanent information.

### `ImageMount`
Reference: `reference/surfaces/image-mount-photo-mount.webp`

**Role:** present visual documentation.

SOURCE:
- image remains crisp/clean,
- mount supports the image,
- consistent border spacing,
- no decorative effects applied to the actual image.

Never:
- fake tape/pins/stickers unless context explicitly calls for them,
- heavy stains,
- inconsistent image treatments.

### `Plaque`
Reference: `reference/surfaces/plaque-nameplate.webp`

**Role:** permanent identity of a place, section, or object.

Examples:
- named collection area,
- special project nameplate,
- structural location.

Rule:
**Plaque identifies a place/object. Label classifies content.**

Paper/parchment versions are contextual.
Brass/painted metal versions are rare/prestigious.

Never use plaques as ordinary labels or buttons.

### `Label`
Reference: `reference/surfaces/label.webp`

**Role:** classification/identification.

Use:
- category,
- status,
- metadata,
- collection name,
- functional state.

A label is a mark, not a card.

Two families:
- contextual paper label,
- UI-native functional label.

### `Divider`
Reference: `reference/surfaces/divider.webp`

**Role:** separation without containment.

SOURCE:
- subtle,
- thin,
- low contrast,
- aligned to content.

A divider must not create hierarchy by itself.

### `Button`
Reference: `reference/surfaces/button.webp`

**Role:** action. Nothing more.

Variants:
- primary,
- secondary,
- tertiary,
- destructive,
- success,
- icon.

SOURCE:
- clean geometry,
- consistent radius,
- strong affordance,
- subtle pressed depth,
- high legibility,
- minimal texture.

Never:
- ornamental border,
- metal plate for ordinary actions,
- screws,
- huge shadow,
- heavy bevel.

### `ProgressTrack`
Reference: `reference/surfaces/progress-track.webp`

**Role:** measurable completion.

SOURCE:
- recessed/printed indicator embedded in a surface,
- low profile,
- fill may look like paint or inlaid material,
- always paired with percentage/clear value where appropriate.

Never:
- glossy modern progress bar,
- neon fill,
- thick floating pill,
- ornamental frame.

### `PaintSwatch`
Reference: `reference/surfaces/swatch.webp`

**Role:** honest display of a paint/color/material sample.

Shapes may include:
- circle,
- chip,
- brush stroke,
- rectangle/strip,
- mounted swatch.

Color accuracy takes priority over decoration.

Never:
- gradients,
- glossy generic color bubble,
- bevels that distort color,
- inconsistent art treatment.

### `Badge` / `Medallion`
Reference: `reference/surfaces/badge-medallion.webp`

**Badge:** compact information.
**Medallion:** special recognition.

Badge:
- paper/parchment/UI-native,
- compact and readable.

Medallion:
- brass/metal/enamel,
- achievements/Curator/special recognition only.

Do not use metal for every badge.

### `Stamp`
Reference: `reference/surfaces/stamp.webp`

**Role:** state or validation.

Examples:
- completed,
- mastered,
- archived,
- Curator's Pick.

A stamp should not exist if it does not communicate a clear state.

Use sparingly; it is more expressive than a standard status label.

### `Pin`
Reference: `reference/surfaces/pin.webp`

**Role:** visibly attach one physical object to another.

Brass primarily.

Sizes in source reference:
- ~6mm,
- ~8mm,
- ~10mm physical metaphor.

A pin must actually pin something.

### `StructuralHardware`
Reference: `reference/hardware/screws-structural-hardware.webp`

**Role:** prove believable construction between rigid materials.

Use only in structural contexts.

### `FunctionalControls`
Not a decorative surface family.

Includes:
- input,
- select,
- toggle,
- checkbox,
- segmented control,
- pagination,
- filters.

Constitution rule: Tier-3 functional UI should be almost invisible.

Use Source Sans 3, S radius, neutral/paper-native surfaces, restrained borders.

### Typography primitives
Create reusable:
- `PageTitle`
- `ObjectTitle`
- `SectionHeading`
- `Subtitle`
- `BodyText`
- `Caption`
- `LabelText`
- `TechnicalValue`

Do not style typography independently per route.

## Build-first priority

Before broad route migration, stabilize these first:

1. WorkbenchShell
2. SurfacePanel
3. EntityCard
4. Button
5. FunctionalControls
6. Typography primitives
7. ImageMount
8. Label
9. Divider
10. ProgressTrack
11. PaintSwatch
12. Badge

Then add higher-physicality components only when screens genuinely need them:
Tray, Drawer, Shelf, PaperSheet, StickyNote, Plaque, Stamp, Pin, StructuralHardware, Medallion.
