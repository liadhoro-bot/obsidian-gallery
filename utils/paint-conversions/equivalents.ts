import { deltaE2000, hexToLab, isUsableHex, type LabColor } from './color'

// Paint families decide what can stand in for what. Colour families are
// compared by hex; contextual families (mediums, varnishes, textures...) are
// compared by what the product does, because their hex says nothing useful.
export type PaintFamily =
  | 'standard'
  | 'metallic'
  | 'contrast'
  | 'wash'
  | 'ink'
  | 'primer'
  | 'varnish'
  | 'medium'
  | 'texture'

// chart: official manufacturer chart. community: community-compiled
// cross-reference. linked: second-degree, an equivalent of a direct chart or
// cross-reference match. All three outrank colour matches, in that order.
export type EquivalentTier = 'chart' | 'community' | 'linked' | 'exact' | 'close' | 'near' | 'contextual'

// A paint reached through direct matches; via lists the direct matches it
// came through (more paths = stronger).
export type EquivalentLinkedEdge = {
  paintId: string
  via: string[]
}

export type EquivalentCatalogPaint = {
  id: string
  brand: string | null
  line: string | null
  name: string | null
  hex_approx: string | null
  paint_type: string | null
  finish_type?: string | null
}

export type EquivalentChartEdge = {
  paintId: string
  sourceName: string | null
  kind?: 'official' | 'community'
}

export type PaintEquivalent = {
  paintId: string
  tier: EquivalentTier
  group: EquivalentGroup
  deltaE: number | null
  // Percent similar (100 − 3·ΔE00); null when there is no colour comparison.
  similarity: number | null
  reason: string
  rank: number
}

const CONTEXTUAL_FAMILIES = new Set<PaintFamily>(['primer', 'varnish', 'medium', 'texture'])
// Washes, inks and contrast paints are shown at different strengths by each
// brand's swatches, so they are compared mainly on hue and chroma.
const TRANSPARENT_FAMILIES = new Set<PaintFamily>(['wash', 'ink', 'contrast'])

// Families that may stand in for each other, with a ranking penalty in ΔE units.
const COMPATIBLE_FAMILIES: Partial<Record<PaintFamily, Partial<Record<PaintFamily, number>>>> = {
  wash: { ink: 4, contrast: 6 },
  ink: { wash: 4, contrast: 6 },
  contrast: { wash: 6, ink: 6 },
}

const EXACT_DELTA_E = 2.5
const CLOSE_DELTA_E = 5
const NEAR_DELTA_E = 10
const MIN_RESULTS = 6
// No product limit on how many 85%+ colour matches are listed (users page and
// filter them); this only stops crowded darks and greys returning hundreds.
const MAX_RESULTS = 150
// Colour matches that lead the list, and the chart-based block that follows them.
const LEAD_SIMILAR_RESULTS = 6
const CHART_BLOCK_RESULTS = 6

const METAL_WORDS =
  /\b(metallic|metal|gold|silver|bronze|brass|steel|chrome|gunmetal|mithril|alumini?um|pewter|platinum)\b/
const CONTEXT_KEYWORDS = [
  'matt',
  'satin',
  'gloss',
  'thinner',
  'flow',
  'retarder',
  'reducer',
  'glaze',
  'medium',
  'drying',
  'cleaner',
  'airbrush',
  'crackle',
  'mud',
  'snow',
  'water',
  'blood',
  'rust',
  'gem',
  'earth',
  'sand',
  'ash',
  'grass',
  'slime',
  'oil',
  'grease',
  'fuel',
  'dust',
  'pigment',
  'black',
  'grey',
  'white',
]

function text(paint: EquivalentCatalogPaint) {
  return {
    type: (paint.paint_type ?? '').toLowerCase(),
    line: (paint.line ?? '').toLowerCase(),
    name: (paint.name ?? '').toLowerCase(),
    brand: (paint.brand ?? '').toLowerCase(),
  }
}

export function classifyPaintFamily(paint: EquivalentCatalogPaint): PaintFamily {
  const { type, line, name, brand } = text(paint)

  if (type === 'varnish' || /\bvarnish\b/.test(name)) return 'varnish'
  if (type === 'primer' || /\bprimer\b/.test(line) || /\bprimer\b/.test(name)) return 'primer'
  if (
    type === 'auxiliary' ||
    /\b(medium|thinner|retarder|flow improver|reducer|cleaner|glaze)\b/.test(name)
  ) {
    return 'medium'
  }
  if (
    ['technical', 'effect', 'weathering', 'pigment'].includes(type) ||
    /\b(texture|technical|weathering|pigment|fx)\b/.test(line)
  ) {
    return 'texture'
  }
  if (type === 'contrast' || type === 'speedpaint' || /\b(contrast|speedpaint|xpress)\b/.test(line)) {
    return 'contrast'
  }
  if (
    type === 'wash' ||
    /\b(shade|wash|washes)\b/.test(line) ||
    (brand.includes('army painter') && /\b(tone|shade)$/.test(name))
  ) {
    return 'wash'
  }
  if (type === 'ink' || /\bink\b/.test(line)) return 'ink'
  if (
    type === 'metallic' ||
    paint.finish_type === 'metallic' ||
    /\b(metal|metallic|chrome)\b/.test(line) ||
    METAL_WORDS.test(name)
  ) {
    return 'metallic'
  }

  return 'standard'
}

