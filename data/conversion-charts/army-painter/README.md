# The Army Painter official colour charts

Extracted on 2026-10-07 from the official poster PDFs published by The Army Painter. The PDFs aren't committed; keep them next to each other in one folder to re-run the extraction.

| PDF | CSV | What it maps |
| --- | --- | --- |
| `A3_Fanatic_Colour_Conversion_Chart_WEB.pdf` (v1.0) | `fanatic-conversion.csv` | Warpaints Fanatic → Original Warpaints, Warpaints Air, Citadel |
| `Warpaints_Colour_Conversion_Chart_web.pdf` | `original-warpaints-conversion.csv` | Original Warpaints → Citadel, Vallejo Game Color |
| `Colour-Comparison-Chart-Historical-to-Fanatic-2026.pdf` | `historical-to-fanatic.csv` | Historical (WWII sets) → Fanatic |
| `GameMaster_Colour_Comparison_Chart_web.pdf` (2023) | `gamemaster-to-original-warpaints.csv` | GameMaster sets → Original Warpaints |
| `GameMaster_Warpaints_Fanatic_Colour_Comparison_Chart.pdf` (2024) | `gamemaster-to-fanatic.csv` | GameMaster sets → Fanatic |
| `Licensed_Colour_Comparison_Chart_2026_web.pdf` | `licensed-to-fanatic.csv` | Infinity, HeroScape, BattleTech, Halo Flashpoint and Arcworld sets → Fanatic or Speedpaint 2.0 |

## How it's extracted

```bash
node scripts/extract-army-painter-charts.mjs <folder with the PDFs>
npx tsx --env-file=.env.local scripts/build-army-painter-imports.ts
```

- **Names are read from the PDF text layer by position.** Reading them in plain text order collapses empty slots, which shifted names into the wrong column in the June 2026 import.
- **The Original Warpaints chart has no text layer**, because its names are vector outlines. It was transcribed by hand into `original-warpaints-conversion.transcribed.tsv`, with each zoomed crop read and verified.
- **`source_hex` is sampled from each paint's hexagon swatch on the chart**, using its dominant fill colour. Metallic and textured hexagons are approximate.
- **Chart misspellings are corrected in `build-army-painter-imports.ts`**, for example "Ushtabi Bone" → Ushabti Bone. Each corrected row keeps the printed name in its `notes`.
- **`import/unresolved.csv` lists targets left unmatched on purpose.** These are names we don't carry, such as discontinued Citadel colours and Vallejo Game Color paints missing from the catalog.
- **"Unique colour", "exclusive colour" and "N/A" mean the chart has no match.** No pairing is created for them.
