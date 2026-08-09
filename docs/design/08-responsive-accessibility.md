# Responsive and accessibility rules

OG-WDS is mobile-first even when the reference sheet demonstrates a desktop composition.

## Mobile principle

**Compress the metaphor, not the usability.**

Do not literally shrink a desktop workbench until labels become tiny and hardware becomes clutter.

## Default breakpoints - CALIBRATED DEFAULT

Use the repository's existing breakpoint system when possible. If none exists, start with:

- compact: < 640px
- medium: 640-1023px
- wide: >= 1024px

Do not invent component-specific breakpoints without need.

## Canonical application viewport

Obsidian Gallery keeps a phone-format application composition on wide browser viewports unless a screen spec explicitly opts into a broader workspace.

- Canonical app viewport: 390 x 844 portrait proportion.
- At a 390 x 844 browser viewport, the app fills the available viewport normally.
- At a 1440 x 900 browser viewport, the app remains in the same mobile-format composition and is centered horizontally inside environmental/workbench space.
- Do not stretch app panels to desktop width, reorganize phone routes into desktop columns, enlarge mobile cards into horizontal desktop cards, or introduce desktop-specific navigation just because the browser is wide.
- Unused desktop space is environmental/workbench space, not additional content space.
- Use `--og-workbench-compact-max-width` for compact migrated app routes that must preserve this phone-format architecture.

## Mobile behavior

- single-column primary flow,
- 16px page gutter,
- large tap targets,
- horizontal scrolling only for semantically horizontal objects (e.g. stage track, curated shelf),
- no clipped parchment/card shadows,
- account for bottom navigation and safe areas,
- move secondary drawer-like content to bottom sheet/accordion when appropriate,
- reduce visible hardware,
- reduce texture intensity,
- preserve title hierarchy without print-sized display text.

## Tablet/desktop behavior

Compact migrated application routes must preserve the canonical phone-format composition on tablet and desktop unless their screen spec explicitly approves a broader workspace.

Broader workspace routes may:
- introduce side-by-side hero + details,
- use a structural walnut rail/sidebar,
- show grouped trays,
- allow denser metadata,
- keep primary reading width comfortable.

Do not fill desktop width just because it exists.

## Accessibility

### Contrast
Texture and material color never excuse low contrast.

Functional text must meet normal accessibility contrast targets.

### Focus
Every interactive component needs a visible keyboard focus state.

Focus should be:
- unmistakable,
- not reliant only on color,
- compatible with the material surface.

Use a restrained high-contrast outline/ring token, not an ornamental glow.

### Touch
44x44px minimum target on touch layouts.

### Motion
Respect `prefers-reduced-motion`.

Physical motion should be small and meaningful:
- button press,
- drawer reveal,
- gentle surface state transitions.

No unnecessary parallax, bounce, or cinematic transitions.

### Text
Do not make captions tiny.
Do not justify body copy on mobile.
Do not use handwritten text for required information.
Do not encode status solely in color.

### Images
Preserve:
- alt text,
- loading behavior,
- aspect ratio,
- focal content,
- image clarity.

The Image Mount decorates/supports the image container; it must not degrade the image itself.

## Density

A premium interface is not an empty interface.

Use whitespace to create hierarchy, not to force excessive scrolling.

On mobile, prefer:
- concise section headings,
- compact metadata rows,
- progressive disclosure,
- clear next action.

Do not stack huge title blocks, decorative plaques, hero images, and multiple panels before the user reaches the actual task.
