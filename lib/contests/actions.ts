'use server'

import { revalidatePath, revalidateTag } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '../../utils/supabase/server'
import { createServiceRoleClient } from '../../utils/supabase/service-role'
import { captureServerEvent } from '../../utils/analytics/server'
import { isCurrentUserAdmin } from '../admin'
import { getContestPhase } from './phases'
import { validateContestConfig } from './validation'
import { canManageContest } from './permissions'
import {
  getSafeImageExtension,
  validateGalleryImageFile,
} from '../../utils/images/gallery-upload'
import type {
  ContestNomineeType,
  ContestPublicationStatus,
  ContestVotingMethod,
} from './types'

function getString(formData: FormData, key: string) {
  return formData.get(key)?.toString().trim() ?? ''
}

function getBoolean(formData: FormData, key: string) {
  return formData.get(key) === 'on' || formData.get(key) === 'true'
}

function toIsoFromInput(value: string) {
  return new Date(value).toISOString()
}

function isPublicationStatus(value: string): value is ContestPublicationStatus {
  return ['draft', 'published', 'cancelled', 'archived'].includes(value)
}

function getUploadedImageFile(formData: FormData, key: string) {
  const value = formData.get(key)
  return value instanceof File && value.size > 0 ? value : null
}

function contestRevalidate(slugOrId?: string | null) {
  revalidatePath('/contests')
  revalidatePath('/dashboard')
  if (slugOrId) {
    revalidatePath(`/contests/${slugOrId}`)
  }
  revalidateTag('contests', 'max')
}

async function replaceAllowedNomineeTypes(
  supabase: Awaited<ReturnType<typeof createClient>>,
  contestId: string,
  nomineeTypes: ContestNomineeType[]
) {
  const { error: allowedDeleteError } = await supabase
    .from('contest_allowed_nominee_types')
    .delete()
    .eq('contest_id', contestId)

  if (allowedDeleteError) {
    throw new Error(allowedDeleteError.message)
  }

  if (nomineeTypes.length > 0) {
    const { error: allowedInsertError } = await supabase
      .from('contest_allowed_nominee_types')
      .insert(
        nomineeTypes.map((nomineeType) => ({
          contest_id: contestId,
          nominee_type: nomineeType,
        }))
      )

    if (allowedInsertError) {
      throw new Error(allowedInsertError.message)
    }
  }
}

