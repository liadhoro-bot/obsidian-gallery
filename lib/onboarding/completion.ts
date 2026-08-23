import { revalidatePath } from 'next/cache'
import { captureServerEvent } from '../../utils/analytics/server'
import { createClient } from '../../utils/supabase/server'
import type { OnboardingFlowName } from './action-definitions'

type ActiveFlowRow = {
  flow_name: OnboardingFlowName | null
  goal_key: string | null
  experience_level: string | null
  completed_at: string | null
  dismissed_at: string | null
}

type FlowActionRow = {
  id: string
  flow_name: OnboardingFlowName
  action_key: string
  action_order: number | null
  milestone_key: string | null
  milestone_order: number | null
  ref_page: string | null
  ref_component: string | null
}

export type OnboardingSubjectContext = {
  subjectUnitId?: string | null
  subjectProjectId?: string | null
  subjectGuideId?: string | null
  subjectSessionId?: string | null
}

type CompleteOnboardingActionInput = OnboardingSubjectContext & {
  userId: string
  actionKey: string
  flowName?: OnboardingFlowName
}

function withoutUndefinedContext(context: OnboardingSubjectContext) {
  const update: Record<string, string | null> = {}

  if (context.subjectUnitId !== undefined) {
    update.subject_unit_id = context.subjectUnitId
  }

  if (context.subjectProjectId !== undefined) {
    update.subject_project_id = context.subjectProjectId
  }

  if (context.subjectGuideId !== undefined) {
    update.subject_guide_id = context.subjectGuideId
  }

  if (context.subjectSessionId !== undefined) {
    update.subject_session_id = context.subjectSessionId
  }

  return update
}

function isMissingFlowContextColumn(error: { code?: string; message?: string }) {
  return (
    error.code === 'PGRST204' ||
    /schema cache/i.test(error.message ?? '') ||
    /subject_.*_id/i.test(error.message ?? '')
  )
}

