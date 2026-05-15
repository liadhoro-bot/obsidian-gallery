'use server'

import { revalidatePath } from 'next/cache'
import { Resend } from 'resend'
import { createClient } from '../../utils/supabase/server'

const resend = new Resend(process.env.RESEND_API_KEY)

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

  if (process.env.RESEND_API_KEY && process.env.FEEDBACK_TO_EMAIL) {
    await resend.emails.send({
      from: 'Obsidian Gallery <onboarding@resend.dev>',
      to: process.env.FEEDBACK_TO_EMAIL,
      subject: 'New Obsidian Gallery feedback',
      text: [
        'New feedback received from the support page.',
        '',
        `User ID: ${user.id}`,
        '',
        'Message:',
        message,
      ].join('\n'),
    })
  }

  revalidatePath('/support')
}