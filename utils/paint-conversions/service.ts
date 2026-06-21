import type { SupabaseClient } from '@supabase/supabase-js'
import {
  deltaE,
  deltaEToSimilarityScore,
  hexToLab,
  isUsableHex,
  rgbDistance,
  type LabColor,
} from './color'
import {
  normalizeBrand,
  normalizeLine,
  normalizePaintCode,
  normalizePaintName,
} from './normalization'
import { calculateRankingScores, type EdgeForRanking } from './scoring'

const ZERO_UUID = '00000000-0000-0000-0000-000000000000'
const SAFE_MATCH_CONFIDENCE = 0.86
const FUZZY_MATCH_CONFIDENCE = 0.74
const GENERIC_FINISH_TYPES = new Set(['standard', 'contrast', 'speedpaint', 'xpress'])
const SPECIAL_FINISH_TYPES = new Set(['metallic', 'technical', 'texture', 'medium'])
const NORMALIZATION_UPDATE_CONCURRENCY = 25

export type PaintConversionDbClient = SupabaseClient

export type PaintMatchInput = {
  brandRaw?: string | null
  lineRaw?: string | null
  nameRaw?: string | null
  codeRaw?: string | null
}

export type PaintMatchResult = {
  paint: PaintCatalogMatchRow | null
  confidence: number
  reason: string
  needs_review: boolean
}

export type PaintCatalogMatchRow = {
  id: string
  brand: string | null
  line: string | null
  name: string | null
  sku: string | null
  normalized_brand: string | null
  normalized_line: string | null
  normalized_name: string | null
  finish_type?: string | null
  is_color_matchable?: boolean | null
  is_conversion_matchable?: boolean | null
  hex_approx?: string | null
  lab_l?: number | null
  lab_a?: number | null
  lab_b?: number | null
}

export type ParsedConversionCsvRow = {
  source_brand_raw?: string | null
  source_line_raw?: string | null
  source_paint_name_raw?: string | null
  source_code_raw?: string | null
  target_brand_raw?: string | null
  target_line_raw?: string | null
  target_paint_name_raw?: string | null
  target_code_raw?: string | null
  notes_raw?: string | null
}

export type ConversionSourceMetadata = {
  name: string
  manufacturer?: string | null
  source_type?: string | null
  source_url?: string | null
  file_path?: string | null
  notes?: string | null
  reliability_score?: number
  imported_by?: string | null
}

export type ImportConversionCsvResult = {
  source_id: string
  inserted_rows: number
  matched_rows: number
  partially_matched_rows: number
  unmatched_rows: number
  review_rows: number
  edges_created: number
}

export type GenerateHexSimilarityOptions = {
  batchSize?: number
  topN?: number
}

export type RankingGenerationResult = {
  pairs_ranked: number
}

export type RematchConversionRawRowsResult = {
  rows_checked: number
  matched_rows: number
  partially_matched_rows: number
  unmatched_rows: number
  review_rows: number
  edges_created: number
}

export type SimilarPaintOptions = {
  limit?: number
  brand?: string
  ownedOnly?: boolean
  wishlistOnly?: boolean
  officialOnly?: boolean
  hexOnly?: boolean
  includeLooseMatches?: boolean
  userId?: string
}

export type SimilarPaintResult = {
  id: string
  brand: string | null
  line: string | null
  name: string | null
  sku: string | null
  swatch_image_url: string | null
  hex_approx: string | null
  paint_type: string | null
  score: number
  explanation: string | null
  best_connection_type: string | null
  source_count: number
  min_delta_e: number | null
  is_owned: boolean | null
  is_wishlist: boolean | null
}

type SimilarPaintDetails = Omit<
  SimilarPaintResult,
  | 'score'
  | 'explanation'
  | 'best_connection_type'
  | 'source_count'
  | 'min_delta_e'
  | 'is_owned'
  | 'is_wishlist'
>

type SimilarPaintRankingRow = {
  overall_score: number
  official_score: number
  hex_score: number
  manual_score: number
  explanation: string | null
  best_connection_type: string | null
  source_count: number
  min_delta_e: number | null
  similar_paint: SimilarPaintDetails | SimilarPaintDetails[] | null
}

