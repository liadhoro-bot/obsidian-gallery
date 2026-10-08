# Paint equivalents revival (2026-10-07)

Goal: from any paint, show at least six credible equivalents, drawn from official and unofficial conversion charts, cross-references and very close hex matches. Mediums, varnishes, primers and texture or effect products are matched by what they do, not by colour.

All database numbers below were measured read-only against the Frankfurt production project (`vwshzvxsitiwyayawcvr`) on 2026-10-07.

## 1. V2 code inventory

| Piece | Location | Verdict |
| --- | --- | --- |
| Schema: `paint_conversion_sources`, `_raw_rows`, `_edges`, `paint_similarity_rankings`, `paint_aliases`, Lab/normalised columns on `paint_catalog` | `supabase/migrations/20260615120000_add_paint_conversion_recommendations.sql` | **Keep.** Sound provenance model: raw chart row → matched edge → ranking. |
| Name/brand/line normaliser and SKU, alias and fuzzy matcher | `utils/paint-conversions/normalization.ts`, `findPaintMatch` in `service.ts` | **Keep and extend.** Handles GW/Citadel/Warhammer Colour and TAP aliases. Needs aliases for TAP "Original Warpaints", Warpaints Air and Citadel's old "Hobby Paint" names (see §2). |
| CSV import and rematch (`importConversionCsv`, `rematchConversionRawRows`) plus CLI | `service.ts`, `scripts/import-paint-conversions.ts` | **Keep.** The source CSVs in `downloads/reference/` no longer exist locally. Re-create them under a tracked folder such as `data/conversion-charts/`. |
| Hex-similarity edge generator and ranking builder | `generateHexSimilarityEdges`, `generateSimilarityRankings`, `scoring.ts` | **Retire.** It uses CIE76 ΔE and the broken `finish_type`. Its scoring caps hex-only pairs at 0.30 overall, below the 0.35 review cut, so it flags every hex-only ranking as `needs_review`. That covers about 99% of the 55,866 rankings. Hex matching is now computed live (≈6 ms per paint). |
| `/api/vault/paint-equivalencies` and the V2 vault card, loader and grid | `app/api/vault/...`, `app/vault/[source]/[id]/paint-conversion-chart-*` | **Retire with V2.** The new route replaces it, and the grid UI was V2-only. |
| `color.ts` | `utils/paint-conversions/color.ts` | **Keep.** CIEDE2000 (`deltaE2000`) was added this session. |

### Shipped this session (local, not committed)

- `utils/paint-conversions/equivalents.ts`: family classifier (built from `paint_type`, line and name, because `finish_type` is unreliable) and a pure ranker. Tiers are `chart` (any official, manual or curated edge), `exact` (ΔE00 ≤ 2.5), `close` (ΔE00 ≤ 5), `near` (≤ 10, used only to fill up to six) and `contextual` (same family and same role keywords for mediums, varnishes, primers and textures). Placeholder hexes (`#FFFFFF` or `#000000` on a paint not named white or black) are ignored.
- `GET /api/paints/v3-equivalents?paintId=…`: auth-gated. Returns grid-ready paint records, the user's ownership, and match metadata per paint. The catalog is cached in memory for 10 minutes.
- Paint info pane: MSRP moved left, plus a **Show equivalents** / **Hide equivalents** toggle.
- Paints grid: equivalents mode with a banner and **Back to paints**. Matches carry badges (`Chart`, `ΔE 2.1`, `Same use`). There is a **Best match** sort. Brand, line, ownership and colour filters work within the results. The previous filters are restored on exit.

## 2. What the database looks like today

| Metric | Value |
| --- | --- |
| Active catalog paints | 3,500 (Vallejo 1,320, AK 558, TAP 415, GSW 340, GW 331, …) |
| Conversion sources | 3: Vallejo CC266 Game Color, Vallejo CC266 Xpress, TAP Fanatic chart. No `source_url` on any of them. |
| Raw chart rows | 444: 304 matched, 124 partially matched, 8 unmatched, 8 needs review |
| Official edges | 460, touching only **386 paints** (315 of them have exactly one edge) |
| Hex edges | 55,440 (top 20 per paint) |
| `paint_aliases` | **0 rows** |
| Paints with no hex | 230. Another 87 have a hex but no Lab values. |

### Problems, by impact

