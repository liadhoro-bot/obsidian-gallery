'use server'

import { createClient, getSessionUser } from '../../utils/supabase/server'
import { getSupabaseImageUrl } from '../../utils/images/supabase-image'
import {
  markOwnedPaints,
  paintRefColumns,
  themePaintColumns,
  toSwatch,
  unitThemeMarker,
  type PaintRefRow,
} from '../paint-mode/paint-mode-data'
import {
  buildUnitGuideDraft,
  groupUnitSourceFolders,
  type UnitGuideDraft,
  type UnitSourceFolder,
} from './shared/unit-guide-draft'

function thumb(url: string) {
  return getSupabaseImageUrl(url, { width: 160, height: 160, resize: 'cover', quality: 76 }) ?? url
}

async function requireUser() {
  const supabase = await createClient()
  const user = await getSessionUser(supabase)
  if (!user) throw new Error('Not authenticated')
  return { supabase, user }
}

// Every unit the user has, finished ones included: those are the ones most
// worth writing up.
export async function loadUnitSourceFolders(): Promise<UnitSourceFolder[]> {
  const { supabase, user } = await requireUser()

  const [unitsResult, projectsResult, linksResult, imagesResult] = await Promise.all([
    supabase.from('units').select('id, name, project_id').eq('user_id', user.id),
    supabase.from('projects').select('id, name').eq('user_id', user.id),
    supabase.from('unit_projects').select('unit_id, project_id').eq('user_id', user.id),
    supabase
      .from('image_assets')
      .select('entity_type, entity_id, image_url, is_featured')
      .in('entity_type', ['unit', 'project'])
      .eq('user_id', user.id)
      .order('sort_order', { ascending: true, nullsFirst: false })
      .order('created_at', { ascending: true }),
  ])

  for (const result of [unitsResult, projectsResult, linksResult, imagesResult]) {
    if (result.error) throw new Error(result.error.message)
  }

  // The featured image wins; otherwise the first in gallery order.
  const unitImages = new Map<string, string>()
  const projectImages = new Map<string, string>()
  for (const image of imagesResult.data ?? []) {
    if (!image.image_url) continue
    const images = image.entity_type === 'unit' ? unitImages : projectImages
    if (image.is_featured || !images.has(image.entity_id)) images.set(image.entity_id, thumb(image.image_url))
  }

  return groupUnitSourceFolders({
    units: unitsResult.data ?? [],
    projects: projectsResult.data ?? [],
    links: linksResult.data ?? [],
    unitImages,
    projectImages,
  })
}

export async function loadUnitGuideDraft(unitId: string): Promise<UnitGuideDraft> {
  const { supabase, user } = await requireUser()

  const { data: unit, error: unitError } = await supabase
    .from('units')
    .select('id, name, notes')
    .eq('id', unitId)
    .eq('user_id', user.id)
    .maybeSingle()
  if (unitError) throw new Error(unitError.message)
  if (!unit) throw new Error('Unit not found')

  const [imagesResult, stepsResult, stagePaintsResult, themeResult, stageGuidesResult, sessionsResult] = await Promise.all([
    supabase
      .from('image_assets')
      .select('image_url, is_featured, alt_text')
      .eq('entity_type', 'unit')
      .eq('entity_id', unitId)
      .eq('user_id', user.id)
      .order('sort_order', { ascending: true, nullsFirst: false })
      .order('created_at', { ascending: true }),
    supabase
      .from('unit_progress_steps')
      .select('id, step_key, step_label, notes')
      .eq('unit_id', unitId)
      .order('step_order', { ascending: true }),
    supabase
      .from('unit_stage_paints')
      .select(`progress_step_id, ${paintRefColumns}`)
      .eq('unit_id', unitId)
      .eq('user_id', user.id)
      .order('sort_order', { ascending: true }),
    supabase
      .from('themes')
      .select(`id, theme_paints (${themePaintColumns})`)
      .eq('user_id', user.id)
      .ilike('description', `%${unitThemeMarker(unitId)}%`)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from('unit_stage_recipes')
      .select('progress_step_id, recipe:recipes (name)')
      .eq('unit_id', unitId)
      .eq('user_id', user.id),
    supabase
      .from('unit_sessions')
      .select('started_at, notes')
      .eq('unit_id', unitId)
      .eq('user_id', user.id)
      .not('notes', 'is', null)
      .order('started_at', { ascending: true }),
  ])

  for (const result of [imagesResult, stepsResult, stagePaintsResult, themeResult, stageGuidesResult, sessionsResult]) {
    if (result.error) throw new Error(result.error.message)
  }

  const palette = ((themeResult.data as { theme_paints?: PaintRefRow[] } | null)?.theme_paints ?? [])
    .slice()
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
    .map(toSwatch)
  const stagePaintRows = (stagePaintsResult.data ?? []) as unknown as Array<PaintRefRow & { progress_step_id: string }>
  const stagePaints = stagePaintRows.map((row) => ({ stepId: row.progress_step_id, paint: toSwatch(row) }))
  await markOwnedPaints(supabase, user.id, [...palette, ...stagePaints.map(({ paint }) => paint)])

  const guideRows = (stageGuidesResult.data ?? []) as unknown as Array<{
    progress_step_id: string
    recipe: { name: string | null } | Array<{ name: string | null }> | null
  }>
  const guideTitle = (recipe: (typeof guideRows)[number]['recipe']) =>
    (Array.isArray(recipe) ? recipe[0]?.name : recipe?.name) || null

  return buildUnitGuideDraft({
    name: unit.name || 'Untitled Unit',
    notes: unit.notes,
    images: (imagesResult.data ?? [])
      .filter((image) => Boolean(image.image_url))
      .map((image) => ({
        url: image.image_url as string,
        isFeatured: image.is_featured === true,
        altText: image.alt_text,
      })),
    palette,
    stages: (stepsResult.data ?? []).map((step) => ({
      key: step.step_key,
      label: step.step_label,
      notes: step.notes,
      paints: stagePaints.filter(({ stepId }) => stepId === step.id).map(({ paint }) => paint),
      guideTitles: guideRows
        .filter((row) => row.progress_step_id === step.id)
        .map((row) => guideTitle(row.recipe))
        .filter((name): name is string => Boolean(name)),
    })),
    sessionNotes: (sessionsResult.data ?? []).map((session) => ({
      startedAt: session.started_at,
      notes: session.notes ?? '',
    })),
  })
}
