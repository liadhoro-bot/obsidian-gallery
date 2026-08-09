---
name: obsidian-v3-redesign
description: Redesign, migrate, redress, restyle, or modernize an Obsidian Gallery page or component into the V3 "OG-WDS" handcrafted workbench design language (walnut / parchment / paper / brass / ebonized materials). Use for requests like "redesign the Paints page to V3", "migrate Projects to the new design", "redress Guides", "make X look like the new Dashboard", or anything referencing V3, OG-WDS, the design constitution, or the walnut/parchment/brass material system.
---

# Obsidian V3 Redesign (OG-WDS)

## Core Mandate

Turn an existing Obsidian Gallery route into the V3 design language: a premium miniature-painting workbench where craftsmanship supports clarity. Preserve product behavior and data flow exactly. Make the hobby — miniatures, paint, progress, painting history — the visual hero. Keep software mechanics (controls, menus, filters) quiet, precise, and almost invisible by comparison.

## Hard rule — read this before touching any CSS or asset

**Never apply `background-size: 100% 100%` (or `cover`) to a fixed-aspect raster image that has a frame, border, plaque, or any baked-in content, onto a box whose proportions aren't a fixed match to that image.** It will get squashed non-uniformly and look wrong at every size except the one it was authored for.

Raster images in this design system may only be used for two things:
1. **Small tileable material-grain fills** — `background-repeat: repeat` at a fixed small tile size (e.g. 150–300px). Walnut grain, parchment fiber, ebonized leather texture.
2. **Small fixed-aspect isolated hardware icons** — a single rivet stud, sized and positioned by CSS at its real small footprint (7–14px), never stretched to fill a panel.

Everything else — panel frames, plaques, cards, buttons, bevels, tab shells — is drawn in **pure CSS** from the `--og-shadow-*` / `--og-radius-*` / `--og-border-*` tokens in `src/styles/og-design-tokens.css`. Those tokens already produce correct, size-independent bevels.

### Why this rule exists — the canonical failure case

The Dashboard Active Units screen (`app/dashboard/dashboard-og.module.css`) originally shipped with individual PNG crops taken from one flat AI-generated "asset kit" poster (`public/og-v3/source/kit.png`), wired in as full-panel `background-size: 100% 100%` layers. It looked "terribly misaligned" against the approved mockup for two concrete, repeatable reasons — recognize these symptoms in any future route:

- **Non-uniform stretch.** A square framed asset (~1:1) was stretched into a 1.5:1 featured-unit panel and a ~6:1 next-actions bar, squashing the corner bevels into ovals and thinning opposite edges unevenly.
- **Baked-in fake content conflicting with real DOM content.** One asset baked in its own fake progress bar and a fake ▶ button that had nothing to do with the real, independently-positioned React-rendered progress track and chevron layered on top of it. Another baked a **static** 50/50 split for a two-state tab control — which structurally cannot represent the second tab being active, because the image itself never changes.

The fix (see `docs/design/golden-implementation.md` once approved) was to delete every such "shell" asset and let the CSS bevel system — already present and already correct — do the framing. Do not reintroduce this pattern.

### Also a known, separate dead end — don't extend it

`app/globals.css`'s `.v3-dashboard-shell` / `.v3-parchment-panel` / `.v3-material-walnut` classes and their `/v3-raster/*.webp` assets, wired through the `app/*/*-v3-preview.tsx` + `?preview=1` mechanism, are an **earlier, independent migration attempt** with the same non-uniform-stretch defect. Do not use it as a reference and do not extend it with new routes. (Exception: `/v3-raster/progress-paint.webp` is fine — it's already correctly used as a small tiled fill, not a stretched shell.)

## Required reading

Read in this order, only what's relevant to the task at hand:

