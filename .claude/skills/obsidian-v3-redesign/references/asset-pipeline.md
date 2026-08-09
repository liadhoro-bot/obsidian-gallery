# Asset pipeline

How to decide whether a route needs a new raster asset, and how to make one that won't break at arbitrary sizes.

## Decision tree

```
Do I need a raster image at all?
│
├─ Is it a repeating surface color/grain (wood, paper, leather, fabric)?
│    → Tileable material fill. background-repeat: repeat, fixed small tile size
│      (150-300px depending on how fine the grain should read). See "Tileable fills" below.
│
├─ Is it one small, real, fixed-aspect physical object (a rivet, a pin, a stamp)?
│    → Isolated hardware icon. Extract just the object, alpha-mask it, size it at
│      its real small footprint (7-96px) via CSS. Never stretch it to fill a panel.
│
├─ Is it a panel/card/plaque/button frame, border, or bevel?
│    → REJECT. Draw it in CSS: border + border-radius + box-shadow from
│      --og-shadow-* / --og-radius-* / --og-border-* tokens. This system's
│      shadow tokens already encode multi-ring bevel structure; see
│      docs/design/05-physicality-depth-system.md.
│
└─ Does it bake in placeholder/fake UI content (a fake button, a fake progress
   bar, fake label text)?
     → REJECT unconditionally. No amount of clever CSS sizing fixes an asset
       that assumes content it doesn't actually control. Render the real
       content as real DOM elements instead.
```

## Do / don't, from the Dashboard repair

| Found | Problem | Fix |
|---|---|---|
| `parchment-panel-shell.png` — square frame, rivets baked in each corner | Stretched via `100% 100%` into 1.5:1–6:1 boxes; bevel/rivets squashed into ovals | Deleted. CSS border + `--og-shadow-constructed-panel` + inset `::before` pseudo-border does the same job at any aspect ratio |
| `next-actions-shell.png` — baked-in fake medallion, fake progress pill, fake ▶ button | Real DOM medallion/progress-track/chevron rendered on top, misregistered against the fake ones underneath | Deleted. Real elements are the only elements |
| `segmented-control-shell.png` — static 50/50 cream/dark split | Can't represent the second tab being active; the image never changes | Deleted. The active-segment highlight is a real CSS-positioned element |
| `parchment-fiber.png` — nearly flat, no visible grain | Tiled at 300px it read as "washed out" | Recropped from a more textured region of the same source sheet |
| `brass-aged.png` — flat cream, not metallic | Every "brass" surface lost its metallic gleam | Dropped entirely; strengthened the pure-CSS specular gradient in `--og-material-brass` instead — a plain `linear-gradient` conveys a metal sheen fine at UI scale and never needs a tile-size decision |
| `brass-rivet.png` — a leather panel crop, not a rivet | Corner "pins" rendered as dark smudges | Recropped tight to one real rivet stud from a different source sheet, alpha-masked to a circle |

## Using `scripts/crop-tileable-asset.mjs`

Three functions, callable from the CLI or imported:

- `cropTile({ src, out, left, top, width, height, outSize })` — extract a region and resize it into a square tileable swatch.
- `isolateCircleIcon({ src, out, left, top, width, height, outSize })` — extract a region and alpha-mask it to a circle, for hardware icons.
- `noiseGrain({ out, size, baseFrequency, seed, rgb, alpha })` — procedural `feTurbulence` grain as a **fallback only**, when no source region has usable texture. Tint `rgb` toward the target token color (e.g. `--og-parchment-100`) so it reads as a shade of that material, not generic static.

Workflow — this is the loop that actually works, because Claude Code can view PNG output directly:

1. Look at the candidate source region first (`Read` the full source sheet, e.g. `public/og-v3/source/kit.png` or another `source/*.png`) and estimate a crop box.
2. Run the crop command.
3. `Read` the output file.
4. Judge: is the grain visible but not busy? Is a hardware icon centered with minimal background bleed at the mask edge? Does a diagonal vignette or shadow bleed into the crop (bad — will show as a seam when tiled)?
5. Adjust coordinates and re-crop. Two to four iterations is normal — see the Dashboard rivet fix, which took five attempts to center correctly.

Do not port the old `.codex` skill's `make-contact-sheets.py` — Python isn't installed in this environment. The `Read`-and-iterate loop above needs no dependency beyond `sharp`, which is already a project dependency.

## Output conventions

- Tileable material fills: 256–512px square PNG, no alpha needed unless layered over a non-opaque background.
- Hardware icons: 64–96px square PNG, alpha-transparent outside the object's silhouette.
- Naming: `public/og-v3/materials/<name>.png` for fills, `public/og-v3/hardware/<name>.png` for icons. Keep the source crop library at `public/og-v3/source/*.png` untouched — it's shared across routes.
- **Token-arity rule.** Every `--og-material-*` composite in `src/styles/og-design-tokens.css` is a comma-separated list of background-image layers. Every consumer's `background-repeat` and `background-size` must list exactly as many values, in the same order, as that consumer's total flattened layer count (the composite's layer count, plus one for each extra layer the consumer prepends itself, e.g. its own gradient). Adding or removing a layer from a composite means re-checking and re-counting every consumer — a shorter list doesn't error, it silently cycles and applies the wrong size to the wrong layer. This exact bug, independent of the shell-image problem, was found and fixed across a dozen call sites during the Dashboard repair (see `app/dashboard/dashboard-og.module.css`, `app/components/mobile-nav.module.css`, `src/components/v3/primitives.module.css`). Check it every time.