export async function saveContestAction(formData: FormData) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) throw new Error('Not authenticated')

  const contestId = getString(formData, 'contestId') || null
  const canSaveContest = contestId
    ? await canManageContest(user.id, contestId)
    : await isCurrentUserAdmin(user.id)
  if (!canSaveContest) throw new Error('Not authorized')

  const intent = getString(formData, 'intent') || 'save'
  const requestedPublicationStatus = getString(formData, 'publicationStatus')
  const publicationStatus: ContestPublicationStatus =
    intent === 'publish'
      ? 'published'
      : intent === 'cancel'
        ? 'cancelled'
        : intent === 'archive'
          ? 'archived'
          : isPublicationStatus(requestedPublicationStatus)
            ? requestedPublicationStatus
            : 'draft'
  const title = getString(formData, 'title')
  const slug = getString(formData, 'slug')
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '')
  const nomineeTypes = formData
    .getAll('nomineeTypes')
    .map(String)
    .filter((value): value is ContestNomineeType =>
      ['project', 'unit', 'guide'].includes(value)
    )
  const votingMethod = getString(formData, 'votingMethod') as ContestVotingMethod
  const minimumSelections = Number(getString(formData, 'minimumSelections') || 1)
  const maximumSelections = Number(getString(formData, 'maximumSelections') || 1)
  const rulesMarkdown = getString(formData, 'rulesMarkdown')
  const headerImage = getUploadedImageFile(formData, 'coverImageFile')

  const validationErrors = validateContestConfig({
    title,
    rulesMarkdown,
    nomineeTypes,
    submissionsOpenAt: getString(formData, 'submissionsOpenAt'),
    submissionsCloseAt: getString(formData, 'submissionsCloseAt'),
    votingOpenAt: getString(formData, 'votingOpenAt'),
    votingCloseAt: getString(formData, 'votingCloseAt'),
    votingMethod,
    minimumSelections,
    maximumSelections,
  })

  if (publicationStatus === 'published' && validationErrors.length > 0) {
    throw new Error(validationErrors.join(' '))
  }

  if (headerImage) {
    const validationError = validateGalleryImageFile(headerImage)
    if (validationError) throw new Error(validationError)
  }

  const { data: existingContest } = contestId
    ? await supabase
        .from('contests')
        .select('slug, publication_status, published_at, cancelled_at, archived_at')
        .eq('id', contestId)
        .maybeSingle()
    : { data: null }
  const now = new Date().toISOString()

  const typedCoverImageUrl = getString(formData, 'coverImageUrl')
  const shouldRemoveCoverImage = getBoolean(formData, 'removeCoverImage')

  const payload = {
    title,
    slug,
    short_description: getString(formData, 'shortDescription') || null,
    description: getString(formData, 'description') || null,
    rules_markdown: rulesMarkdown,
    cover_image_url: shouldRemoveCoverImage ? null : typedCoverImageUrl || null,
    visibility: getString(formData, 'visibility') || 'public',
    max_nominations_per_user: Number(getString(formData, 'maxNominations') || 1),
    requires_nomination_approval: getBoolean(formData, 'requiresApproval'),
    voting_method: votingMethod || 'approval',
    minimum_selections_per_ballot: minimumSelections,
    maximum_selections_per_ballot: maximumSelections,
    require_exact_selection_count: getBoolean(formData, 'requireExact'),
    allow_ballot_changes: getBoolean(formData, 'allowBallotChanges'),
    allow_self_vote: getBoolean(formData, 'allowSelfVote'),
    voter_access_mode: getString(formData, 'voterAccessMode') || 'public_authenticated',
    require_verified_email: getBoolean(formData, 'requireVerifiedEmail'),
    minimum_account_age_hours: Number(getString(formData, 'minimumAccountAgeHours') || 0),
    minimum_projects_for_voting: Number(getString(formData, 'minimumProjectsForVoting') || 0),
    minimum_units_for_voting: Number(getString(formData, 'minimumUnitsForVoting') || 0),
    hide_nominee_identity_during_voting: getBoolean(formData, 'hideIdentity'),
    show_live_results: getBoolean(formData, 'showLiveResults'),
    submissions_open_at: toIsoFromInput(getString(formData, 'submissionsOpenAt')),
    submissions_close_at: toIsoFromInput(getString(formData, 'submissionsCloseAt')),
    voting_open_at: toIsoFromInput(getString(formData, 'votingOpenAt')),
    voting_close_at: toIsoFromInput(getString(formData, 'votingCloseAt')),
    publication_status: publicationStatus,
    published_at:
      publicationStatus === 'published'
        ? existingContest?.published_at ?? now
        : null,
    cancelled_at:
      publicationStatus === 'cancelled'
        ? existingContest?.cancelled_at ?? now
        : null,
    archived_at:
      publicationStatus === 'archived'
        ? existingContest?.archived_at ?? now
        : null,
  }

  const result = contestId
    ? await supabase
        .from('contests')
        .update(payload)
        .eq('id', contestId)
        .select('id, slug')
        .single()
    : await supabase
        .from('contests')
        .insert({ ...payload, created_by: user.id })
        .select('id, slug')
        .single()

  if (result.error || !result.data) {
    throw new Error(result.error?.message || 'Could not save contest.')
  }

  const savedContestId = result.data.id

  if (!contestId) {
    const { error: organizerError } = await supabase.from('contest_organizers').insert({
      contest_id: savedContestId,
      user_id: user.id,
      role: 'owner',
    })

    if (organizerError) {
      throw new Error(organizerError.message)
    }
  }

  if (headerImage) {
    const fileExt = getSafeImageExtension(headerImage.name)
    const filePath = `contests/${savedContestId}/header-${Date.now()}-${crypto.randomUUID()}.${fileExt}`
    const { error: uploadError } = await supabase.storage
      .from('obsidian-images')
      .upload(filePath, headerImage, {
        contentType: headerImage.type || 'image/jpeg',
        upsert: false,
      })

    if (uploadError) {
      throw new Error(uploadError.message)
    }

    const {
      data: { publicUrl },
    } = supabase.storage.from('obsidian-images').getPublicUrl(filePath)

    const { error: coverError } = await supabase
      .from('contests')
      .update({ cover_image_url: publicUrl })
      .eq('id', savedContestId)

    if (coverError) {
      await supabase.storage.from('obsidian-images').remove([filePath])
      throw new Error(coverError.message)
    }
  }

  await replaceAllowedNomineeTypes(supabase, savedContestId, nomineeTypes)

  const { error: auditError } = await supabase.from('contest_audit_events').insert({
    contest_id: savedContestId,
    actor_user_id: user.id,
    action: contestId ? 'contest_edited' : 'contest_created',
  })

  if (auditError) {
    throw new Error(auditError.message)
  }

  contestRevalidate(existingContest?.slug)
  contestRevalidate(result.data.slug)
  redirect(`/contests/manage/${savedContestId}`)
}

