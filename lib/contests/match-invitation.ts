import 'server-only'
import { createClient } from '../../utils/supabase/server'
import { createServiceRoleClient } from '../../utils/supabase/service-role'

// Claim only an existing invitation for the signed-in user's verified email.
// Payment records alone are never used as proof of account identity.
export async function matchVerifiedContestInvitation(contestId: string, userId: string) {
  const client = await createClient()
  const { data: { user } } = await client.auth.getUser()
  if (user?.id !== userId || !user.email || !user.email_confirmed_at) return false
  const admin = createServiceRoleClient()
  const { data: invitation, error } = await admin.from('contest_invited_participants')
    .select('id, added_by').eq('contest_id', contestId)
    .eq('email', user.email.trim().toLowerCase()).eq('status', 'pending').is('user_id', null).maybeSingle()
  if (error) throw new Error('Could not check your contest invitation.')
  if (!invitation) return false
  const { error: allowlistError } = await admin.from('contest_voter_allowlist').upsert({
    contest_id: contestId, user_id: user.id, added_by: invitation.added_by,
  }, { onConflict: 'contest_id,user_id', ignoreDuplicates: true })
  if (allowlistError) throw new Error('Could not activate your contest invitation.')
  const { error: matchError } = await admin.from('contest_invited_participants')
    .update({ user_id: user.id, status: 'matched' }).eq('id', invitation.id).eq('status', 'pending')
  if (matchError) throw new Error('Could not finish linking your contest invitation.')
  return true
}
