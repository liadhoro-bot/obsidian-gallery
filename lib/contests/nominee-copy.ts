import { getContestPhase, getPhaseLabel } from './phases'
import { getRankedPoints } from './ranking'
import type { Contest, ContestNomineeType } from './types'

function ordinal(n: number) {
  if (n === 1) return '1st'
  if (n === 2) return '2nd'
  if (n === 3) return '3rd'
  return `${n}th`
}

export type NomineeCopy = {
  entryNoun: string
  entryNounPlural: string
  entryNounCapitalized: string
  voteNoun: string
  actionVerb: string
  periodLabel: string
}

const nomineeCopyByType: Record<ContestNomineeType, NomineeCopy> = {
  guide: {
    entryNoun: 'guide',
    entryNounPlural: 'guides',
    entryNounCapitalized: 'Guide',
    voteNoun: 'creator',
    actionVerb: 'Create a Guide',
    periodLabel: 'Creation Period',
  },
  project: {
    entryNoun: 'army',
    entryNounPlural: 'armies',
    entryNounCapitalized: 'Army',
    voteNoun: 'army',
    actionVerb: 'Nominate Your Army',
    periodLabel: 'Nomination Period',
  },
  unit: {
    entryNoun: 'unit',
    entryNounPlural: 'units',
    entryNounCapitalized: 'Unit',
    voteNoun: 'unit',
    actionVerb: 'Nominate Your Unit',
    periodLabel: 'Nomination Period',
  },
}

const fallbackNomineeCopy: NomineeCopy = {
  entryNoun: 'entry',
  entryNounPlural: 'entries',
  entryNounCapitalized: 'Entry',
  voteNoun: 'entry',
  actionVerb: 'Enter the Contest',
  periodLabel: 'Entry Period',
}

export function getNomineeType(contest: Contest): ContestNomineeType | undefined {
  return contest.allowed_nominee_types?.[0]?.nominee_type
}

export function getNomineeCopy(contest: Contest): NomineeCopy {
  const type = getNomineeType(contest)
  return (type && nomineeCopyByType[type]) || fallbackNomineeCopy
}

export function getPhaseHeadline(contest: Contest): string {
  const phase = getContestPhase(contest)
  if (phase === 'upcoming') return 'Accepting Nominations'
  if (phase === 'submissions_open') return 'Accepting Nominations'
  if (phase === 'moderation') return 'Voting Opens Soon'
  if (phase === 'voting_open') return 'Voting Open'
  if (phase === 'voting_closed') return 'Winners Coming Soon'
  if (phase === 'results_published') return 'Winners Announced'
  return getPhaseLabel(phase)
}

export function getBallotSummary(contest: Contest, voteNoun: string): string {
  const max = contest.maximum_selections_per_ballot
  const parts = Array.from({ length: max }, (_, index) => {
    const rank = index + 1
    const points = getRankedPoints(max, rank)
    const noun = index === 0 ? `${voteNoun} ` : ''
    return `one ${noun}for ${ordinal(rank)} place (${points} point${points === 1 ? '' : 's'})`
  })

  if (parts.length === 1) return parts[0]
  if (parts.length === 2) return `${parts[0]} and ${parts[1]}`
  return `${parts.slice(0, -1).join(', ')}, and ${parts[parts.length - 1]}`
}

export function getOrdinal(n: number) {
  return ordinal(n)
}