async function attachOwnershipAndApplyFilters(
  supabase: PaintConversionDbClient,
  results: SimilarPaintResult[],
  options: SimilarPaintOptions
) {
  let filteredResults = results

  if (options.brand) {
    filteredResults = filteredResults.filter((paint) => paint.brand === options.brand)
  }

  if (options.userId) {
    const paintIds = filteredResults.map((paint) => paint.id)
    const { data: ownershipRows, error: ownershipError } =
      paintIds.length > 0
        ? await supabase
            .from('user_paint_ownership')
            .select('paint_catalog_id, is_owned, is_wishlist')
            .eq('user_id', options.userId)
            .in('paint_catalog_id', paintIds)
        : { data: [], error: null }

    if (ownershipError) throw ownershipError

    const ownership = new Map(
      (ownershipRows ?? []).map((row) => [row.paint_catalog_id, row])
    )

    filteredResults = filteredResults.map((paint) => ({
      ...paint,
      is_owned: ownership.get(paint.id)?.is_owned ?? false,
      is_wishlist: ownership.get(paint.id)?.is_wishlist ?? false,
    }))
  }

  if (options.ownedOnly) {
    filteredResults = filteredResults.filter((paint) => paint.is_owned === true)
  }

  if (options.wishlistOnly) {
    filteredResults = filteredResults.filter((paint) => paint.is_wishlist === true)
  }

  return filteredResults
}

export async function backfillPaintCatalogNormalization(
  supabase: PaintConversionDbClient,
  batchSize = 500,
  options: { force?: boolean } = {}
) {
  let updated = 0
  let offset = 0

  while (true) {
    let query = supabase
      .from('paint_catalog')
      .select('id, brand, line, name')

    if (options.force) {
      query = query.range(offset, offset + batchSize - 1)
    } else {
      query = query
        .or(
          'normalized_brand.is.null,normalized_line.is.null,normalized_name.is.null'
        )
        .range(0, batchSize - 1)
    }

    const { data, error } = await query

    if (error) throw error
    if (!data?.length) break

    const updates = (
      data as Array<{
        id: string
        brand: string | null
        line: string | null
        name: string | null
      }>
    ).map((paint) => ({
      id: paint.id,
      normalized_brand: normalizeBrand(paint.brand ?? ''),
      normalized_line: normalizeLine(paint.line ?? ''),
      normalized_name: normalizePaintName(paint.name ?? ''),
    }))

    for (
      let index = 0;
      index < updates.length;
      index += NORMALIZATION_UPDATE_CONCURRENCY
    ) {
      const chunk = updates.slice(index, index + NORMALIZATION_UPDATE_CONCURRENCY)
      const results = await Promise.all(
        chunk.map((update) =>
          supabase
            .from('paint_catalog')
            .update({
              normalized_brand: update.normalized_brand,
              normalized_line: update.normalized_line,
              normalized_name: update.normalized_name,
            })
            .eq('id', update.id)
        )
      )
      const failed = results.find((result) => result.error)

      if (failed?.error) throw failed.error
    }

    updated += updates.length

    if (options.force) {
      offset += batchSize
    }
  }

  return { updated }
}

function asNumber(value: unknown) {
  return typeof value === 'number' ? value : Number(value)
}

function uniqueByPaintId(rows: PaintCatalogMatchRow[]) {
  const seen = new Set<string>()

  return rows.filter((row) => {
    if (seen.has(row.id)) return false
    seen.add(row.id)
    return true
  })
}

function similarityRatio(left: string, right: string) {
  if (!left || !right) return 0
  if (left === right) return 1

  const rows = Array.from({ length: left.length + 1 }, (_, index) => index)

  for (let i = 1; i <= right.length; i += 1) {
    let previous = rows[0]
    rows[0] = i

    for (let j = 1; j <= left.length; j += 1) {
      const current = rows[j]
      const cost = left[j - 1] === right[i - 1] ? 0 : 1
      rows[j] = Math.min(rows[j] + 1, rows[j - 1] + 1, previous + cost)
      previous = current
    }
  }

  const distance = rows[left.length]
  const longest = Math.max(left.length, right.length)

  return longest === 0 ? 1 : 1 - distance / longest
}

function getMatchStatus(source: PaintMatchResult, target: PaintMatchResult) {
  if (source.paint && target.paint) {
    return source.needs_review || target.needs_review ? 'needs_review' : 'matched'
  }

  if (source.paint || target.paint) return 'partially_matched'

  return 'unmatched'
}

function confidenceNeedsReview(confidence: number) {
  return confidence < SAFE_MATCH_CONFIDENCE
}