export async function createMvpContestsAction() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) throw new Error('Not authenticated')
  if (!(await isCurrentUserAdmin(user.id))) throw new Error('Not authorized')

  const now = new Date()
  const submissionsOpenAt = new Date(now.getTime() - 60 * 60 * 1000)
  const submissionsCloseAt = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000)
  const votingOpenAt = new Date(now.getTime() + 15 * 24 * 60 * 60 * 1000)
  const votingCloseAt = new Date(now.getTime() + 22 * 24 * 60 * 60 * 1000)

  const presets: Array<{
    nomineeTypes: ContestNomineeType[]
    contest: Record<string, unknown>
  }> = [
    {
      nomineeTypes: ['project'],
      contest: {
        slug: 'path-to-glory-coolest-army',
        title: 'Path to Glory: Coolest Army',
        short_description: 'A closed campaign vote for the coolest army in the Path to Glory group.',
        description:
          'A private campaign contest for 12 Path to Glory players. Each invited participant may nominate one army project, then cast a ranked ballot for first and second place.',
        rules_markdown:
          'Only invited campaign participants may nominate or vote. Nominate one army project. Ranked ballots must choose exactly two armies: 1st place is worth 2 points and 2nd place is worth 1 point.',
        cover_image_url: '/onboarding/welcome-hero.jpeg',
        created_by: user.id,
        publication_status: 'published',
        visibility: 'private',
        max_nominations_per_user: 1,
        requires_nomination_approval: false,
        voting_method: 'ranked',
        minimum_selections_per_ballot: 2,
        maximum_selections_per_ballot: 2,
        require_exact_selection_count: true,
        allow_ballot_changes: true,
        allow_self_vote: false,
        voter_access_mode: 'allowlist',
        require_verified_email: true,
        minimum_account_age_hours: 0,
        minimum_projects_for_voting: 0,
        minimum_units_for_voting: 0,
        hide_nominee_identity_during_voting: false,
        show_live_results: false,
        submissions_open_at: submissionsOpenAt.toISOString(),
        submissions_close_at: submissionsCloseAt.toISOString(),
        voting_open_at: votingOpenAt.toISOString(),
        voting_close_at: votingCloseAt.toISOString(),
        published_at: now.toISOString(),
      },
    },
    {
      nomineeTypes: ['guide'],
      contest: {
        slug: 'best-painting-guide',
        title: 'Best Painting Guide',
        short_description: 'An open contest for the strongest painting guide in the gallery.',
        description:
          'An open prize contest where authenticated app users can nominate guides and vote on their top three. Voting is protected by verified email and minimum collection activity.',
        rules_markdown:
          'Users may nominate eligible painting guides. Ranked ballots must choose exactly three guides: 1st place is worth 3 points, 2nd place is worth 2 points, and 3rd place is worth 1 point. Voters must have a verified email plus at least one project and one unit in the app.',
        cover_image_url: '/onboarding/welcome-hero.jpeg',
        created_by: user.id,
        publication_status: 'published',
        visibility: 'private',
        max_nominations_per_user: 1,
        requires_nomination_approval: true,
        voting_method: 'ranked',
        minimum_selections_per_ballot: 3,
        maximum_selections_per_ballot: 3,
        require_exact_selection_count: true,
        allow_ballot_changes: true,
        allow_self_vote: false,
        voter_access_mode: 'public_authenticated',
        require_verified_email: true,
        minimum_account_age_hours: 0,
        minimum_projects_for_voting: 1,
        minimum_units_for_voting: 1,
        hide_nominee_identity_during_voting: false,
        show_live_results: false,
        submissions_open_at: submissionsOpenAt.toISOString(),
        submissions_close_at: submissionsCloseAt.toISOString(),
        voting_open_at: votingOpenAt.toISOString(),
        voting_close_at: votingCloseAt.toISOString(),
        published_at: now.toISOString(),
      },
    },
  ]

  for (const preset of presets) {
    const { data: contest, error } = await supabase
      .from('contests')
      .upsert(preset.contest, { onConflict: 'slug' })
      .select('id, slug')
      .single()

    if (error || !contest) {
      throw new Error(error?.message || 'Could not create MVP contest.')
    }

    const { error: organizerError } = await supabase
      .from('contest_organizers')
      .upsert(
        { contest_id: contest.id, user_id: user.id, role: 'owner' },
        { onConflict: 'contest_id,user_id' }
      )

    if (organizerError) {
      throw new Error(organizerError.message)
    }

    await supabase
      .from('contest_organizers')
      .delete()
      .eq('contest_id', contest.id)
      .neq('user_id', user.id)

    await replaceAllowedNomineeTypes(supabase, contest.id, preset.nomineeTypes)
    contestRevalidate(contest.slug)
  }

  revalidatePath('/contests/manage')
  redirect('/contests/manage')
}

