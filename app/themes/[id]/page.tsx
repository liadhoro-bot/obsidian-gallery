import Image from 'next/image'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '../../../utils/supabase/server'
import SubmitButton from '../../components/SubmitButton'
import DashboardTopBar from '../../dashboard/dashboard-top-bar'
import ThemeDetailHero from './theme-detail-hero'
import ThemePaletteEditor from './theme-palette-editor'
import ThemeAssignmentPanel from './theme-assignment-panel'
import DeleteConfirmationCard from '../../components/delete-confirmation-card'
import { calculateThemePaletteAction, deleteTheme } from './actions'
import { getCachedPublicTheme } from '../../../lib/public-cache'
import { createPerfTimer } from '../../../utils/perf/server'
import ContentActionRow from '../../components/social/content-action-row'
import {
  reportTheme,
  toggleThemeLike,
  toggleThemeSave,
} from '../../components/social/actions'
import { getThemeSocialState } from '../../components/social/data'

type Props = {
  params: Promise<{
    id: string
  }>
}

type ThemePaint = {
  id: string
  sort_order: number | null
  paint_source: 'catalog' | 'custom'
  paint_catalog_id?: string | null
  custom_paint_id?: string | null
  catalog_paint:
    | {
        id: string
        name: string | null
        brand: string | null
        line: string | null
        swatch_image_url: string | null
        hex_approx: string | null
      }
    | {
        id: string
        name: string | null
        brand: string | null
        line: string | null
        swatch_image_url: string | null
        hex_approx: string | null
      }[]
    | null
  custom_paint:
    | {
        id: string
        name: string | null
        manufacturer: string | null
        series: string | null
        color_hex: string | null
      }
    | {
        id: string
        name: string | null
        manufacturer: string | null
        series: string | null
        color_hex: string | null
      }[]
    | null
}

type ThemeUsageItem = {
  id: string
  type: 'project' | 'unit'
  name: string
  href: string
  imageUrl: string | null
}

type AssignableProject = {
  id: string
  name: string
  themeId: string | null
}

type ProjectUnitGroup = {
  projectId: string
  projectName: string
  units: {
    id: string
    name: string
    currentThemeId: string | null
  }[]
}

function safeImageUrl(value: string | null | undefined) {
  if (!value) return null

  const trimmed = value.trim()

  if (!trimmed) return null

  if (trimmed.startsWith('https://') || trimmed.startsWith('http://')) {
    return trimmed
  }

  return null
}

function unitThemeIdsFromDescription(description: string | null | undefined) {
  return [...(description?.matchAll(/\[unit:([^\]]+)\]/g) ?? [])].map(
    (match) => match[1]
  )
}

function displayThemeDescription(description: string | null | undefined) {
  return description?.replace(/\n\n\[unit:[^\]]+\]/g, '').trim() || null
}

function firstRelation<T>(value: T | T[] | null | undefined) {
  return Array.isArray(value) ? value[0] ?? null : value ?? null
}

function ThemeUsageCard({ items }: { items: ThemeUsageItem[] }) {
  return (
    <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
      <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-white/45">
        Projects/Units Using This
      </h2>

      <div className="mt-4 space-y-2">
        {items.length > 0 ? (
          items.map((item) => (
            <Link
              key={`${item.type}-${item.id}`}
              href={item.href}
              className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.04] p-2 transition hover:border-cyan-400/35 hover:bg-white/[0.07]"
            >
              <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg border border-white/10 bg-white/[0.05]">
                {item.imageUrl ? (
                  <Image
                    src={item.imageUrl}
                    alt={item.name}
                    fill
                    sizes="48px"
                    className="object-cover"
                  />
                ) : (
                  <div className="h-full w-full bg-neutral-800" />
                )}
              </div>

              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-white">
                  {item.name}
                </p>
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-cyan-300/80">
                  {item.type}
                </p>
              </div>
            </Link>
          ))
        ) : (
          <p className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-4 text-sm text-white/45">
            This theme is not assigned yet.
          </p>
        )}
      </div>
    </section>
  )
}

function hasThemePaintSwatchData(themePaints: ThemePaint[]) {
  return themePaints.some((paint) => {
    const catalogPaint = firstRelation(paint.catalog_paint)
    const customPaint = firstRelation(paint.custom_paint)

    return Boolean(
      catalogPaint?.swatch_image_url ||
        catalogPaint?.hex_approx ||
        customPaint?.color_hex
    )
  })
}

