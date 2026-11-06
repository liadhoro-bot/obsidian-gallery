import 'server-only'
import { redirect } from 'next/navigation'
import { isCurrentUserAdmin } from '../../../lib/admin'
import { createClient, getSessionUser } from '../../../utils/supabase/server'

export async function requireNewsroomAccess() {
  const supabase = await createClient()
  const user = await getSessionUser(supabase)
  if (!user) redirect('/login?next=/community/newsroom')
  if (!(await isCurrentUserAdmin(user.id))) redirect('/community?tab=news')
}