async function getSourceSnapshot(
  sourceType: ContestNomineeType,
  sourceId: string,
  userId: string
) {
  const supabase = await createClient()
  const table =
    sourceType === 'project' ? 'projects' : sourceType === 'unit' ? 'units' : 'recipes'
  const descriptionColumn = sourceType === 'unit' ? 'notes' : 'description'
  const { data: source, error } = await supabase
    .from(table)
    .select(`id, user_id, name, ${descriptionColumn}`)
    .eq('id', sourceId)
    .eq('user_id', userId)
    .maybeSingle()

  if (error || !source) throw new Error('Source not found or not owned by you.')

  const { data: image } = await supabase
    .from('image_assets')
    .select('id, image_url, storage_bucket, storage_path, alt_text')
    .eq('entity_type', sourceType === 'guide' ? 'recipe' : sourceType)
    .eq('entity_id', sourceId)
    .eq('user_id', userId)
    .order('is_featured', { ascending: false })
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()

  if (!image?.image_url) throw new Error('Choose a source with a usable image.')

  const { data: profile } = await supabase
    .from('profiles')
    .select('username')
    .eq('id', userId)
    .maybeSingle()

  return {
    title: String(source.name || 'Untitled'),
    description: String(source[descriptionColumn as keyof typeof source] || ''),
    image,
    ownerDisplayName:
      (profile as { username?: string } | null)?.username || 'Obsidian Gallery user',
  }
}

async function copyNominationImage({
  contestId,
  nominationId,
  image,
}: {
  contestId: string
  nominationId: string
  image: { image_url: string; storage_bucket?: string | null; storage_path?: string | null }
}) {
  const service = createServiceRoleClient()
  const destinationPath = `contests/${contestId}/nominations/${nominationId}/cover.webp`

  if (image.storage_bucket && image.storage_path) {
    const { error } = await service.storage
      .from(image.storage_bucket)
      .copy(image.storage_path, destinationPath)

    if (!error) {
      return service.storage.from(image.storage_bucket).getPublicUrl(destinationPath).data.publicUrl
    }
  }

  const response = await fetch(image.image_url)
  if (!response.ok) throw new Error('Could not copy the source image.')
  const buffer = Buffer.from(await response.arrayBuffer())
  const { error } = await service.storage.from('obsidian-images').upload(destinationPath, buffer, {
    contentType: response.headers.get('content-type') || 'image/webp',
    upsert: true,
  })

  if (error) throw new Error(error.message)
  return service.storage.from('obsidian-images').getPublicUrl(destinationPath).data.publicUrl
}

