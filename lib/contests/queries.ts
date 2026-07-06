import { unstable_cache } from 'next/cache'
import { cache } from 'react'
import { createAuthenticatedServerClient } from '../../utils/supabase/authenticated-server-client'
import {
  createClient,
  getSessionAccessToken,
} from '../../utils/supabase/server'
import type {
  Contest,
  ContestBallot,
  ContestInvitedParticipant,
  ContestNomination,
  ContestNomineeType,
  ContestResult,
} from './types'
import { getContestPhase } from './phases'
import { isContestSchemaMissing } from './schema'

export const DEMO_CONTEST_ID = '00000000-0000-4000-8000-000000000001'
export const DEMO_CONTEST_SLUG = 'demo-community-showcase'

const contestSelect = `
  *,
  allowed_nominee_types:contest_allowed_nominee_types (
    nominee_type
  )
`
const CONTEST_PROMPT_CACHE_VERSION = 'v1'
const CONTEST_PROMPT_REVALIDATE_SECONDS = 300

function shouldShowDemoContest() {
  return process.env.CONTEST_DEMO_MODE === 'true'
}

function getDemoContest(): Contest {
  const now = new Date()
  const submissionsOpenAt = new Date(now)
  submissionsOpenAt.setDate(now.getDate() - 1)
  const submissionsCloseAt = new Date(now)
  submissionsCloseAt.setDate(now.getDate() + 14)
  const votingOpenAt = new Date(submissionsCloseAt)
  votingOpenAt.setDate(submissionsCloseAt.getDate() + 1)
  const votingCloseAt = new Date(votingOpenAt)
  votingCloseAt.setDate(votingOpenAt.getDate() + 7)

  return {
    id: DEMO_CONTEST_ID,
    slug: DEMO_CONTEST_SLUG,
    title: 'Demo Community Showcase',
    short_description: 'A local demo contest for testing nominations.',
    description:
      'This demo contest appears locally when no real contest data is available.',
    rules_markdown:
      'Submit an owned Project, Unit, or Guide. This is demo data for local UI testing.',
    cover_image_url: '/onboarding/welcome-hero.jpeg',
    created_by: '00000000-0000-4000-8000-000000000000',
    publication_status: 'published',
    visibility: 'public',
    max_nominations_per_user: 3,
    requires_nomination_approval: true,
    voting_method: 'approval',
    minimum_selections_per_ballot: 1,
    maximum_selections_per_ballot: 1,
    require_exact_selection_count: false,
    allow_ballot_changes: true,
    allow_self_vote: false,
    voter_access_mode: 'public_authenticated',
    require_verified_email: false,
    minimum_account_age_hours: 0,
    minimum_projects_for_voting: 0,
    minimum_units_for_voting: 0,
    hide_nominee_identity_during_voting: true,
    show_live_results: false,
    submissions_open_at: submissionsOpenAt.toISOString(),
    submissions_close_at: submissionsCloseAt.toISOString(),
    voting_open_at: votingOpenAt.toISOString(),
    voting_close_at: votingCloseAt.toISOString(),
    results_published_at: null,
    published_at: submissionsOpenAt.toISOString(),
    cancelled_at: null,
    archived_at: null,
    created_at: submissionsOpenAt.toISOString(),
    updated_at: now.toISOString(),
    allowed_nominee_types: [
      { nominee_type: 'project' },
      { nominee_type: 'unit' },
      { nominee_type: 'guide' },
    ],
  }
}

export type ContestPickerSource = {
  id: string
  sourceType: ContestNomineeType
  title: string
  description: string | null
  imageUrl: string | null
  href: string
}

export const getContestDirectory = cache(async (userId?: string | null) => {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('contests')
    .select(contestSelect)
    .eq('publication_status', 'published')
    .neq('visibility', 'private')
    .order('submissions_open_at', { ascending: false })

  if (isContestSchemaMissing(error)) {
    const demoContest = getDemoContest()
    return {
      active: shouldShowDemoContest() ? [demoContest] : [],
      upcoming: [],
      past: [],
      myNominations: [],
    }
  }

  if (error) {
    throw new Error(error.message)
  }

  const contests = ((data ?? []) as Contest[]).filter(
    (contest) => contest.visibility !== 'unlisted'
  )
  const visibleContests =
    contests.length === 0 && shouldShowDemoContest() ? [getDemoContest()] : contests

  const myNominations =
    userId
      ? await supabase
          .from('contest_nominations')
          .select('*, contest:contests(*)')
          .eq('owner_user_id', userId)
          .order('submitted_at', { ascending: false })
      : { data: [] }

  return {
    active: visibleContests.filter((contest) =>
      ['submissions_open', 'voting_open'].includes(getContestPhase(contest))
    ),
    upcoming: visibleContests.filter((contest) => getContestPhase(contest) === 'upcoming'),
    past: visibleContests.filter((contest) =>
      ['voting_closed', 'results_published', 'archived'].includes(
        getContestPhase(contest)
      )
    ),
    myNominations: (myNominations.data ?? []) as Array<
      ContestNomination & { contest?: Contest }
    >,
  }
})

