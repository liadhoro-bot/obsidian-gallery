'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '../../../utils/supabase/server'

export async function setFeaturedUnit(formData: FormData) {
  const supabase = await createClient()

  const unitId = formData.get('unitId')?.toString()
  const projectId = formData.get('projectId')?.toString()

  if (!unitId || !projectId) {
    return
  }

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return
  }

  const { data: unit } = await supabase
    .from('units')
    .select('id, project_id')
    .eq('id', unitId)
    .eq('user_id', user.id)
    .single()

  if (!unit) {
    return
  }

  await supabase
    .from('units')
    .update({ is_featured: false })
    .eq('project_id', unit.project_id)
    .eq('user_id', user.id)

  await supabase
    .from('units')
    .update({ is_featured: true })
    .eq('id', unitId)
    .eq('user_id', user.id)

  revalidatePath(`/projects/${projectId}`)
}