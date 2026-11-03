import 'server-only'

import { createClient } from '../../utils/supabase/server'
import { closeExpiredUnitSessions } from '../../utils/sessions/expire-unit-sessions'
import { getSupabaseImageUrl } from '../../utils/images/supabase-image'
import { getGuidesV3DeckDetail } from '../guides/guides-v3-detail-data'
import {
  PAINT_MODE_FALLBACK_HERO,
  toPaintModeGuide,
  type PaintModeImage,
  type PaintModeProjectGroup,
  type PaintModeSwatch,
  type PaintModeUnit,
  type PaintModeViewModel,
} from './paint-mode-model'

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>

type OpenSessionRow = {
  id: string
  unit_id: string
  started_at: string
  paused_at: string | null
  paused_seconds: number | null
}

type CatalogPaintRow = {
  id: string
  name: string | null
  brand: string | null
  line: string | null
  hex_approx: string | null
  swatch_image_url: string | null
}

type CustomPaintRow = {
  id: string
  name: string | null
  manufacturer: string | null
  series: string | null
  color_hex: string | null
}

type PaintRefRow = {
  id: string
  paint_source: string | null
  paint_catalog_id: string | null
  custom_paint_id: string | null
  sort_order: number | null
  catalog_paint: CatalogPaintRow | CatalogPaintRow[] | null
  custom_paint: CustomPaintRow | CustomPaintRow[] | null
}

const unitThemeMarker = (unitId: string) => `[unit:${unitId}]`

function firstRelation<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null
  return value ?? null
}

function toSwatch(row: PaintRefRow): PaintModeSwatch {
  const catalog = firstRelation(row.catalog_paint)
  const custom = firstRelation(row.custom_paint)

  if (row.paint_source === 'custom') {
    return {
      id: row.custom_paint_id || row.id,
      source: 'custom',
      name: custom?.name || 'Custom paint',
      brand: custom?.manufacturer || custom?.series || null,
      line: custom?.series || null,
      hex: custom?.color_hex || null,
      swatchImageUrl: null,
      owned: true,
    }
  }

  return {
    id: row.paint_catalog_id || row.id,
    source: 'catalog',
    name: catalog?.name || 'Catalog paint',
    brand: catalog?.brand || catalog?.line || null,
    line: catalog?.line || null,
    hex: catalog?.hex_approx || null,
    swatchImageUrl: catalog?.swatch_image_url || null,
    owned: false,
  }
}

const paintRefColumns = `
  id,
  paint_source,
  paint_catalog_id,
  custom_paint_id,
  sort_order,
  catalog_paint:paint_catalog (
    id, name, brand, line, hex_approx, swatch_image_url
  ),
  custom_paint:paints (
    id, name, manufacturer, series, color_hex
  )
`

const themePaintColumns = `
  id,
  paint_source,
  paint_catalog_id,
  custom_paint_id,
  sort_order,
  catalog_paint:paint_catalog!theme_paints_paint_catalog_id_fkey (
    id, name, brand, line, hex_approx, swatch_image_url
  ),
  custom_paint:paints!theme_paints_custom_paint_id_fkey (
    id, name, manufacturer, series, color_hex
  )
`

function thumb(url: string, width: number, height: number) {
  return getSupabaseImageUrl(url, { width, height, resize: 'cover', quality: 76 }) ?? url
}

