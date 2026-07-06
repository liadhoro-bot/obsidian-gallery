import type { Contest, ContestPhase, ContestPublicationStatus } from './types'

export function getContestPhase(
  contest: Pick<
    Contest,
    | 'publication_status'
    | 'submissions_open_at'
    | 'submissions_close_at'
    | 'voting_open_at'
    | 'voting_close_at'
    | 'results_published_at'
  >,
  now = new Date()
): ContestPhase {
  if (contest.publication_status === 'draft') return 'draft'
  if (contest.publication_status === 'cancelled') return 'cancelled'
  if (contest.publication_status === 'archived') return 'archived'
  if (contest.results_published_at) return 'results_published'

  const currentTime = now.getTime()
  const submissionsOpenAt = new Date(contest.submissions_open_at).getTime()
  const submissionsCloseAt = new Date(contest.submissions_close_at).getTime()
  const votingOpenAt = new Date(contest.voting_open_at).getTime()
  const votingCloseAt = new Date(contest.voting_close_at).getTime()

  if (currentTime < submissionsOpenAt) return 'upcoming'
  if (currentTime >= submissionsOpenAt && currentTime < submissionsCloseAt) {
    return 'submissions_open'
  }
  if (currentTime >= submissionsCloseAt && currentTime < votingOpenAt) {
    return 'moderation'
  }
  if (currentTime >= votingOpenAt && currentTime < votingCloseAt) {
    return 'voting_open'
  }

  return 'voting_closed'
}

export function getPhaseLabel(phase: ContestPhase) {
  return {
    draft: 'Draft',
    upcoming: 'Upcoming',
    submissions_open: 'Submissions Open',
    moderation: 'Moderation',
    voting_open: 'Voting Open',
    voting_closed: 'Voting Closed',
    results_published: 'Results Published',
    cancelled: 'Cancelled',
    archived: 'Archived',
  }[phase]
}

export function getPersistentStatusForAction(
  action: 'draft' | 'publish' | 'cancel' | 'archive'
): ContestPublicationStatus {
  if (action === 'publish') return 'published'
  if (action === 'cancel') return 'cancelled'
  if (action === 'archive') return 'archived'
  return 'draft'
}

export function getContestCountdownTarget(contest: Contest, phase: ContestPhase) {
  if (phase === 'upcoming') return contest.submissions_open_at
  if (phase === 'submissions_open') return contest.submissions_close_at
  if (phase === 'moderation') return contest.voting_open_at
  if (phase === 'voting_open') return contest.voting_close_at
  return null
}
