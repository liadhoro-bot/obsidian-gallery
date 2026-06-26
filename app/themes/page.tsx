import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { createClient } from '../../utils/supabase/server'
import ThemesPageClient from './themes-page-client'
import DashboardTopBar from '../dashboard/dashboard-top-bar'
import {
  getCachedCatalogPaintOptions,
  getCachedPublicThemes,
} from '../../lib/public-cache'
import { createPerfTimer } from '../../utils/perf/server'
import { getDashboardProfile } from '../dashboard/dashboard-data'

type Props = {
  searchParams?: Promise<{
    tab?: string
    q?: string
    selectForProject?: string
  }>
}

type ThemePaintSummary = {
  id: string
  theme_id?: string | null
  sort_order: number | null
  paint_catalog_id?: string | null
  custom_paint_id?: string | null
  catalog_paint:
    | {
        swatch_image_url: string | null
        hex_approx: string | null
      }
    | {
        swatch_image_url: string | null
        hex_approx: string | null
      }[]
    | null
  custom_paint:
    | {
        color_hex: string | null
      }
    | {
        color_hex: string | null
      }[]
    | null
}

type ThemeSummary = {
  id: string
  user_id: string | null
  name: string
  description: string | null
  image_url: string | null
  is_public: boolean | null
  tags?: string[] | null
  theme_paints?: ThemePaintSummary[] | null
}

type SavedThemeRow = {
  theme_id: string
  themes?: ThemeSummary | ThemeSummary[] | null
}

type ThemesTab = 'find' | 'mine' | 'create'

function firstValue<T>(value: T | T[] | null | undefined) {
  return Array.isArray(value) ? value[0] ?? null : value ?? null
}

function firstRelation<T>(value: T | T[] | null | undefined) {
  return Array.isArray(value) ? value[0] ?? null : value ?? null
}

function themeHasSwatchData(theme: ThemeSummary) {
  return Boolean(
    theme.theme_paints?.some((paint) => {
      const catalogPaint = firstRelation(paint.catalog_paint)
      const customPaint = firstRelation(paint.custom_paint)

      return Boolean(
        catalogPaint?.swatch_image_url ||
          catalogPaint?.hex_approx ||
          customPaint?.color_hex
      )
    })
  )
}

async function hydrateMissingThemeSwatches(
  supabase: Awaited<ReturnType<typeof createClient>>,
  themes: ThemeSummary[]
) {
  const themeIds = Array.from(
    new Set(
      themes
        .filter((theme) => !themeHasSwatchData(theme))
        .map((theme) => theme.id)
    )
  )

  if (themeIds.length === 0) {
    return themes
  }

  const { data, error } = await supabase
    .from('theme_paints')
    .select(
      `
      id,
      theme_id,
      sort_order,
      paint_source,
      paint_catalog_id,
      custom_paint_id,
      catalog_paint:paint_catalog!theme_paints_paint_catalog_id_fkey (
        id,
        swatch_image_url,
        hex_approx
      ),
      custom_paint:paints!theme_paints_custom_paint_id_fkey (
        id,
        color_hex
      )
    `
    )
    .in('theme_id', themeIds)
    .order('sort_order', { ascending: true })

  if (error || !data) {
    return themes
  }

  const paintsByThemeId = new Map<string, ThemePaintSummary[]>()
  for (const paint of data as unknown as ThemePaintSummary[]) {
    if (!paint.theme_id) continue

    const paints = paintsByThemeId.get(paint.theme_id) ?? []
    paints.push(paint)
    paintsByThemeId.set(paint.theme_id, paints)
  }

  return themes.map((theme) => ({
    ...theme,
    theme_paints: paintsByThemeId.get(theme.id) ?? theme.theme_paints,
  }))
}

async function attachThemeToProject(formData: FormData) {
  'use server'

  const supabase = await createClient()

  const projectId = formData.get('projectId')?.toString()
  const themeId = formData.get('themeId')?.toString()

  if (!projectId || !themeId) return

  const { error } = await supabase
    .from('projects')
    .update({
      theme_id: themeId,
    })
    .eq('id', projectId)

  if (error) {
    console.error('Error attaching theme to project:', error)
    return
  }

  redirect(`/projects/${projectId}`)
}