async function loadPaintModeUnit(
  supabase: SupabaseServerClient,
  userId: string,
  session: OpenSessionRow,
  unitProjectNames: Map<string, string>
): Promise<PaintModeUnit | null> {
  const unitId = session.unit_id

  const [
    unitResult,
    imagesResult,
    finishedResult,
    stepsResult,
    stagePaintsResult,
    themeResult,
    stageGuidesResult,
  ] = await Promise.all([
    supabase
      .from('units')
      .select('id, name, notes, deadline, created_at, project_id')
      .eq('id', unitId)
      .eq('user_id', userId)
      .maybeSingle(),
    supabase
      .from('image_assets')
      .select('id, image_url, is_featured, created_at, sort_order, alt_text, unit_session_id')
      .eq('entity_type', 'unit')
      .eq('entity_id', unitId)
      .eq('user_id', userId)
      .order('sort_order', { ascending: true, nullsFirst: false })
      .order('created_at', { ascending: true }),
    supabase
      .from('unit_sessions')
      .select('duration_seconds')
      .eq('unit_id', unitId)
      .eq('user_id', userId)
      .not('ended_at', 'is', null)
      .gt('duration_seconds', 0),
    supabase
      .from('unit_progress_steps')
      .select('id, step_key, step_label, step_order, status')
      .eq('unit_id', unitId)
      .order('step_order', { ascending: true }),
    supabase
      .from('unit_stage_paints')
      .select(`progress_step_id, ${paintRefColumns}`)
      .eq('unit_id', unitId)
      .eq('user_id', userId)
      .order('sort_order', { ascending: true }),
    supabase
      .from('themes')
      .select(`id, theme_paints (${themePaintColumns})`)
      .eq('user_id', userId)
      .ilike('description', `%${unitThemeMarker(unitId)}%`)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from('unit_stage_recipes')
      .select('id, progress_step_id, recipe_id')
      .eq('unit_id', unitId)
      .eq('user_id', userId),
  ])

  for (const result of [imagesResult, finishedResult, stepsResult, stagePaintsResult, themeResult, stageGuidesResult]) {
    if (result.error) throw new Error(result.error.message)
  }
  if (unitResult.error) throw new Error(unitResult.error.message)
  const unit = unitResult.data
  if (!unit) return null

  const steps = (stepsResult.data ?? []) as Array<{
    id: string
    step_key: string
    step_label: string
    status: string
  }>
  const currentStep = steps.find((step) => step.status !== 'done') ?? steps[steps.length - 1] ?? null

  const images = (imagesResult.data ?? []).filter((image) => Boolean(image.image_url)) as Array<{
    id: string
    image_url: string
    is_featured: boolean | null
    created_at: string | null
    alt_text: string | null
    unit_session_id: string | null
  }>
  const toImage = (image: (typeof images)[number]): PaintModeImage => ({
    id: image.id,
    src: thumb(image.image_url, 720, 720),
    alt: image.alt_text?.startsWith('stage:') ? `${unit.name} snapshot` : image.alt_text || unit.name,
    createdAt: image.created_at,
  })
  const featured = images.find((image) => image.is_featured) ?? images[0]
  const snapshots = images
    .filter((image) => image.unit_session_id)
    .sort((a, b) => Date.parse(a.created_at ?? '') - Date.parse(b.created_at ?? ''))
    .map(toImage)

  const stagePaints = ((stagePaintsResult.data ?? []) as Array<PaintRefRow & { progress_step_id: string }>)
    .filter((paint) => currentStep && paint.progress_step_id === currentStep.id)
    .map(toSwatch)

  const themePaints = ((themeResult.data as { theme_paints?: PaintRefRow[] } | null)?.theme_paints ?? [])
    .slice()
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
    .map(toSwatch)

  // Catalog paints carry ownership from the user's collection.
  const catalogIds = [...new Set([...stagePaints, ...themePaints].filter((paint) => paint.source === 'catalog').map((paint) => paint.id))]
  if (catalogIds.length) {
    const { data: ownershipRows, error: ownershipError } = await supabase
      .from('user_paint_ownership')
      .select('paint_catalog_id')
      .eq('user_id', userId)
      .eq('is_owned', true)
      .in('paint_catalog_id', catalogIds)
    if (ownershipError) throw new Error(ownershipError.message)
    const ownedIds = new Set((ownershipRows ?? []).map((row) => row.paint_catalog_id as string))
    for (const paint of [...stagePaints, ...themePaints]) {
      if (paint.source === 'catalog') paint.owned = ownedIds.has(paint.id)
    }
  }

  // A guide assigned to several stages is listed once.
  const recipeIds = [...new Set((stageGuidesResult.data ?? []).map((row) => row.recipe_id as string))]
  const decks = (await Promise.all(recipeIds.map((recipeId) => getGuidesV3DeckDetail(recipeId, userId))))
    .filter((deck): deck is NonNullable<typeof deck> => Boolean(deck))

  const finished = (finishedResult.data ?? []) as Array<{ duration_seconds: number | null }>

  return {
    unitId,
    name: unit.name || 'Untitled Unit',
    projectName: unitProjectNames.get(unitId) ?? 'Standalone unit',
    heroImage: featured ? thumb(featured.image_url, 960, 620) : PAINT_MODE_FALLBACK_HERO,
    session: {
      id: session.id,
      startedAt: session.started_at,
      pausedAt: session.paused_at,
      pausedSeconds: session.paused_seconds ?? 0,
    },
    stage: currentStep
      ? { stepId: currentStep.id, stepKey: currentStep.step_key, label: currentStep.step_label }
      : null,
    note: unit.notes?.trim() ?? '',
    stagePaints,
    palette: themePaints,
    guides: decks.map(toPaintModeGuide),
    inspiration: images.filter((image) => !image.unit_session_id).map(toImage),
    snapshots,
    metrics: {
      loggedSeconds: finished.reduce((sum, row) => sum + (row.duration_seconds ?? 0), 0),
      finishedSessions: finished.length,
      addedAt: unit.created_at ?? null,
      deadline: unit.deadline ?? null,
    },
  }
}

