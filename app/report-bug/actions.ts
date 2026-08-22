'use server'

import { revalidatePath } from 'next/cache'
import { Resend } from 'resend'
import { createClient } from '../../utils/supabase/server'

const resend = new Resend(process.env.RESEND_API_KEY)

export type ReportBugResult = {
  ok: boolean
  error?: string
}

export async function submitBugReport(formData: FormData): Promise<ReportBugResult> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return {
      ok: false,
      error: 'You need to be signed in to report a bug.',
    }
  }

  const buggedPage = String(formData.get('buggedPage') || '').trim()
  const description = String(formData.get('description') || '').trim()

  if (!buggedPage || !description) {
    return {
      ok: false,
      error: 'Please include the bugged page and a short description.',
    }
  }

  const message = [
    `Bugged page: ${buggedPage}`,
    '',
    'Description:',
    description,
  ].join('\n')

  const { error } = await supabase.from('feedback').insert({
    user_id: user.id,
    message,
    source: 'bug_report',
  })

  if (error) {
    return {
      ok: false,
      error: 'Could not send the bug report. Please try again.',
    }
  }

  if (process.env.RESEND_API_KEY && process.env.FEEDBACK_TO_EMAIL) {
    await resend.emails.send({
      from: 'Obsidian Gallery <onboarding@resend.dev>',
      to: process.env.FEEDBACK_TO_EMAIL,
      subject: 'New Obsidian Gallery bug report',
      text: [
        'New bug report received.',
        '',
        `User ID: ${user.id}`,
        '',
        message,
      ].join('\n'),
    })
  }

  revalidatePath('/report-bug')

  return { ok: true }
}
