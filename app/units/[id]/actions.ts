'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient, getSessionUser } from '../../../utils/supabase/server'
import {
  calculateUnitXP,
  calculateStepXP,
  calculateCompletionBonus,
} from '@/lib/gamification/xp'
import { addXP } from '@/lib/gamification/add-xp'
import { captureServerEvent } from '../../../utils/analytics/server'
import {
  getSafeImageExtension,
  type GalleryUploadResult,
  validateGalleryImageFile,
} from '../../../utils/images/gallery-upload'
import {
  extractPaletteFromImage,
  findNearestUniquePaints,
} from '../../../utils/color-matching'
import { createPerfTimer } from '../../../utils/perf/server'

const unitThemeMarker = (unitId: string) => `[unit:${unitId}]`
const unitThemeDescription = (unitId: string, source: string) =>
  `${source}\n\n${unitThemeMarker(unitId)}`
const removeUnitThemeMarker = (description: string | null, unitId: string) =>
  (description || '')
    .replace(new RegExp(`\\n\\n\\[unit:${unitId}\\]\\s*$`), '')
    .replace(new RegExp(`\\[unit:${unitId}\\]\\s*$`), '')
    .trim()

type UnitColumnQueryError = {
  code?: string
  message?: string
}

function isMissingUnitColumn(
  error: UnitColumnQueryError | null | undefined,
  column: 'completed_at'
) {
  return error?.code === '42703' && error.message?.includes(column)
}

async function requireSessionUser(
  supabase: Awaited<ReturnType<typeof createClient>>
) {
  const user = await getSessionUser(supabase)

  if (!user) {
    throw new Error('Unauthorized')
  }

  return user
}

function revalidateUnitThemePages(unitId: string, themeId: string) {
  revalidatePath(`/units/${unitId}`)
  revalidatePath('/themes')
  revalidatePath(`/themes/${themeId}`)
}

export async function toggleUnitActive(unitId: string, nextValue: boolean) {
  const supabase = await createClient()
  await requireSessionUser(supabase)

  const { error } = await supabase
    .from('units')
    .update({ is_active: nextValue })
    .eq('id', unitId)

  if (error) {
    throw error
  }

  revalidatePath(`/units/${unitId}`)
}

export async function setFeaturedUnit(unitId: string) {
  const perf = createPerfTimer('action:setFeaturedUnit')
  const supabase = await createClient()
  await requireSessionUser(supabase)

  const { error } = await supabase.rpc('set_featured_unit', {
    p_unit_id: unitId,
  })

  if (error) {
    throw error
  }

  revalidatePath(`/units/${unitId}`)
  perf.mark('revalidation duration')
  perf.total()
}

export async function updateUnitStatus(
  unitId: string,
  status: 'complete' | 'active' | 'bench' | 'pile' | 'other'
) {
  const supabase = await createClient()
  const user = await requireSessionUser(supabase)

  const allowedStatuses = new Set([
    'complete',
    'active',
    'bench',
    'pile',
    'other',
  ])

  if (!unitId || !allowedStatuses.has(status)) {
    throw new Error('Invalid unit status')
  }

  let hasCompletedAtColumn = true
  let { data: currentUnit, error: currentUnitError } = await supabase
    .from('units')
    .select('id, completed_at')
    .eq('id', unitId)
    .eq('user_id', user.id)
    .maybeSingle()

  if (
    isMissingUnitColumn(
      currentUnitError as UnitColumnQueryError | null,
      'completed_at'
    )
  ) {
    hasCompletedAtColumn = false
    const fallbackResult = await supabase
      .from('units')
      .select('id')
      .eq('id', unitId)
      .eq('user_id', user.id)
      .maybeSingle()

    currentUnit = fallbackResult.data
      ? {
          ...fallbackResult.data,
          completed_at: null,
        }
      : null
    currentUnitError = fallbackResult.error
  }

  if (currentUnitError) {
    throw currentUnitError
  }

  if (!currentUnit) {
    throw new Error('Unit not found')
  }

  const completedAt =
    status === 'complete' && !currentUnit.completed_at
      ? new Date().toISOString()
      : currentUnit.completed_at
  const shouldOpenShareModal = status === 'complete' && !currentUnit.completed_at

  const unitUpdate = hasCompletedAtColumn
    ? { status, completed_at: completedAt }
    : { status }

  const { error } = await supabase
    .from('units')
    .update(unitUpdate)
    .eq('id', unitId)
    .eq('user_id', user.id)

  if (error) {
    throw error
  }

  revalidatePath(`/units/${unitId}`)

  return {
    completedAt,
    shouldOpenShareModal,
  }
}

export async function startUnitSession(unitId: string) {
  const perf = createPerfTimer('action:startUnitSession')
  const supabase = await createClient()
  const user = await requireSessionUser(supabase)

  const { data: existing, error: existingError } = await supabase
    .from('unit_sessions')
    .select('id')
    .eq('unit_id', unitId)
    .eq('user_id', user.id)
    .is('ended_at', null)
    .maybeSingle()

  if (existingError) {
    throw existingError
  }
  perf.mark('active session query')

  if (existing) {
    perf.total()
    return existing
  }

  const { data, error } = await supabase
    .from('unit_sessions')
    .insert({
      unit_id: unitId,
      user_id: user.id,
      started_at: new Date().toISOString(),
      entry_source: 'timer',
    })
    .select('id, started_at')
    .single()

  if (error) {
    throw error
  }

  const { data: unit } = await supabase
    .from('units')
    .select('id, name, complexity, project_id')
    .eq('id', unitId)
    .eq('user_id', user.id)
    .maybeSingle()

  let projectName: string | null = null

  if (unit?.project_id) {
    const { data: project } = await supabase
      .from('projects')
      .select('name')
      .eq('id', unit.project_id)
      .eq('user_id', user.id)
      .maybeSingle()

    projectName = project?.name || null
  }

  await captureServerEvent({
    distinctId: user.id,
    event: 'session_started',
    properties: {
      unit_id: unitId,
      unit_name: unit?.name || null,
      project_id: unit?.project_id || null,
      project_name: projectName,
      complexity: unit?.complexity || null,
    },
  })
  perf.mark('analytics event')

  revalidatePath(`/units/${unitId}`)
  perf.mark('revalidation duration')
  perf.total()
  return data
}

