export type RecipeImage = {
  id: string
  image_url: string
  is_featured: boolean | null
  alt_text: string | null
}

export type Paint = {
  id: string
  source: 'catalog' | 'custom'
  brand: string | null
  line: string | null
  name: string | null
  sku: string | null
  hex_approx: string | null
  swatch_image_url: string | null
  paint_type: string | null
  is_owned: boolean
}

export type StepPaintLink = {
  id: string
  recipe_step_id: string
  paint_order: number
  ratio_text: string | null
  paint_source: 'catalog' | 'custom' | null
  paint: {
    id: string
    brand: string | null
    line: string | null
    name: string | null
    hex_approx: string | null
    swatch_image_url: string | null
  } | null
}

export type RecipeStep = {
  id: string
  step_number: number
  title: string
  instructions: string
}

export type Recipe = {
  id: string
  name: string
  description: string | null
  inventory_required: string | null
  expert_tips: string | null
}