async function selectPaintById(
  supabase: PaintConversionDbClient,
  paintId: string
) {
  const { data, error } = await supabase
    .from('paint_catalog')
    .select(
      'id, brand, line, name, sku, normalized_brand, normalized_line, normalized_name, finish_type, is_color_matchable, is_conversion_matchable, hex_approx, lab_l, lab_a, lab_b'
    )
    .eq('id', paintId)
    .maybeSingle()

  if (error) throw error

  return (data ?? null) as PaintCatalogMatchRow | null
}

export async function findPaintMatch(
  supabase: PaintConversionDbClient,
  input: PaintMatchInput
): Promise<PaintMatchResult> {
  const normalizedBrand = normalizeBrand(input.brandRaw ?? '')
  const normalizedLine = normalizeLine(input.lineRaw ?? '')
  const normalizedName = normalizePaintName(input.nameRaw ?? '')
  const normalizedCode = normalizePaintCode(input.codeRaw ?? '')

  if (normalizedCode) {
    const { data, error } = await supabase
      .from('paint_catalog')
      .select(
        'id, brand, line, name, sku, normalized_brand, normalized_line, normalized_name, finish_type, is_conversion_matchable'
      )
      .eq('is_conversion_matchable', true)
      .ilike('sku', input.codeRaw?.trim() ?? normalizedCode)
      .limit(2)

    if (error) throw error

    const rows = uniqueByPaintId((data ?? []) as PaintCatalogMatchRow[])
    if (rows.length === 1) {
      return {
        paint: rows[0],
        confidence: 0.98,
        reason: 'exact sku match',
        needs_review: false,
      }
    }
  }

  if (normalizedName) {
    let aliasQuery = supabase
      .from('paint_aliases')
      .select(
        'paint_id, normalized_alias_brand, normalized_alias_line, normalized_alias_name, confidence_score'
      )
      .eq('normalized_alias_name', normalizedName)

    if (normalizedBrand) aliasQuery = aliasQuery.eq('normalized_alias_brand', normalizedBrand)
    if (normalizedLine) aliasQuery = aliasQuery.eq('normalized_alias_line', normalizedLine)

    const { data: aliasRows, error: aliasError } = await aliasQuery.limit(2)
    if (aliasError) throw aliasError

    if ((aliasRows ?? []).length === 1) {
      const paint = await selectPaintById(supabase, aliasRows![0].paint_id)
      const confidence = asNumber(aliasRows![0].confidence_score)

      if (paint) {
        return {
          paint,
          confidence,
          reason: 'exact alias match',
          needs_review: confidenceNeedsReview(confidence),
        }
      }
    }
  }

  if (normalizedBrand && normalizedLine && normalizedName) {
    const { data, error } = await supabase
      .from('paint_catalog')
      .select(
        'id, brand, line, name, sku, normalized_brand, normalized_line, normalized_name, finish_type, is_conversion_matchable'
      )
      .eq('is_conversion_matchable', true)
      .eq('normalized_brand', normalizedBrand)
      .eq('normalized_line', normalizedLine)
      .eq('normalized_name', normalizedName)
      .limit(2)

    if (error) throw error
    if ((data ?? []).length === 1) {
      return {
        paint: data![0] as PaintCatalogMatchRow,
        confidence: 0.95,
        reason: 'exact normalized brand line name match',
        needs_review: false,
      }
    }
  }

  if (normalizedBrand && normalizedName) {
    const { data, error } = await supabase
      .from('paint_catalog')
      .select(
        'id, brand, line, name, sku, normalized_brand, normalized_line, normalized_name, finish_type, is_conversion_matchable'
      )
      .eq('is_conversion_matchable', true)
      .eq('normalized_brand', normalizedBrand)
      .eq('normalized_name', normalizedName)
      .limit(3)

    if (error) throw error
    if ((data ?? []).length === 1) {
      return {
        paint: data![0] as PaintCatalogMatchRow,
        confidence: 0.9,
        reason: 'exact normalized brand name match',
        needs_review: false,
      }
    }
  }

  if (normalizedBrand && normalizedName) {
    const { data, error } = await supabase
      .from('paint_catalog')
      .select(
        'id, brand, line, name, sku, normalized_brand, normalized_line, normalized_name, finish_type, is_conversion_matchable'
      )
      .eq('is_conversion_matchable', true)
      .eq('normalized_brand', normalizedBrand)
      .limit(250)

    if (error) throw error

    const candidates = ((data ?? []) as PaintCatalogMatchRow[])
      .map((paint) => ({
        paint,
        score: similarityRatio(normalizedName, paint.normalized_name ?? normalizePaintName(paint.name ?? '')),
      }))
      .filter((candidate) => candidate.score >= FUZZY_MATCH_CONFIDENCE)
      .sort((a, b) => b.score - a.score)

    if (candidates[0]) {
      const confidence = Math.min(0.86, candidates[0].score)

      return {
        paint: candidates[0].paint,
        confidence,
        reason: 'fuzzy normalized name match within brand',
        needs_review: confidenceNeedsReview(confidence),
      }
    }
  }

  return {
    paint: null,
    confidence: 0,
    reason: 'no safe match',
    needs_review: true,
  }
}

