import { isCurrentUserAdmin } from '../admin'
import { createClient } from '../../utils/supabase/server'
import { isContestSchemaMissing } from './schema'
import { matchVerifiedContestInvitation } from './match-invitation'
import type { Contest } from './types'

type ContestVisibilityRow = {
  id: string
  publication_status: string
  visibility: string
  voter_access_mode: string
}

export async function canManageContest(userId: string, contestId: string) {
  void contestId
  return isCurrentUserAdmin(userId)
}

// Read-only reporting is available to the recorded contest owner. This does
// not confer global admin privileges or permission to edit other contests.
export async function canReadContestBallots(userId: string | null | undefined, contestId: string) {
  if (!userId) return false
  const supabase = await createClient()
  const { data: contest, error } = await supabase.from('contests')
    .select('created_by').eq('id', contestId).maybeSingle()
  if (error || !contest) return false
  return contest.created_by === userId || await canManageContest(userId, contestId)
}

export async function canViewContest(
  userId: string | null | undefined,
  contestId: string
) {
  const supabase = await createClient()
  const { data: contest, error: contestError } = await supabase
    .from('contests')
    .select('id, publication_status, visibility, voter_access_mode')
    .eq('id', contestId)
    .maybeSingle()

  if (isContestSchemaMissing(contestError)) return false
  if (contestError) throw new Error(contestError.message)
  if (!contest) return false

  const visibleContest = contest as ContestVisibilityRow
  if (
    visibleContest.publication_status === 'published' &&
    ['public', 'unlisted'].includes(visibleContest.visibility)
  ) {
    return true
  }

  if (!userId) return false
  if (
    visibleContest.publication_status === 'published' &&
    visibleContest.visibility === 'private' &&
    visibleContest.voter_access_mode === 'public_authenticated'
  ) {
    return true
  }

  if (await canManageContest(userId, contestId)) return true

  const { data: allowlistEntry, error: allowlistError } = await supabase
    .from('contest_voter_allowlist')
    .select('user_id')
    .eq('contest_id', contestId)
    .eq('user_id', userId)
    .maybeSingle()

  if (isContestSchemaMissing(allowlistError)) return false
  if (allowlistError) throw new Error(allowlistError.message)
  if (allowlistEntry) return true

  const { data: nomination, error: nominationError } = await supabase
    .from('contest_nominations')
    .select('id')
    .eq('contest_id', contestId)
    .eq('owner_user_id', userId)
    .eq('status', 'approved')
    .maybeSingle()

  if (isContestSchemaMissing(nominationError)) return false
  if (nominationError) throw new Error(nominationError.message)

  return Boolean(nomination)
}

export async function canModerateContest(userId: string, contestId: string) {
  void contestId
  return isCurrentUserAdmin(userId)
}

export async function canNominateInContest(
  userId: string | null | undefined,
  contest: Pick<Contest, 'id' | 'voter_access_mode'>
) {
  if (!userId) return false
  if (contest.voter_access_mode !== 'allowlist') return true

  const supabase = await createClient()
  const { data: allowedUser, error } = await supabase
    .from('contest_voter_allowlist')
    .select('user_id')
    .eq('contest_id', contest.id)
    .eq('user_id', userId)
    .maybeSingle()

  if (isContestSchemaMissing(error)) return false
  if (error) throw new Error(error.message)

  return Boolean(allowedUser) || await matchVerifiedContestInvitation(contest.id, userId)
}