- `docs/design/index.md` and `00-source-of-truth.md` through `16-premium-quality-bar.md` — the full written constitution. Always read `01-design-constitution.md`, `02-material-system.md`, and `06-component-inventory.md` before any redesign.
- `docs/design/10-codex-migration-protocol.md` — the phased migration process (foundation → golden route → app shell → route-by-route). Still the right process even though it says "Codex."
- `docs/design/11-migration-prompt-template.md` — copy-paste task template for migrating one route.
- `docs/design/12-screen-spec-template.md` — template for `docs/design/screens/<route>/spec.md`.
- `docs/design/component-registry.json` and `src/components/v3/index.ts` — check what primitives already exist before building anything new.
- `docs/design/golden-implementation.md` — the current approved reference implementation, once filled in.
- `src/components/v3/README.md` and `COMPONENT-CONTRACTS.md` — the boundary rules for primitives (tokens only, no business logic, no raw visual values).
- `references/asset-pipeline.md` (in this skill) — the raster-asset decision tree and the crop script.
- The worked pattern to imitate structurally: `app/dashboard/dashboard-active-units-view.tsx` + `dashboard-og.module.css` + `dashboard-active-units-fixture.ts` + `dashboard-active-units-model.ts` + `dashboard-active-units-screen.tsx` — a view-model layer that feeds the exact same presentation component from both live data and a static dev-only fixture (`?golden=<name>`), so the fixture is provably not a separate fake implementation.

## Workflow

1. **Audit.** Read the target route's current files, data sources, mutations, states, and interactions. Write a short preservation list — what must not change (routing, analytics, a11y semantics, loading/error/empty states).
2. **Map.** For each visual element, check `docs/design/06-component-inventory.md` and `src/components/v3/` for an existing primitive (`OgButton`, `OgPlaque`, `OgProgressTrack`, `SurfacePanel`, `EntityCard`, `ImageMount`, …) before inventing anything. Only build a new primitive in `src/components/v3` if the design system genuinely lacks the concept, and give it its own CSS module contract, not inline route styles.
3. **Assets.** Check `public/og-v3/materials/` and `public/og-v3/hardware/` for what already exists. If this route needs a new tileable material or hardware icon, use `scripts/crop-tileable-asset.mjs` per `references/asset-pipeline.md` — crop from `public/og-v3/source/*.png` first, procedural noise only as a fallback. Never author or accept a full-panel "shell" image.
4. **Implement.** CSS-drawn frames + tileable fills, structured like the Dashboard pattern (view-model + static fixture + dedicated `<route>-og.module.css`). Keep functional/Tier-3 UI visually quiet; save the richest material treatment for the one or two hero objects on the page (per `docs/design/01-design-constitution.md`'s priority order: current task → miniatures → paint → content → interface → background).
5. **Verify — and this is not optional.** Run the repo's typecheck/lint/build. Then actually render the route (dev server) and get **explicit human visual sign-off** — paste a screenshot, compare it against the route's own approved reference mockup and against `docs/design/golden-implementation.md`. Do not declare a route done because it compiles. If your own screenshot tooling isn't working, say so and ask the human to paste one — don't skip the check.
6. **Record.** Only after sign-off, write or update `docs/design/screens/<route>/spec.md` from the template, and note the route in `docs/design/golden-implementation.md` if it's being designated a second reference point (don't overwrite an existing entry without the user's say-so).

## Review checklist

Before presenting a redesign as finished, answer all of these:

- Does it improve the hobby experience and reduce cognitive load?
- Is the current task and are the miniatures more visually prominent than the controls around them?
- Does typography identify/structure/explain/measure in the right voice (display for identity, UI sans for body/controls, mono only for measured values)?
- Do shadows and radii communicate a physical role, not just decoration?
- Is there a simpler solution that still feels premium?
- **Does any `background-image` use `100% 100%` or `cover` on a box that isn't a fixed 1:1 match to that asset's own aspect ratio?** If yes, stop and redraw it in CSS — this is the specific mistake this skill exists to prevent.
- Has a human actually looked at a rendered screenshot and confirmed it, not just you reading the CSS?
