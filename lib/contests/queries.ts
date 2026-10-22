import { unstable_cache } from 'next/cache'
import { cache } from 'react'
import { createAuthenticatedServerClient } from '../../utils/supabase/authenticated-server-client'
import { createServiceRoleClient } from '../../utils/supabase/service-role'
import {
  createClient,
  getSessionAccessToken,
  getSessionUser,
} from '../../utils/supabase/server'
import { canViewContest } from './permissions'
import { loadNominationGallery } from './nomination-gallery'
import { selectCreatorCollection, type CollectionGuide } from '../../app/guides/shared/creator-collection'
import type {
  Contest,
  ContestBallot,
  ContestInvitedParticipant,
  ContestNomination,
  ContestNomineeType,
  ContestResult,
} from './types'
import { getContestPhase } from './phases'
import {
  getPayingUserIds,
  isSubscriptionGateEnabled,
} from '../subscription/subscription-guard'
import { isContestSchemaMissing } from './schema'
import { getSupabaseImageUrl } from '../../utils/images/supabase-image'

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
    results_target_at: null,
    published_at: submissionsOpenAt.toISOString(),
    cancelled_at: null,
    archived_at: null,
    created_at: submissionsOpenAt.toISOString(),
    updated_at: now.toISOString(),
    sponsor_name: null,
    sponsor_logo_url: null,
    prize_first_place: '₪1,200',
    prize_second_place: '₪400',
    how_it_works: [
      { title: 'Create', body: 'Publish as many entries as you like during the contest.' },
      { title: 'Inspire', body: 'Your entries become part of your showcase.' },
      { title: 'Earn the vote', body: 'Each member votes for their 1st and 2nd favorites (2 and 1 points).' },
    ],
    terms_content: null,
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