async function loadProjectGroups(
  supabase: SupabaseServerClient,
  userId: string
): Promise<{ groups: PaintModeProjectGroup[]; unitProjectNames: Map<string, string> }> {
  const [unitsResult, projectsResult, linksResult, featuredResult] = await Promise.all([
    supabase
      .from('units')
      .select('id, name, status, project_id')
      .eq('user_id', userId)
      .order('name', { ascending: true }),
    supabase.from('projects').select('id, name').eq('user_id', userId).order('name', { ascending: true }),
    supabase.from('unit_projects').select('unit_id, project_id').eq('user_id', userId),
    supabase
      .from('image_assets')
      .select('entity_id, image_url')
      .eq('entity_type', 'unit')
      .eq('user_id', userId)
      .eq('is_featured', true),
  ])

  if (unitsResult.error) throw new Error(unitsResult.error.message)
  if (projectsResult.error) throw new Error(projectsResult.error.message)

  const projectNames = new Map((projectsResult.data ?? []).map((project) => [project.id as string, (project.name as string) || 'Untitled project']))
  const linkedProject = new Map<string, string>()
  for (const link of linksResult.data ?? []) {
    if (!linkedProject.has(link.unit_id)) linkedProject.set(link.unit_id, link.project_id)
  }
  const featuredImage = new Map(
    (featuredResult.data ?? []).map((row) => [row.entity_id as string, row.image_url as string])
  )

  const groups = new Map<string, PaintModeProjectGroup>()
  const unitProjectNames = new Map<string, string>()
  for (const unit of unitsResult.data ?? []) {
    // Finished units stay out of the picker; there is nothing left to paint.
    if (unit.status === 'complete') continue
    const projectId = linkedProject.get(unit.id) ?? unit.project_id ?? null
    const key = projectId && projectNames.has(projectId) ? projectId : 'standalone'
    if (key !== 'standalone') unitProjectNames.set(unit.id, projectNames.get(key)!)
    const group: PaintModeProjectGroup = groups.get(key) ?? {
      id: key,
      name: key === 'standalone' ? 'Standalone units' : projectNames.get(key)!,
      units: [],
    }
    const image = featuredImage.get(unit.id)
    group.units.push({
      id: unit.id,
      name: unit.name || 'Untitled Unit',
      image: image ? thumb(image, 160, 160) : null,
      status: unit.status ?? null,
    })
    groups.set(key, group)
  }

  const sorted = [...groups.values()].sort((a, b) =>
    a.id === 'standalone' ? 1 : b.id === 'standalone' ? -1 : a.name.localeCompare(b.name)
  )
  return { groups: sorted, unitProjectNames }
}

export async function getPaintModeViewModel(
  userId: string,
  requestedFocusUnitId: string | null
): Promise<PaintModeViewModel> {
  const supabase = await createClient()
  await closeExpiredUnitSessions(supabase, userId)

  const [{ groups, unitProjectNames }, openSessionsResult] = await Promise.all([
    loadProjectGroups(supabase, userId),
    supabase
      .from('unit_sessions')
      .select('id, unit_id, started_at, paused_at, paused_seconds')
      .eq('user_id', userId)
      .is('ended_at', null)
      .order('started_at', { ascending: true }),
  ])

  if (openSessionsResult.error) throw new Error(openSessionsResult.error.message)

  // One open session per unit; a duplicate row would only repeat the unit.
  const sessionsByUnit = new Map<string, OpenSessionRow>()
  for (const session of (openSessionsResult.data ?? []) as OpenSessionRow[]) {
    if (!sessionsByUnit.has(session.unit_id)) sessionsByUnit.set(session.unit_id, session)
  }

  const units = (
    await Promise.all(
      [...sessionsByUnit.values()].map((session) =>
        loadPaintModeUnit(supabase, userId, session, unitProjectNames)
      )
    )
  ).filter((unit): unit is PaintModeUnit => Boolean(unit))

  const focusUnitId =
    units.find((unit) => unit.unitId === requestedFocusUnitId)?.unitId ??
    units[units.length - 1]?.unitId ??
    null

  return { units, focusUnitId, projects: groups }
}
