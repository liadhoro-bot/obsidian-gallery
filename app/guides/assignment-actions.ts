'use server'

import { revalidatePath } from 'next/cache'
import { createClient, getSessionUser } from '../../utils/supabase/server'
import { getGuideFilesByIds, getGuidesV3Payload } from './guides-v3-data'

export type AssignableContentType = 'guide' | 'deck'
export type AssignmentTargetType = 'project' | 'unit'

export type AssignmentTarget = {
  id: string
  type: AssignmentTargetType
  name: string
  assigned: boolean
  projectIds: string[]
}

export type AssignableContent = {
  id: string
  type: AssignableContentType
  title: string
  subtitle: string
  image: string
  cards: number
  paints: number
  assigned: boolean
  recipeId: string
  likeCount: number
  saveCount: number
  viewerHasLiked: boolean
  viewerHasSaved: boolean
  isOwner: boolean
  creator?: {
    username: string
    avatar: string | null
    href: string
  }
}

async function session() {
  const supabase = await createClient()
  const user = await getSessionUser(supabase)
  if (!user) throw new Error('Not authenticated')
  return { supabase, user }
}

async function assertTargetOwner(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  type: AssignmentTargetType,
  id: string
) {
  const { data, error } = await supabase
    .from(type === 'project' ? 'projects' : 'units')
    .select('id')
    .eq('id', id)
    .eq('user_id', userId)
    .maybeSingle()
  if (error) throw new Error(error.message)
  if (!data) throw new Error(`${type === 'project' ? 'Project' : 'Unit'} not found`)
}

export async function getAssignmentTargets(
  contentType: AssignableContentType,
  contentId: string
): Promise<AssignmentTarget[]> {
  const { supabase, user } = await session()
  const [{ data: projects, error: projectsError }, { data: units, error: unitsError }, { data: unitProjects, error: unitProjectsError }, assignments] =
    await Promise.all([
      supabase.from('projects').select('id, name').eq('user_id', user.id).order('name'),
      supabase.from('units').select('id, name, project_id').eq('user_id', user.id).order('name'),
      supabase.from('unit_projects').select('unit_id, project_id').eq('user_id', user.id),
      supabase
        .from('content_assignments')
        .select('target_type, project_id, unit_id')
        .eq('user_id', user.id)
        .eq('content_type', contentType)
        .eq(contentType === 'guide' ? 'guide_id' : 'recipe_id', contentId),
    ])
  if (projectsError) throw new Error(projectsError.message)
  if (unitsError) throw new Error(unitsError.message)
  if (unitProjectsError) throw new Error(unitProjectsError.message)
  if (assignments.error) throw new Error(assignments.error.message)
  const selected = new Set(
    (assignments.data ?? []).map((row) => `${row.target_type}:${row.project_id ?? row.unit_id}`)
  )
  return [
    ...(projects ?? []).map((row) => ({ id: row.id, type: 'project' as const, name: row.name || 'Untitled Project', assigned: selected.has(`project:${row.id}`), projectIds: [] })),
    ...(units ?? []).map((row) => ({
      id: row.id,
      type: 'unit' as const,
      name: row.name || 'Untitled Unit',
      assigned: selected.has(`unit:${row.id}`),
      projectIds: Array.from(new Set([
        ...(row.project_id ? [row.project_id] : []),
        ...(unitProjects ?? []).filter((link) => link.unit_id === row.id).map((link) => link.project_id),
      ])),
    })),
  ]
}

export async function setContentAssignments(input: {
  contentType: AssignableContentType
  contentId: string
  targets: Array<{ type: AssignmentTargetType; id: string }>
}) {
  const { supabase, user } = await session()
  await Promise.all(input.targets.map((target) => assertTargetOwner(supabase, user.id, target.type, target.id)))

  const key = input.contentType === 'guide' ? 'guide_id' : 'recipe_id'
  const { error: deleteError } = await supabase
    .from('content_assignments')
    .delete()
    .eq('user_id', user.id)
    .eq('content_type', input.contentType)
    .eq(key, input.contentId)
  if (deleteError) throw new Error(deleteError.message)

  if (input.targets.length) {
    const { error } = await supabase.from('content_assignments').insert(
      input.targets.map((target) => ({
        user_id: user.id,
        target_type: target.type,
        project_id: target.type === 'project' ? target.id : null,
        unit_id: target.type === 'unit' ? target.id : null,
        content_type: input.contentType,
        guide_id: input.contentType === 'guide' ? input.contentId : null,
        recipe_id: input.contentType === 'deck' ? input.contentId : null,
      }))
    )
    if (error) throw new Error(error.message)
  }
  input.targets.forEach((target) => revalidatePath(`/${target.type}s/${target.id}`))
  return { assignedCount: input.targets.length }
}

