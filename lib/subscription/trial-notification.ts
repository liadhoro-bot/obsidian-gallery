import 'server-only'

import { Resend } from 'resend'
import { createServiceRoleClient } from '../../utils/supabase/service-role'

type TrialStartedNotification = {
  userId: string
  email: string
  startedAt: string
  endsAt: string
}

function formatIsraelTime(value: string | null | undefined) {
  if (!value) return 'Unknown'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Unknown'

  return `${new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Jerusalem',
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date)} (Israel time)`
}

function describeSignupMethod(provider: unknown) {
  if (provider === 'google') return 'Google'
  if (provider === 'email') return 'Email'
  return typeof provider === 'string' && provider ? provider : 'Unknown'
}

/**
 * Emails the admin when a user starts their free trial. Never throws: a
 * failed notification must not affect the user's trial.
 */
export async function sendTrialStartedNotification({
  userId,
  email,
  startedAt,
  endsAt,
}: TrialStartedNotification) {
  const adminEmail =
    process.env.TRIAL_NOTIFY_EMAIL || process.env.ADMIN_REPORT_EMAIL
  const resendKey = process.env.RESEND_API_KEY

  try {
    const service = createServiceRoleClient()
    const [authResult, profileResult, consentResult, countResult] =
      await Promise.all([
        service.auth.admin.getUserById(userId),
        service.from('profiles').select('username').eq('id', userId).maybeSingle(),
        service
          .from('user_terms_acceptances')
          .select('product_updates_approved_at')
          .eq('user_id', userId)
          .order('accepted_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
        service.from('trials').select('user_id', { count: 'exact', head: true }),
      ])

    const authUser = authResult.data.user
    const metadata = (authUser?.user_metadata ?? {}) as Record<string, unknown>
    const productUpdatesApprovedAt =
      (consentResult.data?.product_updates_approved_at as string | null | undefined) ??
      (metadata.product_updates_approved_at as string | null | undefined) ??
      null
    const fullName =
      (metadata.full_name as string | undefined) ||
      (metadata.name as string | undefined) ||
      'Not provided'
    const username =
      (profileResult.data?.username as string | null | undefined) || 'Not set'

    const subject = `New free trial: ${email}`
    const body = [
      'A new user started their 14-day free trial in Obsidian Gallery.',
      '',
      `Started: ${formatIsraelTime(startedAt)}`,
      `Trial ends: ${formatIsraelTime(endsAt)}`,
      `Total trials so far: ${countResult.count ?? 'Unknown'}`,
      '',
      `Email: ${email}`,
      `Name: ${fullName}`,
      `Username: ${username}`,
      `User ID: ${userId}`,
      `Signed up with: ${describeSignupMethod(authUser?.app_metadata?.provider)}`,
      `Account created: ${formatIsraelTime(authUser?.created_at)}`,
      `Opted in to product updates: ${
        productUpdatesApprovedAt
          ? `Yes (${formatIsraelTime(productUpdatesApprovedAt)})`
          : 'No'
      }`,
      'Came from: Not tracked yet',
    ].join('\n')

    if (!adminEmail || !resendKey) {
      console.info('Trial started notification:', body)
      return
    }

    const { error } = await new Resend(resendKey).emails.send({
      from: 'Obsidian Gallery <onboarding@resend.dev>',
      to: adminEmail,
      subject,
      text: body,
    })
    if (error) {
      console.error('Trial started notification failed:', error)
    }
  } catch (error) {
    console.error('Trial started notification failed:', error)
  }
}
