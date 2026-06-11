import { redirect } from 'next/navigation'
import { createClient } from '../../utils/supabase/server'
import ThemeTabsClient from './theme-tabs-client'
import ThemeCard from './theme-card'
import ThemeForm from './theme-form'
import DashboardTopBar from '../dashboard/dashboard-top-bar'
import {
  getCachedCatalogPaintOptions,
  getCachedPublicThemes,
} from '../../lib/public-cache'
import { createPerfTimer } from '../../utils/perf/server'

type Props = {
  searchParams: Promise<{
    tab?: string
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
  theme_paints?: ThemePaintSummary[] | null
}

type SavedThemeRow = {
  theme_id: string
  themes: ThemeSummary | ThemeSummary[] | null
}

function firstValue<T>(value: T | T[] | null) {
  return Array.isArray(value) ? value[0] ?? null : value
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
    .select(`
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
    `)
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

  return themes.map((theme) => {
    const themePaints = paintsByThemeId.get(theme.id)

    return themePaints
      ? {
          ...theme,
          theme_paints: themePaints,
        }
      : theme
  })
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
export default async function ThemesPage({ searchParams }: Props) {
  const perf = createPerfTimer('/themes')
  const params = await searchParams
  const tab = params.tab || 'find'
  const selectForProject = params.selectForProject || null
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  perf.mark('auth/session fetch')

  if (!user) redirect('/login')

  const [
    publicThemes,
    { data: myThemes },
    { data: savedRows },
    catalogPaints,
    { data: customPaints },
  ] =
    await Promise.all([
      getCachedPublicThemes(),

      supabase
        .from('themes')
        .select(`
  id,
  user_id,
  name,
  description,
  image_url,
  is_public,
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
`)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false }),

      supabase
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
        .eq('user_id', user.id),

      getCachedCatalogPaintOptions(),

      supabase
        .from('paints')
        .select('id, name, manufacturer, series, color_hex')
        .eq('user_id', user.id)
        .order('name', { ascending: true }),
    ])
  perf.mark('main Supabase query')

  const rawPublicThemeRows = (publicThemes ?? []) as ThemeSummary[]
  const rawMyThemeRows = (myThemes ?? []) as ThemeSummary[]
  const savedThemeRows = (savedRows ?? []) as SavedThemeRow[]

  const rawSavedThemes = savedThemeRows
    .map((row) => firstValue(row.themes))
    .filter((theme): theme is ThemeSummary => Boolean(theme))

  const hydratedThemes = await hydrateMissingThemeSwatches(
    supabase,
    [...rawPublicThemeRows, ...rawMyThemeRows, ...rawSavedThemes]
  )
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

  const savedThemeIds = savedThemeRows.map((row) => row.theme_id)

  const myAndSavedThemes = [
    ...myThemeRows,
    ...savedThemes.filter(
      (savedTheme) => !myThemeRows.some((theme) => theme.id === savedTheme.id)
    ),
  ]

  const paintOptions = [
    ...(catalogPaints || []).map((paint) => ({
      id: paint.id,
      source: 'catalog' as const,
      name: paint.name || 'Unnamed paint',
      brand: paint.brand,
      line: paint.line,
      sku: paint.sku,
      swatch_image_url: paint.swatch_image_url,
      hex: paint.hex_approx,
    })),
    ...(customPaints || []).map((paint) => ({
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
    <main className="min-h-screen bg-[#03070b] pb-24 text-white">
      <div className="mx-auto flex w-full max-w-md flex-col gap-5 px-4 pb-24 pt-5">
        <DashboardTopBar userId={user.id} />

        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            Theme Library
          </h1>

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

        <ThemeTabsClient />

        {tab === 'find' && (
          <div className="grid grid-cols-2 gap-3">
            {(publicThemes ?? []).length > 0 ? (
              publicThemeRows.map((theme) => (
                <ThemeCard
                  key={theme.id}
                  theme={theme}
                  currentUserId={user.id}
                  isSaved={savedThemeIds.includes(theme.id)}
                  selectForProject={selectForProject}
                  attachThemeToProjectAction={attachThemeToProject}
                />
              ))
            ) : (
              <div className="col-span-2 rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm text-white/60">
                No public themes yet.
              </div>
            )}
          </div>
        )}

        {tab === 'mine' && (
          <div className="grid grid-cols-2 gap-3">
            {myAndSavedThemes.length > 0 ? (
              myAndSavedThemes.map((theme) => (
                <ThemeCard
                  key={theme.id}
                  theme={theme}
                  currentUserId={user.id}
                  isSaved={savedThemeIds.includes(theme.id)}
                  selectForProject={selectForProject}
                  attachThemeToProjectAction={attachThemeToProject}
                />
              ))
            ) : (
              <div className="col-span-2 rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm text-white/60">
                You have not created or saved any themes yet.
              </div>
            )}
          </div>
        )}

        {tab === 'create' && <ThemeForm paints={paintOptions} />}
      </div>
    </main>
  )
}

