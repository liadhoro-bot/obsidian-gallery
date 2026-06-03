'use server'

import { Resend } from 'resend'

type ReportNotification = {
  contentType: 'recipe' | 'theme'
  contentId: string
  contentName: string | null
  reporterId: string
  creatorId: string | null
  reason: string | null
}

export async function sendReportNotification({
  contentType,
  contentId,
  contentName,
  reporterId,
  creatorId,
  reason,
}: ReportNotification) {
  const adminEmail = process.env.ADMIN_REPORT_EMAIL
  const resendKey = process.env.RESEND_API_KEY
  const subject = `New ${contentType} report`
  const body = [
    `A ${contentType} was reported in Obsidian Gallery.`,
    '',
    `Content: ${contentName || 'Untitled'} (${contentId})`,
    `Reporter ID: ${reporterId}`,
    `Creator ID: ${creatorId || 'Unknown'}`,
    `Reason: ${reason || 'No reason provided'}`,
  ].join('\n')

  if (!adminEmail || !resendKey) {
    console.info('Report notification:', body)
    return
  }

  try {
    const resend = new Resend(resendKey)

    await resend.emails.send({
      from: 'Obsidian Gallery <onboarding@resend.dev>',
      to: adminEmail,
      subject,
      text: body,
    })

    console.info(`Report notification email sent to ${adminEmail}`)
  } catch (error) {
    console.error('Report notification email failed:', error)
  }
}
