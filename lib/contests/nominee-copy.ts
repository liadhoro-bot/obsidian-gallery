import { getContestPhase, getPhaseLabel } from './phases'
import type { Contest, ContestNomineeType } from './types'

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
