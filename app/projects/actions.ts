'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '../../utils/supabase/server'

export async function addProject(formData: FormData) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const name = formData.get('name')?.toString().trim()
  const descriptionRaw = formData.get('description')?.toString().trim()

  if (!name) {
    throw new Error('Project name is required')
  }

  const { data: newProject, error } = await supabase
    .from('projects')
    .insert([
      {
        user_id: user.id,
        name,
        description: descriptionRaw || null,
      },
    ])
    .select('id')
    .single()

  if (error || !newProject) {
    throw new Error(error?.message || 'Failed to create project')
  }

  revalidatePath('/projects')

  redirect(`/projects/${newProject.id}`)
}