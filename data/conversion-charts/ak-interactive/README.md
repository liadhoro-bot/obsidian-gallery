# AK Interactive official charts

Two conversion charts published by AK Interactive, imported as official sources
(`official_chart`), plus the Real Colors range itself.

| File | What it is |
|---|---|
| `3gen-equivalence.csv` | EQUIVALENCIAS2023.pdf: AK 3rd Gen (AK11001–AK11440) → Vallejo Model Color (the column also carries Model Air 71.xxx and Panzer Aces 70.3xx codes), Vallejo Game Color, current and old Citadel. The chart prints no AK names, only a colour cell (`swatch_hex`). |
| `real-color-conversion.csv` | RCEquivalenceDIG.pdf: Real Colors (old RC001–RC508 numbering) → Mr. Hobby, Tamiya, Vallejo, Hataka, Humbrol, Model Master, Lifecolor. |
| `real-colors-catalog.csv` | The current Real Colors range (RC801–RC981) from AK's store, with a hex sampled from each product photo's brush stroke. |
| `import/` | Built by `scripts/build-ak-imports.ts`; applied by `scripts/apply-ak-import.ts`. |

Extraction is by text position (`scripts/extract-ak-charts.mjs <folder with the PDFs>`);
pdftotext collapses the many empty cells and shifts columns.

## Decisions

- **Real Colors renumbering.** AK relaunched the range as RC801–RC981. Old codes are
  mapped by name (`import/real-color-renumbering.csv`); 143 of 238 map. The rest were
  dropped from the range or are ambiguous (RLM 78/79 had 1941 and 1942 versions; the
  relaunch has one each). The military "Light Blue" codes are not the civil RC842.
- **Skipped 3rd Gen rows:** AK11143/AK11144 (Citadel cells printed a row above their
  Vallejo cells) and AK11363 (paired with 71.064 Chrome).
- **Skipped misprints:** pairs whose colours are nearly opposite (ΔE > 60), e.g. Insignia
  White → Tamiya X-1 Black.
- **Old Citadel names** (Bleached Bone, Boltgun Metal…) are discontinued and only noted in
  `import/unresolved.csv`.
- **Not added:** AK11219–AK11230 and AK11236. They appear in the chart without names
  and are no longer on AK's store.
- Chart spellings fixed: Ushabit → Ushabti Bone, Altford → Altdorf Guard Blue,
  Mourfang → Mournfang Brown.
- The 3rd Gen chart is loose on colour (median ΔE ≈ 11 between paired paints); chart
  matches rank after close colour matches.