export function isContextualFamily(family: PaintFamily) {
  return CONTEXTUAL_FAMILIES.has(family)
}

export function familyLightnessWeight(family: PaintFamily) {
  return TRANSPARENT_FAMILIES.has(family) ? 2 : 1
}

// Placeholder hexes (#FFFFFF on "Jade Green", #000000 on a red) poison colour
// matching, so they are treated as missing until the catalog is cleaned.
function trustedLab(paint: EquivalentCatalogPaint): LabColor | null {
  if (!isUsableHex(paint.hex_approx)) return null

  const hex = paint.hex_approx.toUpperCase()
  const name = (paint.name ?? '').toLowerCase()
  if (hex === '#FFFFFF' && !/white|snow|bone|skull|ivory/.test(name)) return null
  if (hex === '#000000' && !/black|night|abyss/.test(name)) return null

  return hexToLab(hex)
}

function contextKeywords(paint: EquivalentCatalogPaint) {
  const { line, name } = text(paint)
  const haystack = `${line} ${name}`.replace('matte', 'matt')

  return new Set(CONTEXT_KEYWORDS.filter((keyword) => haystack.includes(keyword)))
}

function sameRange(a: EquivalentCatalogPaint, b: EquivalentCatalogPaint) {
  return a.brand === b.brand && a.line === b.line
}

function tierForDeltaE(distance: number): EquivalentTier {
  if (distance <= EXACT_DELTA_E) return 'exact'
  if (distance <= CLOSE_DELTA_E) return 'close'

  return 'near'
}