export async function getTargetAssignmentLibrary(
  targetType: AssignmentTargetType,
  targetId: string
): Promise<{ assigned: AssignableContent[]; choices: AssignableContent[] }> {
  const { supabase, user } = await session()
  await assertTargetOwner(supabase, user.id, targetType, targetId)
  const [payload, assignmentResult] = await Promise.all([
    getGuidesV3Payload(user.id),
    supabase
      .from('content_assignments')
      .select('content_type, guide_id, recipe_id')
      .eq('user_id', user.id)
      .eq('target_type', targetType)
      .eq(targetType === 'project' ? 'project_id' : 'unit_id', targetId),
  ])
  if (assignmentResult.error) throw new Error(assignmentResult.error.message)
  const selected = new Set(
    (assignmentResult.data ?? []).map((row) => `${row.content_type}:${row.guide_id ?? row.recipe_id}`)
  )
  const guideMap = new Map(
    [
      ...payload.guideFiles,
      ...payload.libraryGuides.filter((guide) => selected.has(`guide:${guide.id}`)),
    ].map((guide) => [guide.id, guide])
  )
  // An assigned guide stays here after its owner pulls it back to private
  // or draft (it is no longer in Discover's list).
  const unlistedAssignedIds = (assignmentResult.data ?? [])
    .filter((row) => row.content_type === 'guide' && row.guide_id && !guideMap.has(row.guide_id))
    .map((row) => row.guide_id as string)
  for (const guide of (await getGuideFilesByIds(user.id, unlistedAssignedIds)).guides) guideMap.set(guide.id, guide)
  const deckMap = new Map(
    [
      ...payload.decks,
      // A deck already assigned here stays listed after it's upgraded to a guide.
      ...payload.nestableDecks.filter((deck) => selected.has(`deck:${deck.id}`)),
      ...payload.libraryDecks.filter((deck) => selected.has(`deck:${deck.id}`)),
    ].map((deck) => [deck.id, deck])
  )
  const choices: AssignableContent[] = [
    ...Array.from(guideMap.values()).map((guide) => ({ id: guide.id, type: 'guide' as const, title: guide.title, subtitle: guide.subtitle, image: guide.image, cards: guide.cards, paints: guide.palette.length, assigned: selected.has(`guide:${guide.id}`), recipeId: guide.deckId ?? '', likeCount: guide.likeCount, saveCount: guide.saveCount, viewerHasLiked: guide.viewerHasLiked, viewerHasSaved: guide.viewerHasSaved, isOwner: guide.isOwner, creator: guide.creator })),
    ...Array.from(deckMap.values()).map((deck) => ({ id: deck.id, type: 'deck' as const, title: deck.title, subtitle: deck.description || deck.category, image: deck.image, cards: deck.cards, paints: deck.paints, assigned: selected.has(`deck:${deck.id}`), recipeId: deck.id, likeCount: deck.likeCount ?? 0, saveCount: deck.saveCount ?? 0, viewerHasLiked: deck.viewerHasLiked ?? false, viewerHasSaved: deck.viewerHasSaved ?? false, isOwner: deck.isOwner })),
  ]
  return { choices, assigned: choices.filter((choice) => choice.assigned) }
}

export async function setTargetAssignments(input: {
  targetType: AssignmentTargetType
  targetId: string
  content: Array<{ type: AssignableContentType; id: string }>
}) {
  const { supabase, user } = await session()
  await assertTargetOwner(supabase, user.id, input.targetType, input.targetId)
  const targetKey = input.targetType === 'project' ? 'project_id' : 'unit_id'
  const { error: deleteError } = await supabase
    .from('content_assignments')
    .delete()
    .eq('user_id', user.id)
    .eq('target_type', input.targetType)
    .eq(targetKey, input.targetId)
  if (deleteError) throw new Error(deleteError.message)
  if (input.content.length) {
    const { error } = await supabase.from('content_assignments').insert(input.content.map((item) => ({
      user_id: user.id,
      target_type: input.targetType,
      project_id: input.targetType === 'project' ? input.targetId : null,
      unit_id: input.targetType === 'unit' ? input.targetId : null,
      content_type: item.type,
      guide_id: item.type === 'guide' ? item.id : null,
      recipe_id: item.type === 'deck' ? item.id : null,
    })))
    if (error) throw new Error(error.message)
  }
  revalidatePath(`/${input.targetType}s/${input.targetId}`)
}
