import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
import { createClient } from '@supabase/supabase-js'

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
})
assert.equal(new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname, 'ckzrvjisesooqcmmtvwl.supabase.co')
const slug = 'path-to-glory-coolest-army'
async function checked(query) { const { data, error } = await query; if (error) throw error; return data }
const contest = await checked(db.from('contests').select('*').eq('slug', slug).single())
assert.equal(contest.id, '8a19c894-1ff2-4cc5-b95d-8abf88045fac')
assert.equal(contest.publication_status, 'published')
assert.equal(contest.results_published_at, null)
const [participants, allowlist, nominations] = await Promise.all([
  checked(db.from('contest_invited_participants').select('user_id,status').eq('contest_id', contest.id).neq('status', 'removed')),
  checked(db.from('contest_voter_allowlist').select('user_id').eq('contest_id', contest.id)),
  checked(db.from('contest_nominations').select('id').eq('contest_id', contest.id).eq('status', 'approved')),
])
assert.equal(participants.length, 12, 'Expected the existing 12-person invitation list')
assert.equal(nominations.length, 6, 'Expected the six approved armies')
assert(participants.filter((p) => p.user_id).every((p) => allowlist.some((a) => a.user_id === p.user_id)))
assert(allowlist.every((a) => participants.some((p) => p.user_id === a.user_id)), 'Unexpected extra voter')
const patch = {
  submissions_open_at: '2026-09-15T00:00:00+03:00', submissions_close_at: '2026-09-30T23:59:59.999+03:00',
  voting_open_at: '2026-10-04T00:00:00+03:00', voting_close_at: '2026-10-06T23:59:59.999+03:00',
  results_target_at: '2026-10-06T23:59:59.999+03:00', voting_method: 'ranked',
  minimum_selections_per_ballot: 2, maximum_selections_per_ballot: 2,
  require_exact_selection_count: true, allow_ballot_changes: false, allow_self_vote: false,
  voter_access_mode: 'allowlist', show_live_results: false,
}
console.log({ invitations: participants.length, linkedVoters: allowlist.length, pendingInvitations: participants.filter((p) => !p.user_id).length, entries: nominations.length })
if (process.argv.includes('--apply')) {
  await mkdir('.tmp', { recursive: true })
  await writeFile(`.tmp/path-to-glory-settings-before-${Date.now()}.json`, JSON.stringify(Object.fromEntries(Object.keys(patch).map((key) => [key, contest[key]])), null, 2))
  const updated = await checked(db.from('contests').update(patch).eq('id', contest.id).eq('slug', slug).select('*').single())
  for (const [key, value] of Object.entries(patch)) {
    assert.equal(key.endsWith('_at') ? Date.parse(updated[key]) : updated[key], key.endsWith('_at') ? Date.parse(value) : value, key)
  }
  console.log('Live contest schedule and immutable 2/1 voting settings updated and verified.')
} else console.log('Read-only check passed. Pass --apply to update this contest only.')
