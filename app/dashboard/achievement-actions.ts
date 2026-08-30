'use server'

import { revalidatePath } from 'next/cache'
import { createServiceRoleClient } from '../../utils/supabase/service-role'
import { createClient, getSessionUser } from '../../utils/supabase/server'

export async function markAchievementsSeen(achievementIds: string[]) {
  const supabase = await createClient()
  const user = await getSessionUser(supabase)

  if (!user || !achievementIds.length) {
    return { ok: false }
  }

  const service = createServiceRoleClient()
  const { error } = await service
    .from('user_achievements')
    .update({ seen_at: new Date().toISOString() })
    .eq('user_id', user.id)
    .in('achievement_id', achievementIds)
    .is('seen_at', null)

  if (error) {
    console.error('[achievements] Could not mark achievements seen', error)
    return { ok: false }
  }

  revalidatePath('/dashboard')
  return { ok: true }
}
