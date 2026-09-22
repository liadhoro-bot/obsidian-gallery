import type { SupabaseClient } from '@supabase/supabase-js'

export type RecipeStepRow = {
  id: string
  step_number: number | null
  title: string | null
  card_template: string | null
  instructions: string | null
  image_url: string | null
  youtube_url: string | null
}

// Keep compatibility with older schemas without retrying unrelated errors or
// dropping an optional field that the database actually supports.
export async function loadRecipeSteps(supabase: SupabaseClient, deckId: string) {
  const optionalColumns = new Set(['card_template', 'youtube_url'])
  for (;;) {
    const result = await supabase
      .from('recipe_steps')
      .select(['id', 'step_number', 'title', 'instructions', 'image_url', ...optionalColumns].join(', '))
      .eq('recipe_id', deckId)
      .order('step_number', { ascending: true })

    const missingColumn = [...optionalColumns].find((column) =>
      result.error?.message.includes(column) &&
      (result.error.code === '42703' || result.error.code === 'PGRST204' ||
        result.error.message.includes('does not exist') ||
        result.error.message.includes('schema cache'))
    )
    if (missingColumn) {
      optionalColumns.delete(missingColumn)
      continue
    }
    return {
      error: result.error,
      data: result.data?.map((step) => {
        const row = step as unknown as RecipeStepRow
        return { ...row, card_template: row.card_template ?? null, youtube_url: row.youtube_url ?? null }
      }) ?? null,
    }
  }
}