async function createConversionEdge(
  supabase: PaintConversionDbClient,
  edge: {
    source_paint_id: string
    target_paint_id: string
    source_id: string
    raw_row_id: string
    connection_type: string
    confidence_score: number
    reason: string
    needs_review: boolean
  }
) {
  const { data: existing, error: lookupError } = await supabase
    .from('paint_conversion_edges')
    .select('id')
    .eq('source_paint_id', edge.source_paint_id)
    .eq('target_paint_id', edge.target_paint_id)
    .eq('connection_type', edge.connection_type)
    .eq('source_id', edge.source_id)
    .maybeSingle()

  if (lookupError) throw lookupError
  if (existing) return false

  const { error } = await supabase.from('paint_conversion_edges').insert(edge)
  if (error) {
    if (error.code === '23505') return false
    throw error
  }

  return true
}

export async function importConversionCsv(
  supabase: PaintConversionDbClient,
  rows: ParsedConversionCsvRow[],
  sourceMetadata: ConversionSourceMetadata
): Promise<ImportConversionCsvResult> {
  const { data: source, error: sourceError } = await supabase
    .from('paint_conversion_sources')
    .insert({
      name: sourceMetadata.name,
      manufacturer: sourceMetadata.manufacturer ?? null,
      source_type: sourceMetadata.source_type ?? 'official_chart',
      source_url: sourceMetadata.source_url ?? null,
      file_path: sourceMetadata.file_path ?? null,
      notes: sourceMetadata.notes ?? null,
      reliability_score: sourceMetadata.reliability_score ?? 1,
      imported_by: sourceMetadata.imported_by ?? null,
    })
    .select('id, reliability_score, name')
    .single()

  if (sourceError) throw sourceError

  let matchedRows = 0
  let partiallyMatchedRows = 0
  let unmatchedRows = 0
  let reviewRows = 0
  let edgesCreated = 0

  for (const [index, row] of rows.entries()) {
    const sourceMatch = await findPaintMatch(supabase, {
      brandRaw: row.source_brand_raw,
      lineRaw: row.source_line_raw,
      nameRaw: row.source_paint_name_raw,
      codeRaw: row.source_code_raw,
    })
    const targetMatch = await findPaintMatch(supabase, {
      brandRaw: row.target_brand_raw,
      lineRaw: row.target_line_raw,
      nameRaw: row.target_paint_name_raw,
      codeRaw: row.target_code_raw,
    })
    const matchStatus = getMatchStatus(sourceMatch, targetMatch)

    const { data: rawRow, error: rawError } = await supabase
      .from('paint_conversion_raw_rows')
      .insert({
        source_id: source.id,
        source_brand_raw: row.source_brand_raw ?? null,
        source_line_raw: row.source_line_raw ?? null,
        source_paint_name_raw: row.source_paint_name_raw ?? null,
        source_code_raw: row.source_code_raw ?? null,
        target_brand_raw: row.target_brand_raw ?? null,
        target_line_raw: row.target_line_raw ?? null,
        target_paint_name_raw: row.target_paint_name_raw ?? null,
        target_code_raw: row.target_code_raw ?? null,
        notes_raw: row.notes_raw ?? null,
        row_number: index + 1,
        match_status: matchStatus,
        source_paint_id: sourceMatch.paint?.id ?? null,
        target_paint_id: targetMatch.paint?.id ?? null,
      })
      .select('id')
      .single()

    if (rawError) throw rawError

    if (matchStatus === 'matched') matchedRows += 1
    if (matchStatus === 'partially_matched') partiallyMatchedRows += 1
    if (matchStatus === 'unmatched') unmatchedRows += 1
    if (matchStatus === 'needs_review') reviewRows += 1

    if (!sourceMatch.paint || !targetMatch.paint) continue
    if (sourceMatch.paint.id === targetMatch.paint.id) continue

    const confidence =
      (source.reliability_score ?? 1) *
      Math.min(sourceMatch.confidence, targetMatch.confidence)
    const needsReview =
      sourceMatch.needs_review || targetMatch.needs_review || confidenceNeedsReview(confidence)

    for (const [from, to] of [
      [sourceMatch.paint.id, targetMatch.paint.id],
      [targetMatch.paint.id, sourceMatch.paint.id],
    ]) {
      const created = await createConversionEdge(supabase, {
        source_paint_id: from,
        target_paint_id: to,
        source_id: source.id,
        raw_row_id: rawRow.id,
        connection_type: 'official_conversion',
        confidence_score: Math.max(0, Math.min(1, confidence)),
        reason: source.name,
        needs_review: needsReview,
      })

      if (created) edgesCreated += 1
    }
  }

  return {
    source_id: source.id,
    inserted_rows: rows.length,
    matched_rows: matchedRows,
    partially_matched_rows: partiallyMatchedRows,
    unmatched_rows: unmatchedRows,
    review_rows: reviewRows,
    edges_created: edgesCreated,
  }
}