export async function endUnitSession(unitId: string) {
  const perf = createPerfTimer('action:endUnitSession')
  const supabase = await createClient()
  const user = await requireSessionUser(supabase)

  const { data: session, error: sessionError } = await supabase
    .from('unit_sessions')
    .select('id, started_at')
    .eq('unit_id', unitId)
    .eq('user_id', user.id)
    .is('ended_at', null)
    .order('started_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (sessionError) {
    throw sessionError
  }
  perf.mark('active session query')

  if (!session) {
    perf.total()
    return null
  }

  const started = new Date(session.started_at).getTime()
  const ended = Date.now()
  const durationSeconds = Math.max(0, Math.floor((ended - started) / 1000))

  const endedAt = new Date().toISOString()

  const { data: updatedSession, error } = await supabase
    .from('unit_sessions')
    .update({
      ended_at: endedAt,
      duration_seconds: durationSeconds,
      entry_source: 'timer',
    })
    .eq('id', session.id)
    .select('id, started_at, ended_at, duration_seconds, entry_source, notes')
    .single()

  if (error) {
    throw error
  }

  const { data: unit } = await supabase
    .from('units')
    .select('id, name, complexity, project_id')
    .eq('id', unitId)
    .eq('user_id', user.id)
    .maybeSingle()

  let projectName: string | null = null

  if (unit?.project_id) {
    const { data: project } = await supabase
      .from('projects')
      .select('name')
      .eq('id', unit.project_id)
      .eq('user_id', user.id)
      .maybeSingle()

    projectName = project?.name || null
  }

  await captureServerEvent({
    distinctId: user.id,
    event: 'session_stopped',
    properties: {
      unit_id: unitId,
      unit_name: unit?.name || null,
      project_id: unit?.project_id || null,
      project_name: projectName,
      complexity: unit?.complexity || null,
      duration_seconds: durationSeconds,
      duration_minutes: Math.round(durationSeconds / 60),
    },
  })
  perf.mark('analytics event')

  revalidatePath(`/units/${unitId}`)
  perf.mark('revalidation duration')
  perf.total()

  return { durationSeconds, session: updatedSession }
}

export async function logManualUnitSession(formData: FormData) {
  const supabase = await createClient()
  const user = await requireSessionUser(supabase)

  const unitId = String(formData.get('unitId') || '')
  const startedAtRaw = String(formData.get('startedAt') || '')
  const endedAtRaw = String(formData.get('endedAt') || '')
  const notes = String(formData.get('notes') || '').trim()

  if (!unitId || !startedAtRaw || !endedAtRaw) {
    throw new Error('Missing manual session details')
  }

  const startedAt = new Date(startedAtRaw)
  const endedAt = new Date(endedAtRaw)

  if (
    Number.isNaN(startedAt.getTime()) ||
    Number.isNaN(endedAt.getTime()) ||
    endedAt <= startedAt
  ) {
    throw new Error('End time must be after start time')
  }

  const { data: unit, error: unitError } = await supabase
    .from('units')
    .select('id, name, project_id')
    .eq('id', unitId)
    .eq('user_id', user.id)
    .maybeSingle()

  if (unitError) {
    throw unitError
  }

  if (!unit) {
    throw new Error('Unit not found')
  }

  const durationSeconds = Math.floor(
    (endedAt.getTime() - startedAt.getTime()) / 1000
  )

  const { data: session, error } = await supabase
    .from('unit_sessions')
    .insert({
      unit_id: unitId,
      user_id: user.id,
      started_at: startedAt.toISOString(),
      ended_at: endedAt.toISOString(),
      duration_seconds: durationSeconds,
      entry_source: 'manual',
      notes: notes || null,
    })
    .select('id, started_at, ended_at, duration_seconds, entry_source, notes')
    .single()

  if (error) {
    throw error
  }

  await captureServerEvent({
    distinctId: user.id,
    event: 'unit_session_manual_logged',
    properties: {
      unit_id: unitId,
      unit_name: unit.name || null,
      project_id: unit.project_id || null,
      duration_seconds: durationSeconds,
      duration_minutes: Math.round(durationSeconds / 60),
      has_notes: Boolean(notes),
    },
  })

  revalidatePath(`/units/${unitId}`)

  return session
}

export async function updateProgressStep(
  unitId: string,
  stepId: string,
  status: 'pending' | 'in_progress' | 'done',
  progress: number
) {
  const supabase = await createClient()

  const safeProgress = Math.max(0, Math.min(100, progress))

  const { error } = await supabase
    .from('unit_progress_steps')
    .update({
      status,
      progress: safeProgress,
    })
    .eq('id', stepId)
    .eq('unit_id', unitId)

  if (error) {
    throw error
  }

  revalidatePath(`/units/${unitId}`)
}

export async function setFeaturedUnitImage(unitId: string, imageId: string) {
  const supabase = await createClient()

  const { error: clearError } = await supabase
    .from('image_assets')
    .update({ is_featured: false })
    .eq('entity_type', 'unit')
    .eq('entity_id', unitId)

  if (clearError) {
    throw clearError
  }

  const { error: setError } = await supabase
    .from('image_assets')
    .update({ is_featured: true })
    .eq('id', imageId)
    .eq('entity_type', 'unit')
    .eq('entity_id', unitId)

  if (setError) {
    throw setError
  }

  revalidatePath(`/units/${unitId}`)
}

