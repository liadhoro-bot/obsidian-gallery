import assert from 'node:assert/strict'
import test from 'node:test'
import { getContestPhase } from '../../lib/contests/phases'
import { assignDenseRanks, getRankedPoints } from '../../lib/contests/ranking'
import type { Contest } from '../../lib/contests/types'

const baseContest = {
  id: 'contest-id',
  slug: 'summer-showcase',
  title: 'Summer Showcase',
  short_description: null,
  description: null,
  rules_markdown: null,
  cover_image_url: null,
  created_by: 'user-id',
  publication_status: 'published',
  visibility: 'public',
  max_nominations_per_user: 1,
  requires_nomination_approval: true,
  voting_method: 'approval',
  minimum_selections_per_ballot: 1,
  maximum_selections_per_ballot: 1,
  require_exact_selection_count: false,
  allow_ballot_changes: true,
  allow_self_vote: false,
  voter_access_mode: 'public_authenticated',
  require_verified_email: true,
  minimum_account_age_hours: 0,
  minimum_projects_for_voting: 0,
  minimum_units_for_voting: 0,
  hide_nominee_identity_during_voting: true,
  show_live_results: false,
  submissions_open_at: '2026-07-10T00:00:00.000Z',
  submissions_close_at: '2026-07-20T00:00:00.000Z',
  voting_open_at: '2026-07-25T00:00:00.000Z',
  voting_close_at: '2026-07-30T00:00:00.000Z',
  results_published_at: null,
  published_at: null,
  cancelled_at: null,
  archived_at: null,
  created_at: '2026-07-01T00:00:00.000Z',
  updated_at: '2026-07-01T00:00:00.000Z',
} satisfies Contest

test('contest lifecycle phases honor persistent status overrides and schedule boundaries', () => {
  assert.equal(
    getContestPhase(
      { ...baseContest, publication_status: 'draft' },
      new Date('2026-07-15T00:00:00.000Z')
    ),
    'draft'
  )
  assert.equal(
    getContestPhase(baseContest, new Date('2026-07-09T23:59:59.000Z')),
    'upcoming'
  )
  assert.equal(
    getContestPhase(baseContest, new Date('2026-07-10T00:00:00.000Z')),
    'submissions_open'
  )
  assert.equal(
    getContestPhase(baseContest, new Date('2026-07-20T00:00:00.000Z')),
    'moderation'
  )
  assert.equal(
    getContestPhase(baseContest, new Date('2026-07-25T00:00:00.000Z')),
    'voting_open'
  )
  assert.equal(
    getContestPhase(baseContest, new Date('2026-07-30T00:00:00.000Z')),
    'voting_closed'
  )
  assert.equal(
    getContestPhase(
      { ...baseContest, results_published_at: '2026-07-31T00:00:00.000Z' },
      new Date('2026-08-01T00:00:00.000Z')
    ),
    'results_published'
  )
  assert.equal(
    getContestPhase(
      { ...baseContest, publication_status: 'cancelled' },
      new Date('2026-07-15T00:00:00.000Z')
    ),
    'cancelled'
  )
  assert.equal(
    getContestPhase(
      { ...baseContest, publication_status: 'archived' },
      new Date('2026-07-15T00:00:00.000Z')
    ),
    'archived'
  )
})

test('ranked points and dense ranks keep ties tied', () => {
  assert.equal(getRankedPoints(3, 1), 3)
  assert.equal(getRankedPoints(3, 2), 2)
  assert.equal(getRankedPoints(3, 3), 1)

  assert.deepEqual(assignDenseRanks([
    { id: 'a', totalPoints: 5 },
    { id: 'b', totalPoints: 5 },
    { id: 'c', totalPoints: 2 },
  ]), [
    { id: 'a', totalPoints: 5, finalRank: 1, isTied: true },
    { id: 'b', totalPoints: 5, finalRank: 1, isTied: true },
    { id: 'c', totalPoints: 2, finalRank: 3, isTied: false },
  ])
})
