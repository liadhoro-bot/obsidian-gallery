import Link from 'next/link'
import ProjectPaletteStarter from './project-palette-starter'
import { calculateProjectPaletteAction } from './actions'

type ThemePaint = {
  id: string
  sort_order: number | null
  paint_source: string | null
  catalog_paint?: {
    name: string | null
    hex_approx: string | null
    swatch_image_url: string | null
  } | null
  custom_paint?: {
    name: string | null
    color_hex: string | null
  } | null
}

type Theme = {
  id: string
  name: string | null
  description: string | null
  theme_paints: ThemePaint[]
} | null

type Props = {
  theme: Theme
  projectId: string
}

export default function ProjectPaletteCard({ theme, projectId }: Props) {
  const swatches =
    theme?.theme_paints
      ?.slice()
      .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
      .slice(0, 5) ?? []

  if (!theme) {
    return (
      <section className="rounded-2xl border border-neutral-800 bg-gradient-to-br from-neutral-900 to-neutral-950 p-5 shadow-sm">
        <p className="text-sm uppercase tracking-wider text-cyan-400">
          Project Palette
        </p>

        <h2 className="mt-1 text-xl font-semibold">No theme selected</h2>

        <p className="mt-2 text-sm text-neutral-400">
          Define the visual identity of this project.
        </p>

        <div className="mt-4">
          <ProjectPaletteStarter projectId={projectId} />
        </div>

        <div className="mt-4 flex gap-2">
  <Link
    href={`/themes?tab=mine&selectForProject=${projectId}`}
    className="inline-flex rounded-xl bg-cyan-400 px-4 py-2 text-sm font-semibold text-neutral-950 transition active:scale-95"
  >
    Choose Theme
  </Link>

  <form action={calculateProjectPaletteAction}>
    <input type="hidden" name="projectId" value={projectId} />

    <button
      type="submit"
      className="inline-flex rounded-xl border border-cyan-400/30 bg-cyan-400/10 px-4 py-2 text-sm font-semibold text-cyan-300 transition active:scale-95"
    >
      Magic Palette
    </button>
  </form>
</div>
      </section>
    )
  }

  return (
    <section className="rounded-2xl border border-neutral-800 bg-gradient-to-br from-neutral-900 to-neutral-950 p-5 shadow-sm">
      <p className="text-sm uppercase tracking-wider text-cyan-400">
        Project Palette
      </p>

      <h2 className="mt-1 text-xl font-semibold">
        {theme.name || 'Untitled Theme'}
      </h2>

      <p className="mt-2 text-sm text-neutral-400">
        {theme.description || 'No description'}
      </p>

      <div className="mt-4 grid grid-cols-5 gap-2">
        {Array.from({ length: 5 }).map((_, index) => {
          const paint = swatches[index]

          if (!paint) {
            return (
              <ProjectPaletteStarter
                key={`empty-${index}`}
                projectId={projectId}
                slotIndex={index}
              />
            )
          }

          const displayName =
            paint.paint_source === 'custom'
              ? paint.custom_paint?.name
              : paint.catalog_paint?.name

          const displayHex =
            paint.paint_source === 'custom'
              ? paint.custom_paint?.color_hex
              : paint.catalog_paint?.hex_approx

          const imageUrl =
            paint.paint_source === 'custom'
              ? null
              : paint.catalog_paint?.swatch_image_url

          return (
            <div key={paint.id} className="min-w-0">
              {imageUrl ? (
                <img
                  src={imageUrl}
                  alt={displayName || 'Color swatch'}
                  className="aspect-square w-full rounded-xl border border-white/10 object-cover shadow-inner"
                />
              ) : (
                <div
                  className="aspect-square rounded-xl border border-white/10 shadow-inner"
                  style={{ backgroundColor: displayHex || '#262626' }}
                />
              )}

              <p className="mt-1 truncate text-center text-[10px] font-semibold text-white/60">
                {displayName || 'Color'}
              </p>
            </div>
          )
        })}
      </div>

      <Link
        href={`/themes/${theme.id}`}
        className="mt-4 inline-flex text-xs font-semibold text-cyan-300"
      >
        Open full theme →
      </Link>
    </section>
  )
}