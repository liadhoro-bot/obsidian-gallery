import Image from 'next/image'
import { saveTheme, unsaveTheme } from './actions'
import PrefetchLink from '../components/prefetch-link'

type ThemePaint = {
  id: string
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

type Theme = {
  id: string
  user_id: string | null
  name: string
  description: string | null
  image_url: string | null
  hero_image_url?: string | null
  is_public: boolean | null
  theme_paints?: ThemePaint[] | null
}

type Props = {
  theme: Theme
  currentUserId: string
  isSaved?: boolean
  selectForProject?: string | null
  attachThemeToProjectAction?: (formData: FormData) => Promise<void>
}

function safeImageUrl(value: string | null | undefined) {
  if (!value) return null

  const trimmed = value.trim()

  if (!trimmed) return null

  return trimmed.startsWith('https://') || trimmed.startsWith('http://')
    ? trimmed
    : null
}

function firstRelation<T>(value: T | T[] | null | undefined) {
  return Array.isArray(value) ? value[0] ?? null : value ?? null
}

export default function ThemeCard({
  theme,
  currentUserId,
  isSaved = false,
  selectForProject = null,
  attachThemeToProjectAction,
}: Props) {
  const isOwner = theme.user_id === currentUserId
  const isSelectingForProject = Boolean(selectForProject)

  const heroUrl = safeImageUrl(theme.image_url || theme.hero_image_url)

  const swatches = (theme.theme_paints || [])
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
        id: paint.id,
        sort_order: paint.sort_order || 0,
        imageUrl: safeImageUrl(catalogPaint?.swatch_image_url),
        hex: catalogPaint?.hex_approx || customPaint?.color_hex || null,
      }
    })
    .sort((a, b) => a.sort_order - b.sort_order)
    .slice(0, 5)

  const imageBlock = (
    <div className="relative aspect-square overflow-hidden bg-gradient-to-br from-cyan-500/25 via-slate-900 to-black">
      {heroUrl ? (
        <Image
          src={heroUrl}
          alt={theme.name || 'Theme image'}
          fill
          sizes="(max-width: 768px) 50vw, 240px"
          className="object-cover"
        />
      ) : null}

      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-black/5 to-black/55" />

      <div className="absolute right-2 top-2 z-10 flex flex-col gap-1 rounded-full border border-white/10 bg-black/35 p-1 backdrop-blur">
        {Array.from({ length: 5 }).map((_, index) => {
          const swatch = swatches[index]

          return (
            <div
              key={swatch?.id || index}
              className="relative h-6 w-6 overflow-hidden rounded-md border border-white/20 bg-white/10 shadow-sm"
            >
              {swatch?.imageUrl ? (
                <Image
                  src={swatch.imageUrl}
                  alt="Theme swatch"
                  fill
                  sizes="24px"
                  className="object-cover"
                />
              ) : swatch?.hex ? (
                <div
                  className="h-full w-full"
                  style={{ backgroundColor: swatch.hex }}
                />
              ) : null}
            </div>
          )
        })}
      </div>

      <div className="absolute bottom-2 left-2 right-9">
        <h3 className="line-clamp-2 text-sm font-bold leading-tight text-white">
          {theme.name}
        </h3>
      </div>
    </div>
  )

  return (
    <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.035] shadow-lg">
      {isSelectingForProject ? (
        imageBlock
      ) : (
        <PrefetchLink href={`/themes/${theme.id}`} viewportPrefetch>
          {imageBlock}
        </PrefetchLink>
      )}

      <div className="space-y-2 p-3">
        <div className="flex flex-wrap gap-1.5">
          <span className="rounded-full border border-white/10 bg-white/[0.05] px-2 py-0.5 text-[10px] text-white/55">
            {theme.is_public ? 'Public' : 'Private'}
          </span>

          {isOwner && (
            <span className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-2 py-0.5 text-[10px] text-cyan-200">
              Owner
            </span>
          )}

          {!isOwner && isSaved && (
            <span className="rounded-full border border-white/10 bg-white/[0.05] px-2 py-0.5 text-[10px] text-white/55">
              Saved
            </span>
          )}
        </div>

        {isSelectingForProject && attachThemeToProjectAction ? (
          <form action={attachThemeToProjectAction}>
            <input type="hidden" name="projectId" value={selectForProject ?? ''} />
            <input type="hidden" name="themeId" value={theme.id} />

            <button
              type="submit"
              className="w-full rounded-xl bg-cyan-400 px-3 py-2 text-xs font-semibold text-neutral-950 transition active:scale-95"
            >
              Use For Project
            </button>
          </form>
        ) : !isOwner ? (
          <form action={isSaved ? unsaveTheme : saveTheme}>
            <input type="hidden" name="themeId" value={theme.id} />

            <button
              type="submit"
              className="w-full rounded-xl border border-cyan-400/40 bg-cyan-400/10 px-3 py-2 text-xs font-semibold text-cyan-300 transition hover:bg-cyan-400/20"
            >
              {isSaved ? 'Saved' : 'Save'}
            </button>
          </form>
        ) : (
          <button
            type="button"
            className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-semibold text-white/65"
          >
            Your Theme
          </button>
        )}
      </div>
    </div>
  )
}