// For logged-out visitors (public contest creator pages): reads bypass RLS,
// so only published contests that any account may open are returned - public
// or unlisted ones, and private ones open to every signed-in user.
export async function getPublicContestBySlug(slug: string) {
  const { data, error } = await createServiceRoleClient()
    .from('contests')
    .select(contestSelect)
    .eq('slug', slug)
    .eq('publication_status', 'published')
    .maybeSingle()
  if (isContestSchemaMissing(error)) return null
  if (error) throw new Error(error.message)
  const contest = (data ?? null) as Contest | null
  if (!contest) return null
  const openToAnyAccount = ['public', 'unlisted'].includes(contest.visibility)
    || (contest.visibility === 'private' && contest.voter_access_mode === 'public_authenticated')
  return openToAnyAccount ? contest : null
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

export async function getUserContestNominations(contestId: string, userId: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('contest_nominations')
    .select('*')
    .eq('contest_id', contestId)
    .eq('owner_user_id', userId)
    .order('submitted_at', { ascending: false })

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

export async function getContestNominationById(nominationId: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('contest_nominations')
    .select('*')
    .eq('id', nominationId)
    .maybeSingle()

  if (isContestSchemaMissing(error)) return null
  if (error) throw new Error(error.message)

  return (data ?? null) as ContestNomination | null
}

export async function withLiveNomineeData(
  nominations: ContestNomination[]
): Promise<ContestNomination[]> {
  const projectIds = nominations
    .filter((nomination) => nomination.source_type === 'project' && nomination.source_project_id)
    .map((nomination) => nomination.source_project_id as string)
  const unitIds = nominations
    .filter((nomination) => nomination.source_type === 'unit' && nomination.source_unit_id)
    .map((nomination) => nomination.source_unit_id as string)
  const guideIds = nominations
    .filter((nomination) => nomination.source_type === 'guide' && nomination.source_guide_id)
    .map((nomination) => nomination.source_guide_id as string)
  const allSourceIds = [...projectIds, ...unitIds, ...guideIds]

  if (allSourceIds.length === 0) return nominations

  const supabase = await createClient()
  const [projectsResult, unitsResult, guidesResult, imagesResult] = await Promise.all([
    projectIds.length
      ? supabase.from('projects').select('id, name, description').in('id', projectIds)
      : Promise.resolve({ data: [], error: null }),
    unitIds.length
      ? supabase.from('units').select('id, name, notes').in('id', unitIds)
      : Promise.resolve({ data: [], error: null }),
    guideIds.length
      ? supabase.from('recipes').select('id, name, description').in('id', guideIds)
      : Promise.resolve({ data: [], error: null }),
    supabase
      .from('image_assets')
      .select('entity_id, image_url, is_featured, created_at')
      .in('entity_id', allSourceIds)
      .order('is_featured', { ascending: false })
      .order('created_at', { ascending: true }),
  ])

  const nameById = new Map<string, string>()
  const descriptionById = new Map<string, string>()
  for (const row of (projectsResult.data ?? []) as {
    id: string
    name: string | null
    description: string | null
  }[]) {
    if (row.name) nameById.set(row.id, row.name)
    if (row.description) descriptionById.set(row.id, row.description)
  }
  for (const row of (unitsResult.data ?? []) as {
    id: string
    name: string | null
    notes: string | null
  }[]) {
    if (row.name) nameById.set(row.id, row.name)
    if (row.notes) descriptionById.set(row.id, row.notes)
  }
  for (const row of (guidesResult.data ?? []) as {
    id: string
    name: string | null
    description: string | null
  }[]) {
    if (row.name) nameById.set(row.id, row.name)
    if (row.description) descriptionById.set(row.id, row.description)
  }

  const imageById = new Map<string, string>()
  for (const row of (imagesResult.data ?? []) as { entity_id: string; image_url: string }[]) {
    if (!imageById.has(row.entity_id)) imageById.set(row.entity_id, row.image_url)
  }

  return nominations.map((nomination) => {
    const sourceId =
      nomination.source_project_id ?? nomination.source_unit_id ?? nomination.source_guide_id
    if (!sourceId) return nomination

    const liveTitle = nameById.get(sourceId)
    const liveDescription = descriptionById.get(sourceId)
    const liveImage = imageById.get(sourceId)
    if (!liveTitle && !liveDescription && !liveImage) return nomination

    return {
      ...nomination,
      snapshot_title: liveTitle || nomination.snapshot_title,
      snapshot_description: liveDescription || nomination.snapshot_description,
      snapshot_image_url: liveImage || nomination.snapshot_image_url,
    }
  })
}

export type GuideCreatorLeaderboardEntry = {
  ownerId: string
  ownerName: string
  guideCount: number
  imageUrl: string | null
  guideImageUrls: string[]
  avatarUrl: string | null
  isViewer: boolean
}

export type ContestCreatorProfile = {
  description: string | null
  // The guide whose photo is the creator's entry card; coverRecipeId is the
  // older per-deck choice, used when no guide is chosen.
  coverGuideId: string | null
  coverRecipeId: string | null
  // Guide ids the organizer wants first on the creator page, in order.
  guideOrder: string[]
}

// Organizer-curated creator descriptions and entry covers. Returns an empty map
// until the contest_creator_profiles table exists, so pages keep working.
export async function getContestCreatorProfiles(contestId: string) {
  const { data, error } = await createServiceRoleClient()
    .from('contest_creator_profiles')
    .select('owner_user_id, description, cover_guide_id, cover_recipe_id, guide_order')
    .eq('contest_id', contestId)
  const profiles = new Map<string, ContestCreatorProfile>()
  if (error) {
    if (!['42P01', 'PGRST205'].includes(error.code)) console.error('Creator profiles failed to load', error)
    return profiles
  }
  for (const row of data ?? []) {
    profiles.set(row.owner_user_id, {
      description: row.description?.trim() || null,
      coverGuideId: row.cover_guide_id,
      coverRecipeId: row.cover_recipe_id,
      guideOrder: row.guide_order ?? [],
    })
  }
  return profiles
}

export async function getPublicGuideCreatorLeaderboard(
  hideIdentity?: boolean,
  viewerId?: string | null,
  contestId?: string,
  // Read for a logged-out visitor; every query below already limits itself to public guides.
  shared = false
): Promise<GuideCreatorLeaderboardEntry[]> {
  const supabase = shared ? createServiceRoleClient() : await createClient()
  const profilesPromise = contestId ? getContestCreatorProfiles(contestId) : Promise.resolve(new Map<string, ContestCreatorProfile>())
  const { data: publicRecipes, error } = await supabase
    .from('recipes')
    .select('id, user_id, image_url, created_at, inline_guide_id')
    .eq('is_public', true)
    .order('created_at', { ascending: false })

  if (error) throw new Error(error.message)
  if (!publicRecipes || publicRecipes.length === 0) return []

  // Only paying (or bypass) members are contest entries; free-trial users
  // are not. If the lookup fails, show everyone rather than an empty contest.
  const payingOwners = isSubscriptionGateEnabled()
    ? await getPayingUserIds(
        Array.from(new Set(publicRecipes.map((recipe) => recipe.user_id as string)))
      )
    : null
  const payingRecipes = payingOwners
    ? publicRecipes.filter((recipe) => payingOwners.has(recipe.user_id))
    : publicRecipes
  if (payingRecipes.length === 0) return []

  // Only published guides (guides.visibility = 'public') make a creator's
  // work an entry. A guide pulled back to private or draft keeps its decks
  // public for the people who saved it, so public decks alone don't count.
  const { data: listedGuideRows, error: listedError } = await supabase
    .from('guides')
    .select('id, user_id, is_auto, image_url, created_at, guide_decks(recipe_id, position)')
    .eq('visibility', 'public')
    .in('user_id', Array.from(new Set(payingRecipes.map((recipe) => recipe.user_id as string))))
  if (listedError) throw new Error(listedError.message)
  const listedGuides = (listedGuideRows ?? []) as { id: string; user_id: string; is_auto: boolean | null; image_url: string | null; created_at: string; guide_decks: { recipe_id: string; position: number | null }[] | null }[]
  const listedRecipeIds = new Set(listedGuides.flatMap((guide) => (guide.guide_decks ?? []).map((deck) => deck.recipe_id)))
  const recipes = payingRecipes.filter((recipe) => listedRecipeIds.has(recipe.id))
  if (recipes.length === 0) return []

  const countByOwner = new Map<string, number>()
  const directImageByRecipeId = new Map<string, string>()
  const recipeById = new Map(recipes.map((recipe) => [recipe.id, recipe]))

  // Entry-card thumbnails come from every listed public recipe the creator
  // has, including guides' own cards (e.g. a deck upgraded to a guide).
  const imageRecipeIdsByOwner = new Map<string, string[]>()
  for (const recipe of recipes) {
    imageRecipeIdsByOwner.set(recipe.user_id, [...(imageRecipeIdsByOwner.get(recipe.user_id) ?? []), recipe.id])
    if (recipe.image_url) directImageByRecipeId.set(recipe.id, recipe.image_url)
  }

  // The count is the creator's whole collection - exactly what their creator
  // page lists (both use selectCreatorCollection over published guides).
  // A guide's own cards (its inline deck) make that guide count rather than
  // counting as a deck of their own.
  const collectionByOwner = new Map<string, CollectionGuide[]>()
  for (const guide of listedGuides) {
    const members = [...(guide.guide_decks ?? [])].sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
    const isOwnCards = (recipeId: string) => {
      const recipe = recipeById.get(recipeId)
      return recipe?.inline_guide_id === guide.id && recipe.user_id === guide.user_id
    }
    collectionByOwner.set(guide.user_id, [...(collectionByOwner.get(guide.user_id) ?? []), {
      id: guide.id,
      isAuto: Boolean(guide.is_auto),
      publicDeckIds: members.filter((deck) => recipeById.has(deck.recipe_id) && !isOwnCards(deck.recipe_id)).map((deck) => deck.recipe_id),
      hasPublicInline: members.some((deck) => recipeById.has(deck.recipe_id) && isOwnCards(deck.recipe_id)),
    }])
  }
  const collectionIdsByOwner = new Map<string, Set<string>>()
  for (const [ownerId, guides] of collectionByOwner) {
    const collection = selectCreatorCollection(guides)
    if (collection.length > 0) countByOwner.set(ownerId, collection.length)
    collectionIdsByOwner.set(ownerId, new Set(collection.map((guide) => guide.id)))
  }

  const allRecipeIds = recipes.map((recipe) => recipe.id)
  const { data: assets } = await supabase
    .from('image_assets')
    .select('entity_id, image_url, is_featured, created_at')
    .eq('entity_type', 'recipe')
    .in('entity_id', allRecipeIds)
    .order('is_featured', { ascending: false })
    .order('created_at', { ascending: true })

  const assetImageByRecipeId = new Map<string, string>()
  for (const asset of assets ?? []) {
    if (!assetImageByRecipeId.has(asset.entity_id)) {
      assetImageByRecipeId.set(asset.entity_id, asset.image_url)
    }
  }

  const ownerIds = Array.from(countByOwner.keys())
  const nameByOwner = new Map<string, string>()
  const avatarByOwner = new Map<string, string>()
  if (!hideIdentity) {
    // Profiles are private under RLS. Read only public usernames and avatars
    // for the creators whose public guides were visible to this viewer above.
    const { data: profiles, error: profilesError } = await createServiceRoleClient()
      .from('profiles')
      .select('id, username, avatar_url')
      .in('id', ownerIds)

    if (profilesError) throw new Error(profilesError.message)
    for (const profile of (profiles ?? []) as { id: string; username: string | null; avatar_url: string | null }[]) {
      if (profile.username) nameByOwner.set(profile.id, profile.username)
      const avatar = getSupabaseImageUrl(profile.avatar_url, { width: 96, height: 96, quality: 60, resize: 'cover' })
      if (avatar) avatarByOwner.set(profile.id, avatar)
    }
  }

  // Site-relative images are the app's built-in placeholders (e.g. the
  // colour wheel on decks without a photo); they never represent a creator.
  const realImage = (url: string | null | undefined) => (url && !url.startsWith('/') ? url : null)
  const deckImage = (recipeId: string) =>
    realImage(assetImageByRecipeId.get(recipeId)) ?? realImage(directImageByRecipeId.get(recipeId))
  const guideImage = (guide: (typeof listedGuides)[number]) =>
    realImage(guide.image_url) ??
    [...(guide.guide_decks ?? [])]
      .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
      .map((deck) => (recipeById.has(deck.recipe_id) ? deckImage(deck.recipe_id) : null))
      .find((url): url is string => Boolean(url)) ??
    null

  const creatorProfiles = await profilesPromise
  return ownerIds
    .map((ownerId) => {
      // Photos come from the creator's published guides, newest first - the
      // same guides their creator page lists. The chosen cover guide (or the
      // guide holding an older per-deck cover) leads and is the entry card.
      const profile = creatorProfiles.get(ownerId)
      const collectionIds = collectionIdsByOwner.get(ownerId) ?? new Set<string>()
      const ownGuides = listedGuides
        .filter((guide) => guide.user_id === ownerId && collectionIds.has(guide.id))
        .sort((a, b) => b.created_at.localeCompare(a.created_at))
      const coverGuide =
        ownGuides.find((guide) => guide.id === profile?.coverGuideId) ??
        (profile?.coverRecipeId
          ? ownGuides.find((guide) => (guide.guide_decks ?? []).some((deck) => deck.recipe_id === profile.coverRecipeId))
          : undefined)
      const legacyCoverImage = !profile?.coverGuideId && profile?.coverRecipeId ? deckImage(profile.coverRecipeId) : null
      const orderedGuides = coverGuide ? [coverGuide, ...ownGuides.filter((guide) => guide !== coverGuide)] : ownGuides
      const fromGuides = orderedGuides.map(guideImage)
      // Creators whose guides carry no photo fall back to their decks' images.
      const fromDecks = (imageRecipeIdsByOwner.get(ownerId) ?? []).map(deckImage)
      const guideImageUrls = Array.from(new Set(
        [legacyCoverImage, ...fromGuides, ...fromDecks].filter((url): url is string => Boolean(url))
      ))

      return {
        ownerId,
        ownerName: hideIdentity ? 'Gallery Member' : nameByOwner.get(ownerId) || 'Gallery Member',
        guideCount: countByOwner.get(ownerId) ?? 0,
        isViewer: ownerId === viewerId,
        imageUrl: guideImageUrls[0] ?? null,
        guideImageUrls: guideImageUrls.slice(0, 12),
        avatarUrl: avatarByOwner.get(ownerId) ?? null,
      }
    })
    .sort((first, second) => second.guideCount - first.guideCount)
}

export async function getContestNominationGallery(contestId: string, nominationId: string) {
  const supabase = await createClient()
  const user = await getSessionUser(supabase)
  return loadNominationGallery(contestId, nominationId, {
    viewer: supabase,
    viewerId: user?.id ?? null,
    canViewContest: () => canViewContest(user?.id, contestId),
    createService: createServiceRoleClient,
  })
}
