import { notFound } from 'next/navigation'
import { createClient } from '../../../utils/supabase/server'
import DashboardTopBar from '../../dashboard/dashboard-top-bar'
import ThemeDetailHero from './theme-detail-hero'
import ThemePaletteEditor from './theme-palette-editor'
import DeleteConfirmationCard from '../../components/delete-confirmation-card'
import { calculateThemePaletteAction, deleteTheme } from './actions'
import { getCachedPublicTheme } from '../../../lib/public-cache'
import { createPerfTimer } from '../../../utils/perf/server'

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

function safeImageUrl(value: string | null | undefined) {
  if (!value) return null

  const trimmed = value.trim()

  if (!trimmed) return null

  if (trimmed.startsWith('https://') || trimmed.startsWith('http://')) {
    return trimmed
  }

  return null
}

function firstRelation<T>(value: T | T[] | null | undefined) {
  return Array.isArray(value) ? value[0] ?? null : value ?? null
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

  const hydratedThemePaintRows = await getHydratedThemePaints(
    supabase,
    theme.id,
    (theme.theme_paints || []) as unknown as ThemePaint[]
  )
  perf.mark('secondary Supabase queries')

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
          description={theme.description}
          tags={theme.tags || []}
          heroUrl={heroUrl}
          isOwner={isOwner}
          isPublic={theme.is_public}
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

              <button
                type="submit"
                className="w-full rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-4 text-sm font-semibold text-white transition hover:bg-white/[0.1]"
              >
                Calculate Palette
              </button>
            </form>
          )}
        </section>

        <section className="px-4 pt-6">
          <button
            type="button"
            className="w-full rounded-2xl bg-cyan-500 px-4 py-4 text-sm font-bold text-slate-950 shadow-lg shadow-cyan-500/20 transition hover:bg-cyan-400"
          >
            Add to Project / Unit
          </button>
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

