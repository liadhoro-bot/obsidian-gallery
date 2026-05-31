import Image from 'next/image'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '../../../utils/supabase/server'
import DashboardTopBar from '../../dashboard/dashboard-top-bar'
import ThemeOwnerActions from './theme-owner-actions'
import ThemeVisibilityPill from './theme-visibility-pill'
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
  perf.total()

  const themePaints = ((theme.theme_paints || []) as unknown as ThemePaint[])
    .map((paint) => {
      const catalogPaint = Array.isArray(paint.catalog_paint)
        ? paint.catalog_paint[0] || null
        : paint.catalog_paint

      const customPaint = Array.isArray(paint.custom_paint)
        ? paint.custom_paint[0] || null
        : paint.custom_paint

      return {
        ...paint,
        catalog_paint: catalogPaint,
        custom_paint: customPaint,
      }
    })
    .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
    .slice(0, 5)

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

        <section className="relative mt-4">
          <div className="absolute left-4 top-4 z-20">
            <Link
              href="/themes"
              className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/40 px-3 py-2 text-sm font-medium text-white backdrop-blur transition hover:bg-black/60"
            >
              ← Back to Themes
            </Link>
          </div>

          <div className="relative h-[340px] overflow-hidden bg-white/[0.04]">
            {heroUrl ? (
              <Image
                src={heroUrl}
                alt={theme.name || 'Theme image'}
                fill
                priority
                sizes="(max-width: 768px) 100vw, 420px"
                className="object-cover"
              />
            ) : (
              <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/30 via-slate-900 to-black" />
            )}

            <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-black/20 to-[#07090d]" />
          </div>

          <div className="-mt-16 px-4">
            <div className="relative rounded-3xl border border-white/10 bg-[#10131a]/90 p-5 shadow-2xl backdrop-blur">
              <div className="mb-3 flex items-center gap-2">
                {isOwner ? (
                  <ThemeVisibilityPill
                    themeId={theme.id}
                    isPublic={theme.is_public}
                  />
                ) : (
                  <span className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-xs text-white/60">
                    {theme.is_public ? 'Public theme' : 'Private theme'}
                  </span>
                )}

                {isOwner && (
                  <span className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-xs text-cyan-200">
                    Owner
                  </span>
                )}
              </div>

              <h1 className="text-3xl font-bold tracking-tight">
                {theme.name}
              </h1>

              {theme.description && (
                <p className="mt-3 text-sm leading-6 text-white/65">
                  {theme.description}
                </p>
              )}

              {Array.isArray(theme.tags) && theme.tags.length > 0 && (
                <div className="mt-4 flex flex-wrap gap-2">
                  {theme.tags.map((tag: string) => (
                    <span
                      key={tag}
                      className="rounded-full bg-white/[0.06] px-3 py-1 text-xs text-white/55"
                    >
                      #{tag}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        </section>

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
          <ThemeOwnerActions
            themeId={theme.id}
            name={theme.name}
            description={theme.description}
            tags={theme.tags || []}
            isPublic={theme.is_public}
            slots={paletteEditorSlots}
            paintOptions={paintOptions}
          />
        )}

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

