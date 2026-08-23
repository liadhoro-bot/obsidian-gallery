# Dashboard V3 material work — handover

## What this is

The Obsidian Gallery Dashboard (Active Units tab) is being redressed into a
premium "walnut / parchment / brass / leather" material language ("OG-WDS").
There's an approved mockup (the user will re-attach it) showing the target
look. A huge amount of session work landed the *structure* correctly — the
mockup's layout, copy, and composition are matched — but **material
fidelity, especially brass, still doesn't look like the reference**, and the
user has seen already-fixed things regress. This document exists so a fresh
session doesn't repeat the same dead ends.

## Goal

Make the Dashboard Active Units screen's materials — walnut background,
parchment panels/cards, brass plaques/hardware, leather (nav, tentative) —
actually read as those physical materials, matching:
- The user's mockup image (they'll re-share it).
- `public/og-v3/source/kit.png` — an AI-generated "OG Dashboard Golden Asset
  Kit" reference sheet with numbered swatches (walnut tile, parchment panel,
  brass plaque, ebonized button, brass rivet, unit card shell, segmented
  control, next-actions shell, bottom-nav shell) plus a small "Reference:
  Approved Dashboard" thumbnail matching the mockup.
- `docs/design/reference/materials/{brass,parchment,leather,walnut}.webp` —
  **higher-quality reference sheets**, each with real rendered material
  swatches *and* a written spec (Purpose / Personality / Visual
  Characteristics / a "Never" list / Emotional role). Treat these as more
  authoritative than kit.png for color and rule calibration.

## Where to verify (read this before touching anything)

**`https://obsidian-gallery-v3.vercel.app/dashboard?golden=dashboard-active-units`**
— static fixture data (Stormward Veteran), **no login required**. This was
broken behind two separate, redundant auth gates for most of the session
(see Gotchas below) and is now fixed and confirmed working via a cookie-less
`curl` request. **Use this URL for every iteration.** Don't rely on the real
logged-in `/dashboard` unless specifically checking real-data behavior.

Deploys are **not automatic on git push** for this Vercel project — pushing
to `codex/v3-dev-inspection` does not trigger a build. After every commit,
run:
```bash
npx vercel --prod --yes
```
from the repo root. The Vercel CLI is already authenticated in this
environment (occasionally throws a transient "Not authorized" — just retry
once).

### Browser pane / screenshot tooling — known unreliable

The `mcp__Claude_Browser__*` screenshot tool intermittently fails with *"the
Browser pane is not displayed, so the page is not compositing frames."* This
is a **client-side state** (the user needs the Browser/Preview panel
actually open/focused in their Claude Code UI) — not fixable from the agent
side. When broken, even `document.hidden` reports `true` and
`getBoundingClientRect()` returns `0x0` for real, correctly-rendered
elements — this looks exactly like a CSS bug but isn't. **At the start of
the new session, explicitly confirm screenshot capability works before
doing any real work**, rather than discovering it's broken several rounds
in (this ate a lot of time this session).

Fallback that always works regardless of pane state: `curl` the page/CSS
chunk directly and `grep` for expected class names, asset URLs, or `?v=`
cache-busting strings. This is how the middleware double-gate bug (below)
was actually found and confirmed fixed.

## Known infrastructure gotchas — don't rediscover these

1. **There are three separate "V3 dashboard" implementations in this repo.**
   Only one is correct:
   - ✅ `DashboardActiveUnitsScreen` / `DashboardActiveUnitsView`
     (`app/dashboard/dashboard-active-units-*.ts(x)`,
     `app/dashboard/dashboard-og.module.css`) at the plain `/dashboard`
     route. **This is the one to work on.**
   - ❌ `DashboardV3Preview` (`app/dashboard/dashboard-v3-preview.tsx`),
     reached via `?preview=1` — an old, abandoned, teal/cyan-themed attempt.
     Do not extend it.
   - ❌ A second on-disk rewrite of `dashboard-v3-preview.tsx` using a
     cruder `app/globals.css`-based `.v3-material-walnut` /
     `.v3-parchment-panel` system — also not the target.
2. **`isV3DeploymentHost`** (`lib/v3-preview.ts`) auto-treats *any* visit to
   `obsidian-gallery-v3*.vercel.app` as "preview mode" by hostname alone.
   This was silently forcing the deployed `/dashboard` into the wrong (old)
   component for every visitor. Fixed for `/dashboard` specifically in both
   `app/dashboard/page.tsx` and `app/login/page.tsx` — but be aware this
   hostname-based auto-preview still applies to other routes
   (paints/guides/projects/community/settings/units) via
   `proxy.ts`'s `isInspectionPreviewRoute` list, intentionally left alone.