async function updateOnboardingFlowContext({
  userId,
  flowName,
  context,
}: {
  userId: string
  flowName: OnboardingFlowName
  context: OnboardingSubjectContext
}) {
  const update = withoutUndefinedContext(context)

  if (Object.keys(update).length === 0) {
    return
  }

  const supabase = await createClient()
  const { error } = await supabase
    .from('user_onboarding_flows')
    .update({
      ...update,
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', userId)
    .eq('flow_name', flowName)

  if (error && !isMissingFlowContextColumn(error)) {
    console.error('Failed to update onboarding flow context:', error)
  }
}

export async function completeOnboardingAction({
  userId,
  actionKey,
  flowName,
  subjectUnitId,
  subjectProjectId,
  subjectGuideId,
  subjectSessionId,
}: CompleteOnboardingActionInput) {
  const supabase = await createClient()
  const { data: activeFlow, error: flowError } = await supabase
    .from('user_onboarding_flows')
    .select('flow_name, goal_key, experience_level, completed_at, dismissed_at')
    .eq('user_id', userId)
    .maybeSingle<ActiveFlowRow>()

  if (flowError || !activeFlow?.flow_name) {
    return { completed: false, reason: 'no_active_flow' as const }
  }

  if (activeFlow.dismissed_at || activeFlow.completed_at) {
    return { completed: false, reason: 'inactive_flow' as const }
  }

  if (flowName && activeFlow.flow_name !== flowName) {
    return { completed: false, reason: 'different_flow' as const }
  }

  const { data: action, error: actionError } = await supabase
    .from('onboarding_flow_actions')
    .select(
      'id, flow_name, action_key, action_order, milestone_key, milestone_order, ref_page, ref_component'
    )
    .eq('flow_name', activeFlow.flow_name)
    .eq('action_key', actionKey)
    .maybeSingle<FlowActionRow>()

  if (actionError || !action) {
    return { completed: false, reason: 'action_not_in_flow' as const }
  }

  await updateOnboardingFlowContext({
    userId,
    flowName: activeFlow.flow_name,
    context: {
      subjectUnitId,
      subjectProjectId,
      subjectGuideId,
      subjectSessionId,
    },
  })

  const completedAt = new Date().toISOString()
  const { error: completionError } = await supabase
    .from('user_onboarding_action_completions')
    .upsert(
      {
        user_id: userId,
        flow_action_id: action.id,
        completed_at: completedAt,
      },
      { onConflict: 'user_id,flow_action_id' }
    )

  if (completionError) {
    return { completed: false, reason: 'completion_failed' as const }
  }

  const [{ data: allActions }, { data: completedActions }] = await Promise.all([
    supabase
      .from('onboarding_flow_actions')
      .select('id, milestone_key')
      .eq('flow_name', activeFlow.flow_name),
    supabase
      .from('user_onboarding_action_completions')
      .select('flow_action_id')
      .eq('user_id', userId),
  ])

  const activeActionIds = new Set((allActions ?? []).map((row) => row.id))
  const completedActionIds = new Set(
    (completedActions ?? [])
      .map((row) => row.flow_action_id)
      .filter((id): id is string => activeActionIds.has(id))
  )
  const isFlowComplete =
    activeActionIds.size > 0 && completedActionIds.size >= activeActionIds.size
  const milestoneActionIds = (allActions ?? [])
    .filter((row) => row.milestone_key === action.milestone_key)
    .map((row) => row.id)
  const isMilestoneComplete =
    milestoneActionIds.length > 0 &&
    milestoneActionIds.every((id) => completedActionIds.has(id))

  if (isFlowComplete) {
    await supabase
      .from('user_onboarding_flows')
      .update({
        completed_at: completedAt,
        updated_at: completedAt,
      })
      .eq('user_id', userId)
  }

  await captureServerEvent({
    distinctId: userId,
    event: 'onboarding_action_completed',
    properties: {
      flow_name: activeFlow.flow_name,
      goal_key: activeFlow.goal_key,
      experience_level: activeFlow.experience_level,
      action_key: action.action_key,
      milestone_key: action.milestone_key,
      action_order: action.action_order,
      ref_page: action.ref_page,
      ref_component: action.ref_component,
    },
  })

  if (isMilestoneComplete) {
    await captureServerEvent({
      distinctId: userId,
      event: 'onboarding_milestone_completed',
      properties: {
        flow_name: activeFlow.flow_name,
        goal_key: activeFlow.goal_key,
        milestone_key: action.milestone_key,
        milestone_order: action.milestone_order,
      },
    })
  }

  if (isFlowComplete) {
    await captureServerEvent({
      distinctId: userId,
      event: 'onboarding_flow_completed',
      properties: {
        flow_name: activeFlow.flow_name,
        goal_key: activeFlow.goal_key,
        experience_level: activeFlow.experience_level,
      },
    })
  }

  revalidatePath('/dashboard')

  return {
    completed: true,
    flowCompleted: isFlowComplete,
    milestoneCompleted: isMilestoneComplete,
  }
}

export async function completeOnboardingActions(
  input: Omit<CompleteOnboardingActionInput, 'actionKey'> & {
    actionKeys: string[]
  }
) {
  const results = []

  for (const actionKey of input.actionKeys) {
    results.push(
      await completeOnboardingAction({
        ...input,
        actionKey,
      })
    )
  }

  return results
}

export async function reconcileOnboardingFlowStart({
  userId,
  flowName,
}: {
  userId: string
  flowName: OnboardingFlowName | null
}) {
  if (!flowName) {
    return
  }

  const supabase = await createClient()
  await updateOnboardingFlowContext({
    userId,
    flowName,
    context: {
      subjectUnitId: null,
      subjectProjectId: null,
      subjectGuideId: null,
      subjectSessionId: null,
    },
  })

  if (flowName === 'paint_miniature') {
    const { data: unit } = await supabase
      .from('units')
      .select('id, name, complexity, unit_size, deadline, notes')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle<{
        id: string
        name: string | null
        complexity: number | null
        unit_size: number | null
        deadline: string | null
        notes: string | null
      }>()

    if (!unit) {
      return
    }

    await updateOnboardingFlowContext({
      userId,
      flowName,
      context: { subjectUnitId: unit.id },
    })

    const actionKeys = ['create_unit']

    if (unit.name?.trim()) {
      actionKeys.push('name_unit')
    }

    const [{ count: imageCount }, { count: progressCount }] = await Promise.all([
      supabase
        .from('image_assets')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('entity_type', 'unit')
        .eq('entity_id', unit.id),
      supabase
        .from('unit_progress_steps')
        .select('id', { count: 'exact', head: true })
        .eq('unit_id', unit.id)
        .neq('status', 'pending'),
    ])

    if ((imageCount ?? 0) > 0) {
      actionKeys.push('add_unit_image')
    }

    if (unit.complexity || unit.unit_size || unit.deadline || unit.notes) {
      actionKeys.push('complete_unit_info')
    }

    if ((progressCount ?? 0) > 0) {
      actionKeys.push('set_unit_progress_stage')
    }

    await completeOnboardingActions({
      userId,
      flowName,
      subjectUnitId: unit.id,
      actionKeys,
    })
  }

  if (flowName === 'organize_hobby') {
    const [{ data: project }, { data: unit }, { count: ownedPaints }] =
      await Promise.all([
        supabase
          .from('projects')
          .select('id')
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle<{ id: string }>(),
        supabase
          .from('units')
          .select('id, project_id, status, is_featured')
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle<{
            id: string
            project_id: string | null
            status: string | null
            is_featured: boolean | null
          }>(),
        supabase
          .from('user_paint_ownership')
          .select('paint_catalog_id', { count: 'exact', head: true })
          .eq('user_id', userId)
          .eq('is_owned', true),
      ])

    await updateOnboardingFlowContext({
      userId,
      flowName,
      context: {
        subjectProjectId: project?.id ?? unit?.project_id ?? null,
        subjectUnitId: unit?.id ?? null,
      },
    })

    const actionKeys = []

    if (project) {
      actionKeys.push('create_project')
    }

    if (unit) {
      actionKeys.push('add_project_unit')
    }

    if (unit?.status) {
      actionKeys.push('set_unit_status')
    }

    if (unit?.status === 'bench' || unit?.status === 'active') {
      actionKeys.push('add_unit_to_active_bench')
    }

    if (unit?.is_featured) {
      actionKeys.push('feature_unit')
    }

    if ((ownedPaints ?? 0) > 0) {
      actionKeys.push('add_owned_paints')
    }

    await completeOnboardingActions({
      userId,
      flowName,
      subjectProjectId: project?.id ?? unit?.project_id ?? null,
      subjectUnitId: unit?.id ?? null,
      actionKeys,
    })
  }

  if (flowName === 'create_content') {
    const { data: guide } = await supabase
      .from('recipes')
      .select('id, name, image_url')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle<{
        id: string
        name: string | null
        image_url: string | null
      }>()

    if (!guide) {
      return
    }

    await updateOnboardingFlowContext({
      userId,
      flowName,
      context: { subjectGuideId: guide.id },
    })

    const actionKeys = ['create_guide']

    if (guide.name?.trim()) {
      actionKeys.push('name_guide')
    }

    if (guide.image_url) {
      actionKeys.push('add_guide_cover')
    }

    await completeOnboardingActions({
      userId,
      flowName,
      subjectGuideId: guide.id,
      actionKeys,
    })
  }
}