export async function submitNominationAction(formData: FormData) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) throw new Error('Not authenticated')

  const contestId = getString(formData, 'contestId')
  const sourceType = getString(formData, 'sourceType') as ContestNomineeType
  const sourceId = getString(formData, 'sourceId')

  const { data: contest } = await supabase
    .from('contests')
    .select('*, allowed_nominee_types:contest_allowed_nominee_types(nominee_type)')
    .eq('id', contestId)
    .single()

  if (!contest) throw new Error('Contest not found.')
  if (getContestPhase(contest) !== 'submissions_open') {
    throw new Error('Submission period is closed.')
  }

  const allowedTypes = new Set(
    ((contest.allowed_nominee_types ?? []) as { nominee_type: string }[]).map(
      (row) => row.nominee_type
    )
  )
  if (!allowedTypes.has(sourceType)) {
    throw new Error('This contest does not accept that source type.')
  }

  if (contest.voter_access_mode === 'allowlist') {
    const { data: allowedUser, error: allowlistError } = await supabase
      .from('contest_voter_allowlist')
      .select('user_id')
      .eq('contest_id', contestId)
      .eq('user_id', user.id)
      .maybeSingle()

    if (allowlistError) throw new Error(allowlistError.message)
    if (!allowedUser) {
      throw new Error('This contest only accepts nominations from invited participants.')
    }
  }

  const countResult = await supabase
    .from('contest_nominations')
    .select('id', { count: 'exact', head: true })
    .eq('contest_id', contestId)
    .eq('owner_user_id', user.id)
    .in('status', ['pending', 'approved'])

  if ((countResult.count ?? 0) >= contest.max_nominations_per_user) {
    throw new Error('You have reached the nomination limit for this contest.')
  }

  const snapshot = await getSourceSnapshot(sourceType, sourceId, user.id)
  const nominationId = crypto.randomUUID()
  const copiedImageUrl = await copyNominationImage({
    contestId,
    nominationId,
    image: snapshot.image,
  })

  const insertPayload = {
    id: nominationId,
    contest_id: contestId,
    submitted_by_user_id: user.id,
    owner_user_id: user.id,
    source_type: sourceType,
    source_project_id: sourceType === 'project' ? sourceId : null,
    source_unit_id: sourceType === 'unit' ? sourceId : null,
    source_guide_id: sourceType === 'guide' ? sourceId : null,
    snapshot_title: snapshot.title,
    snapshot_description: snapshot.description,
    snapshot_image_url: copiedImageUrl,
    snapshot_owner_display_name: snapshot.ownerDisplayName,
    snapshot_metadata: { original_image_url: snapshot.image.image_url },
    status: contest.requires_nomination_approval ? 'pending' : 'approved',
  }

  const { error } = await supabase.from('contest_nominations').insert(insertPayload)
  if (error) {
    await createServiceRoleClient()
      .storage
      .from('obsidian-images')
      .remove([`contests/${contestId}/nominations/${nominationId}/cover.webp`])
    throw new Error(error.message)
  }

  await supabase.from('contest_audit_events').insert({
    contest_id: contestId,
    actor_user_id: user.id,
    action: 'contest_nomination_submitted',
    target_type: 'contest_nomination',
    target_id: nominationId,
    metadata: { source_type: sourceType },
  })

  await captureServerEvent({
    distinctId: user.id,
    event: 'contest_nomination_submitted',
    properties: {
      contest_id: contestId,
      nominee_source_type: sourceType,
      effective_phase: 'submissions_open',
    },
  })

  contestRevalidate(contest.slug)
  revalidatePath(`/${sourceType === 'guide' ? 'recipes' : `${sourceType}s`}/${sourceId}`)
  redirect(`/contests/${contest.slug}`)
}

export async function withdrawNominationAction(formData: FormData) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const nominationId = getString(formData, 'nominationId')
  const contestId = getString(formData, 'contestId')
  const { data: contest } = await supabase
    .from('contests')
    .select('*')
    .eq('id', contestId)
    .single()

  if (!contest || getContestPhase(contest) === 'voting_open') {
    throw new Error('Nominations can no longer be withdrawn.')
  }

  await supabase
    .from('contest_nominations')
    .update({ status: 'withdrawn', withdrawn_at: new Date().toISOString() })
    .eq('id', nominationId)
    .eq('owner_user_id', user.id)

  await supabase.from('contest_audit_events').insert({
    contest_id: contestId,
    actor_user_id: user.id,
    action: 'contest_nomination_withdrawn',
    target_type: 'contest_nomination',
    target_id: nominationId,
  })

  contestRevalidate(contest.slug)
}