3. **The golden-fixture route had *two* separate gates**, both
   `NODE_ENV !== 'production'`: one in `app/dashboard/page.tsx`, and a
   **duplicate, independent one in `proxy.ts` middleware**. Middleware runs
   first, so fixing only the page-level check appeared to work (if the
   agent's own browser session happened to be authenticated) while still
   failing for the actual unauthenticated user. Both are now fixed. If
   anything like this is added again, **check middleware first**, not just
   the page.
4. Every raster asset in `public/og-v3/` has been swapped multiple times
   this session under the *same filename*. Several were suspected to be
   stale-cache issues in the user's browser even after the origin file was
   confirmed correct byte-for-byte. **Always add a `?v=<token>` query string
   when replacing an asset that's been touched before** — several already
   have one (e.g. `brass-worn.png?v=directional1`,
   `brass-plaque-frame.png?v=blank1`); bump the token on every future change
   to that same file.

## Brass — what's been tried, in order, so the next attempt doesn't repeat them

The single most persistent complaint all session was "brass doesn't look
like real brass." Attempts, roughly chronological:

1. **Flat CSS gradient only** (brass-500 → brass-700 linear-gradient, no
   texture). Read as flat painted color, no material quality.
2. **Procedural blob noise** (`feTurbulence` fractalNoise, patina + fine
   grain layered). Better than flat, still muddy/flat once composited —
   didn't read as metal.
3. **Real photo crop, directional brushed streaks**, cropped from
   `kit.png`'s "Brushed Surface" example. Looked genuinely metallic at full
   size, but **tiled into an ugly basket-weave/corduroy repeat pattern** at
   the small sizes used in the UI (16–40px) — the streak pattern doesn't
   repeat cleanly.
4. **Procedural *directional* brushed-metal** (anisotropic `feTurbulence`:
   different X/Y `baseFrequency` to fake linear grain, `stitchTiles="stitch"`
   for guaranteed seamlessness). This is the current `brass-worn.png`. Fixed
   one real bug: at 28–40px tile sizes the noise's own large-scale patina
   blobs (~22px wavelength) repeated verbatim tile-to-tile, reading as an
   obvious regular pattern even with perfectly matched edges (not a seam
   problem — a *scale* problem). Fixed by raising every brass tile size to
   220px, larger than any single brass element on the page, so no element
   ever shows more than one non-repeating crop.
5. **`border-image-slice` reusing the kit's actual rendered plaque/nav-tile
   geometry** (current approach, `src/components/v3/primitives.module.css`
   `.plaque[data-tone="brass"]`, `app/components/mobile-nav.module.css`
   `.item[data-active='true']`). Rationale: the kit's richness comes mainly
   from its *lighting model* (strong directional bevel highlight/shadow,
   rivets rendered with real sphere-shading), not primarily color or grain —
   CSS `box-shadow` tuning wasn't reproducing that convincingly no matter
   how it was adjusted, so this reuses the kit's own rendered bevel instead
   of reconstructing it. Cropped from `kit.png` at
   `public/og-v3/panels/brass-plaque-frame.png` (a *blank*, unlabeled
   plaque — an earlier version used the labeled "Featured Unit" swatch,
   whose baked-in text bled through the border-image corner slices
   regardless of the `fill` keyword, which only affects the center region,
   not the corners). **This is where the session ended** — the double-text
   bug is fixed, but the user's latest screenshot still shows a plaque that
   looks thin/flat, not rich like the kit reference. Unclear whether the
   slice/width values need tuning, the source crop needs to be bigger/richer,
   or the whole technique needs reconsideration. **This needs a fresh,
   verified (screenshot-confirmed) look**, not another blind parameter
   change.

Current brass token values (`src/styles/og-design-tokens.css`):
`--og-brass-500: #9f7136`, `--og-brass-700: #744e22` — these were sampled
from the kit sheet's "Aged Brass"/"Antique Brass" swatches then brightened
for contrast; worth re-checking against `docs/design/reference/materials/brass.webp`
directly rather than assuming they're still right.

**Design spec constraints (from `docs/design/reference/materials/brass.webp`
itself)**: warm muted gold tones; **never** "bright gold" or "mirror
finish"; wants "soft highlights" and "fine, non-distracting texture";
finishes should feel "crafted, not plated."

## Parchment / walnut — lower priority, roughly OK

Parchment (`public/og-v3/materials/parchment-fiber.png`,
`--og-parchment-*`/`--og-paper-*` tokens) was recropped from the real
reference sheet's own texture swatch and color-sampled directly
(`#ecdac2` average) — the user's last explicit note was "so-so, could be a
tad more similar to the kit reference," not urgent. Walnut
(`public/og-v3/materials/walnut-seamless.png`) was confirmed OK by the user
("the walnut tile is ok") after being rebuilt as a genuinely seamless
mirror-tile (the original crop was never edge-matched at all).

## Leather

Built (`--og-material-leather`, `public/og-v3/materials/leather-grain.png`,
real crop from the leather reference sheet) and briefly applied to the
bottom nav, but the user rejected the result ("looks like a weird pizza")
and it was reverted back to walnut. The leather material/asset still exists
and is unused — a future attempt could reuse or replace it, but bottom nav
is currently walnut by deliberate choice, not oversight.

## Process note for the next session

The user has flagged that **previously-fixed things are resurfacing** —
apparent regressions. Recommend a tighter loop than this session used: one
change at a time, confirmed via an actual screenshot (not just build/lint
success, not just a synthetic Node/sharp simulation — those have both
previously looked clean while the real browser render was visibly broken),
before moving to the next change. Batch fewer speculative fixes together.

## Key files

- `app/dashboard/dashboard-og.module.css` — Dashboard-specific layout/styles
- `src/styles/og-design-tokens.css` — color tokens, material composites
- `src/components/v3/primitives.module.css` — shared primitives incl. `.plaque`
- `app/components/mobile-nav.module.css` — bottom nav incl. active tile
- `app/dashboard/dashboard-active-units-view.tsx` — the view component
- `app/dashboard/dashboard-active-units-fixture.ts` — golden-route fixture data
- `app/dashboard/page.tsx`, `proxy.ts` — routing/auth (both patched for the golden route)
- `public/og-v3/` — all raster assets; `public/og-v3/source/kit.png` is the crop source
- `docs/design/reference/materials/*.webp` — the higher-quality reference sheets
- `.claude/skills/obsidian-v3-redesign/` — skill + `scripts/crop-tileable-asset.mjs`,
  a reusable texture toolkit built this session (tileable crops, circular
  hardware-icon isolation, procedural noise, seamless mirror-tiling,
  directional brushed-metal generation) — read this before writing new
  asset-generation code, it likely already does what's needed.