1. **Catalog hexes are often wrong, and this is the root problem.** 53 of 174 official cross-brand pairs differ by ΔE76 > 20, and 14 differ by more than 40. The charts are right; the hexes are wrong. Examples: TAP *Green Tone* `#D54E2E` (orange), *Matt Black* `#686B76`, Citadel *Nuln Oil* `#CECED2`, GSW *Jade Green* `#FFFFFF`, AK *Black Purple* `#FFFFFF`, Vallejo Game Color Ink *Black* `#ACACAB`. Washes, inks and air paints are the worst affected, which suggests the hexes were sampled from bottle labels or caps. A crude name-versus-hue check flags about 5–11% of hexes per brand.
2. **`finish_type` is meaningless.** It is `standard` for 3,425 of 3,502 paints, while `paint_type` says 128 are metallic, 92 technical and 156 inks. Some metallics are mistyped too: *Retributor Armour* spray is `acrylic`.
3. **Chart coverage is thin.** It covers only Vallejo Game/Xpress → GW and TAP Fanatic → GW. AK, Pro Acryl, P3, GSW, Two Thin Coats and Monument have no chart data, and no paint has six chart equivalents.
4. **The TAP Fanatic import was mis-parsed.** Its targets include TAP's own *Original Warpaints* and *Warpaints Air* names (Storm Wolf, Fog Grey, Consul Blue), which are not in the catalog. GW names such as *Druchii Violet* and *Fulgrim Pink* failed on a null target line. Vallejo rows targeting Citadel "Hobby Paint" names (Bloody Red, Scarlet Red) are partial for the same alias reason.
5. **Public-read RLS on the conversion tables is missing in Frankfurt.** Migration `20260621160000` exists in the repo, but the anon and authenticated roles can't read `paint_conversion_edges`. It was probably lost in the region move. The new route reads edges with the service role as a stopgap.

## 3. Validation plan

Each phase is a script under `scripts/`. Each one defaults to a **dry run** that writes a CSV report, and needs `--apply` to write anything. Nothing runs against production without sign-off.

### Phase 0: Unblock (½ day)
- Re-apply the public-read policies migration in Frankfurt, then switch the route back to the user client.
- Commit the chart CSVs to `data/conversion-charts/`, each with a `README` naming its source URL or PDF and the date captured. Backfill `source_url` on the three sources.

### Phase 1: Fix catalog colour data (highest value)
- `scripts/audit-paint-hex.ts` should flag five kinds of suspect hex:
  - placeholders (`#FFFFFF`, `#000000`, duplicate hexes within a line)
  - name/hue contradictions (black with L* > 30, green with a hue outside the green band, and so on)
  - official chart pairs with ΔE00 > 15, where one side is probably wrong
  - outliers inside a brand line
  - paints with a hex but no Lab values (87)
- Re-sample flagged paints from the swatch images we already store, using the median of the swatch's centre region instead of the label. Hand-review anything that still disagrees with its chart partner. `audit-paint-swatches.ts` is a starting point.
- Record provenance in new columns: `hex_source` (`swatch_sample` / `manufacturer` / `manual` / `legacy`) and `hex_verified_at`.
- **Exit criterion:** fewer than 2% of official cross-brand pairs have ΔE00 > 15.

#### Phase 1 dry-run results (2026-10-07)

`scripts/audit-paint-hex.ts` was run against Frankfurt. It is read-only and writes `scripts/output/paint-hex-audit.{csv,html}`.

| Action | Paints | Meaning |
| --- | --- | --- |
| keep | 2,673 | Stored hex agrees with the swatch (ΔE00 ≤ 8) |
| fill | 19 | No usable hex, but the swatch sample is confident |
| replace | 89 | ΔE00 > 15, flat or gradient swatch, not metallic. All 89 were spot-checked visually; the old hexes are systematically washed out. |
| suggest | 218 | Non-metallic ΔE00 8–15. The first 60 were spot-checked and all looked like improvements. |
| review | 501 | 226 have no hex and no swatch. 110 are radial-highlight spray or metallic renders, plus noisy swatches, chart conflicts and so on. |

Sampler details:
- Flat swatches use the median of the centre.
- Citadel-style gradients use the bottom band, left of the pot icon.
- Radial highlights (spray and metallic renders) are always sent to a human.
- Downloads retry, because Storage returns spurious 400s and 429s when hit in bursts. 42 swatch URLs are genuinely broken.

Washes, inks and contrast paints are now compared with CIEDE2000 kL = 2, which discounts lightness, because each brand shows them at a different strength. The audit and the equivalents ranker both use this.

**Measured impact if fill, replace and suggest are applied:** chart pairs with ΔE00 > 15 drop from 55 of 230 to 50 of 230. Equivalents coverage barely moves (57.3% → 58.1% of paints with at least six strong matches). So Phase 1 fixes *which* paints match (no more orange results for a green wash), not *how many* do. Most remaining chart conflicts are pairs where the swatch agrees with the stored hex, so the swatch itself is suspect, or the chart pairs "closest available" rather than identical paints. Getting the count up depends on Phase 3 chart data.

#### Chart-pair pass and Phase 3a results (2026-10-07)

**Principle (user decision):** official manufacturer charts are the first source of truth, even for "closest substitute" pairs whose colours visibly differ. Hex similarity is secondary. Mediums and effects are matched by role.

Chart-pair pass over the 50 pairs that still conflicted after the hex write:
- **16 mis-imported edges deactivated.** Chart targets in ranges we don't carry had resolved to other paints.
- **6 hex fixes applied.** The swatch image itself is wrong, so each took its chart partner's colour (`hex_source = manual`).
- **2 same-paint hexes aligned**, by your choice: Athena Skin and Bronze Brown.
- **Bookkeeping:** 16 blank-swatch rows were reset to `legacy`, and Pigment Binder was restored to having no hex.

