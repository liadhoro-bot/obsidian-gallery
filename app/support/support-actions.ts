'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '../../utils/supabase/server'

export async function submitFeedback(formData: FormData) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    throw new Error('Not authenticated')
  }

  const message = String(formData.get('message') || '').trim()

  if (!message) {
    throw new Error('Feedback message is required')
  }

  const { error } = await supabase.from('feedback').insert({
    user_id: user.id,
    message,
    source: 'support_page',
  })

  if (error) {
    throw error
  }

  revalidatePath('/support')
}