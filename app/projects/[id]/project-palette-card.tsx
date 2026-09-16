import SubmitButton from '../../components/SubmitButton'
import ProjectPaletteStarter from './project-palette-starter'
import { calculateProjectPaletteAction } from './actions'
import { calculateUnitPaletteAction } from '../../units/[id]/actions'
import styles from './project-detail-silver.module.css'

type ThemePaint = {
  id: string
  sort_order: number | null
  paint_source: string | null
  paint_catalog_id?: string | null
  custom_paint_id?: string | null
  catalog_paint?: {
    id?: string | null
    name: string | null
    brand?: string | null
    line?: string | null
    hex_approx: string | null
    swatch_image_url: string | null
  } | null
  custom_paint?: {
    id?: string | null
    name: string | null
    manufacturer?: string | null
    series?: string | null
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

function toInitialPaint(paint: ThemePaint | undefined) {
  if (!paint) return null

  if (paint.paint_source === 'custom') {
    const id = paint.custom_paint_id || paint.custom_paint?.id
    if (!id) return null

    return {
      id,
      source: 'custom' as const,
      name: paint.custom_paint?.name || 'Custom paint',
      brand: paint.custom_paint?.manufacturer || 'Custom',
      line: paint.custom_paint?.series || 'Custom Paint',
      swatch_image_url: null,
      hex: paint.custom_paint?.color_hex || null,
    }
  }

  const id = paint.paint_catalog_id || paint.catalog_paint?.id
  if (!id) return null

  return {
    id,
    source: 'catalog' as const,
    name: paint.catalog_paint?.name || 'Catalog paint',
    brand: paint.catalog_paint?.brand || null,
    line: paint.catalog_paint?.line || null,
    swatch_image_url: paint.catalog_paint?.swatch_image_url || null,
    hex: paint.catalog_paint?.hex_approx || null,
  }
}

export default function ProjectPaletteCard({ theme, projectId, unitId }: Props) {
  const paletteLabel = 'Palette'
  const paints =
    theme?.theme_paints
      ?.slice()
      .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
      .slice(0, 5) ?? []

  if (!theme) {
    return (
      <section className={styles.panel}>
        <div className="flex items-center justify-between gap-3">
          <p className={styles.eyebrow}>{paletteLabel}</p>
          <span className="text-[9px] font-black uppercase tracking-[0.16em] text-[color:var(--og-text-muted)]">
            Assign paints
          </span>
        </div>

        <p className="mt-2 text-sm">
          Add paints or generate a palette for this {unitId ? 'unit' : 'project'}.
        </p>

        <div className="mt-4">
          <ProjectPaletteStarter projectId={projectId} unitId={unitId} />
        </div>

        <div className="mt-4 flex gap-2">
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
      <div className="flex items-center justify-between gap-3">
        <p className={styles.eyebrow}>{paletteLabel}</p>
        <span className="text-[9px] font-black uppercase tracking-[0.16em] text-[color:var(--og-text-muted)]">
          Assign paints
        </span>
      </div>

      <p className="mt-2 text-sm">
        {displayDescription(theme.description) || 'No description'}
      </p>

      <div className="mt-4 grid grid-cols-5 gap-2">
        {Array.from({ length: 5 }).map((_, index) => {
          const paint = toInitialPaint(paints[index])
          return (
            <ProjectPaletteStarter
              key={`palette-slot-${index}`}
              projectId={projectId}
              unitId={unitId}
              slotIndex={index}
              initialPaint={paint}
            />
          )
        })}
      </div>

      {paints.length ? (
        <div className="mt-3 grid grid-cols-5 gap-2">
          {paints.map((paint, index) => {
            const displayPaint = toInitialPaint(paint)
            return (
              <div key={paint.id || `paint-${index}`} className="min-w-0">
                <p className="truncate text-center text-[8px] font-black uppercase tracking-[0.12em] text-[color:var(--og-brass-700)]">
                  {displayPaint?.brand || displayPaint?.line || 'Paint'}
                </p>
                <p className="mt-0.5 truncate text-center text-[9px] font-black text-[color:var(--og-text-primary)]">
                  {displayPaint?.name || 'Paint'}
                </p>
              </div>
            )
          })}
        </div>
      ) : null}
    </section>
  )
}