export async function rematchConversionRawRows(
  supabase: PaintConversionDbClient,
  options: { sourceId?: string; onlyIncomplete?: boolean } = {}
): Promise<RematchConversionRawRowsResult> {
  let query = supabase
    .from('paint_conversion_raw_rows')
    .select(
      `
      id,
      source_id,
      source_brand_raw,
      source_line_raw,
      source_paint_name_raw,
      source_code_raw,
      target_brand_raw,
      target_line_raw,
      target_paint_name_raw,
      target_code_raw,
      source:paint_conversion_sources (
        id,
        name,
        reliability_score
      )
    `
    )

  if (options.sourceId) {
    query = query.eq('source_id', options.sourceId)
  }

  if (options.onlyIncomplete ?? true) {
    query = query.neq('match_status', 'matched')
  }

  const { data, error } = await query

  if (error) throw error

  let matchedRows = 0
  let partiallyMatchedRows = 0
  let unmatchedRows = 0
  let reviewRows = 0
  let edgesCreated = 0

  for (const row of (data ?? []) as Array<
    ParsedConversionCsvRow & {
      id: string
      source_id: string
      source:
        | { id: string; name: string; reliability_score: number | null }
        | Array<{ id: string; name: string; reliability_score: number | null }>
        | null
    }
  >) {
    const sourceRecord = Array.isArray(row.source) ? row.source[0] : row.source
    const sourceMatch = await findPaintMatch(supabase, {
      brandRaw: row.source_brand_raw,
      lineRaw: row.source_line_raw,
      nameRaw: row.source_paint_name_raw,
      codeRaw: row.source_code_raw,
    })
    const targetMatch = await findPaintMatch(supabase, {
      brandRaw: row.target_brand_raw,
      lineRaw: row.target_line_raw,
      nameRaw: row.target_paint_name_raw,
      codeRaw: row.target_code_raw,
    })
    const matchStatus = getMatchStatus(sourceMatch, targetMatch)

    const { error: updateError } = await supabase
      .from('paint_conversion_raw_rows')
      .update({
        match_status: matchStatus,
        source_paint_id: sourceMatch.paint?.id ?? null,
        target_paint_id: targetMatch.paint?.id ?? null,
      })
      .eq('id', row.id)

    if (updateError) throw updateError

    if (matchStatus === 'matched') matchedRows += 1
    if (matchStatus === 'partially_matched') partiallyMatchedRows += 1
    if (matchStatus === 'unmatched') unmatchedRows += 1
    if (matchStatus === 'needs_review') reviewRows += 1

    if (!sourceMatch.paint || !targetMatch.paint) continue
    if (sourceMatch.paint.id === targetMatch.paint.id) continue

    const reliability = sourceRecord?.reliability_score ?? 1
    const confidence =
      reliability * Math.min(sourceMatch.confidence, targetMatch.confidence)
    const needsReview =
      sourceMatch.needs_review || targetMatch.needs_review || confidenceNeedsReview(confidence)

    for (const [from, to] of [
      [sourceMatch.paint.id, targetMatch.paint.id],
      [targetMatch.paint.id, sourceMatch.paint.id],
    ]) {
      const created = await createConversionEdge(supabase, {
        source_paint_id: from,
        target_paint_id: to,
        source_id: row.source_id,
        raw_row_id: row.id,
        connection_type: 'official_conversion',
        confidence_score: Math.max(0, Math.min(1, confidence)),
        reason: sourceRecord?.name ?? 'conversion chart',
        needs_review: needsReview,
      })

      if (created) edgesCreated += 1
    }
  }

  return {
    rows_checked: data?.length ?? 0,
    matched_rows: matchedRows,
    partially_matched_rows: partiallyMatchedRows,
    unmatched_rows: unmatchedRows,
    review_rows: reviewRows,
    edges_created: edgesCreated,
  }
}

