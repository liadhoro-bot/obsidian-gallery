'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '../../../utils/supabase/server'
import { createServiceRoleClient } from '../../../utils/supabase/service-role'
import { isCurrentUserAdmin } from '../../../lib/admin'
import { isPushConfigured } from '../../../lib/push/send'
import { sendPushPreviewToSelf } from '../../../lib/engage/push-dispatch'
import type { MessageStatus } from '../../../lib/engage/types'

async function requireAdmin() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user || !(await isCurrentUserAdmin(user.id))) return null
  return user
}

export async function setEngagementMessageStatus(key: string, status: MessageStatus) {
  const user = await requireAdmin()
  if (!user) return { ok: false as const, error: 'Not allowed.' }
  if (!['draft', 'review', 'live', 'paused'].includes(status)) {
    return { ok: false as const, error: 'Unknown status.' }
  }
  const { data: message } = await createServiceRoleClient()
    .from('engagement_messages')
    .select('surface')
    .eq('key', key)
    .maybeSingle()
  if (!message) return { ok: false as const, error: 'Unknown message.' }
  if (status === 'live' && message.surface === 'email') {
    return { ok: false as const, error: 'Email has no sender or marketing consent yet, so it cannot go live.' }
  }

  const { error } = await createServiceRoleClient()
    .from('engagement_messages')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('key', key)
  if (error) return { ok: false as const, error: error.message }
  revalidatePath('/admin/engage')
  return { ok: true as const }
}

export async function sendEngagePushPreview(key: string) {
  const user = await requireAdmin()
  if (!user) return { ok: false as const, error: 'Not allowed.' }
  if (!isPushConfigured()) return { ok: false as const, error: 'Push is not configured on the server.' }
  const result = await sendPushPreviewToSelf(user.id, key)
  revalidatePath('/admin/engage')
  return result.ok ? { ok: true as const } : { ok: false as const, error: result.error }
}
