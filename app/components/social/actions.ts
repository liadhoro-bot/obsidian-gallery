'use server'

import { revalidatePath, revalidateTag } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '../../../utils/supabase/server'
import { captureServerEvent } from '../../../utils/analytics/server'
import { sendReportNotification } from './report-email'
import { createPerfTimer } from '../../../utils/perf/server'

type ToggleResult = {
  active: boolean
}

type ReportResult = {
  status: 'reported' | 'duplicate'
  message: string
}

function normalizeReason(reason?: string) {
  const trimmed = reason?.trim() || ''
  return trimmed ? trimmed.slice(0, 1000) : null
}

function isDuplicateError(error: { code?: string } | null) {
  return error?.code === '23505'
}

async function requireUser() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  return { supabase, user }
}

export async function toggleRecipeLike(recipeId: string): Promise<ToggleResult> {
  const { supabase, user } = await requireUser()

  const { data: existing } = await supabase
    .from('recipe_likes')
    .select('recipe_id')
    .eq('recipe_id', recipeId)
    .eq('user_id', user.id)
    .maybeSingle()

  const { data: recipe } = await supabase
    .from('recipes')
    .select('id, name, user_id')
    .eq('id', recipeId)
    .maybeSingle()

  if (existing) {
    const { error } = await supabase
      .from('recipe_likes')
      .delete()
      .eq('recipe_id', recipeId)
      .eq('user_id', user.id)

    if (error) throw error

    await captureServerEvent({
      distinctId: user.id,
      event: 'recipe_unliked',
      properties: {
        recipe_id: recipeId,
        recipe_name: recipe?.name || null,
        creator_id: recipe?.user_id || null,
      },
    })

    revalidatePath(`/recipes/${recipeId}`)
    revalidateTag(`recipe:${recipeId}`, 'max')
    return { active: false }
  }

  const { error } = await supabase.from('recipe_likes').insert({
    user_id: user.id,
    recipe_id: recipeId,
  })

  if (error && !isDuplicateError(error)) throw error

  await captureServerEvent({
    distinctId: user.id,
    event: 'recipe_liked',
    properties: {
      recipe_id: recipeId,
      recipe_name: recipe?.name || null,
      creator_id: recipe?.user_id || null,
    },
  })

  revalidatePath(`/recipes/${recipeId}`)
  revalidateTag(`recipe:${recipeId}`, 'max')
  return { active: true }
}

export async function toggleThemeLike(themeId: string): Promise<ToggleResult> {
  const { supabase, user } = await requireUser()

  const { data: existing } = await supabase
    .from('theme_likes')
    .select('theme_id')
    .eq('theme_id', themeId)
    .eq('user_id', user.id)
    .maybeSingle()

  const { data: theme } = await supabase
    .from('themes')
    .select('id, name, user_id')
    .eq('id', themeId)
    .maybeSingle()

  if (existing) {
    const { error } = await supabase
      .from('theme_likes')
      .delete()
      .eq('theme_id', themeId)
      .eq('user_id', user.id)

    if (error) throw error

    await captureServerEvent({
      distinctId: user.id,
      event: 'theme_unliked',
      properties: {
        theme_id: themeId,
        theme_name: theme?.name || null,
        creator_id: theme?.user_id || null,
      },
    })

    revalidatePath(`/themes/${themeId}`)
    revalidateTag(`theme:${themeId}`, 'max')
    return { active: false }
  }

  const { error } = await supabase.from('theme_likes').insert({
    user_id: user.id,
    theme_id: themeId,
  })

  if (error && !isDuplicateError(error)) throw error

  await captureServerEvent({
    distinctId: user.id,
    event: 'theme_liked',
    properties: {
      theme_id: themeId,
      theme_name: theme?.name || null,
      creator_id: theme?.user_id || null,
    },
  })

  revalidatePath(`/themes/${themeId}`)
  revalidateTag(`theme:${themeId}`, 'max')
  return { active: true }
}

export async function toggleRecipeSave(recipeId: string): Promise<ToggleResult> {
  const perf = createPerfTimer('action:toggleRecipeSave')
  const { supabase, user } = await requireUser()
  perf.mark('auth/session fetch')

  const { data: existing } = await supabase
    .from('saved_recipes')
    .select('recipe_id')
    .eq('recipe_id', recipeId)
    .eq('user_id', user.id)
    .maybeSingle()

  const { data: recipe } = await supabase
    .from('recipes')
    .select('id, name, user_id')
    .eq('id', recipeId)
    .maybeSingle()
  perf.mark('existing save and recipe fetch')

  if (existing) {
    const { error } = await supabase
      .from('saved_recipes')
      .delete()
      .eq('recipe_id', recipeId)
      .eq('user_id', user.id)

    if (error) throw error
    perf.mark('Supabase mutation')

    await captureServerEvent({
      distinctId: user.id,
      event: 'recipe_unsaved',
      properties: {
        recipe_id: recipeId,
        recipe_name: recipe?.name || null,
        creator_id: recipe?.user_id || null,
      },
    })
    perf.mark('analytics event')

    revalidatePath('/recipes')
    revalidatePath(`/recipes/${recipeId}`)
    perf.mark('revalidation duration')
    perf.total()
    return { active: false }
  }

  const { error } = await supabase.from('saved_recipes').insert({
    user_id: user.id,
    recipe_id: recipeId,
  })

  if (error && !isDuplicateError(error)) throw error
  perf.mark('Supabase mutation')

  await captureServerEvent({
    distinctId: user.id,
    event: 'recipe_saved',
    properties: {
      recipe_id: recipeId,
      recipe_name: recipe?.name || null,
      creator_id: recipe?.user_id || null,
    },
  })
  perf.mark('analytics event')

  revalidatePath('/recipes')
  revalidatePath(`/recipes/${recipeId}`)
  perf.mark('revalidation duration')
  perf.total()
  return { active: true }
}

