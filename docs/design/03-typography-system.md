# Typography system

References:
- `reference/typography/obsidian-gallery-typography-system.webp`
- `reference/typography/section-structure-and-navigation.webp`
- `reference/typography/subtitle-context.webp`
- `reference/typography/body-reading-and-understanding.webp`
- `reference/typography/caption-supporting-information.webp`
- `reference/typography/label-classification-and-ui.webp`
- `reference/typography/mono-technical-precision.webp`

## Approved families

### Title
**Cormorant Garamond - Semibold 600**

Purpose:
identity and presence.

Use:
- page titles,
- project names,
- collection names,
- hero-object titles,
- special feature titles.

Rules:
- Title Case.
- Strong but not theatrical.
- The title gives identity; it does not explain.

Never:
- medieval/fantasy display type,
- all caps by default,
- outlines,
- drop shadows,
- faux letterpress,
- decorative sparkle/effects,
- functional button copy.

### Section
**Cormorant Garamond - Semibold 600**

Purpose:
structure and navigation.

Use:
- "On Your Bench",
- "Paint Collection",
- "Active Projects",
- "Recent Guides",
- other structural headings.

Rules:
- restrained relative to Title,
- uppercase/small-caps treatment is allowed,
- controlled tracking,
- should organize the workspace, not become a second title.

Never:
- oversized section headings,
- ornamental flourishes everywhere,
- plaques for every section,
- serif metadata.

### Subtitle
**Source Sans 3 - Regular 400 / Medium 500**

Purpose:
context.

Use:
- contextual line under a title,
- concise descriptions,
- project/faction/scale/status context.

Rules:
- quiet,
- modern,
- clear,
- secondary.

Never:
- Cormorant simply to make it feel premium,
- bold/heavy by default,
- decorative italics,
- low contrast.

### Body
**Source Sans 3 - Regular 400**

Purpose:
reading and understanding.

Use:
- descriptions,
- instructions,
- guides,
- notes,
- settings,
- explanations,
- long-form content,
- Curator communication when it must be fully readable.

Rules:
- highly legible,
- neutral,
- humanist,
- calm.

Never:
- serif body copy for atmosphere,
- thin/light weights,
- tight line-height,
- textures/effects on text,
- justified paragraphs on mobile.

### Caption
**Source Sans 3 - Regular 400 / Medium 500**

Purpose:
supporting information.

Use:
- dates,
- manufacturer,
- scale,
- timestamps,
- secondary metadata,
- image captions.

Rules:
- quiet but readable,
- compact but not tiny,
- may recede but must remain effortless to read.

Critical information must not be styled merely as a caption.

### Label
**Source Sans 3 - Semibold 600 / Medium 500**

Purpose:
classification and UI.

Use:
- status,
- category,
- ownership,
- stage,
- filter/control labels,
- metadata keys.

Rules:
- compact,
- precise,
- functional,
- short,
- uppercase and tracking may be used when helpful.

A label identifies; it does not explain.

Never:
- Cormorant labels,
- decorative mini-plaques,
- oversized pills,
- long sentences,
- label clutter.

### Mono
**IBM Plex Mono - Regular 400 / Medium 500**

Purpose:
technical precision.

Use:
- paint codes,
- ratios,
- measurements,
- product/reference IDs,
- exact technical color values,
- logs/timestamps where a technical presentation is useful.

Rules:
- use sparingly,
- communicates precision, not "tech aesthetic".

Never:
- navigation,
- ordinary metadata,
- paragraphs,
- project titles,
- buttons,
- decorative terminal-like treatment.

## Type-size tokens - CALIBRATED DEFAULT

The source specifies families/roles but not browser pixel sizes. Start here and tune globally against the approved golden implementation.

| Token | Mobile | Desktop | Weight | Line-height |
|---|---:|---:|---:|---:|
| `title-xl` | 40px | 56px | 600 | 0.98-1.05 |
| `title-lg` | 34px | 44px | 600 | 1.02-1.08 |
| `subtitle-lg` | 22px | 26px | 400/500 | 1.25 |
| `section` | 18px | 20px | 600 | 1.15 |
| `body-lg` | 17px | 18px | 400 | 1.55 |
| `body` | 16px | 16px | 400 | 1.5 |
| `caption` | 13px | 14px | 400/500 | 1.4 |
| `label` | 12px | 12px | 500/600 | 1.25 |
| `mono` | 13px | 13px | 400/500 | 1.45 |

Do not shrink below accessible reading sizes just to make a layout look more like a print artifact.

## Handwriting

The supplied visual references use handwriting as atmosphere on some notes, but they do not define an approved production handwriting font.

Therefore:
- do not invent a handwriting font in code,
- do not make essential information depend on handwriting,
- if an approved handwriting asset/font is added later, reserve it for short personal/Curator Tier-1 notes,
- always preserve accessible machine-readable text.
