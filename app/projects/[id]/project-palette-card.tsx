import Image from 'next/image'
import Link from 'next/link'
import SubmitButton from '../../components/SubmitButton'
import ProjectPaletteStarter from './project-palette-starter'
import { calculateProjectPaletteAction } from './actions'
import { calculateUnitPaletteAction } from '../../units/[id]/actions'
import ThemeUnassignButton from './theme-unassign-button'
import styles from './project-detail-silver.module.css'

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
  unitId?: string
}

function displayDescription(description: string | null | undefined) {
  return description?.replace(/\n\n\[unit:[^\]]+\]/g, '').trim()
}

export default function ProjectPaletteCard({ theme, projectId, unitId }: Props) {
  const paletteLabel = unitId ? 'Unit Palette' : 'Project Palette'
  const swatches =
    theme?.theme_paints
      ?.slice()
      .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
      .slice(0, 5) ?? []

  if (!theme) {
    return (
      <section className={styles.panel}>
        <p className={styles.eyebrow}>
          {paletteLabel}
        </p>

        <h2 className="mt-1 text-xl">No theme selected</h2>

        <p className="mt-2 text-sm">
          Define the visual identity of this {unitId ? 'unit' : 'project'}.
        </p>

        <div className="mt-4">
          <ProjectPaletteStarter projectId={projectId} unitId={unitId} />
        </div>

        <div className="mt-4 flex gap-2">
  {projectId ? (
    <Link
      href={`/themes?tab=mine&selectForProject=${projectId}`}
      className={`${styles.primaryButton} inline-flex px-4 py-2 text-sm font-bold transition active:scale-95`}
    >
      Choose Theme
    </Link>
  ) : null}

  <form action={unitId ? calculateUnitPaletteAction : calculateProjectPaletteAction}>
    {unitId ? (
      <input type="hidden" name="unitId" value={unitId} />
    ) : (
      <input type="hidden" name="projectId" value={projectId} />
    )}

    <SubmitButton
      idleText="Magic Palette"
      pendingText="Calculating..."
      className={`${styles.secondaryAction} inline-flex px-4 py-2 text-sm font-bold transition active:scale-95`}
    />
  </form>
</div>
      </section>
    )
  }

  return (
    <section className={styles.panel}>
      <div className="flex items-start justify-between gap-3">
        <p className={styles.eyebrow}>
          {paletteLabel}
        </p>

        <ThemeUnassignButton
          projectId={projectId}
          unitId={unitId}
          themeId={theme.id}
        />
      </div>

      <h2 className="mt-1 text-xl">
        {theme.name || 'Untitled Theme'}
      </h2>

      <p className="mt-2 text-sm">
        {displayDescription(theme.description) || 'No description'}
      </p>

      <div className={styles.paletteGrid}>
        {Array.from({ length: 5 }).map((_, index) => {
          const paint = swatches[index]

          if (!paint) {
            return (
              <ProjectPaletteStarter
                key={`empty-${index}`}
                projectId={projectId}
                unitId={unitId}
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
                <Image
                  src={imageUrl}
                  alt={displayName || 'Color swatch'}
                  width={96}
                  height={96}
                  sizes="64px"
                  className={`${styles.swatch} w-full object-cover`}
                />
              ) : (
                <div
                  className={styles.swatch}
                  style={{ backgroundColor: displayHex || '#262626' }}
                />
              )}

              <p className="mt-1 truncate text-center text-[10px] font-semibold text-[color:var(--og-text-secondary)]">
                {displayName || 'Color'}
              </p>
            </div>
          )
        })}
      </div>

      <Link
        href={`/themes/${theme.id}`}
        className="mt-4 inline-flex text-xs font-semibold text-[color:var(--og-brass-500)]"
      >
        Open full theme →
      </Link>
    </section>
  )
}
