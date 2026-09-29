import PaletteCard, { type PaletteCardPaint } from './palette-card'
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

function toPalettePaint(paint: ThemePaint): PaletteCardPaint | null {
  if (paint.paint_source === 'custom') {
    const id = paint.custom_paint_id || paint.custom_paint?.id
    if (!id) return null

    return {
      themePaintId: paint.id,
      id,
      source: 'custom',
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
    themePaintId: paint.id,
    id,
    source: 'catalog',
    name: paint.catalog_paint?.name || 'Catalog paint',
    brand: paint.catalog_paint?.brand || null,
    line: paint.catalog_paint?.line || null,
    swatch_image_url: paint.catalog_paint?.swatch_image_url || null,
    hex: paint.catalog_paint?.hex_approx || null,
  }
}

export default function ProjectPaletteCard({ theme, projectId, unitId }: Props) {
  const paints =
    theme?.theme_paints
      ?.slice()
      .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
      .map(toPalettePaint)
      .filter((paint): paint is PaletteCardPaint => Boolean(paint)) ?? []

  return (
    <PaletteCard
      projectId={projectId}
      unitId={unitId}
      paints={paints}
      className={styles.panel}
    />
  )
}
