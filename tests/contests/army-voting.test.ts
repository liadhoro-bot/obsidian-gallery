import assert from 'node:assert/strict'
import test from 'node:test'
import { tallyBallots, type ReportBallot } from '../../lib/contests/ballot-report'
import { getContestPhase } from '../../lib/contests/phases'

test('army tally counts only submitted ballots, uses 2/1 points, and retains zero-vote entries', () => {
  const nominations = ['a', 'b', 'c'].map((id) => ({ id, snapshot_title: id, status: 'approved' as const }))
  const ballot = (status: string, first: string, second: string): ReportBallot => ({
    id: status, voter_user_id: status, status, submitted_at: null,
    contest_ballot_items: [
      { nomination_id: first, selection_rank: 1, points_awarded: 2 },
      { nomination_id: second, selection_rank: 2, points_awarded: 1 },
    ],
  })
  assert.deepEqual(tallyBallots(nominations, [ballot('submitted', 'a', 'b'), ballot('void', 'c', 'a'), ballot('draft', 'b', 'c')]), [
    { id: 'a', title: 'a', first: 1, second: 0, points: 2 },
    { id: 'b', title: 'b', first: 0, second: 1, points: 1 },
    { id: 'c', title: 'c', first: 0, second: 0, points: 0 },
  ])
})

test('October voting schedule uses Israel dates and remains open through October 6', () => {
  const contest = {
    publication_status: 'published' as const, results_published_at: null,
    submissions_open_at: '2026-09-15T00:00:00+03:00', submissions_close_at: '2026-09-30T23:59:59.999+03:00',
    voting_open_at: '2026-10-04T00:00:00+03:00', voting_close_at: '2026-10-06T23:59:59.999+03:00',
  }
  assert.equal(getContestPhase(contest, new Date('2026-10-03T20:59:59Z')), 'moderation')
  assert.equal(getContestPhase(contest, new Date('2026-10-03T21:00:00Z')), 'voting_open')
  assert.equal(getContestPhase(contest, new Date('2026-10-06T20:59:59Z')), 'voting_open')
  assert.equal(getContestPhase(contest, new Date('2026-10-06T21:00:00Z')), 'voting_closed')
})