export async function toggleThemeSave(themeId: string): Promise<ToggleResult> {
  const perf = createPerfTimer('action:toggleThemeSave')
  const { supabase, user } = await requireUser()
  perf.mark('auth/session fetch')

  const { data: existing } = await supabase
    .from('saved_themes')
    .select('theme_id')
    .eq('theme_id', themeId)
    .eq('user_id', user.id)
    .maybeSingle()

  const { data: theme } = await supabase
    .from('themes')
    .select('id, name, user_id')
    .eq('id', themeId)
    .maybeSingle()
  perf.mark('existing save and theme fetch')

  if (existing) {
    const { error } = await supabase
      .from('saved_themes')
      .delete()
      .eq('theme_id', themeId)
      .eq('user_id', user.id)

    if (error) throw error
    perf.mark('Supabase mutation')

    await captureServerEvent({
      distinctId: user.id,
      event: 'theme_unsaved',
      properties: {
        theme_id: themeId,
        theme_name: theme?.name || null,
        creator_id: theme?.user_id || null,
      },
    })
    perf.mark('analytics event')

    revalidatePath('/themes')
    revalidatePath(`/themes/${themeId}`)
    perf.mark('revalidation duration')
    perf.total()
    return { active: false }
  }

  const { error } = await supabase.from('saved_themes').insert({
    user_id: user.id,
    theme_id: themeId,
  })

  if (error && !isDuplicateError(error)) throw error
  perf.mark('Supabase mutation')

  await captureServerEvent({
    distinctId: user.id,
    event: 'theme_saved',
    properties: {
      theme_id: themeId,
      theme_name: theme?.name || null,
      creator_id: theme?.user_id || null,
    },
  })
  perf.mark('analytics event')

  revalidatePath('/themes')
  revalidatePath(`/themes/${themeId}`)
  perf.mark('revalidation duration')
  perf.total()
  return { active: true }
}

export async function reportRecipe(
  recipeId: string,
  reason?: string
): Promise<ReportResult> {
  const { supabase, user } = await requireUser()
  const { data: recipe, error: recipeError } = await supabase
    .from('recipes')
    .select('id, name, user_id')
    .eq('id', recipeId)
    .maybeSingle()

  if (recipeError) throw recipeError
  if (!recipe) throw new Error('Guide not found')

  const reportReason = normalizeReason(reason)
  const { error } = await supabase.from('recipe_reports').insert({
    recipe_id: recipeId,
    reporter_id: user.id,
    creator_id: recipe.user_id,
    reason: reportReason,
  })

  if (isDuplicateError(error)) {
    return {
      status: 'duplicate',
      message: 'Thank you, report received.',
    }
  }

  if (error) throw error

  await captureServerEvent({
    distinctId: user.id,
    event: 'recipe_reported',
    properties: {
      recipe_id: recipeId,
      recipe_name: recipe.name || null,
      creator_id: recipe.user_id || null,
      has_reason: Boolean(reportReason),
    },
  })

  await sendReportNotification({
    contentType: 'recipe',
    contentId: recipeId,
    contentName: recipe.name || null,
    reporterId: user.id,
    creatorId: recipe.user_id || null,
    reason: reportReason,
  })

  revalidatePath(`/recipes/${recipeId}`)
  return {
    status: 'reported',
    message: 'Thank you, report received.',
  }
}

export async function reportTheme(
  themeId: string,
  reason?: string
): Promise<ReportResult> {
  const { supabase, user } = await requireUser()
  const { data: theme, error: themeError } = await supabase
    .from('themes')
    .select('id, name, user_id')
    .eq('id', themeId)
    .maybeSingle()

  if (themeError) throw themeError
  if (!theme) throw new Error('Theme not found')

  const reportReason = normalizeReason(reason)
  const { error } = await supabase.from('theme_reports').insert({
    theme_id: themeId,
    reporter_id: user.id,
    creator_id: theme.user_id,
    reason: reportReason,
  })

  if (isDuplicateError(error)) {
    return {
      status: 'duplicate',
      message: 'Thank you, report received.',
    }
  }

  if (error) throw error

  await captureServerEvent({
    distinctId: user.id,
    event: 'theme_reported',
    properties: {
      theme_id: themeId,
      theme_name: theme.name || null,
      creator_id: theme.user_id || null,
      has_reason: Boolean(reportReason),
    },
  })

  await sendReportNotification({
    contentType: 'theme',
    contentId: themeId,
    contentName: theme.name || null,
    reporterId: user.id,
    creatorId: theme.user_id || null,
    reason: reportReason,
  })

  revalidatePath(`/themes/${themeId}`)
  return {
    status: 'reported',
    message: 'Thank you, report received.',
  }
}
