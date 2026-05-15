'use server'

import { createClient } from '../../utils/supabase/server'

export type CreateOnboardingProjectState = {
  success: boolean
  error: string | null
}

export async function createOnboardingProject(
  previousState: CreateOnboardingProjectState,
  formData: FormData
): Promise<CreateOnboardingProjectState> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return {
      success: false,
      error: 'You must be logged in to create a project.',
    }
  }

  const name = String(formData.get('name') || '').trim()
  const description = String(formData.get('description') || '').trim()

  if (!name) {
    return {
      success: false,
      error: 'Project name is required.',
    }
  }

  const { error } = await supabase.from('projects').insert({
    user_id: user.id,
    name,
    description: description || null,
  })

  if (error) {
    return {
      success: false,
      error: error.message,
    }
  }

  return {
    success: true,
    error: null,
  }
}