export async function moderateNominationAction(formData: FormData) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const contestId = getString(formData, 'contestId')
  const nominationId = getString(formData, 'nominationId')
  const action = getString(formData, 'action')
  const reason = getString(formData, 'reason') || null
  const status =
    action === 'approve'
      ? 'approved'
      : action === 'reject'
        ? 'rejected'
        : action === 'disqualify'
          ? 'disqualified'
          : 'pending'

  const payload: Record<string, unknown> = {
    status,
    reviewed_at: new Date().toISOString(),
    reviewed_by: user.id,
  }
  if (status === 'rejected') payload.rejection_reason = reason
  if (status === 'disqualified') {
    payload.disqualified_at = new Date().toISOString()
    payload.disqualification_reason = reason
  }

  const { error } = await supabase
    .from('contest_nominations')
    .update(payload)
    .eq('id', nominationId)
    .eq('contest_id', contestId)

  if (error) throw new Error(error.message)

  await supabase.from('contest_audit_events').insert({
    contest_id: contestId,
    actor_user_id: user.id,
    action: `contest_nomination_${status}`,
    target_type: 'contest_nomination',
    target_id: nominationId,
    metadata: reason ? { reason } : {},
  })

  await captureServerEvent({
    distinctId: user.id,
    event:
      status === 'approved'
        ? 'contest_nomination_approved'
        : 'contest_nomination_rejected',
    properties: { contest_id: contestId },
  })

  revalidatePath(`/contests/manage/${contestId}`)
  revalidatePath('/contests')
}

export async function submitBallotAction(formData: FormData) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const contestId = getString(formData, 'contestId')
  const slug = getString(formData, 'slug')
  const nominationIds = formData.getAll('nominationIds').map(String).filter(Boolean)
  const { data, error } = await supabase.rpc('replace_contest_ballot', {
    p_contest_id: contestId,
    p_nomination_ids: nominationIds,
  })

  if (error) throw new Error(error.message)

  const summary = Array.isArray(data) ? data[0] : data
  await captureServerEvent({
    distinctId: user.id,
    event: summary?.updated ? 'contest_ballot_updated' : 'contest_ballot_submitted',
    properties: {
      contest_id: contestId,
      maximum_ballot_selections: nominationIds.length,
      is_update: Boolean(summary?.updated),
    },
  })

  contestRevalidate(slug)
  redirect(`/contests/${slug}/vote?submitted=1`)
}

export async function finalizeContestResultsAction(formData: FormData) {
  const supabase = await createClient()
  const contestId = getString(formData, 'contestId')
  const { error } = await supabase.rpc('finalize_contest_results', {
    p_contest_id: contestId,
  })
  if (error) throw new Error(error.message)
  revalidatePath(`/contests/manage/${contestId}`)
}

export async function publishContestResultsAction(formData: FormData) {
  const supabase = await createClient()
  const contestId = getString(formData, 'contestId')
  const slug = getString(formData, 'slug')
  const { error } = await supabase.rpc('publish_contest_results', {
    p_contest_id: contestId,
  })
  if (error) throw new Error(error.message)
  contestRevalidate(slug)
}

function parseParticipantIdentifiers(value: string) {
  return Array.from(
    new Set(
      value
        .split(/[\n,]+/)
        .map((entry) => entry.trim().replace(/^@/, ''))
        .filter(Boolean)
    )
  )
}