export async function backfillPaintCatalogLab(
  supabase: PaintConversionDbClient,
  batchSize = 500
) {
  let updated = 0

  while (true) {
    const { data, error } = await supabase
      .from('paint_catalog')
      .select('id, hex_approx')
      .not('hex_approx', 'is', null)
      .or('lab_l.is.null,lab_a.is.null,lab_b.is.null')
      .range(0, batchSize - 1)

    if (error) throw error
    if (!data?.length) break

    for (const paint of data as Array<{ id: string; hex_approx: string | null }>) {
      if (!isUsableHex(paint.hex_approx)) continue

      const lab = hexToLab(paint.hex_approx)
      const { error: updateError } = await supabase
        .from('paint_catalog')
        .update({ lab_l: lab.l, lab_a: lab.a, lab_b: lab.b })
        .eq('id', paint.id)

      if (updateError) throw updateError
      updated += 1
    }
  }

  return { updated }
}

function paintLab(row: PaintCatalogMatchRow): LabColor | null {
  if (
    typeof row.lab_l !== 'number' ||
    typeof row.lab_a !== 'number' ||
    typeof row.lab_b !== 'number'
  ) {
    return null
  }

  return { l: row.lab_l, a: row.lab_a, b: row.lab_b }
}

type PaintComparisonFamily = 'transparent' | 'metallic' | 'technical' | 'standard'

function getPaintComparisonFamily(paint: PaintCatalogMatchRow): PaintComparisonFamily {
  const normalizedLine = normalizeLine(paint.line ?? '')
  const searchable = `${paint.brand ?? ''} ${paint.line ?? ''} ${
    paint.name ?? ''
  } ${paint.finish_type ?? ''}`.toLowerCase()

  if (
    normalizedLine === 'contrast' ||
    normalizedLine === 'xpress' ||
    normalizedLine === 'speedpaint' ||
    searchable.includes('contrast') ||
    searchable.includes('xpress') ||
    searchable.includes('speedpaint')
  ) {
    return 'transparent'
  }

  if (
    paint.finish_type === 'metallic' ||
    searchable.includes('metallic') ||
    searchable.includes('metal color') ||
    searchable.includes('metal colour')
  ) {
    return 'metallic'
  }

  if (
    paint.finish_type === 'technical' ||
    paint.finish_type === 'texture' ||
    paint.finish_type === 'medium'
  ) {
    return 'technical'
  }

  return 'standard'
}

function familyDistancePenalty(
  sourceFamily: PaintComparisonFamily,
  targetFamily: PaintComparisonFamily
) {
  if (sourceFamily === targetFamily) return 0
  if (sourceFamily === 'standard' || targetFamily === 'standard') return 10

  return 22
}

function canCompareByFinish(source: PaintCatalogMatchRow, target: PaintCatalogMatchRow) {
  const sourceFinish = source.finish_type || 'standard'
  const targetFinish = target.finish_type || 'standard'

  if (SPECIAL_FINISH_TYPES.has(sourceFinish) || SPECIAL_FINISH_TYPES.has(targetFinish)) {
    return sourceFinish === targetFinish
  }

  return GENERIC_FINISH_TYPES.has(sourceFinish) && GENERIC_FINISH_TYPES.has(targetFinish)
}