Importer fixes in `utils/paint-conversions/service.ts`:
1. **Line guard.** A chart row naming a line we don't carry returns "range not in catalog" instead of falling back to a same-named paint elsewhere.
2. **Line-scoped fallbacks.** When the line exists, the brand+name and fuzzy fallbacks stay inside it.
3. **Full fuzzy pool.** Fuzzy matching now scans the whole brand; the old `.limit(250)` slice is gone.
4. **Brush paints preferred.** When a chart gives no line, the brush paint wins over its Air, Spray or Dry versions.
5. **Normalization refreshed.** 101 catalog rows had stale `normalized_*` values; they are recomputed.

**Rematch result:** 69 new chart pairs (138 edges). 24 edges that pointed at the wrong variant (Spray cans, Model Air) were retired. Active official edges went from 444 to 558. The equivalents route now ignores chart edges still flagged `needs_review` (fuzzy name matches).

**Still unmatched:** about 96 rows target Original Warpaints, which isn't in the catalog. About 60 are Army Painter rows whose CSV columns were mis-extracted, such as Citadel targets carrying Warpaints Air names. Both need the official Army Painter chart re-extracted (Phase 3b).

#### Phase 3b: Army Painter official charts (2026-10-08)

Six official Army Painter chart PDFs were extracted by position. The Original Warpaints chart has no text layer, so it was transcribed by hand. Sources and method are in `data/conversion-charts/army-painter/README.md`; the pipeline is `scripts/extract-army-painter-charts.mjs` → `build-army-painter-imports.ts` → `make-army-painter-swatches.mjs` → `apply-army-painter-import.ts`.

**474 new catalog paints:**

| Line | Paints |
| --- | --- |
| Original Warpaints | 138 |
| Historical | 84 |
| GameMaster | 84 |
| Warpaints Air | 52 |
| Infinity | 49 |
| HeroScape | 28 |
| BattleTech | 20 |
| Arcworld | 11 |
| Halo Flashpoint | 8 |

- **Colours:** 408 hexes were sampled from the paint's own chart swatch (`hex_source = chart_swatch`). The other 66 take their chart partner's colour (`chart_partner`).
- **Swatches:** 408 swatch images were cropped from the chart hexagons, with the label text painted out. They are stored in `paint-swatches/army-painter/<line>/<sku>.png`. The other 66 use the hex as a fallback.
- **Edges:** 785 chart pairings were imported as 6 sources, and every row matched, adding 1,504 edges. The June mis-parsed Fanatic import was retired: its 268 edges are deactivated and the source note explains why.
- **Coverage:** 1,794 active chart edges. 1,007 paints have at least one chart match (was 457), and 237 have three or more.
- **Ranking:** in the equivalents ranker, chart matches now sort by colour closeness among themselves.
- **Unresolved:** 31 targets are left in `import/unresolved.csv`. They are discontinued Citadel paints, plus Vallejo Game Color paints that are missing from our catalog's Game Color line, which has 96 of roughly 170.
- **Rollback record:** `scripts/output/army-painter-import-applied.json`.

### Phase 2: Real product taxonomy
- Add a `product_family` column (the same enum as `classifyPaintFamily`) and a `product_role` column (e.g. `matt_varnish`, `glaze_medium`, `thinner`, `crackle_texture`, `mud_effect`, `metallic_gold`).
- Backfill both from the classifier, then hand-review the about 450 non-standard paints (metallic 369 is the bulk, then texture, medium, varnish and primer).
- Make the ranker read these columns instead of guessing from names. Contextual matches then become "same role", which is the right answer for mediums and effects.

### Phase 3: More chart data, with matching fixed
- Add aliases to `paint_aliases` for TAP Original Warpaints → current Fanatic names, Citadel's pre-2012 range → current names, and Vallejo Game Color legacy names. Then run `--rematch-raw`. Target: at least 95% of raw rows matched.
- Import more charts, official first:
  - AK 3rd Gen equivalence chart
  - Pro Acryl vs Citadel
  - Two Thin Coats chart
  - Vallejo's Model Color cross-reference
  - Then reputable community cross-reference tables, with `source_type = 'community_chart'` and `reliability_score` 0.6–0.8
- Store edges in both directions (the import already does this) and keep `raw_row_id` for traceability.

### Phase 4: Coverage gate and spot-check
- `scripts/report-equivalent-coverage.ts` runs the live ranker over every active paint and reports, per brand and family, the percentage with at least six results where every result is `chart`, `exact`, `close` or `contextual`.
  - Today that is 1,866 of 3,500 (53%), using hex and context only.
  - **Target:** at least 90% of colour paints, and 100% of contextual paints that have one or more peers.
- Hand spot-check 50 random paints per brand. Any wrong match gets a `not_recommended` edge, which the ranker should treat as a hard exclusion (still to be added).
- Optional later step: a community "suggest an equivalent" action writing `community_suggestion` edges that need review.

### Cleanup once the new path is proven
- Drop `paint_similarity_rankings` and delete the 55k `hex_similarity` edges (the edges table then holds only curated or chart data).
- Delete the V2 vault equivalency components and `/api/vault/paint-equivalencies`.
