import { createClient } from '../../../utils/supabase/server'

type SocialState = {
  likeCount: number
  saveCount: number
  viewerHasLiked: boolean
  viewerHasSaved: boolean
  viewerHasReported: boolean
}

function countValue(count: number | null) {
  return count || 0
}

export async function getRecipeSocialState(
  supabase: Awaited<ReturnType<typeof createClient>>,
  recipeId: string,
  userId?: string | null
): Promise<SocialState> {
  const [
    { count: likeCount },
    { count: saveCount },
    likedResult,
    savedResult,
    reportedResult,
  ] = await Promise.all([
    supabase
      .from('recipe_likes')
      .select('recipe_id', { count: 'exact', head: true })
      .eq('recipe_id', recipeId),
    supabase
      .from('saved_recipes')
      .select('recipe_id', { count: 'exact', head: true })
      .eq('recipe_id', recipeId),
    userId
      ? supabase
          .from('recipe_likes')
          .select('recipe_id')
          .eq('recipe_id', recipeId)
          .eq('user_id', userId)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    userId
      ? supabase
          .from('saved_recipes')
          .select('recipe_id')
          .eq('recipe_id', recipeId)
          .eq('user_id', userId)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    userId
      ? supabase
          .from('recipe_reports')
          .select('recipe_id')
          .eq('recipe_id', recipeId)
          .eq('reporter_id', userId)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ])

  return {
    likeCount: countValue(likeCount),
    saveCount: countValue(saveCount),
    viewerHasLiked: Boolean(likedResult.data),
    viewerHasSaved: Boolean(savedResult.data),
    viewerHasReported: Boolean(reportedResult.data),
  }
}

export async function getThemeSocialState(
  supabase: Awaited<ReturnType<typeof createClient>>,
  themeId: string,
  userId?: string | null
): Promise<SocialState> {
  const [
    { count: likeCount },
    { count: saveCount },
    likedResult,
    savedResult,
    reportedResult,
  ] = await Promise.all([
    supabase
      .from('theme_likes')
      .select('theme_id', { count: 'exact', head: true })
      .eq('theme_id', themeId),
    supabase
      .from('saved_themes')
      .select('theme_id', { count: 'exact', head: true })
      .eq('theme_id', themeId),
    userId
      ? supabase
          .from('theme_likes')
          .select('theme_id')
          .eq('theme_id', themeId)
          .eq('user_id', userId)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    userId
      ? supabase
          .from('saved_themes')
          .select('theme_id')
          .eq('theme_id', themeId)
          .eq('user_id', userId)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    userId
      ? supabase
          .from('theme_reports')
          .select('theme_id')
          .eq('theme_id', themeId)
          .eq('reporter_id', userId)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ])

  return {
    likeCount: countValue(likeCount),
    saveCount: countValue(saveCount),
    viewerHasLiked: Boolean(likedResult.data),
    viewerHasSaved: Boolean(savedResult.data),
    viewerHasReported: Boolean(reportedResult.data),
  }
}
