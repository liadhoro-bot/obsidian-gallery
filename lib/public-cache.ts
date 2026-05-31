import { unstable_cache } from 'next/cache'
import { supabase } from './supabase'

const ONE_DAY = 60 * 60 * 24
const TEN_MINUTES = 60 * 10

export const getCachedCatalogFilterRows = unstable_cache(
  async () => {
    const pageSize = 1000
    let from = 0
    let allRows: {
      brand: string | null
      line: string | null
    }[] = []

    while (true) {
      const { data, error } = await supabase
        .from('paint_catalog')
        .select('brand,line')
        .eq('is_active', true)
        .order('brand', { ascending: true })
        .order('line', { ascending: true })
        .range(from, from + pageSize - 1)

      if (error) throw error

      const rows = data || []
      allRows = [...allRows, ...rows]

      if (rows.length < pageSize) break

      from += pageSize
    }

    return allRows
  },
  ['paint-catalog-filter-rows'],
  {
    tags: ['paint-catalog'],
    revalidate: ONE_DAY,
  }
)

export const getCachedCatalogPaintOptions = unstable_cache(
  async () => {
    const { data, error } = await supabase
      .from('paint_catalog')
      .select('id, name, brand, line, sku, swatch_image_url, hex_approx, finish, paint_type')
      .eq('is_active', true)
      .order('brand', { ascending: true })
      .order('line', { ascending: true })
      .order('name', { ascending: true })

    if (error) throw error

    return data || []
  },
  ['paint-catalog-options'],
  {
    tags: ['paint-catalog'],
    revalidate: ONE_DAY,
  }
)

export function getCachedCatalogPaint(paintId: string) {
  return unstable_cache(
    async (id: string) => {
      const { data, error } = await supabase
        .from('paint_catalog')
        .select('id, name, brand, line, sku, swatch_image_url, hex_approx, finish, paint_type')
        .eq('id', id)
        .eq('is_active', true)
        .maybeSingle()

      if (error) throw error

      return data
    },
    ['paint-detail', paintId],
    {
      tags: ['paint-catalog', `paint:${paintId}`],
      revalidate: ONE_DAY,
    }
  )(paintId)
}

export const getCachedPublicRecipes = unstable_cache(
  async () => {
    const { data, error } = await supabase
      .from('recipes')
      .select('id, name, description, image_url, is_public, created_at, user_id')
      .eq('is_public', true)
      .order('created_at', { ascending: false })

    if (error) throw error

    return data || []
  },
  ['public-recipes-list'],
  {
    tags: ['public-recipes'],
    revalidate: TEN_MINUTES,
  }
)

export function getCachedPublicRecipe(recipeId: string) {
  return unstable_cache(
    async (id: string) => {
      const { data, error } = await supabase
        .from('recipes')
        .select('id, name, description, inventory_required, expert_tips, youtube_url, is_public, user_id')
        .eq('id', id)
        .eq('is_public', true)
        .maybeSingle()

      if (error) throw error

      return data
    },
    ['public-recipe-detail', recipeId],
    {
      tags: ['public-recipes', `recipe:${recipeId}`],
      revalidate: TEN_MINUTES,
    }
  )(recipeId)
}

export function getCachedPublicRecipeAssets(recipeId: string) {
  return unstable_cache(
    async (id: string) => {
      const [{ data: steps, error: stepsError }, { data: images, error: imagesError }] =
        await Promise.all([
          supabase
            .from('recipe_steps')
            .select('id, step_number, title, instructions, image_url')
            .eq('recipe_id', id)
            .order('step_number', { ascending: true }),
          supabase
            .from('image_assets')
            .select('id, image_url, is_featured, alt_text')
            .eq('entity_type', 'recipe')
            .eq('entity_id', id)
            .order('created_at', { ascending: false }),
        ])

      if (stepsError) throw stepsError
      if (imagesError) throw imagesError

      const stepIds = steps?.map((step) => step.id) || []

      const { data: stepPaintLinks, error: stepPaintLinksError } =
        stepIds.length > 0
          ? await supabase
              .from('recipe_step_paints')
              .select(`
                id,
                recipe_step_id,
                paint_order,
                ratio_text,
                paint_source,
                paint_catalog_id,
                custom_paint_id,
                catalog_paint:paint_catalog_id (
                  id,
                  brand,
                  line,
                  name,
                  hex_approx,
                  swatch_image_url
                ),
                custom_paint:custom_paint_id (
                  id,
                  name,
                  manufacturer,
                  series,
                  color_hex,
                  paint_type
                )
              `)
              .in('recipe_step_id', stepIds)
              .order('paint_order', { ascending: true })
          : { data: [], error: null }

      if (stepPaintLinksError) throw stepPaintLinksError

      return {
        steps: steps || [],
        images: images || [],
        stepPaintLinks: stepPaintLinks || [],
      }
    },
    ['public-recipe-assets', recipeId],
    {
      tags: ['public-recipes', `recipe:${recipeId}`],
      revalidate: TEN_MINUTES,
    }
  )(recipeId)
}

export const getCachedPublicThemes = unstable_cache(
  async () => {
    const { data, error } = await supabase
      .from('themes')
      .select(`
        id,
        user_id,
        name,
        description,
        image_url,
        is_public,
        created_at,
        theme_paints (
          id,
          sort_order,
          paint_source,
          catalog_paint:paint_catalog!theme_paints_paint_catalog_id_fkey (
            id,
            swatch_image_url,
            hex_approx
          ),
          custom_paint:paints!theme_paints_custom_paint_id_fkey (
            id,
            color_hex
          )
        )
      `)
      .eq('is_public', true)
      .order('created_at', { ascending: false })

    if (error) throw error

    return data || []
  },
  ['public-themes-list'],
  {
    tags: ['public-themes'],
    revalidate: TEN_MINUTES,
  }
)

export function getCachedPublicTheme(themeId: string) {
  return unstable_cache(
    async (id: string) => {
      const { data, error } = await supabase
        .from('themes')
        .select(`
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
        `)
        .eq('id', id)
        .eq('is_public', true)
        .maybeSingle()

      if (error) throw error

      return data
    },
    ['public-theme-detail', themeId],
    {
      tags: ['public-themes', `theme:${themeId}`],
      revalidate: TEN_MINUTES,
    }
  )(themeId)
}
