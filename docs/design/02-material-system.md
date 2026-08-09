# Material system

Material in OG-WDS is semantic. It explains what kind of object something is, not merely what style it belongs to.

Reference:
- `reference/guides/material-hierarchy.pdf`
- `reference/materials/*.webp`

## Material hierarchy

| Material | Source frequency | Source role | Implementation use |
|---|---:|---|---|
| Walnut | ★★★★★ | Structural | Workbench, frames, shelves, permanent construction, major navigation structures |
| Parchment | ★★★★★ | Information | Primary reading surfaces, project details, guides, important cards |
| Paper | ★★★★☆ | Secondary information | Labels, tabs, references, supporting notes, utility surfaces |
| Paint | ★★★★☆ | Visual focus | Honest paint swatches, progress color, miniature color, creative emphasis |
| Brass | ★★★☆☆ | Premium accents | Pins, fasteners, rare labels, selected accents, milestones |
| Steel | ★★☆☆☆ | Functional precision | Measurement, technical controls, tool metaphors, utility hardware |
| Cork | ★★☆☆☆ | Storytelling moments | Curator/inspiration/temporary notes and pinned references |
| Leather | ★☆☆☆☆ | Premium navigation & collections | Special covers, premium collections, rare navigation contexts |
| Glass | ★☆☆☆☆ | Specific functional use | Magnification, transparency, display/preview where transparency has meaning |
| Wax | ☆☆☆☆☆ | Celebratory only | Certification, exceptional achievements, special events |

## Walnut

SOURCE character:
- medium walnut,
- visible but subtle grain,
- matte,
- natural variation,
- rounded edges,
- minimal wear.

Use for:
- structural frame/shell,
- shelves,
- trays,
- permanent construction,
- durable navigation housing.

Never:
- heavy scratches,
- orange wood,
- rustic farmhouse styling,
- black/dark lacquered walnut,
- glossy varnish.

**Rule:** walnut creates stability. It should make the app feel built, not wooden everywhere.

## Parchment

SOURCE character:
- warm ivory,
- soft fibers,
- fine grain,
- subtle edge wear,
- matte,
- no visible grime.

Use for:
- primary information surfaces,
- cards,
- important panels,
- project details,
- recipes/guides,
- curated notes.

Never:
- burned edges,
- treasure-map styling,
- yellowed dirty paper,
- fantasy scroll clichés.

## Paper

SOURCE character:
- archival,
- neutral warm white,
- lighter and cleaner than parchment,
- minimal texture,
- subtle fibers,
- matte.

Use for:
- filters,
- supporting forms,
- tabs,
- labels,
- bookmarks,
- reference slips,
- lightweight notes.

Never:
- notebook-paper cliché,
- coffee stains,
- heavy wrinkles,
- bright sterile white,
- constant torn edges.

## Paint

SOURCE rule: **paint is the visual hero.**

Use:
- real color swatches,
- paint identity,
- recipe composition,
- progress fills where color has meaning,
- achievements tied to painting.

Never:
- artificial gradients,
- neon UI color,
- oversaturation,
- plastic-looking swatches,
- decorative effects that distort the perceived color.

Color accuracy outranks atmosphere.

## Brass

SOURCE character:
- warm muted gold,
- brushed/satin,
- aged or subtle patina allowed,
- never bright yellow or mirror polished.

Use:
- true fasteners,
- selected premium framing,
- important nameplates,
- milestone medallions,
- controlled highlight accents.

Never:
- brass on every component,
- steampunk ornament,
- heavy oxidation,
- shiny gold chrome.

## Steel

SOURCE character:
- brushed/satin,
- cool neutral gray,
- low reflection,
- precise edges.

Use only where function feels technical:
- measurement,
- precision,
- rulers,
- tool/ferrule metaphors,
- utility controls,
- functional hardware.

Never turn steel into a futuristic/sci-fi UI skin.

## Cork

SOURCE role: secondary storytelling surface.

Use for:
- inspiration,
- short-lived reminders,
- Curator board,
- pinned references,
- personal notes.

Never make the entire app a cork notice board.

## Leather

SOURCE role: sophisticated, rare, premium navigation/collection treatment.

Use for:
- special project covers,
- premium collections,
- portfolio-like moments,
- exceptional navigation contexts.

Never:
- fantasy armor leather,
- handbag luxury aesthetic,
- heavy embossing,
- shiny leather.

## Glass

SOURCE role: rare, functional transparency.

Use only where transparency itself explains something:
- magnifier,
- display case,
- color preview,
- real paint bottle representation,
- focused overlay where seeing beneath it matters.

Never use glassmorphism as the app's general chrome.

## Wax

SOURCE rule: exceptional moments only.

Use:
- official completion,
- certification,
- rare milestones,
- special events.

If wax appears in ordinary navigation, filters, buttons, or routine status, it is being misused.

## Screen-level material budget - CALIBRATED DEFAULT

For ordinary screens:
- 1 structural material,
- 1 primary reading material,
- up to 2 minor accent/support materials.

A normal screen should usually read as **walnut + parchment/paper**, with paint imagery providing color and brass/steel used sparingly.

Hero screens may use one additional special material when semantically justified.

Do not introduce every material just because the library contains it.
