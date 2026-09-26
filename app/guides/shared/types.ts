export type RecipeImage = {
  id: string
  image_url: string
  is_featured: boolean | null
  alt_text: string | null
  // CSS object-position percentages (0-100), so a cropped/cover-fit image
  // can be repositioned instead of always centering. 50/50 is dead center.
  focal_x?: number
  focal_y?: number
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
  is_owned?: boolean
  is_wishlist?: boolean
} | null
}

export type RecipeStep = {
  id: string
  step_number: number
  title: string
  instructions: string
  image_url: string | null
  // See RecipeImage.focal_x/focal_y.
  image_focal_x?: number
  image_focal_y?: number
}

export type Recipe = {
  id: string
  name: string
  description: string | null
  inventory_required: string | null
  expert_tips: string | null
  youtube_url: string | null
  is_public: boolean
}
