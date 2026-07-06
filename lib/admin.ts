import { createClient } from '../utils/supabase/server'

export async function isCurrentUserAdmin(userId: string) {
  const envAdminIds = (process.env.ADMIN_USER_IDS || '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean)

  if (envAdminIds.includes(userId)) {
    return true
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('id', userId)
    .maybeSingle()

  if (error) {
    return false
  }

  return Boolean((data as { is_admin?: boolean } | null)?.is_admin)
}
