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
  options: {
    // 'overview' is read by the shipped unit page. 'paint' is only read by
    // the V3 preview, where it is the painting-SESSION tab (calendar,
    // scheduler, start/finish session) — not paint colors, despite the
    // name. Any unrecognized tab value (including 'paint') falls back to
    // 'overview' on the shipped page, which also has the session tracker
    // inline, so it is always safe to pass for session-related actions.
    tab?: 'overview' | 'paint' | 'progress'
    edit?: 'header' | 'details' | 'gallery'
  } = {}
) {
  const unitId = context.subjectUnitId ?? context.featuredUnitId

  if (!unitId) {
    return '/units/new'
  }

  const params = new URLSearchParams()

  if (options.tab) {
    params.set('tab', options.tab)
  }

  if (options.edit) {
    params.set('edit', options.edit)
  }

  const query = params.toString()

  return query ? `/units/${unitId}?${query}` : `/units/${unitId}`
}

function projectPath(
  context: OnboardingActionRouteContext,
  tab: 'details' | 'units' = 'details'
) {
  return context.subjectProjectId
    ? `/projects/${context.subjectProjectId}?tab=${tab}`
    : '/projects?tab=create'
}

function guidePath(
  context: OnboardingActionRouteContext,
  options: {
    tab?: 'details' | 'edit'
    edit?: 'header'
    preview?: boolean
  } = {}
) {
  if (!context.subjectGuideId) {
    return '/recipes?tab=custom'
  }

  const params = new URLSearchParams()

  if (options.tab) {
    params.set('tab', options.tab)
  }

  if (options.edit) {
    params.set('edit', options.edit)
  }

  if (options.preview) {
    params.set('preview', '1')
  }

  const query = params.toString()

  return query
    ? `/recipes/${context.subjectGuideId}?${query}`
    : `/recipes/${context.subjectGuideId}`
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
    return '/units/new'
  }

  if (refPage === 'unit_builder') {
    if (refComponent === 'unit_name') {
      return unitPath(context, { edit: 'header' })
    }

    if (refComponent === 'unit_image') {
      return unitPath(context, { edit: 'gallery' })
    }

    // unit_info and any other unit_builder component land on the details
    // editor, which covers complexity/size/deadline/notes.
    return unitPath(context, { edit: 'details' })
  }

  if (refPage === 'unit_detail') {
    if (refComponent === 'progress_stage') {
      return unitPath(context, { tab: 'progress' })
    }

    // The status selector lives in the details editor on the Overview tab.
    if (refComponent === 'unit_status') {
      return unitPath(context, { edit: 'details' })
    }

    // The session tracker, scheduler, and session-goal controls live in the
    // painting-session area (the "paint" tab).
    if (refComponent === 'session_tracker' || refComponent === 'session_goal') {
      return unitPath(context, { tab: 'paint' })
    }

    // unit_palette, paint_ownership, guide_picker, featured_toggle, and
    // next_action all live inline on the Overview tab — the palette and the
    // Guides card (guide assignment) are both there, not a separate tab.
    return unitPath(context, { tab: 'overview' })
  }

  if (refPage === 'projects') {
    return '/projects?tab=create'
  }

  if (refPage === 'project_detail') {
    return projectPath(context, refComponent === 'add_unit' ? 'units' : 'details')
  }

  if (refPage === 'vault' || refPage === 'paint_detail') {
    return '/vault?tab=collection'
  }

  if (refPage === 'guide_forge') {
    return '/recipes?tab=custom'
  }

  if (refPage === 'guide_builder') {
    if (refComponent === 'guide_title') {
      return guidePath(context, { tab: 'details', edit: 'header' })
    }

    if (refComponent === 'guide_preview') {
      return guidePath(context, { tab: 'details', preview: true })
    }

    if (refComponent === 'guide_cover') {
      return guidePath(context, { tab: 'details' })
    }

    // deck_builder, step_card, card_paints, card_image, card_picker, and
    // card_order are all edited from the Edit Guide tab.
    return guidePath(context, { tab: 'edit' })
  }

  if (refPage === 'guide_detail') {
    // Assigning a guide to a unit happens from the unit's Guides card on
    // its Overview tab, not from the guide's own page.
    if (refComponent === 'assign_guide') {
      return unitPath(context, { tab: 'overview' })
    }

    return guidePath(context, { tab: 'details' })
  }

  if (refPage === 'dashboard') {
    return '/dashboard?tab=painting-table'
  }

  if (refPage === 'active_session' || refPage === 'session_summary') {
    return unitPath(context, { tab: 'paint' })
  }

  return '/dashboard?tab=painting-table'
}