export async function getContestBySlug(slug: string) {
  if (shouldShowDemoContest() && slug === DEMO_CONTEST_SLUG) {
    return getDemoContest()
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('contests')
    .select(contestSelect)
    .eq('slug', slug)
    .maybeSingle()

  if (isContestSchemaMissing(error)) {
    return null
  }

  if (error) {
    throw new Error(error.message)
  }

  return (data ?? null) as Contest | null
}

export async function getContestById(id: string) {
  if (shouldShowDemoContest() && id === DEMO_CONTEST_ID) {
    return getDemoContest()
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('contests')
    .select(contestSelect)
    .eq('id', id)
    .maybeSingle()

  if (isContestSchemaMissing(error)) {
    return null
  }

  if (error) {
    throw new Error(error.message)
  }

  return (data ?? null) as Contest | null
}

export async function getContestNominations(contestId: string, allStatuses = false) {
  const supabase = await createClient()
  let query = supabase
    .from('contest_nominations')
    .select('*')
    .eq('contest_id', contestId)
    .order('submitted_at', { ascending: true })

  if (!allStatuses) {
    query = query.eq('status', 'approved')
  }

  const { data, error } = await query

  if (isContestSchemaMissing(error)) {
    return []
  }

  if (error) {
    throw new Error(error.message)
  }

  return (data ?? []) as ContestNomination[]
}

export async function getContestResults(contestId: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('contest_results')
    .select('*, nomination:contest_nominations(*)')
    .eq('contest_id', contestId)
    .order('final_rank', { ascending: true })
    .order('total_points', { ascending: false })

  if (isContestSchemaMissing(error)) {
    return []
  }

  if (error) {
    throw new Error(error.message)
  }

  return (data ?? []) as ContestResult[]
}

export async function getViewerBallot(contestId: string, userId?: string | null) {
  if (!userId) return null
  const supabase = await createClient()
  const { data } = await supabase
    .from('contest_ballots')
    .select('*, contest_ballot_items(nomination_id, selection_rank)')
    .eq('contest_id', contestId)
    .eq('voter_user_id', userId)
    .maybeSingle()

  return (data ?? null) as ContestBallot | null
}

export async function getManageContests(userId: string, includeAll = false) {
  const supabase = await createClient()
  let contestIds: string[] | null = null

  if (!includeAll) {
    const { data: organizers, error: organizerError } = await supabase
      .from('contest_organizers')
      .select('contest_id')
      .eq('user_id', userId)
      .in('role', ['owner', 'admin'])

    if (isContestSchemaMissing(organizerError)) {
      return []
    }

    if (organizerError) {
      throw new Error(organizerError.message)
    }

    contestIds = (organizers ?? [])
      .map((row) => row.contest_id)
      .filter(Boolean)
  }

  let query = supabase
    .from('contests')
    .select(`
      *,
      allowed_nominee_types:contest_allowed_nominee_types(nominee_type),
      nominations:contest_nominations(id, status),
      ballots:contest_ballots(id, status)
    `)
    .order('created_at', { ascending: false })

  if (contestIds) {
    query =
      contestIds.length > 0
        ? query.or(`created_by.eq.${userId},id.in.(${contestIds.join(',')})`)
        : query.eq('created_by', userId)
  }

  const { data, error } = await query

  if (isContestSchemaMissing(error)) {
    return []
  }

  if (error) {
    throw new Error(error.message)
  }

  return (data ?? []) as Array<
    Contest & {
      nominations?: { id: string; status: string }[]
      ballots?: { id: string; status: string }[]
    }
  >
}

export async function getEligibleContestsForSource(
  userId: string,
  sourceType: ContestNomineeType,
  sourceId: string
) {
  const supabase = await createClient()
  const sourceColumn =
    sourceType === 'project'
      ? 'source_project_id'
      : sourceType === 'unit'
        ? 'source_unit_id'
        : 'source_guide_id'

  const [allowedResult, nominationsResult] = await Promise.all([
    supabase
      .from('contest_allowed_nominee_types')
      .select('contest_id')
      .eq('nominee_type', sourceType),
    supabase
      .from('contest_nominations')
      .select('*')
      .eq('owner_user_id', userId)
      .eq(sourceColumn, sourceId),
  ])

  if (
    isContestSchemaMissing(allowedResult.error) ||
    isContestSchemaMissing(nominationsResult.error)
  ) {
    return shouldShowDemoContest() ? [getDemoContest()] : []
  }

  if (allowedResult.error) {
    throw new Error(allowedResult.error.message)
  }
  if (nominationsResult.error) {
    throw new Error(nominationsResult.error.message)
  }

  const allowedContestIds = new Set(
    (allowedResult.data ?? []).map((row) => row.contest_id).filter(Boolean)
  )
  const nominations = (nominationsResult.data ?? []) as ContestNomination[]
  const nominationContestIds = nominations.map((nomination) => nomination.contest_id)
  const contestIds = Array.from(new Set([...allowedContestIds, ...nominationContestIds]))

  if (contestIds.length === 0) {
    return shouldShowDemoContest() ? [getDemoContest()] : []
  }

  const { data, error } = await supabase
    .from('contests')
    .select(contestSelect)
    .in('id', contestIds)
    .order('submissions_close_at', { ascending: true })

  if (isContestSchemaMissing(error)) {
    return shouldShowDemoContest() ? [getDemoContest()] : []
  }

  if (error) {
    throw new Error(error.message)
  }

  const nominationsByContestId = nominations.reduce<Record<string, ContestNomination[]>>(
    (acc, nomination) => {
      acc[nomination.contest_id] = acc[nomination.contest_id] ?? []
      acc[nomination.contest_id].push(nomination)
      return acc
    },
    {}
  )

  return ((data ?? []) as Contest[])
    .filter((contest) => {
      const phase = getContestPhase(contest)
      return (
        contest.publication_status === 'published' &&
        allowedContestIds.has(contest.id) &&
        (phase === 'submissions_open' || Boolean(nominationsByContestId[contest.id]))
      )
    })
    .map((contest) => ({
      ...contest,
      nominations: nominationsByContestId[contest.id] ?? [],
    }))
}

function getCachedDashboardContestPrompt(
  userId: string,
  accessToken: string
) {
  return unstable_cache(
    async () => {
      const supabase = createAuthenticatedServerClient(accessToken)
      const now = new Date().toISOString()

      const [
        {
          data: votingContests,
          error: votingError,
        },
        {
          data: submissionContests,
          error: submissionError,
        },
        {
          data: pending,
          error: pendingError,
        },
      ] = await Promise.all([
        supabase
          .from('contests')
          .select('*, allowed_nominee_types:contest_allowed_nominee_types(nominee_type), ballots:contest_ballots(id, voter_user_id, status)')
          .eq('publication_status', 'published')
          .lte('voting_open_at', now)
          .gt('voting_close_at', now)
          .order('voting_close_at', { ascending: true })
          .limit(5),
        supabase
          .from('contests')
          .select('*, allowed_nominee_types:contest_allowed_nominee_types(nominee_type)')
          .eq('publication_status', 'published')
          .lte('submissions_open_at', now)
          .gt('submissions_close_at', now)
          .order('submissions_close_at', { ascending: true })
          .limit(1),
        supabase
          .from('contest_nominations')
          .select('*, contest:contests(*)')
          .eq('owner_user_id', userId)
          .eq('status', 'pending')
          .order('submitted_at', { ascending: false })
          .limit(1),
      ])

      if (
        isContestSchemaMissing(votingError) ||
        isContestSchemaMissing(submissionError) ||
        isContestSchemaMissing(pendingError)
      ) {
        return shouldShowDemoContest()
          ? { kind: 'submit' as const, contest: getDemoContest() }
          : null
      }

      const voting = (
        (votingContests ?? []) as Array<Contest & { ballots?: ContestBallot[] }>
      ).find((contest) => {
        const ballot = contest.ballots?.find((row) => row.voter_user_id === userId)
        return !ballot || contest.allow_ballot_changes
      })

      if (voting) {
        return { kind: 'vote' as const, contest: voting }
      }

      const submissions = (submissionContests ?? []) as Contest[]
      if (submissions[0]) {
        return { kind: 'submit' as const, contest: submissions[0] }
      }

      if (shouldShowDemoContest()) {
        return { kind: 'submit' as const, contest: getDemoContest() }
      }

      const pendingNomination = (pending ?? [])[0] as
        | (ContestNomination & { contest?: Contest })
        | undefined
      if (pendingNomination?.contest) {
        return { kind: 'pending' as const, contest: pendingNomination.contest }
      }

      return null
    },
    [CONTEST_PROMPT_CACHE_VERSION, 'dashboard-contest-prompt', userId],
    {
      tags: ['contests'],
      revalidate: CONTEST_PROMPT_REVALIDATE_SECONDS,
    }
  )()
}

export const getDashboardContestPrompt = cache(async (userId: string) => {
  const supabase = await createClient()
  const accessToken = await getSessionAccessToken(supabase)

  if (!accessToken) {
    return shouldShowDemoContest()
      ? { kind: 'submit' as const, contest: getDemoContest() }
      : null
  }

  return getCachedDashboardContestPrompt(userId, accessToken)
})

export async function getContestAllowlist(contestId: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('contest_voter_allowlist')
    .select('contest_id, user_id, created_at')
    .eq('contest_id', contestId)
    .order('created_at', { ascending: false })

  if (isContestSchemaMissing(error)) {
    return []
  }

  if (error) throw new Error(error.message)

  return (data ?? []) as {
    contest_id: string
    user_id: string
    created_at: string
  }[]
}

export async function getContestParticipants(contestId: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('contest_invited_participants')
    .select('*')
    .eq('contest_id', contestId)
    .neq('status', 'removed')
    .order('created_at', { ascending: true })

  if (isContestSchemaMissing(error)) {
    return []
  }

  if (error) throw new Error(error.message)

  return (data ?? []) as ContestInvitedParticipant[]
}

export async function getNominationPickerSources(
  userId: string,
  allowedTypes: ContestNomineeType[]
) {
  const supabase = await createClient()
  const sources: ContestPickerSource[] = []

  async function attachImages<T extends { id: string }>(
    entityType: 'project' | 'unit' | 'recipe',
    rows: T[]
  ) {
    const ids = rows.map((row) => row.id)
    if (ids.length === 0) return new Map<string, string | null>()

    const { data } = await supabase
      .from('image_assets')
      .select('entity_id, image_url, is_featured, created_at')
      .eq('entity_type', entityType)
      .eq('user_id', userId)
      .in('entity_id', ids)
      .order('is_featured', { ascending: false })
      .order('created_at', { ascending: true })

    const map = new Map<string, string | null>()
    for (const image of data ?? []) {
      if (!map.has(image.entity_id)) {
        map.set(image.entity_id, image.image_url)
      }
    }
    return map
  }

  if (allowedTypes.includes('project')) {
    const { data, error } = await supabase
      .from('projects')
      .select('id, name, description, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    if (error) throw new Error(error.message)

    const projects = data ?? []
    const imageMap = await attachImages('project', projects)
    sources.push(
      ...projects.map((project) => ({
        id: project.id,
        sourceType: 'project' as const,
        title: project.name || 'Untitled Project',
        description: project.description ?? null,
        imageUrl: imageMap.get(project.id) ?? null,
        href: `/projects/${project.id}`,
      }))
    )
  }

  if (allowedTypes.includes('unit')) {
    const { data, error } = await supabase
      .from('units')
      .select('id, name, notes, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    if (error) throw new Error(error.message)

    const units = data ?? []
    const imageMap = await attachImages('unit', units)
    sources.push(
      ...units.map((unit) => ({
        id: unit.id,
        sourceType: 'unit' as const,
        title: unit.name || 'Untitled Unit',
        description: unit.notes ?? null,
        imageUrl: imageMap.get(unit.id) ?? null,
        href: `/units/${unit.id}`,
      }))
    )
  }

  if (allowedTypes.includes('guide')) {
    const { data, error } = await supabase
      .from('recipes')
      .select('id, name, description, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    if (error) throw new Error(error.message)

    const guides = data ?? []
    const imageMap = await attachImages('recipe', guides)
    sources.push(
      ...guides.map((guide) => ({
        id: guide.id,
        sourceType: 'guide' as const,
        title: guide.name || 'Untitled Guide',
        description: guide.description ?? null,
        imageUrl: imageMap.get(guide.id) ?? null,
        href: `/recipes/${guide.id}`,
      }))
    )
  }

  return sources
}
