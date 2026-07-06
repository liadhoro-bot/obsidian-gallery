import type { ContestVotingMethod } from './types'

export type ContestValidationInput = {
  title: string
  rulesMarkdown: string
  nomineeTypes: string[]
  submissionsOpenAt: string
  submissionsCloseAt: string
  votingOpenAt: string
  votingCloseAt: string
  votingMethod: ContestVotingMethod
  minimumSelections: number
  maximumSelections: number
}

export function validateContestConfig(input: ContestValidationInput) {
  const errors: string[] = []

  if (!input.title.trim()) errors.push('Title is required.')
  if (!input.rulesMarkdown.trim()) errors.push('Rules are required.')
  if (input.nomineeTypes.length === 0) {
    errors.push('Choose at least one nominee type.')
  }

  const submissionsOpenAt = new Date(input.submissionsOpenAt)
  const submissionsCloseAt = new Date(input.submissionsCloseAt)
  const votingOpenAt = new Date(input.votingOpenAt)
  const votingCloseAt = new Date(input.votingCloseAt)

  if (Number.isNaN(submissionsOpenAt.getTime())) {
    errors.push('Submissions open date is invalid.')
  }
  if (submissionsCloseAt <= submissionsOpenAt) {
    errors.push('Submissions close must be after submissions open.')
  }
  if (votingOpenAt < submissionsCloseAt) {
    errors.push('Voting must open at or after submissions close.')
  }
  if (votingCloseAt <= votingOpenAt) {
    errors.push('Voting close must be after voting open.')
  }
  if (input.minimumSelections < 1) {
    errors.push('Minimum selections must be at least 1.')
  }
  if (input.maximumSelections < input.minimumSelections) {
    errors.push('Maximum selections must be at least the minimum.')
  }
  if (input.votingMethod === 'ranked' && input.maximumSelections < 2) {
    errors.push('Ranked voting needs at least 2 possible selections.')
  }

  return errors
}