async function ThemesContent({
  userId,
  activeTab,
  initialSearch,
  selectForProject,
}: {
  userId: string
  activeTab: ThemesTab
  initialSearch: string
  selectForProject: string | null
}) {
  const perf = createPerfTimer('/themes:content')
  const supabase = await createClient()

  const [publicThemes, myThemesResult, savedRowsResult, catalogPaints, customPaintsResult] =
    await Promise.all([
      activeTab === 'find'
        ? getCachedPublicThemes()
        : Promise.resolve([] as ThemeSummary[]),
      activeTab === 'mine'
        ? supabase
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
                  swatch_image_url,
                  hex_approx
                ),
                custom_paint:paints!theme_paints_custom_paint_id_fkey (
                  id,
                  color_hex
                )
              )
            `
            )
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
        : Promise.resolve({ data: [] as ThemeSummary[] }),
      activeTab === 'mine'
        ? supabase
            .from('saved_themes')
            .select(
              `
              theme_id,
              themes (
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
                    swatch_image_url,
                    hex_approx
                  ),
                  custom_paint:paints!theme_paints_custom_paint_id_fkey (
                    id,
                    color_hex
                  )
                )
              )
            `
            )
            .eq('user_id', userId)
        : supabase
            .from('saved_themes')
            .select('theme_id')
            .eq('user_id', userId),
      activeTab === 'create'
        ? getCachedCatalogPaintOptions()
        : Promise.resolve([]),
      activeTab === 'create'
        ? supabase
            .from('paints')
            .select('id, name, manufacturer, series, color_hex')
            .eq('user_id', userId)
            .order('name', { ascending: true })
        : Promise.resolve({ data: [] as Array<Record<string, unknown>> }),
    ])
  perf.mark('main Supabase query')

  const rawPublicThemeRows = (publicThemes ?? []) as ThemeSummary[]
  const rawMyThemeRows = (myThemesResult.data ?? []) as ThemeSummary[]
  const savedThemeRows = (savedRowsResult.data ?? []) as SavedThemeRow[]
  const rawSavedThemes = savedThemeRows
    .map((row) => firstValue(row.themes))
    .filter((theme): theme is ThemeSummary => Boolean(theme))

  const hydratedThemes = await hydrateMissingThemeSwatches(supabase, [
    ...rawPublicThemeRows,
    ...rawMyThemeRows,
    ...rawSavedThemes,
  ])
  perf.mark('theme swatch hydration')

  const hydratedThemeById = new Map(
    hydratedThemes.map((theme) => [theme.id, theme])
  )

  const publicThemeRows = rawPublicThemeRows.map(
    (theme) => hydratedThemeById.get(theme.id) ?? theme
  )
  const myThemeRows = rawMyThemeRows.map(
    (theme) => hydratedThemeById.get(theme.id) ?? theme
  )
  const savedThemes = rawSavedThemes.map(
    (theme) => hydratedThemeById.get(theme.id) ?? theme
  )

  const myAndSavedThemes = [
    ...myThemeRows,
    ...savedThemes.filter(
      (savedTheme) => !myThemeRows.some((theme) => theme.id === savedTheme.id)
    ),
  ]

  const paintOptions = [
    ...catalogPaints.map((paint) => ({
      id: paint.id,
      source: 'catalog' as const,
      name: paint.name || 'Unnamed paint',
      brand: paint.brand,
      line: paint.line,
      sku: paint.sku,
      swatch_image_url: paint.swatch_image_url,
      hex: paint.hex_approx,
    })),
    ...((customPaintsResult.data ?? []) as Array<{
      id: string
      name: string | null
      manufacturer: string | null
      series: string | null
      color_hex: string | null
    }>).map((paint) => ({
      id: paint.id,
      source: 'custom' as const,
      name: paint.name || 'Unnamed paint',
      brand: paint.manufacturer,
      line: paint.series,
      swatch_image_url: null,
      hex: paint.color_hex,
    })),
  ]
  perf.total()

  return (
    <ThemesPageClient
      activeTab={activeTab}
      currentUserId={userId}
      publicThemes={publicThemeRows}
      myAndSavedThemes={myAndSavedThemes}
      savedThemeIds={savedThemeRows.map((row) => row.theme_id)}
      paintOptions={paintOptions}
      initialSearch={initialSearch}
      selectForProject={selectForProject}
      attachThemeToProjectAction={attachThemeToProject}
    />
  )
}

export default async function ThemesPage({ searchParams }: Props) {
  const perf = createPerfTimer('/themes')
  const params = searchParams ? await searchParams : undefined
  const themeSearch = params?.q?.trim() || ''
  const selectForProject = params?.selectForProject || null
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  perf.mark('auth/session fetch')

  if (!user) redirect('/login')

  const requestedTab =
    params?.tab === 'mine' || params?.tab === 'create' || params?.tab === 'find'
      ? params.tab
      : null

  let activeTab: ThemesTab
  if (requestedTab) {
    activeTab = requestedTab
  } else {
    const [{ data: myTheme }, { data: savedTheme }] = await Promise.all([
      supabase
        .from('themes')
        .select('id')
        .eq('user_id', user.id)
        .limit(1)
        .maybeSingle(),
      supabase
        .from('saved_themes')
        .select('theme_id')
        .eq('user_id', user.id)
        .limit(1)
        .maybeSingle(),
    ])

    activeTab = myTheme || savedTheme ? 'mine' : 'find'
  }

  const profilePromise = (async () => ({
    data: await getDashboardProfile(user.id),
  }))()
  perf.total()

  return (
    <main className="min-h-screen bg-[#03070b] pb-24 text-white">
      <div className="mx-auto flex w-full max-w-md flex-col gap-5 px-4 pb-24 pt-5">
        <Suspense fallback={null}>
          <DashboardTopBar userId={user.id} profilePromise={profilePromise} />
        </Suspense>

        <div>
          <h1 className="text-3xl font-bold tracking-tight">Theme Library</h1>

          <p className="mt-2 text-sm font-medium text-neutral-200">
            Solve the hardest part: choosing the colors
          </p>
          <p className="mt-2 text-sm leading-6 text-white/60">
            Themes let you capture color palettes, reference images, and visual
            concepts in one place. Explore community schemes, create your own,
            and give every project a clear artistic direction before the first
            coat of paint.
          </p>
        </div>

        <ThemesContent
          userId={user.id}
          activeTab={activeTab}
          initialSearch={themeSearch}
          selectForProject={selectForProject}
        />
      </div>
    </main>
  )
}