export async function calculateUnitPaletteAction(formData: FormData) {
  const supabase = await createClient()

  const unitId = String(formData.get('unitId') || '')

  if (!unitId) return

  const user = await requireSessionUser(supabase)

  const { data: unit, error: unitError } = await supabase
    .from('units')
    .select('id, name, project_id')
    .eq('id', unitId)
    .eq('user_id', user.id)
    .maybeSingle()

  if (unitError) {
    throw unitError
  }

  if (!unit) {
    throw new Error('Unit not found')
  }

  const { error: themeColumnError } = await supabase
    .from('units')
    .select('theme_id')
    .eq('id', unitId)
    .eq('user_id', user.id)
    .maybeSingle()
  const canUseUnitThemeColumn = !themeColumnError

  const { data: featuredImage } = await supabase
    .from('image_assets')
    .select('image_url')
    .eq('entity_type', 'unit')
    .eq('entity_id', unitId)
    .eq('user_id', user.id)
    .eq('is_featured', true)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!featuredImage?.image_url) {
    throw new Error('Add a featured unit image before creating a magic palette')
  }

  const extractedHexes = await extractPaletteFromImage(featuredImage.image_url)

  const { data: catalogColors, error: catalogError } = await supabase
    .from('paint_catalog')
    .select('id, hex_approx, color_match_enabled')
    .eq('is_active', true)
    .eq('color_match_enabled', true)
    .not('hex_approx', 'is', null)
    .filter('hex_approx', 'match', '^#[0-9A-Fa-f]{6}$')
    .limit(5000)

  if (catalogError) {
    throw catalogError
  }

  if (!catalogColors?.length) {
    throw new Error('No paint catalog colors found')
  }

  const matchedPaints = findNearestUniquePaints(extractedHexes, catalogColors)
    .map((nearestPaint, index) => ({
        paint_source: 'catalog',
        paint_catalog_id: nearestPaint.id,
        custom_paint_id: null,
        sort_order: index,
      }))

  if (matchedPaints.length === 0) {
    throw new Error('Could not match palette colors to paints')
  }

  const { data: newTheme, error: themeError } = await supabase
    .from('themes')
    .insert({
      user_id: user.id,
      name: unit.name || 'Unit Palette',
      description: unitThemeDescription(
        unitId,
        'Unit palette created from the unit image.'
      ),
      image_url: featuredImage.image_url,
      is_public: false,
    })
    .select('id')
    .single()

  if (themeError || !newTheme) {
    throw themeError || new Error('Failed to create unit palette')
  }

  const themeId = newTheme.id

  if (canUseUnitThemeColumn) {
    const { error: updateUnitError } = await supabase
      .from('units')
      .update({ theme_id: themeId })
      .eq('id', unitId)
      .eq('user_id', user.id)

    if (updateUnitError) {
      throw updateUnitError
    }
  }

  const paintRows = matchedPaints.map((paint) => ({
    ...paint,
    theme_id: themeId,
  }))

  const { error: insertPaintsError } = await supabase
    .from('theme_paints')
    .insert(paintRows)

  if (insertPaintsError) {
    throw insertPaintsError
  }

  await captureServerEvent({
    distinctId: user.id,
    event: 'palette_calculator_used',
    properties: {
      source_type: 'unit',
      source_id: unitId,
      unit_id: unitId,
      project_id: unit.project_id || null,
      theme_id: themeId,
      extracted_colors_count: extractedHexes.length,
      matched_paints_count: matchedPaints.length,
    },
  })

  revalidateUnitThemePages(unitId, themeId)
}

export async function unassignUnitTheme(formData: FormData) {
  const supabase = await createClient()

  const unitId = String(formData.get('unitId') || '')
  const themeId = String(formData.get('themeId') || '')

  if (!unitId || !themeId) return

  const user = await requireSessionUser(supabase)

  const { data: unit, error: unitError } = await supabase
    .from('units')
    .select('id')
    .eq('id', unitId)
    .eq('user_id', user.id)
    .maybeSingle()

  if (unitError) {
    throw unitError
  }

  if (!unit) return

  const { error: themeColumnError } = await supabase
    .from('units')
    .select('theme_id')
    .eq('id', unitId)
    .eq('user_id', user.id)
    .maybeSingle()

  if (!themeColumnError) {
    const { error: updateUnitError } = await supabase
      .from('units')
      .update({ theme_id: null })
      .eq('id', unitId)
      .eq('user_id', user.id)

    if (updateUnitError) {
      throw updateUnitError
    }
  }

  const { data: theme, error: themeError } = await supabase
    .from('themes')
    .select('id, description')
    .eq('id', themeId)
    .eq('user_id', user.id)
    .maybeSingle()

  if (themeError) {
    throw themeError
  }

  if (theme?.description?.includes(unitThemeMarker(unitId))) {
    const { error: updateThemeError } = await supabase
      .from('themes')
      .update({ description: removeUnitThemeMarker(theme.description, unitId) })
      .eq('id', themeId)
      .eq('user_id', user.id)

    if (updateThemeError) {
      throw updateThemeError
    }
  }

  revalidateUnitThemePages(unitId, themeId)
}

