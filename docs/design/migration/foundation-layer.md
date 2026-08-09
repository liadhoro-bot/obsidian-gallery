# OG-WDS Foundation Layer

## Scope Implemented

- Installed the approved OG-WDS font families through the existing App Router root layout using `next/font/google` in `app/layout.tsx`.
- Connected `src/styles/og-design-tokens.css` from `app/globals.css`, after Tailwind, so legacy routes keep their existing classes and gain only passive token availability.
- Added the Tier 1 foundation primitive export surface under `src/components/v3` for the first golden route only. No existing route imports these primitives yet.
- Preserved database, data, auth, API, and business/domain behavior. This task adds design infrastructure only.

## Source References Used

- `docs/design/04-token-spec.md`
- `docs/design/06-component-inventory.md`
- `docs/design/16-premium-quality-bar.md`
- `src/components/v3/COMPONENT-CONTRACTS.md`
- `docs/design/component-registry.json`
- `docs/design/reference/surfaces/panel.webp`
- `docs/design/reference/surfaces/card.webp`
- `docs/design/reference/surfaces/button.webp`
- `docs/design/reference/surfaces/image-mount-photo-mount.webp`
- `docs/design/reference/surfaces/label.webp`
- `docs/design/reference/surfaces/badge-medallion.webp`
- `docs/design/reference/surfaces/divider.webp`
- `docs/design/reference/surfaces/progress-track.webp`
- `docs/design/reference/surfaces/swatch.webp`

## Tier 1 Primitive Files

- `src/components/v3/composition/workbench-shell.tsx`
- `src/components/v3/surfaces/surface-panel.tsx`
- `src/components/v3/surfaces/entity-card.tsx`
- `src/components/v3/controls/button.tsx`
- `src/components/v3/controls/functional-controls.tsx`
- `src/components/v3/typography/typography.tsx`
- `src/components/v3/media/image-mount.tsx`
- `src/components/v3/media/paint-swatch.tsx`
- `src/components/v3/feedback/label.tsx`
- `src/components/v3/feedback/badge.tsx`
- `src/components/v3/feedback/divider.tsx`
- `src/components/v3/feedback/progress-track.tsx`
- `src/components/v3/primitives.module.css`
- `src/components/v3/index.ts`

## Calibrated Token Adjustments

These values were centralized in `src/styles/og-design-tokens.css` instead of being left as primitive-local constants:

- `--og-font-display`, `--og-font-ui`, and `--og-font-mono` now wrap the Next.js font variables with the approved source-family fallbacks.
- `--og-radius-round` supports circular swatches and future medallion/pill use without repeating `999px`.
- `--og-leading-section` supports section heading rhythm from the reference sheets.
- `--og-gutter-fluid`, `--og-gutter-fluid-comfortable`, `--og-shell-max-width`, `--og-workbench-compact-max-width`, and `--og-workbench-fade-stop` support the workbench shell without route-local layout constants. `--og-workbench-compact-max-width` is calibrated to `390px` for compact migrated routes that must retain the canonical phone-format application viewport on desktop.
- `--og-border-width`, `--og-focus-width`, `--og-focus-offset`, and `--og-press-depth` support consistent primitive borders, focus rings, and physical press feedback.
- `--og-material-walnut-board`, `--og-material-walnut-control`, `--og-material-parchment-panel`, `--og-material-paper-card`, `--og-material-photo-mount`, `--og-material-brass`, `--og-material-progress-track`, `--og-material-progress-fill`, `--og-material-dark-inset`, `--og-shadow-physical-panel`, `--og-shadow-photo-mount`, and `--og-shadow-walnut-control` calibrate shared primitives toward the approved Dashboard reference using repository-local V3 raster materials.

No route-specific colors, fonts, radii, shadows, or spacing values were added.
### Task 4C Geometry/Material Calibration
- Walnut workbench material was recalibrated from high-contrast raster grain to low-contrast directional walnut so the background remains environmental.
- Parchment and paper material tokens were warmed and slightly darkened to read as premium hobby notebook stock rather than pale CSS cream.
- `--og-material-ebonized-control` was added for Resume, segmented wells, filters, and bottom navigation so dark controls no longer reuse dominant wood texture.
- Brass material and `OgPlaque` were tuned toward compact aged workshop labels with darker perimeter, restrained highlight, and two small fastener details.
- Global physical shadows were softened to support bevel/contact without theatrical elevation.

## Migration Notes

- The first golden route should import from `src/components/v3` only where a screen is intentionally migrated.
- Existing legacy components remain in place and are not wrapped or re-exported through OG-WDS yet.
- Golden route implementation should tune calibrated values globally in `src/styles/og-design-tokens.css` if visual QA finds drift; do not patch local component CSS to compensate.



### Task 4D Premium Fidelity Correction
- `--og-material-parchment-panel` and `--og-material-paper-card` were recalibrated globally to reduce perceived raster texture by roughly half; the surfaces should now read first as warm notebook/card stock, with fiber visible only on closer inspection.
- `--og-material-brass` was recalibrated as a restrained aged workshop brass gradient without raster grain, and `OgPlaque` now supplies graphical fasteners rather than relying on text punctuation.
- `--og-material-ebonized-control` remains the global inset control material for primary dark buttons, status controls, segmented wells, and mobile navigation; walnut grain is intentionally not used inside these controls.
- Generic `ImageMount`/photo-mount layer sizing was corrected so mounted images can fill their frame without inheriting parchment-card empty space.
### Task 4E Final Material / Physicality Pass
- Walnut tokens now use the local walnut raster asset plus directional grain layers so the workbench reads immediately as restrained dark wood while remaining subordinate to content.
- Parchment and paper tokens now expose more fine fiber and edge variation, with global panel/card frame shadows providing a built stationery surface rather than flat cream boxes.
- Brass tokens now use the local brass raster asset and micro-brushed layers; `OgPlaque` and fastener details use the shared brass plate/hardware shadows for dimensional metal.
- New global depth tokens (`--og-shadow-constructed-panel`, `--og-shadow-constructed-card`, `--og-shadow-control-built`, `--og-shadow-brass-plate`, `--og-shadow-hardware-pin`) define constructed frames, tactile controls, metal plates, and pins for reuse.
- Ebonized controls now include micro-grain and controlled bevel layers for Resume, segmented wells, filters, grid/list toggle, and selected navigation controls.