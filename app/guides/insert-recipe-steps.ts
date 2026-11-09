import type { SupabaseClient } from '@supabase/supabase-js'

export type RecipeStepInsert = {
  recipe_id: string
  user_id: string
  step_number: number
  title: string
  card_template?: string | null
  instructions: string
  image_url: string | null
  youtube_url?: string | null
  image_focal_x: number
  image_focal_y: number
  subtitle?: string | null
  workflow_step?: boolean | null
}

// Only these legacy columns have equivalent data in OG_DECK_CARD_META.
// Omit exactly the column the database rejects; never reconstruct the row
// from an allowlist that can silently discard newer supported fields.
export async function insertRecipeSteps(supabase: SupabaseClient, steps: RecipeStepInsert[]) {
  const rows = steps.map(step => ({ ...step }))
  // workflow_step (the Workflow step switch) has no fallback; dropping it
  // only loses the creator's override until its migration is applied.
  const optionalColumns = new Set<'card_template' | 'youtube_url' | 'workflow_step'>(['card_template', 'youtube_url', 'workflow_step'])
  for (;;) {
    const result = await supabase.from('recipe_steps').insert(rows).select('id, step_number')
    const error = result.error
    const missing = [...optionalColumns].find(column =>
      error?.message.includes(column) &&
      (error.code === '42703' || error.code === 'PGRST204')
    )
    if (!missing) return result
    optionalColumns.delete(missing)
    for (const row of rows) delete row[missing]
  }
}