export function findPaintEquivalents({
  source,
  catalog,
  chartEdges,
  linkedEdges = [],
}: {
  source: EquivalentCatalogPaint
  catalog: EquivalentCatalogPaint[]
  chartEdges: EquivalentChartEdge[]
  linkedEdges?: EquivalentLinkedEdge[]
}): PaintEquivalent[] {
  const sourceFamily = classifyPaintFamily(source)
  const sourceLab = trustedLab(source)
  const lightnessWeight = familyLightnessWeight(sourceFamily)
  const results = new Map<string, Omit<PaintEquivalent, 'rank' | 'group' | 'similarity'> & { score: number }>()

  const TIER_SCORE = { chart: -1000, community: -500, linked: -250 } as const
  // Each extra independent path pulls a linked paint up within its tier.
  const linkSupport = new Map<string, number>()
  // Official edges first, so a pair listed by both keeps its official tier.
  const orderedEdges = [...chartEdges].sort((a, b) => Number(a.kind === 'community') - Number(b.kind === 'community'))

  for (const edge of orderedEdges) {
    if (edge.paintId === source.id || results.has(edge.paintId)) continue
    const tier = edge.kind === 'community' ? 'community' : 'chart'

    results.set(edge.paintId, {
      paintId: edge.paintId,
      tier,
      deltaE: null,
      reason: tier === 'community'
        ? `Community cross-reference: ${edge.sourceName ?? 'conversion table'}`
        : edge.sourceName ? `Conversion chart: ${edge.sourceName}` : 'Conversion chart',
      score: TIER_SCORE[tier],
    })
  }

  for (const link of linkedEdges) {
    if (link.paintId === source.id || results.has(link.paintId)) continue
    const support = link.via.length
    linkSupport.set(link.paintId, support)
    results.set(link.paintId, {
      paintId: link.paintId,
      tier: 'linked',
      deltaE: null,
      reason: `Linked via ${link.via.slice(0, 3).join(', ')}${support > 3 ? ` and ${support - 3} more` : ''}`,
      score: TIER_SCORE.linked - support * 20,
    })
  }

  const candidates = catalog.filter(
    (paint) => paint.id !== source.id && !sameRange(paint, source)
  )

  if (isContextualFamily(sourceFamily)) {
    const sourceKeywords = contextKeywords(source)

    for (const paint of candidates) {
      if (classifyPaintFamily(paint) !== sourceFamily) continue

      const keywords = contextKeywords(paint)
      const shared = [...sourceKeywords].filter((keyword) => keywords.has(keyword))
      const targetLab = trustedLab(paint)
      const distance = sourceLab && targetLab ? deltaE2000(sourceLab, targetLab) : null
      const existing = results.get(paint.id)

      if (existing) {
        existing.deltaE = distance
        continue
      }
      if (sourceKeywords.size > 0 && shared.length === 0) continue

      results.set(paint.id, {
        paintId: paint.id,
        tier: 'contextual',
        deltaE: distance,
        reason: shared.length
          ? `Same role: ${shared.join(', ')} ${sourceFamily}`
          : `Same product type: ${sourceFamily}`,
        // Shared purpose dominates; colour only breaks ties (e.g. grey vs black primer).
        score: -shared.length * 100 + (distance ?? 50),
      })
    }
  } else if (sourceLab) {
    for (const paint of candidates) {
      const family = classifyPaintFamily(paint)
      const penalty =
        family === sourceFamily ? 0 : COMPATIBLE_FAMILIES[sourceFamily]?.[family]
      if (penalty === undefined) continue

      const targetLab = trustedLab(paint)
      if (!targetLab) continue

      const distance = deltaE2000(sourceLab, targetLab, lightnessWeight)
      const existing = results.get(paint.id)

      if (existing) {
        existing.deltaE = distance
        // Chart matches all rank first; among them, closer colours lead.
        if (existing.tier === 'chart' || existing.tier === 'community') {
          existing.score = TIER_SCORE[existing.tier] + distance
        } else if (existing.tier === 'linked') {
          existing.score = TIER_SCORE.linked - (linkSupport.get(existing.paintId) ?? 1) * 20 + distance
        }
        continue
      }
      if (distance > NEAR_DELTA_E) continue

      results.set(paint.id, {
        paintId: paint.id,
        tier: tierForDeltaE(distance),
        deltaE: distance,
        reason:
          penalty > 0
            ? `Colour match (ΔE ${distance.toFixed(1)}), ${family} instead of ${sourceFamily}`
            : `Colour match (ΔE ${distance.toFixed(1)})`,
        score: distance + penalty,
      })
    }
  }

  // Display order: close colour matches first (whatever else vouches for
  // them), then official charts, community cross-references, second-degree
  // links and same-use products. Weaker colour matches only fill the list up
  // to the minimum.
  const withGroup = [...results.values()].map((match) => ({ ...match, group: groupOf(match) }))
  const ranked = withGroup.sort(
    (a, b) =>
      GROUP_ORDER[a.group] - GROUP_ORDER[b.group] ||
      (a.group === 'similar' || a.group === 'colour'
        ? (a.deltaE ?? Infinity) - (b.deltaE ?? Infinity)
        : a.score - b.score)
  )
  // A rounded picture: the best 6 colour matches, then up to 6 chart-based
  // matches (official, community, related), then the rest of the 85%+ colour
  // matches, then any remaining chart-based and same-use matches.
  const similar = ranked.filter((match) => match.group === 'similar')
  const chartBased = ranked.filter((match) => ['official', 'community', 'related'].includes(match.group))
  const contextual = ranked.filter((match) => match.group === 'contextual')
  const strong = [
    ...similar.slice(0, LEAD_SIMILAR_RESULTS),
    ...chartBased.slice(0, CHART_BLOCK_RESULTS),
    ...similar.slice(LEAD_SIMILAR_RESULTS),
    ...chartBased.slice(CHART_BLOCK_RESULTS),
    ...contextual,
  ]
  const weak = ranked.filter((match) => match.group === 'colour')
  const selected = [
    ...strong.slice(0, MAX_RESULTS),
    ...weak.slice(0, Math.max(0, MIN_RESULTS - strong.length)),
  ]

  return selected.map((match, index) => ({
    paintId: match.paintId,
    tier: match.tier,
    group: match.group,
    deltaE: match.deltaE,
    similarity: match.deltaE === null ? null : similarityPercent(match.deltaE),
    reason: match.reason,
    rank: index,
  }))
}

// "X% similar" shown to users: 100 − 3·ΔE00, so ΔE 1 (barely visible) is 97%,
// ΔE 2 is 94%, ΔE 5 (clearly different, same colour family) is 85%.
export function similarityPercent(deltaE: number) {
  return Math.max(0, Math.min(100, Math.round(100 - 3 * deltaE)))
}

// Colour matches at or above 85% similar lead the list.
export const SIMILAR_CUTOFF_DELTA_E = 5

export type EquivalentGroup = 'similar' | 'official' | 'community' | 'related' | 'contextual' | 'colour'

const GROUP_ORDER: Record<EquivalentGroup, number> = {
  similar: 0,
  official: 1,
  community: 2,
  related: 3,
  contextual: 4,
  colour: 5,
}

function groupOf(match: { tier: EquivalentTier; deltaE: number | null }): EquivalentGroup {
  if (match.tier === 'contextual') return 'contextual'
  if (match.deltaE !== null && match.deltaE <= SIMILAR_CUTOFF_DELTA_E) return 'similar'
  if (match.tier === 'chart') return 'official'
  if (match.tier === 'community') return 'community'
  if (match.tier === 'linked') return 'related'
  return 'colour'
}