export async function generateHexSimilarityEdges(
  supabase: PaintConversionDbClient,
  options: GenerateHexSimilarityOptions = {}
) {
  const topN = options.topN ?? 20
  const batchSize = options.batchSize ?? 1000
  let paintFrom = 0
  const paints: PaintCatalogMatchRow[] = []

  while (true) {
    const { data, error } = await supabase
      .from('paint_catalog')
      .select(
        'id, brand, line, name, sku, finish_type, is_color_matchable, hex_approx, lab_l, lab_a, lab_b'
      )
      .eq('is_color_matchable', true)
      .not('lab_l', 'is', null)
      .not('lab_a', 'is', null)
      .not('lab_b', 'is', null)
      .order('id', { ascending: true })
      .range(paintFrom, paintFrom + batchSize - 1)

    if (error) throw error

    paints.push(...((data ?? []) as PaintCatalogMatchRow[]))

    if (!data || data.length < batchSize) break
    paintFrom += batchSize
  }
  const generatedEdges = new Map<
    string,
    {
      source_paint_id: string
      target_paint_id: string
      source_id: null
      raw_row_id: null
      connection_type: string
      confidence_score: number
      distance_delta_e: number
      distance_rgb: number | null
      reason: string
      needs_review: boolean
      is_active: boolean
    }
  >()

  for (const source of paints) {
    const sourceLab = paintLab(source)
    if (!sourceLab) continue
    const sourceFamily = getPaintComparisonFamily(source)

    const closest = paints
      .filter((target) => target.id !== source.id && canCompareByFinish(source, target))
      .map((target) => {
        const targetLab = paintLab(target)
        const targetFamily = getPaintComparisonFamily(target)
        const distance = targetLab ? deltaE(sourceLab, targetLab) : Number.POSITIVE_INFINITY

        return {
          target,
          distance,
          rankedDistance:
            distance + familyDistancePenalty(sourceFamily, targetFamily),
        }
      })
      .filter((candidate) => Number.isFinite(candidate.distance))
      .sort((a, b) => a.rankedDistance - b.rankedDistance)
      .slice(0, topN)

    for (const { target, distance } of closest) {
      const confidence = deltaEToSimilarityScore(distance)
      generatedEdges.set(`${source.id}|${target.id}`, {
        source_paint_id: source.id,
        target_paint_id: target.id,
        source_id: null,
        raw_row_id: null,
        connection_type: 'hex_similarity',
        confidence_score: confidence,
        distance_delta_e: distance,
        distance_rgb:
          isUsableHex(source.hex_approx) && isUsableHex(target.hex_approx)
            ? rgbDistance(source.hex_approx, target.hex_approx)
            : null,
        reason: 'LAB color similarity',
        needs_review: confidence < 0.45,
        is_active: true,
      })
    }
  }

  const existingHexEdgeKeys = new Set<string>()
  let from = 0

  while (true) {
    const { data: existingHexEdges, error: existingHexEdgesError } = await supabase
      .from('paint_conversion_edges')
      .select('id, source_paint_id, target_paint_id')
      .eq('connection_type', 'hex_similarity')
      .order('id', { ascending: true })
      .range(from, from + batchSize - 1)

    if (existingHexEdgesError) throw existingHexEdgesError

    for (const edge of existingHexEdges ?? []) {
      existingHexEdgeKeys.add(`${edge.source_paint_id}|${edge.target_paint_id}`)
    }

    if (!existingHexEdges || existingHexEdges.length < batchSize) break
    from += batchSize
  }

  const generatedEdgeRows = Array.from(generatedEdges.values()).filter(
    (edge) => !existingHexEdgeKeys.has(`${edge.source_paint_id}|${edge.target_paint_id}`)
  )

  async function insertGeneratedEdgeChunk(
    chunk: typeof generatedEdgeRows
  ): Promise<number> {
    if (chunk.length === 0) return 0

    const { error: insertError } = await supabase
      .from('paint_conversion_edges')
      .insert(chunk)

    if (!insertError) return chunk.length

    if (insertError.code !== '23505' || chunk.length === 1) {
      if (insertError.code === '23505' && chunk.length === 1) return 0
      throw insertError
    }

    const midpoint = Math.floor(chunk.length / 2)

    return (
      (await insertGeneratedEdgeChunk(chunk.slice(0, midpoint))) +
      (await insertGeneratedEdgeChunk(chunk.slice(midpoint)))
    )
  }

  let edgesCreated = 0

  for (let index = 0; index < generatedEdgeRows.length; index += batchSize) {
    const chunk = generatedEdgeRows.slice(index, index + batchSize)
    edgesCreated += await insertGeneratedEdgeChunk(chunk)
  }

  return { paints_processed: paints.length, edges_created: edgesCreated }
}

