import 'server-only'
import { randomUUID } from 'node:crypto'
import { isCurrentUserAdmin } from '../../../lib/admin'
import { createClient, getSessionUser } from '../../../utils/supabase/server'
import { createServiceRoleClient } from '../../../utils/supabase/service-role'

// Admins come from ADMIN_USER_IDS, which RLS can't see, so Newsroom writes use
// the service role once this check passes, the same way contest management does.
export async function requireNewsAdmin() {
  const user = await getSessionUser(await createClient())
  if (!user || !(await isCurrentUserAdmin(user.id))) return null
  return { supabase: createServiceRoleClient(), user }
}

export type NewsSupabase = NonNullable<Awaited<ReturnType<typeof requireNewsAdmin>>>['supabase']

export async function findFreeSlug(supabase: NewsSupabase, base: string, ownId: string | null) {
  for (let attempt = 1; attempt <= 20; attempt += 1) {
    const candidate = attempt === 1 ? base : `${base}-${attempt}`
    const { data } = await supabase
      .from('news_articles')
      .select('id')
      .eq('slug', candidate)
      .maybeSingle()
    if (!data || data.id === ownId) return candidate
  }
  return `${base}-${randomUUID().slice(0, 8)}`
}