export async function setUnitPaletteSlot(
  unitId: string,
  slotIndex: number,
  paintSource: 'catalog' | 'custom',
  paintId: string
) {
  const supabase = await createClient()
  const user = await requireSessionUser(supabase)

  const { data: unit, error: unitError } = await supabase
    .from('units')
    .select('id, name')
    .eq('id', unitId)
    .eq('user_id', user.id)
    .maybeSingle()

  if (unitError) {
    throw unitError
  }

  if (!unit) return

  const { data: unitThemeRow, error: themeColumnError } = await supabase
    .from('units')
    .select('theme_id')
    .eq('id', unitId)
    .eq('user_id', user.id)
    .maybeSingle()

  const canUseUnitThemeColumn = !themeColumnError
  let themeId =
    typeof unitThemeRow?.theme_id === 'string' ? unitThemeRow.theme_id : null

  if (!themeId) {
    const { data: existingMarkedTheme } = await supabase
      .from('themes')
      .select('id')
      .eq('user_id', user.id)
      .ilike('description', `%${unitThemeMarker(unitId)}%`)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    themeId = existingMarkedTheme?.id ?? null
  }

  if (!themeId) {
    const { data: featuredImage } = await supabase
      .from('image_assets')
      .select('image_url')
      .eq('entity_type', 'unit')
      .eq('entity_id', unitId)
      .eq('user_id', user.id)
      .eq('is_featured', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    const { data: newTheme, error: themeError } = await supabase
      .from('themes')
      .insert({
        user_id: user.id,
        name: unit.name || 'Unit Palette',
        description: unitThemeDescription(
          unitId,
          'Unit palette created from the unit page.'
        ),
        image_url: featuredImage?.image_url || null,
        is_public: false,
      })
      .select('id')
      .single()

    if (themeError || !newTheme) {
      throw themeError || new Error('Failed to create unit palette')
    }

    themeId = newTheme.id

    if (canUseUnitThemeColumn) {
      const { error: updateUnitError } = await supabase
        .from('units')
        .update({ theme_id: themeId })
        .eq('id', unitId)
        .eq('user_id', user.id)

      if (updateUnitError) {
        throw updateUnitError
      }
    }
  }

  const sortOrder = slotIndex + 1

  const { error: deleteError } = await supabase
    .from('theme_paints')
    .delete()
    .eq('theme_id', themeId)
    .eq('sort_order', sortOrder)

  if (deleteError) {
    throw deleteError
  }

  const { error: insertError } = await supabase.from('theme_paints').insert({
    theme_id: themeId,
    paint_source: paintSource,
    paint_catalog_id: paintSource === 'catalog' ? paintId : null,
    custom_paint_id: paintSource === 'custom' ? paintId : null,
    sort_order: sortOrder,
  })

  if (insertError) {
    throw insertError
  }

  revalidatePath(`/units/${unitId}`)
  revalidatePath(`/themes/${themeId}`)
}

export async function uploadUnitGalleryImages(
  formData: FormData
): Promise<GalleryUploadResult | void> {
  const supabase = await createClient()
  const user = await requireSessionUser(supabase)

  const unitId = String(formData.get('unitId') || '')
  const uploadSource =
    formData.get('uploadSource') === 'camera' ? 'camera' : 'gallery_picker'
  const files = formData
    .getAll('image')
    .filter((value): value is File => value instanceof File && value.size > 0)

  if (!unitId || files.length === 0) return

  const { data: unit, error: unitError } = await supabase
    .from('units')
    .select('id, project_id')
    .eq('id', unitId)
    .eq('user_id', user.id)
    .maybeSingle()

  if (unitError) {
    throw unitError
  }

  if (!unit) {
    throw new Error('Unit not found')
  }

  const { data: existingFeatured } = await supabase
    .from('image_assets')
    .select('id')
    .eq('entity_type', 'unit')
    .eq('entity_id', unitId)
    .eq('is_featured', true)
    .limit(1)

  const result: GalleryUploadResult = {
    uploadedCount: 0,
    failed: [],
    uploadedImages: [],
  }
  const hasFeaturedImage = Boolean(
    existingFeatured && existingFeatured.length > 0
  )

  for (const file of files) {
    const validationError = validateGalleryImageFile(file)

    if (validationError) {
      result.failed.push({ fileName: file.name, reason: validationError })
      continue
    }

    const fileExt = getSafeImageExtension(file.name)
    const filePath = `units/${unitId}/${crypto.randomUUID()}.${fileExt}`

    const { error: uploadError } = await supabase.storage
      .from('obsidian-images')
      .upload(filePath, file, {
        contentType: file.type,
        upsert: false,
      })

    if (uploadError) {
      result.failed.push({ fileName: file.name, reason: uploadError.message })
      continue
    }

    const { data } = supabase.storage
      .from('obsidian-images')
      .getPublicUrl(filePath)

    const shouldBeFeatured = !hasFeaturedImage && result.uploadedCount === 0

    const { data: imageAsset, error: insertError } = await supabase
      .from('image_assets')
      .insert({
        entity_type: 'unit',
        entity_id: unitId,
        image_url: data.publicUrl,
        user_id: user.id,
        storage_bucket: 'obsidian-images',
        storage_path: filePath,
        is_featured: shouldBeFeatured,
        sort_order: 0,
        alt_text: null,
      })
      .select(
        'id, image_url, is_featured, created_at, sort_order, alt_text, storage_bucket, storage_path'
      )
      .single()

    if (insertError) {
      await supabase.storage.from('obsidian-images').remove([filePath])
      result.failed.push({ fileName: file.name, reason: insertError.message })
      continue
    }

    result.uploadedCount += 1
    if (imageAsset) {
      result.uploadedImages?.push(imageAsset)
    }

    await captureServerEvent({
      distinctId: user.id,
      event: 'image_uploaded',
      properties: {
        surface: 'unit_gallery',
        unit_id: unitId,
        entity_id: unitId,
        project_id: unit.project_id,
        image_count: 1,
        is_featured: shouldBeFeatured,
        upload_source: uploadSource,
      },
    })
  }

  if (result.uploadedCount > 0) {
    revalidatePath(`/units/${unitId}`)
    if (unit.project_id) {
      revalidatePath(`/projects/${unit.project_id}`)
    }
  }

  return result
}

export async function updateUnitDetails(formData: FormData) {
  const supabase = await createClient()
  const user = await requireSessionUser(supabase)

  const unitId = String(formData.get('unitId') ?? '')
  const complexityRaw = String(formData.get('complexity') ?? '').trim()
  const unitSizeRaw = String(formData.get('unit_size') ?? '').trim()
  const deadlineRaw = String(formData.get('deadline') ?? '').trim()
  const selectedProjectIds = Array.from(
    new Set(
      formData
        .getAll('projectIds')
        .map((value) => String(value).trim())
        .filter(Boolean)
    )
  )

  if (!unitId) {
    throw new Error('Missing unit ID')
  }

  const complexity = complexityRaw ? Number(complexityRaw) : null
  const unitSize = unitSizeRaw ? Number(unitSizeRaw) : null
  const deadline = deadlineRaw || null

  if (complexity !== null && (!Number.isFinite(complexity) || complexity < 1 || complexity > 5)) {
    throw new Error('Complexity must be between 1 and 5')
  }

  if (unitSize !== null && (!Number.isFinite(unitSize) || unitSize < 1)) {
    throw new Error('Unit size must be a positive number')
  }

  const { data: unit, error: unitError } = await supabase
    .from('units')
    .select('id, project_id')
    .eq('id', unitId)
    .eq('user_id', user.id)
    .maybeSingle()

  if (unitError) {
    throw unitError
  }

  if (!unit) {
    throw new Error('Unit not found')
  }

  if (selectedProjectIds.length > 0) {
    const { data: allowedProjects, error: allowedProjectsError } =
      await supabase
        .from('projects')
        .select('id')
        .eq('user_id', user.id)
        .in('id', selectedProjectIds)

    if (allowedProjectsError) {
      throw allowedProjectsError
    }

    const allowedProjectIds = new Set(
      (allowedProjects ?? []).map((project) => project.id)
    )

    if (selectedProjectIds.some((projectId) => !allowedProjectIds.has(projectId))) {
      throw new Error('Invalid parent project')
    }
  }

  const { data: existingLinks, error: existingLinksError } = await supabase
    .from('unit_projects')
    .select('project_id')
    .eq('unit_id', unitId)
    .eq('user_id', user.id)

  if (existingLinksError) {
    throw existingLinksError
  }

  const existingProjectIds = (existingLinks ?? []).map(
    (link) => link.project_id
  )
  const selectedProjectIdSet = new Set(selectedProjectIds)
  const existingProjectIdSet = new Set(existingProjectIds)
  const projectIdsToInsert = selectedProjectIds.filter(
    (projectId) => !existingProjectIdSet.has(projectId)
  )
  const projectIdsToDelete = existingProjectIds.filter(
    (projectId) => !selectedProjectIdSet.has(projectId)
  )

  const { error } = await supabase
    .from('units')
    .update({
      complexity,
      unit_size: unitSize,
      deadline,
      project_id: selectedProjectIds[0] ?? null,
    })
    .eq('id', unitId)
    .eq('user_id', user.id)

  if (error) {
    throw error
  }

  if (projectIdsToInsert.length > 0) {
    const { error: insertLinksError } = await supabase
      .from('unit_projects')
      .insert(
        projectIdsToInsert.map((projectId) => ({
          unit_id: unitId,
          project_id: projectId,
          user_id: user.id,
        }))
      )

    if (insertLinksError) {
      throw insertLinksError
    }
  }

  if (projectIdsToDelete.length > 0) {
    const { error: deleteLinksError } = await supabase
      .from('unit_projects')
      .delete()
      .eq('unit_id', unitId)
      .eq('user_id', user.id)
      .in('project_id', projectIdsToDelete)

    if (deleteLinksError) {
      throw deleteLinksError
    }
  }

  const affectedProjectIds = new Set([
    ...existingProjectIds,
    ...selectedProjectIds,
  ])

  if (unit.project_id) {
    affectedProjectIds.add(unit.project_id)
  }

  revalidatePath(`/units/${unitId}`)
  affectedProjectIds.forEach((projectId) => {
    revalidatePath(`/projects/${projectId}`)
  })
}

export async function updateUnitHeader(formData: FormData) {
  const supabase = await createClient()
  const user = await requireSessionUser(supabase)

  const unitId = String(formData.get('unitId') ?? '')
  const name = String(formData.get('name') ?? '').trim()
  const description = String(formData.get('description') ?? '').trim()

  if (!unitId) {
    throw new Error('Missing unit ID')
  }

  if (!name) {
    throw new Error('Unit name is required')
  }

  const { error } = await supabase
    .from('units')
    .update({
      name,
      notes: description || null,
    })
    .eq('id', unitId)
    .eq('user_id', user.id)

  if (error) {
    throw error
  }

  revalidatePath(`/units/${unitId}`)
}

export async function deleteUnit(formData: FormData) {
  const supabase = await createClient()
  const user = await requireSessionUser(supabase)

  const unitId = String(formData.get('unitId') || '')

  if (!unitId) {
    throw new Error('Missing unit ID')
  }

  const { data: unit, error: unitError } = await supabase
    .from('units')
    .select('id, project_id')
    .eq('id', unitId)
    .eq('user_id', user.id)
    .maybeSingle()

  if (unitError) {
    throw unitError
  }

  if (!unit) {
    return
  }

  await supabase
    .from('image_assets')
    .delete()
    .eq('entity_type', 'unit')
    .eq('entity_id', unitId)
    .eq('user_id', user.id)

  await supabase
    .from('unit_stage_paints')
    .delete()
    .eq('unit_id', unitId)
    .eq('user_id', user.id)

  await supabase
    .from('unit_stage_recipes')
    .delete()
    .eq('unit_id', unitId)
    .eq('user_id', user.id)

  await supabase
    .from('unit_sessions')
    .delete()
    .eq('unit_id', unitId)
    .eq('user_id', user.id)

  await supabase
    .from('unit_progress_steps')
    .delete()
    .eq('unit_id', unitId)

  await supabase
    .from('unit_stage_progress')
    .delete()
    .eq('unit_id', unitId)

  await supabase
    .from('units')
    .delete()
    .eq('id', unitId)
    .eq('user_id', user.id)

  revalidatePath('/dashboard')
  revalidatePath('/projects')

  if (unit.project_id) {
    revalidatePath(`/projects/${unit.project_id}`)
    redirect(`/projects/${unit.project_id}`)
  }

  redirect('/projects')
}

export async function expireUnitSessionAtTwoHours(unitId: string) {
  const supabase = await createClient()
  const user = await requireSessionUser(supabase)

  const { data: session, error: sessionError } = await supabase
    .from('unit_sessions')
    .select('id, started_at')
    .eq('unit_id', unitId)
    .eq('user_id', user.id)
    .is('ended_at', null)
    .order('started_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (sessionError) {
    throw sessionError
  }

  if (!session) {
    return null
  }

  const startedAt = new Date(session.started_at)
  const forcedEndAt = new Date(startedAt.getTime() + 2 * 60 * 60 * 1000)

  const { error } = await supabase
    .from('unit_sessions')
    .update({
      ended_at: forcedEndAt.toISOString(),
      duration_seconds: 7200,
    })
    .eq('id', session.id)

  if (error) {
    throw error
  }

  revalidatePath(`/units/${unitId}`)

  return { durationSeconds: 7200 }
}

export async function toggleStepDone(formData: FormData) {
  const supabase = await createClient()
  const user = await requireSessionUser(supabase)

  const stepId = formData.get('stepId')?.toString()
  const unitId = formData.get('unitId')?.toString()
  const nextStatus = formData.get('nextStatus')?.toString() as
    | 'pending'
    | 'in_progress'
    | 'done'
    | undefined

  if (!stepId || !unitId || !nextStatus) return

  let hasCompletedAtColumn = true
  let { data: unit, error: unitError } = await supabase
    .from('units')
    .select('id, user_id, complexity, unit_size, is_active, completed_at')
    .eq('id', unitId)
    .eq('user_id', user.id)
    .single()

  if (
    isMissingUnitColumn(unitError as UnitColumnQueryError | null, 'completed_at')
  ) {
    hasCompletedAtColumn = false
    const fallbackResult = await supabase
      .from('units')
      .select('id, user_id, complexity, unit_size, is_active')
      .eq('id', unitId)
      .eq('user_id', user.id)
      .single()

    unit = fallbackResult.data
      ? {
          ...fallbackResult.data,
          completed_at: null,
        }
      : null
    unitError = fallbackResult.error
  }

  if (unitError || !unit) {
    throw new Error('Unit not found')
  }

  const { data: currentStep, error: currentStepError } = await supabase
    .from('unit_progress_steps')
    .select('id, step_key, status')
    .eq('id', stepId)
    .eq('unit_id', unitId)
    .single()

  if (currentStepError || !currentStep) {
    throw new Error('Step not found')
  }

  const wasStepDone = currentStep.status === 'done'
  const isNowDone = nextStatus === 'done'
  const shouldGrantStepXP =
    !wasStepDone && isNowDone && currentStep.step_key !== 'done'

  const progress = isNowDone ? 100 : 0

  const { error: updateStepError } = await supabase
    .from('unit_progress_steps')
    .update({
      status: nextStatus,
      progress,
    })
    .eq('id', stepId)
    .eq('unit_id', unitId)

  if (updateStepError) {
    throw updateStepError
  }

  const { data: allSteps, error: stepsError } = await supabase
    .from('unit_progress_steps')
    .select('id, step_key, status')
    .eq('unit_id', unitId)

  if (stepsError) {
    throw stepsError
  }

  const visibleSteps = allSteps.filter((step) => step.step_key !== 'done')

  const allVisibleDone =
    visibleSteps.length > 0 &&
    visibleSteps.every((step) => step.status === 'done')

  const shouldGrantCompletionBonus =
    allVisibleDone && unit.is_active !== false
  const shouldOpenShareModal = allVisibleDone && !unit.completed_at
  const completedAt = shouldOpenShareModal
    ? new Date().toISOString()
    : unit.completed_at

  const { error: updateDoneStepError } = await supabase
    .from('unit_progress_steps')
    .update({
      status: allVisibleDone ? 'done' : 'pending',
      progress: allVisibleDone ? 100 : 0,
    })
    .eq('unit_id', unitId)
    .eq('step_key', 'done')

  if (updateDoneStepError) {
    throw updateDoneStepError
  }

  const unitUpdate = hasCompletedAtColumn
    ? {
        is_active: !allVisibleDone,
        completed_at: allVisibleDone ? completedAt : unit.completed_at,
      }
    : {
        is_active: !allVisibleDone,
      }

  const { error: updateUnitError } = await supabase
    .from('units')
    .update(unitUpdate)
    .eq('id', unitId)
    .eq('user_id', user.id)

  if (updateUnitError) {
    throw updateUnitError
  }

  const totalUnitXP = calculateUnitXP({
    complexity: unit.complexity ?? 1,
    unitSize: unit.unit_size ?? 1,
  })

  if (shouldGrantStepXP) {
    const stepXP = calculateStepXP(totalUnitXP)
    await addXP(user.id, stepXP)
  }

  if (shouldGrantCompletionBonus) {
    const completionBonus = calculateCompletionBonus(totalUnitXP)
    await addXP(user.id, completionBonus)
  }

  revalidatePath(`/units/${unitId}`)

  return {
    completedAt,
    shouldOpenShareModal,
  }
}

export async function updateUnitSession(formData: FormData) {
  const supabase = await createClient()
  const user = await requireSessionUser(supabase)

  const unitId = String(formData.get('unitId') || '')
  const sessionId = String(formData.get('sessionId') || '')
  const startedAt = String(formData.get('startedAt') || '')
  const endedAt = String(formData.get('endedAt') || '')

  if (!unitId || !sessionId || !startedAt || !endedAt) {
    throw new Error('Missing session details')
  }

  const started = new Date(startedAt)
  const ended = new Date(endedAt)

  if (ended <= started) {
    throw new Error('End time must be after start time')
  }

  const durationSeconds = Math.floor(
    (ended.getTime() - started.getTime()) / 1000
  )

  const { data: session, error } = await supabase
    .from('unit_sessions')
    .update({
      started_at: started.toISOString(),
      ended_at: ended.toISOString(),
      duration_seconds: durationSeconds,
    })
    .eq('id', sessionId)
    .eq('unit_id', unitId)
    .eq('user_id', user.id)
    .select('id, started_at, ended_at, duration_seconds, entry_source, notes')
    .single()

  if (error) throw error

  revalidatePath(`/units/${unitId}`)

  return session
}

export async function deleteUnitSession(formData: FormData) {
  const supabase = await createClient()
  const user = await requireSessionUser(supabase)

  const unitId = String(formData.get('unitId') || '')
  const sessionId = String(formData.get('sessionId') || '')

  if (!unitId || !sessionId) {
    throw new Error('Missing session details')
  }

  const { error } = await supabase
    .from('unit_sessions')
    .delete()
    .eq('id', sessionId)
    .eq('unit_id', unitId)
    .eq('user_id', user.id)

  if (error) throw error

  revalidatePath(`/units/${unitId}`)

  return { sessionId }
}
export async function assignRecipeToStage(formData: FormData) {
  const supabase = await createClient()
  const user = await requireSessionUser(supabase)

  const unitId = String(formData.get('unitId') || '')
  const progressStepId = String(formData.get('progressStepId') || '')
  const recipeId = String(formData.get('recipeId') || '')

  if (!unitId || !progressStepId || !recipeId) {
    throw new Error('Missing guide stage details')
  }

  const { data: unit, error: unitError } = await supabase
    .from('units')
    .select('id')
    .eq('id', unitId)
    .eq('user_id', user.id)
    .maybeSingle()

  if (unitError) {
    throw unitError
  }

  if (!unit) {
    throw new Error('Unit not found')
  }

  const { data: step, error: stepError } = await supabase
    .from('unit_progress_steps')
    .select('id')
    .eq('id', progressStepId)
    .eq('unit_id', unitId)
    .maybeSingle()

  if (stepError) {
    throw stepError
  }

  if (!step) {
    throw new Error('Progress step not found')
  }

  const { data: recipe, error: recipeError } = await supabase
    .from('recipes')
    .select('id, user_id, is_public')
    .eq('id', recipeId)
    .maybeSingle()

  if (recipeError) {
    throw recipeError
  }

  if (!recipe) {
    throw new Error('Guide not found')
  }

  const { data: savedRecipe, error: savedRecipeError } = await supabase
    .from('saved_recipes')
    .select('id')
    .eq('recipe_id', recipeId)
    .eq('user_id', user.id)
    .maybeSingle()

  if (savedRecipeError) {
    throw savedRecipeError
  }

  const canUseRecipe =
    recipe.user_id === user.id || recipe.is_public === true || !!savedRecipe

  if (!canUseRecipe) {
    throw new Error('You cannot assign this guide')
  }

  const { error } = await supabase.from('unit_stage_recipes').upsert(
    {
      unit_id: unitId,
      progress_step_id: progressStepId,
      recipe_id: recipeId,
      user_id: user.id,
    },
    {
      onConflict: 'progress_step_id',
    }
  )

  if (error) {
    throw error
  }

  revalidatePath(`/units/${unitId}`)
}

export async function removeRecipeFromStage(formData: FormData) {
  const supabase = await createClient()
  const user = await requireSessionUser(supabase)

  const unitId = String(formData.get('unitId') || '')
  const progressStepId = String(formData.get('progressStepId') || '')

  if (!unitId || !progressStepId) {
    throw new Error('Missing guide stage details')
  }

  const { error } = await supabase
    .from('unit_stage_recipes')
    .delete()
    .eq('unit_id', unitId)
    .eq('progress_step_id', progressStepId)
    .eq('user_id', user.id)

  if (error) {
    throw error
  }

  revalidatePath(`/units/${unitId}`)
}

export async function addPaintToStage(formData: FormData) {
  const supabase = await createClient()
  const user = await requireSessionUser(supabase)

  const unitId = String(formData.get('unitId') || '')
  const progressStepId = String(formData.get('progressStepId') || '')
  const paintSource = String(formData.get('paintSource') || '') as
    | 'catalog'
    | 'custom'
  const paintId = String(formData.get('paintId') || '')

  if (!unitId || !progressStepId || !paintSource || !paintId) {
    throw new Error('Missing stage paint details')
  }

  if (paintSource !== 'catalog' && paintSource !== 'custom') {
    throw new Error('Invalid paint source')
  }

  const { data: unit, error: unitError } = await supabase
    .from('units')
    .select('id')
    .eq('id', unitId)
    .eq('user_id', user.id)
    .maybeSingle()

  if (unitError) {
    throw unitError
  }

  if (!unit) {
    throw new Error('Unit not found')
  }

  const { data: step, error: stepError } = await supabase
    .from('unit_progress_steps')
    .select('id')
    .eq('id', progressStepId)
    .eq('unit_id', unitId)
    .maybeSingle()

  if (stepError) {
    throw stepError
  }

  if (!step) {
    throw new Error('Progress step not found')
  }

  if (paintSource === 'catalog') {
    const { data: catalogPaint, error: catalogPaintError } = await supabase
      .from('paint_catalog')
      .select('id')
      .eq('id', paintId)
      .maybeSingle()

    if (catalogPaintError) {
      throw catalogPaintError
    }

    if (!catalogPaint) {
      throw new Error('Catalog paint not found')
    }

    const { data: existingPaint, error: existingPaintError } = await supabase
      .from('unit_stage_paints')
      .select('id')
      .eq('progress_step_id', progressStepId)
      .eq('paint_catalog_id', paintId)
      .eq('user_id', user.id)
      .maybeSingle()

    if (existingPaintError) {
      throw existingPaintError
    }

    if (existingPaint) {
      return null
    }
  }

  if (paintSource === 'custom') {
    const { data: customPaint, error: customPaintError } = await supabase
      .from('paints')
      .select('id')
      .eq('id', paintId)
      .eq('user_id', user.id)
      .maybeSingle()

    if (customPaintError) {
      throw customPaintError
    }

    if (!customPaint) {
      throw new Error('Custom paint not found')
    }

    const { data: existingPaint, error: existingPaintError } = await supabase
      .from('unit_stage_paints')
      .select('id')
      .eq('progress_step_id', progressStepId)
      .eq('custom_paint_id', paintId)
      .eq('user_id', user.id)
      .maybeSingle()

    if (existingPaintError) {
      throw existingPaintError
    }

    if (existingPaint) {
      return null
    }
  }

  const { count, error: countError } = await supabase
    .from('unit_stage_paints')
    .select('id', { count: 'exact', head: true })
    .eq('progress_step_id', progressStepId)
    .eq('user_id', user.id)

  if (countError) {
    throw countError
  }

  const { data: stagePaint, error } = await supabase
    .from('unit_stage_paints')
    .insert({
      unit_id: unitId,
      progress_step_id: progressStepId,
      paint_source: paintSource,
      paint_catalog_id: paintSource === 'catalog' ? paintId : null,
      custom_paint_id: paintSource === 'custom' ? paintId : null,
      user_id: user.id,
      sort_order: count ?? 0,
    })
    .select(
      `
      id,
      unit_id,
      progress_step_id,
      paint_source,
      paint_catalog_id,
      custom_paint_id,
      sort_order,
      catalog_paint:paint_catalog (
        id,
        name,
        brand,
        line,
        hex_approx,
        swatch_image_url
      ),
      custom_paint:paints (
        id,
        name,
        manufacturer,
        series,
        color_hex
      )
    `
    )
    .single()

  if (error) {
    throw error
  }

  revalidatePath(`/units/${unitId}`)
  return stagePaint
}

export async function removePaintFromStage(formData: FormData) {
  const supabase = await createClient()
  const user = await requireSessionUser(supabase)

  const unitId = String(formData.get('unitId') || '')
  const stagePaintId = String(formData.get('stagePaintId') || '')

  if (!unitId || !stagePaintId) {
    throw new Error('Missing stage paint details')
  }

  const { error } = await supabase
    .from('unit_stage_paints')
    .delete()
    .eq('id', stagePaintId)
    .eq('unit_id', unitId)
    .eq('user_id', user.id)

  if (error) {
    throw error
  }

  revalidatePath(`/units/${unitId}`)
}
export async function deleteUnitImage(formData: FormData) {
  const supabase = await createClient()
  const user = await requireSessionUser(supabase)

  const unitId = String(formData.get('unitId') || '')
  const imageIds = formData
    .getAll('imageIds')
    .map((value) => String(value))
    .filter(Boolean)
  const imageId = String(formData.get('imageId') || '')
  const targetImageIds = imageIds.length > 0 ? imageIds : imageId ? [imageId] : []

  if (!unitId || targetImageIds.length === 0) {
    throw new Error('Missing image details')
  }

  const { data: images, error: imageError } = await supabase
    .from('image_assets')
    .select('id, storage_bucket, storage_path')
    .eq('entity_type', 'unit')
    .eq('entity_id', unitId)
    .eq('user_id', user.id)
    .in('id', targetImageIds)

  if (imageError) {
    throw imageError
  }

  if (!images || images.length === 0) {
    throw new Error('Image not found')
  }

  const storagePathsByBucket = images.reduce<Record<string, string[]>>(
    (acc, image) => {
      if (image.storage_bucket && image.storage_path) {
        acc[image.storage_bucket] = acc[image.storage_bucket] || []
        acc[image.storage_bucket].push(image.storage_path)
      }

      return acc
    },
    {}
  )

  for (const [bucket, paths] of Object.entries(storagePathsByBucket)) {
    const { error: storageError } = await supabase.storage
      .from(bucket)
      .remove(paths)

    if (storageError) {
      throw storageError
    }
  }

  const { error: deleteError } = await supabase
    .from('image_assets')
    .delete()
    .eq('entity_type', 'unit')
    .eq('entity_id', unitId)
    .eq('user_id', user.id)
    .in('id', images.map((image) => image.id))

  if (deleteError) {
    throw deleteError
  }

  revalidatePath(`/units/${unitId}`)
}