export async function generateSimilarityRankings(
  supabase: PaintConversionDbClient
): Promise<RankingGenerationResult> {
  const grouped = new Map<string, EdgeForRanking[]>()
  const batchSize = 1000
  const deleteBatchSize = 200
  let edgeFrom = 0

  while (true) {
    const { data, error } = await supabase
      .from('paint_conversion_edges')
      .select(
        'source_paint_id, target_paint_id, connection_type, confidence_score, distance_delta_e, source_id, is_active, needs_review'
      )
      .eq('is_active', true)
      .order('id', { ascending: true })
      .range(edgeFrom, edgeFrom + batchSize - 1)

    if (error) throw error

    for (const edge of (data ?? []) as Array<
      EdgeForRanking & { source_paint_id: string; target_paint_id: string }
    >) {
      const key = `${edge.source_paint_id}|${edge.target_paint_id}`
      grouped.set(key, [...(grouped.get(key) ?? []), edge])
    }

    if (!data || data.length < batchSize) break
    edgeFrom += batchSize
  }

  const rankingRows = []

  for (const [key, edges] of grouped.entries()) {
    const [paintId, similarPaintId] = key.split('|')
    if (!paintId || !similarPaintId || paintId === similarPaintId) continue

    const scores = calculateRankingScores(edges)

    rankingRows.push({
      paint_id: paintId,
      similar_paint_id: similarPaintId,
      ...scores,
      calculated_at: new Date().toISOString(),
    })
  }

  const existingRankingIds: string[] = []
  let rankingFrom = 0

  while (true) {
    const { data: existingRankings, error: existingRankingsError } = await supabase
      .from('paint_similarity_rankings')
      .select('id')
      .order('id', { ascending: true })
      .range(rankingFrom, rankingFrom + batchSize - 1)

    if (existingRankingsError) throw existingRankingsError

    existingRankingIds.push(...((existingRankings ?? []).map((ranking) => ranking.id)))

    if (!existingRankings || existingRankings.length < batchSize) break
    rankingFrom += batchSize
  }

  for (let index = 0; index < existingRankingIds.length; index += deleteBatchSize) {
    const chunk = existingRankingIds.slice(index, index + deleteBatchSize)
    const { error: deleteError } = await supabase
      .from('paint_similarity_rankings')
      .delete()
      .in('id', chunk)

    if (deleteError) throw deleteError
  }

  for (let index = 0; index < rankingRows.length; index += batchSize) {
    const chunk = rankingRows.slice(index, index + batchSize)
    const { error: upsertError } = await supabase
      .from('paint_similarity_rankings')
      .upsert(chunk, { onConflict: 'paint_id,similar_paint_id' })

    if (upsertError) throw upsertError
  }

  return { pairs_ranked: grouped.size }
}

export async function getSimilarPaints(
  supabase: PaintConversionDbClient,
  paintId: string,
  options: SimilarPaintOptions = {}
): Promise<SimilarPaintResult[]> {
  const limit = options.limit ?? 12

  let query = supabase
    .from('paint_similarity_rankings')
    .select(
      `
      overall_score,
      official_score,
      hex_score,
      manual_score,
      explanation,
      best_connection_type,
      source_count,
      min_delta_e,
      needs_review,
      similar_paint:paint_catalog!paint_similarity_rankings_similar_paint_id_fkey (
        id,
        brand,
        line,
        name,
        sku,
        swatch_image_url,
        hex_approx,
        paint_type
      )
    `
    )
    .eq('paint_id', paintId)
    .eq('is_hidden', false)
    .order('official_score', { ascending: false })
    .order('overall_score', { ascending: false })

  if (!options.includeLooseMatches) {
    query = query.eq('needs_review', false)
  }

  if (options.officialOnly) {
    query = query.gt('official_score', 0)
  }

  if (options.hexOnly) {
    query = query.gt('hex_score', 0)
  }

  const { data, error } = await query.limit(Math.max(limit * 3, limit))

  if (error) throw error

  const rankingRows = (data ?? []) as unknown as SimilarPaintRankingRow[]
  const results: SimilarPaintResult[] = []

  for (const row of rankingRows) {
    const similarPaint = Array.isArray(row.similar_paint)
      ? row.similar_paint[0]
      : row.similar_paint

    if (!similarPaint) continue

    results.push({
      ...similarPaint,
      score: row.overall_score,
      explanation: row.explanation,
      best_connection_type: row.best_connection_type,
      source_count: row.source_count,
      min_delta_e: row.min_delta_e,
      is_owned: null,
      is_wishlist: null,
    })
  }

  const filteredResults = await attachOwnershipAndApplyFilters(
    supabase,
    results,
    options
  )

  return filteredResults.slice(0, limit)
}

export { ZERO_UUID }
