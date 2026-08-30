export type OnboardingActionRouteInput = {
  refPage: string | null
  refComponent: string | null
}

export type OnboardingActionRouteContext = {
  subjectUnitId?: string | null
  subjectProjectId?: string | null
  subjectGuideId?: string | null
  subjectSessionId?: string | null
  featuredUnitId?: string | null
}

function withHash(path: string, component: string | null | undefined) {
  const [pathWithoutHash] = path.split('#')

  return component
    ? `${pathWithoutHash}#${encodeURIComponent(component)}`
    : pathWithoutHash
}

function unitPath(
  context: OnboardingActionRouteContext,
  tab: 'details' | 'paint' | 'progress' | 'sessions' = 'details',
  component?: string | null
) {
  const unitId = context.subjectUnitId ?? context.featuredUnitId

  if (!unitId) {
    return withHash('/units/new', component)
  }

  return withHash(`/units/${unitId}?tab=${tab}`, component)
}

function projectPath(
  context: OnboardingActionRouteContext,
  tab: 'details' | 'units' | 'add' = 'details',
  component?: string | null
) {
  return context.subjectProjectId
    ? withHash(`/projects/${context.subjectProjectId}?tab=${tab}`, component)
    : withHash('/projects?tab=create', component)
}

function guidePath(
  context: OnboardingActionRouteContext,
  tab: 'details' | 'edit' | 'steps' = 'details',
  component?: string | null
) {
  return context.subjectGuideId
    ? withHash(`/recipes/${context.subjectGuideId}?tab=${tab}`, component)
    : withHash('/recipes?tab=custom', component)
}

export function resolveOnboardingActionDestination(
  action: OnboardingActionRouteInput,
  context: OnboardingActionRouteContext = {}
) {
  const refPage = action.refPage ?? ''
  const refComponent = action.refComponent ?? null

  if (refPage.startsWith('/')) {
    return withHash(refPage, refComponent)
  }

  if (refPage === 'units') {
    return withHash('/units/new', refComponent)
  }

  if (refPage === 'unit_builder') {
    if (
      refComponent === 'unit_image' ||
      refComponent === 'unit_info' ||
      refComponent === 'unit_name'
    ) {
      return unitPath(context, 'details', refComponent)
    }

    return unitPath(context, 'details', refComponent)
  }

  if (refPage === 'unit_detail') {
    if (
      refComponent === 'progress_stage' ||
      refComponent === 'session_tracker' ||
      refComponent === 'session_goal'
    ) {
      return unitPath(
        context,
        refComponent === 'progress_stage' ? 'progress' : 'sessions',
        refComponent
      )
    }

    if (
      refComponent === 'unit_palette' ||
      refComponent === 'guide_picker' ||
      refComponent === 'paint_ownership'
    ) {
      return unitPath(context, 'paint', refComponent)
    }

    return unitPath(context, 'details', refComponent)
  }

  if (refPage === 'projects') {
    return withHash('/projects?tab=create', refComponent)
  }

  if (refPage === 'project_detail') {
    if (refComponent === 'add_unit') {
      return projectPath(context, 'add', refComponent)
    }

    return projectPath(context, 'details', refComponent)
  }

  if (refPage === 'vault' || refPage === 'paint_detail') {
    return withHash('/vault?tab=collection', refComponent)
  }

  if (refPage === 'guide_forge') {
    return withHash('/recipes?tab=custom', refComponent)
  }

  if (refPage === 'guide_builder') {
    return guidePath(context, 'edit', refComponent)
  }

  if (refPage === 'guide_detail') {
    return guidePath(context, 'details', refComponent)
  }

  if (refPage === 'dashboard') {
    return withHash('/dashboard?tab=painting-table', refComponent)
  }

  if (refPage === 'active_session' || refPage === 'session_summary') {
    return unitPath(context, 'sessions', refComponent)
  }

  return withHash('/dashboard?tab=painting-table', refComponent)
}
