import type { ContestNomination } from './types'

export type ReportBallot = {
  id: string
  voter_user_id: string
  status: string
  submitted_at: string | null
  contest_ballot_items: { nomination_id: string; selection_rank: number | null; points_awarded: number }[]
}

export function tallyBallots(nominations: Pick<ContestNomination, 'id' | 'snapshot_title' | 'status'>[], ballots: ReportBallot[]) {
  return nominations.filter((entry) => entry.status === 'approved').map((entry) => {
    const selections = ballots.filter((ballot) => ballot.status === 'submitted')
      .flatMap((ballot) => ballot.contest_ballot_items).filter((item) => item.nomination_id === entry.id)
    return {
      id: entry.id, title: entry.snapshot_title,
      first: selections.filter((item) => item.selection_rank === 1).length,
      second: selections.filter((item) => item.selection_rank === 2).length,
      points: selections.reduce((sum, item) => sum + item.points_awarded, 0),
    }
  }).sort((a, b) => b.points - a.points || a.title.localeCompare(b.title))
}