async function getHydratedThemePaints(
  supabase: Awaited<ReturnType<typeof createClient>>,
  themeId: string,
  themePaints: ThemePaint[]
) {
  if (hasThemePaintSwatchData(themePaints)) {
    return themePaints
  }

  const { data, error } = await supabase
    .from('theme_paints')
    .select(`
      id,
      sort_order,
      paint_source,
      paint_catalog_id,
      custom_paint_id,
      catalog_paint:paint_catalog!theme_paints_paint_catalog_id_fkey (
        id,
        name,
        brand,
        line,
        swatch_image_url,
        hex_approx
      ),
      custom_paint:paints!theme_paints_custom_paint_id_fkey (
        id,
        name,
        manufacturer,
        series,
        color_hex
      )
    `)
    .eq('theme_id', themeId)
    .order('sort_order', { ascending: true })

  if (error || !data) {
    return themePaints
  }

  return data as unknown as ThemePaint[]
}

export default async function ThemeDetailPage({ params }: Props) {
  const perf = createPerfTimer('/themes/[id]')
  const { id } = await params

  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  perf.mark('auth/session fetch')

  const cachedPublicTheme = await getCachedPublicTheme(id)
  const { data: privateTheme, error: themeError } = cachedPublicTheme
    ? { data: null, error: null }
    : user
      ? await supabase
          .from('themes')
          .select(
            `
            id,
            user_id,
            name,
            description,
            image_url,
            is_public,
            tags,
            created_at,
            theme_paints (
              id,
              sort_order,
              paint_source,
              paint_catalog_id,
              custom_paint_id,
              catalog_paint:paint_catalog!theme_paints_paint_catalog_id_fkey (
                id,
                name,
                brand,
                line,
                swatch_image_url,
                hex_approx
              ),
              custom_paint:paints!theme_paints_custom_paint_id_fkey (
                id,
                name,
                manufacturer,
                series,
                color_hex
              )
            )
          `
          )
          .eq('id', id)
          .eq('user_id', user.id)
          .maybeSingle()
      : { data: null, error: null }

  if (themeError) {
    throw new Error(themeError.message)
  }

  const theme = cachedPublicTheme || privateTheme
  perf.mark('main Supabase query')

  if (!theme) {
    notFound()
  }

  const isOwner = Boolean(user && user.id === theme.user_id)
  const heroUrl = safeImageUrl(theme.image_url)
  const markedUnitIds = unitThemeIdsFromDescription(theme.description)

  const projectsUsingThemePromise = user
    ? supabase
        .from('projects')
        .select('id, name')
        .eq('user_id', user.id)
        .eq('theme_id', theme.id)
        .order('name', { ascending: true })
    : Promise.resolve({ data: [], error: null })

  const unitsUsingThemePromise = user
    ? supabase
        .from('units')
        .select('id, name')
        .eq('user_id', user.id)
        .eq('theme_id', theme.id)
        .order('name', { ascending: true })
    : Promise.resolve({ data: [], error: null })

  const markedUnitsPromise =
    user && markedUnitIds.length > 0
      ? supabase
          .from('units')
          .select('id, name')
          .eq('user_id', user.id)
          .in('id', markedUnitIds)
      : Promise.resolve({ data: [], error: null })

  const [
    hydratedThemePaintRows,
    socialState,
    projectsUsingThemeResult,
    unitsUsingThemeResult,
    markedUnitsResult,
  ] = await Promise.all([
    getHydratedThemePaints(
      supabase,
      theme.id,
      (theme.theme_paints || []) as unknown as ThemePaint[]
    ),
    getThemeSocialState(supabase, theme.id, user?.id),
    projectsUsingThemePromise,
    unitsUsingThemePromise,
    markedUnitsPromise,
  ])
  perf.mark('secondary Supabase queries')

  if (projectsUsingThemeResult.error) {
    throw new Error(projectsUsingThemeResult.error.message)
  }

  const unitsUsingTheme = unitsUsingThemeResult.error
    ? []
    : unitsUsingThemeResult.data ?? []

  const unitsById = new Map<string, { id: string; name: string | null }>()

  for (const unit of unitsUsingTheme) {
    unitsById.set(unit.id, unit)
  }

  for (const unit of markedUnitsResult.data ?? []) {
    unitsById.set(unit.id, unit)
  }

  const projectsUsingTheme = projectsUsingThemeResult.data ?? []
  const projectIds = projectsUsingTheme.map((project) => project.id)
  const unitIds = Array.from(unitsById.keys())
  const usageEntityIds = [...projectIds, ...unitIds]

  const { data: usageImages, error: usageImagesError } =
    usageEntityIds.length > 0
      ? await supabase
          .from('image_assets')
          .select('entity_type, entity_id, image_url, is_featured, sort_order, created_at')
          .in('entity_id', usageEntityIds)
          .in('entity_type', ['project', 'unit'])
          .eq('user_id', user?.id ?? '')
          .order('is_featured', { ascending: false })
          .order('sort_order', { ascending: true })
          .order('created_at', { ascending: false })
      : { data: [], error: null }

  if (usageImagesError) {
    throw new Error(usageImagesError.message)
  }

  const featuredImageByEntity = new Map<string, string>()

  for (const image of usageImages ?? []) {
    const key = `${image.entity_type}:${image.entity_id}`

    if (!featuredImageByEntity.has(key)) {
      featuredImageByEntity.set(key, image.image_url)
    }
  }

  const usageItems: ThemeUsageItem[] = [
    ...projectsUsingTheme.map((project) => ({
      id: project.id,
      type: 'project' as const,
      name: project.name || 'Untitled Project',
      href: `/projects/${project.id}`,
      imageUrl: safeImageUrl(featuredImageByEntity.get(`project:${project.id}`)),
    })),
    ...unitIds.map((unitId) => {
      const unit = unitsById.get(unitId)

      return {
        id: unitId,
        type: 'unit' as const,
        name: unit?.name || 'Untitled Unit',
        href: `/units/${unitId}`,
        imageUrl: safeImageUrl(featuredImageByEntity.get(`unit:${unitId}`)),
      }
    }),
  ]

  const [
    { data: assignableProjectRows, error: assignableProjectsError },
    { data: unitRows, error: unitRowsError },
    { data: unitProjectRows, error: unitProjectRowsError },
    { data: userThemeRows, error: userThemesError },
    unitThemeRowsResult,
  ] = user
    ? await Promise.all([
        supabase
          .from('projects')
          .select('id, name, theme_id')
          .eq('user_id', user.id)
          .order('name', { ascending: true }),
        supabase
          .from('units')
          .select('id, name, project_id')
          .eq('user_id', user.id)
          .order('name', { ascending: true }),
        supabase
          .from('unit_projects')
          .select('unit_id, project_id')
          .eq('user_id', user.id),
        supabase
          .from('themes')
          .select('id, description')
          .eq('user_id', user.id),
        supabase
          .from('units')
          .select('id, theme_id')
          .eq('user_id', user.id),
      ])
    : [
        { data: [], error: null },
        { data: [], error: null },
        { data: [], error: null },
        { data: [], error: null },
        { data: [], error: null },
      ]

  if (assignableProjectsError) {
    throw new Error(assignableProjectsError.message)
  }

  if (unitRowsError) {
    throw new Error(unitRowsError.message)
  }

  if (unitProjectRowsError) {
    throw new Error(unitProjectRowsError.message)
  }

  if (userThemesError) {
    throw new Error(userThemesError.message)
  }

  const assignableProjects: AssignableProject[] = (
    assignableProjectRows ?? []
  ).map((project) => ({
    id: project.id,
    name: project.name || 'Untitled Project',
    themeId: project.theme_id ?? null,
  }))

  const unitThemeById = new Map<string, string>()

  if (!unitThemeRowsResult.error) {
    for (const unitThemeRow of unitThemeRowsResult.data ?? []) {
      if (unitThemeRow.theme_id) {
        unitThemeById.set(unitThemeRow.id, unitThemeRow.theme_id)
      }
    }
  }

  for (const userTheme of userThemeRows ?? []) {
    for (const unitId of unitThemeIdsFromDescription(userTheme.description)) {
      if (!unitThemeById.has(unitId)) {
        unitThemeById.set(unitId, userTheme.id)
      }
    }
  }

  const unitsByProjectId = new Map<
    string,
    Map<string, { id: string; name: string; currentThemeId: string | null }>
  >()
  const unitRowsById = new Map(
    (unitRows ?? []).map((unit) => [unit.id, unit])
  )

  for (const project of assignableProjects) {
    unitsByProjectId.set(project.id, new Map())
  }

  for (const link of unitProjectRows ?? []) {
    const unit = unitRowsById.get(link.unit_id)
    const projectUnits = unitsByProjectId.get(link.project_id)

    if (!unit || !projectUnits) continue

    projectUnits.set(unit.id, {
      id: unit.id,
      name: unit.name || 'Untitled Unit',
      currentThemeId: unitThemeById.get(unit.id) ?? null,
    })
  }

  for (const unit of unitRows ?? []) {
    if (!unit.project_id) continue

    const projectUnits = unitsByProjectId.get(unit.project_id)

    if (!projectUnits || projectUnits.has(unit.id)) continue

    projectUnits.set(unit.id, {
      id: unit.id,
      name: unit.name || 'Untitled Unit',
      currentThemeId: unitThemeById.get(unit.id) ?? null,
    })
  }

  const projectUnitGroups: ProjectUnitGroup[] = assignableProjects.map(
    (project) => ({
      projectId: project.id,
      projectName: project.name,
      units: Array.from(unitsByProjectId.get(project.id)?.values() ?? []).sort(
        (a, b) => a.name.localeCompare(b.name)
      ),
    })
  )

  const themePaints = hydratedThemePaintRows
    .map((paint) => {
      const relationPaint = paint as ThemePaint & {
        paint_catalog?: ThemePaint['catalog_paint']
        paints?: ThemePaint['custom_paint']
      }
      const catalogPaint = firstRelation(
        relationPaint.catalog_paint ?? relationPaint.paint_catalog
      )
      const customPaint = firstRelation(
        relationPaint.custom_paint ?? relationPaint.paints
      )

      return {
        ...paint,
        catalog_paint: catalogPaint,
        custom_paint: customPaint,
      }
    })
    .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
    .slice(0, 5)
  perf.total()

  const paletteSlots = Array.from({ length: 5 }).map((_, index) => {
    return themePaints[index] || null
  })

  const paintOptions: {
    id: string
    source: 'catalog' | 'custom'
    name: string
    brand: string | null
    line: string | null
    sku?: string | null
    swatch_image_url: string | null
    hex: string | null
  }[] = []

  const paletteEditorSlots = paletteSlots.map((themePaint, index) => {
    const catalogPaint = themePaint?.catalog_paint
    const customPaint = themePaint?.custom_paint

    if (!themePaint) return null

    return {
      id: themePaint.id,
      paintId: catalogPaint?.id || customPaint?.id || '',
      paintSource: themePaint.paint_source,
      name: catalogPaint?.name || customPaint?.name || `Color ${index + 1}`,
      imageUrl: safeImageUrl(catalogPaint?.swatch_image_url),
      hex: catalogPaint?.hex_approx || customPaint?.color_hex || null,
    }
  })

  return (
    <main className="min-h-screen bg-[#07090d] text-white">
      <div className="mx-auto max-w-md pb-28">
        <div className="px-4 pt-4">
          <DashboardTopBar />
        </div>

        <ThemeDetailHero
          themeId={theme.id}
          name={theme.name}
          description={displayThemeDescription(theme.description)}
          tags={theme.tags || []}
          heroUrl={heroUrl}
          isOwner={isOwner}
          isPublic={theme.is_public}
        />

        <ContentActionRow
          contentId={theme.id}
          contentType="theme"
          likeCount={socialState.likeCount}
          saveCount={socialState.saveCount}
          viewerHasLiked={socialState.viewerHasLiked}
          viewerHasSaved={socialState.viewerHasSaved}
          viewerHasReported={socialState.viewerHasReported}
          toggleLikeAction={toggleThemeLike}
          toggleSaveAction={toggleThemeSave}
          reportAction={reportTheme}
        />

        <section className="px-4 pt-6">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-[0.2em] text-white/45">
            Palette
          </h2>

          <ThemePaletteEditor
            themeId={theme.id}
            isOwner={isOwner}
            slots={paletteEditorSlots}
            paintOptions={paintOptions}
            mode={isOwner ? 'edit' : 'display'}
          />

          {isOwner && heroUrl && (
            <form action={calculateThemePaletteAction} className="mt-4">
              <input type="hidden" name="themeId" value={theme.id} />

              <SubmitButton
                idleText="Calculate Palette"
                pendingText="Calculating..."
                className="w-full rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-4 text-sm font-semibold text-white transition hover:bg-white/[0.1]"
              />
            </form>
          )}
        </section>

        <section className="px-4 pt-6">
          <ThemeAssignmentPanel
            themeId={theme.id}
            projects={assignableProjects}
            projectUnitGroups={projectUnitGroups}
          />

          {isOwner ? (
            <div className="mt-4">
              <ThemeUsageCard items={usageItems} />
            </div>
          ) : null}
        </section>

        {isOwner && (
          <section className="px-4 pt-6">
            <DeleteConfirmationCard
              itemId={theme.id}
              itemIdFieldName="themeId"
              title="Delete Theme"
              buttonLabel="Delete This Theme"
              initialDescription="Permanently delete this theme from your gallery."
              confirmDescription="If you delete this theme, it will be removed along with its palette, saved copies, and project links. This action cannot be undone."
              deleteAction={deleteTheme}
            />
          </section>
        )}
      </div>
    </main>
  )
}