export async function addContestAllowlistUsersAction(formData: FormData) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const contestId = getString(formData, 'contestId')
  if (!(await canManageContest(user.id, contestId))) throw new Error('Not authorized')

  const identifiers = parseParticipantIdentifiers(getString(formData, 'emails'))
  const emails = identifiers
    .filter((identifier) => identifier.includes('@'))
    .map((email) => email.toLowerCase())
  const usernames = identifiers
    .filter((identifier) => !identifier.includes('@'))
    .map((username) => username.toLowerCase())

  if (identifiers.length === 0) return

  const service = createServiceRoleClient()
  const matchedUsers: { id: string; email?: string }[] = []
  const userIdsByUsername = new Map<string, string>()
  let page = 1

  while (page < 20) {
    const { data, error } = await service.auth.admin.listUsers({
      page,
      perPage: 1000,
    })
    if (error) throw new Error(error.message)

    matchedUsers.push(
      ...data.users
        .filter((candidate) =>
          candidate.email ? emails.includes(candidate.email.toLowerCase()) : false
        )
        .map((candidate) => ({ id: candidate.id, email: candidate.email ?? undefined }))
    )

    if (data.users.length < 1000) break
    page += 1
  }

  if (usernames.length > 0) {
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('id, username')
      .in('username', usernames)

    if (profilesError) throw new Error(profilesError.message)

    matchedUsers.push(
      ...(profiles ?? []).map((profile) => ({
        id: profile.id,
        email: undefined,
      }))
    )
    for (const profile of profiles ?? []) {
      if (profile.username) {
        userIdsByUsername.set(profile.username.toLowerCase(), profile.id)
      }
    }
  }

  const matchedUserIds = Array.from(new Set(matchedUsers.map((candidate) => candidate.id)))
  const rows = matchedUsers.map((candidate) => ({
    contest_id: contestId,
    user_id: candidate.id,
    added_by: user.id,
  }))

  if (rows.length > 0) {
    const { error } = await supabase
      .from('contest_voter_allowlist')
      .upsert(rows, { onConflict: 'contest_id,user_id', ignoreDuplicates: true })
    if (error) throw new Error(error.message)
  }

  const participantRows = identifiers.map((identifier) => {
    const normalized = identifier.toLowerCase()
    const matchedEmailUser = matchedUsers.find(
      (candidate) => candidate.email?.toLowerCase() === normalized
    )
    const isEmail = normalized.includes('@')
    const userId = isEmail
      ? matchedEmailUser?.id ?? null
      : userIdsByUsername.get(normalized) ?? null

    return {
      contest_id: contestId,
      identifier: normalized,
      email: isEmail ? normalized : null,
      username: isEmail ? null : normalized,
      user_id: userId,
      status: userId ? 'matched' : 'pending',
      added_by: user.id,
    }
  })

  if (participantRows.length > 0) {
    const { error: participantsError } = await supabase
      .from('contest_invited_participants')
      .upsert(participantRows, { onConflict: 'contest_id,identifier' })

    if (participantsError) throw new Error(participantsError.message)
  }

  await supabase.from('contest_audit_events').insert({
    contest_id: contestId,
    actor_user_id: user.id,
    action: 'contest_allowlist_users_added',
    metadata: {
      requested_count: identifiers.length,
      matched_count: matchedUserIds.length,
      unmatched_identifiers: identifiers.filter((identifier) => {
        const normalized = identifier.toLowerCase()
        if (normalized.includes('@')) {
          return !matchedUsers.some(
            (candidate) => candidate.email?.toLowerCase() === normalized
          )
        }
        return false
      }),
    },
  })

  revalidatePath(`/contests/manage/${contestId}`)
}

export async function removeContestAllowlistUserAction(formData: FormData) {
  const supabase = await createClient()
  const contestId = getString(formData, 'contestId')
  const userId = getString(formData, 'userId')

  const { error } = await supabase
    .from('contest_voter_allowlist')
    .delete()
    .eq('contest_id', contestId)
    .eq('user_id', userId)

  if (error) throw new Error(error.message)

  await supabase.from('contest_audit_events').insert({
    contest_id: contestId,
    actor_user_id: (await supabase.auth.getUser()).data.user?.id ?? null,
    action: 'contest_allowlist_user_removed',
    target_type: 'user',
    target_id: userId,
  })

  revalidatePath(`/contests/manage/${contestId}`)
}

export async function removeContestParticipantAction(formData: FormData) {
  const supabase = await createClient()
  const contestId = getString(formData, 'contestId')
  const participantId = getString(formData, 'participantId')
  const userId = getString(formData, 'userId')
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) throw new Error('Not authenticated')
  if (!(await canManageContest(user.id, contestId))) throw new Error('Not authorized')

  const { error } = await supabase
    .from('contest_invited_participants')
    .update({ status: 'removed' })
    .eq('contest_id', contestId)
    .eq('id', participantId)

  if (error) throw new Error(error.message)

  if (userId) {
    await supabase
      .from('contest_voter_allowlist')
      .delete()
      .eq('contest_id', contestId)
      .eq('user_id', userId)
  }

  revalidatePath(`/contests/manage/${contestId}`)
}
