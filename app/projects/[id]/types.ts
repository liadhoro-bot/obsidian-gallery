export type ProjectRow = {
  id: string
  name: string | null
  description: string | null
  theme?: ProjectTheme | null
}

export type ProjectThemePaint = {
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

export type ProjectTheme = {
  id: string
  name: string | null
  description: string | null
  theme_paints: ProjectThemePaint[]
}

export type ProjectImage = {
  id: string
  entity_id?: string | null
  image_url: string
  alt_text: string | null
  is_featured: boolean | null
  is_primary?: boolean | null
  sort_order?: number | null
  created_at?: string | null
}

export type ProjectUnit = {
  id: string
  name: string
  notes?: string | null
  model_count?: number | null
  is_featured?: boolean | null
  deadline?: string | null
  updated_at: string
}

export type UnitStage = {
  unit_id: string
  stage_key?: string | null
  step_key?: string | null
  is_done?: boolean | null
  status?: string | null
}

export type UnitImage = {
  entity_id: string
  image_url: string
  is_featured: boolean | null
}

export type SerializableError = {
  message?: string
  details?: string
  hint?: string
  code?: string
}
