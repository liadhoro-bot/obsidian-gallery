import { isCurrentUserAdmin } from '../admin'
import { createClient } from '../../utils/supabase/server'
import { isContestSchemaMissing } from './schema'

export async function canManageContest(userId: string, contestId: string) {
  if (await isCurrentUserAdmin(userId)) return true

  const supabase = await createClient()
  const { data: contest, error: contestError } = await supabase
    .from('contests')
    .select('id')
    .eq('id', contestId)
    .eq('created_by', userId)
    .maybeSingle()

  if (isContestSchemaMissing(contestError)) return false
  if (contestError) throw new Error(contestError.message)
  if (contest) return true

  const { data, error } = await supabase
    .from('contest_organizers')
    .select('role')
    .eq('contest_id', contestId)
    .eq('user_id', userId)
    .in('role', ['owner', 'admin'])
    .maybeSingle()

  if (isContestSchemaMissing(error)) return false
  if (error) throw new Error(error.message)

  return Boolean(data)
}

export async function canModerateContest(userId: string, contestId: string) {
  if (await isCurrentUserAdmin(userId)) return true

  const supabase = await createClient()
  const { data: contest, error: contestError } = await supabase
    .from('contests')
    .select('id')
    .eq('id', contestId)
    .eq('created_by', userId)
    .maybeSingle()

  if (isContestSchemaMissing(contestError)) return false
  if (contestError) throw new Error(contestError.message)
  if (contest) return true

  const { data, error } = await supabase
    .from('contest_organizers')
    .select('role')
    .eq('contest_id', contestId)
    .eq('user_id', userId)
    .in('role', ['owner', 'admin', 'moderator'])
    .maybeSingle()

  if (isContestSchemaMissing(error)) return false
  if (error) throw new Error(error.message)

  return Boolean(data)
}
