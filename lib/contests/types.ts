export type ContestPublicationStatus =
  | 'draft'
  | 'published'
  | 'cancelled'
  | 'archived'

export type ContestPhase =
  | 'draft'
  | 'upcoming'
  | 'submissions_open'
  | 'moderation'
  | 'voting_open'
  | 'voting_closed'
  | 'results_published'
  | 'cancelled'
  | 'archived'

export type ContestNomineeType = 'project' | 'unit' | 'guide'
export type ContestVotingMethod = 'approval' | 'ranked'
export type ContestVisibility = 'public' | 'private' | 'unlisted'
export type ContestVoterAccessMode =
  | 'public_authenticated'
  | 'allowlist'
  | 'nominees_only'

export type Contest = {
  id: string
  slug: string
  title: string
  short_description: string | null
  description: string | null
  rules_markdown: string | null
  cover_image_url: string | null
  created_by: string
  publication_status: ContestPublicationStatus
  visibility: ContestVisibility
  max_nominations_per_user: number
  requires_nomination_approval: boolean
  voting_method: ContestVotingMethod
  minimum_selections_per_ballot: number
  maximum_selections_per_ballot: number
  require_exact_selection_count: boolean
  allow_ballot_changes: boolean
  allow_self_vote: boolean
  voter_access_mode: ContestVoterAccessMode
  require_verified_email: boolean
  minimum_account_age_hours: number
  minimum_projects_for_voting: number
  minimum_units_for_voting: number
  hide_nominee_identity_during_voting: boolean
  show_live_results: boolean
  submissions_open_at: string
  submissions_close_at: string
  voting_open_at: string
  voting_close_at: string
  results_published_at: string | null
  published_at: string | null
  cancelled_at: string | null
  archived_at: string | null
  created_at: string
  updated_at: string
  allowed_nominee_types?: { nominee_type: ContestNomineeType }[]
}

export type ContestInvitedParticipant = {
  id: string
  contest_id: string
  identifier: string
  email: string | null
  username: string | null
  user_id: string | null
  status: 'pending' | 'matched' | 'removed'
  added_by: string | null
  created_at: string
  updated_at: string
}

export type ContestNomination = {
  id: string
  contest_id: string
  submitted_by_user_id: string
  owner_user_id: string
  source_type: ContestNomineeType
  source_project_id: string | null
  source_unit_id: string | null
  source_guide_id: string | null
  snapshot_title: string
  snapshot_description: string | null
  snapshot_image_url: string
  snapshot_owner_display_name: string | null
  snapshot_metadata: Record<string, unknown>
  status: 'pending' | 'approved' | 'rejected' | 'withdrawn' | 'disqualified'
  submitted_at: string
  reviewed_at: string | null
  reviewed_by: string | null
  rejection_reason: string | null
  withdrawn_at: string | null
  disqualified_at: string | null
  disqualification_reason: string | null
}

export type ContestResult = {
  id: string
  contest_id: string
  nomination_id: string
  valid_ballot_count: number
  selection_count: number
  total_points: number
  first_place_count: number
  final_rank: number
  is_tied: boolean
  calculation_version: number
  calculated_at: string
  nomination?: ContestNomination
}

export type ContestBallot = {
  id: string
  contest_id: string
  voter_user_id: string
  status: 'draft' | 'submitted' | 'void'
  submitted_at: string | null
  contest_ballot_items?: {
    nomination_id: string
    selection_rank: number | null
  }[]
}
