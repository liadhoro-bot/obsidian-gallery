import { getSupabaseImageUrl } from '../../utils/images/supabase-image'
import type {
  DashboardFeedUnit,
  DashboardNextActionsState,
  DashboardPaintingTableFeed,
  DashboardStatus,
} from './dashboard-data'

export type DashboardActiveUnitViewStatus =
  | 'complete'
  | 'active'
  | 'bench'
  | 'pile'
  | 'other'

export type DashboardActiveUnitsNextActionViewModel = {
  id: string
  label: string
  breadcrumb: string
  href: string
  order: number
  isActive: boolean
  completedAt: string | null
}

export type DashboardActiveUnitsMilestoneViewModel = {
  key: string
  label: string
  order: number
  totalCount: number
  completedCount: number
  actions: DashboardActiveUnitsNextActionViewModel[]
}

export type DashboardActiveUnitsNextActionsViewModel = {
  flowName: string | null
  title: string
  description: string | null
  copy: string
  totalCount: number
  completedCount: number
  actions: DashboardActiveUnitsNextActionViewModel[]
  milestones: DashboardActiveUnitsMilestoneViewModel[]
  canMutate: boolean
}

export type DashboardFeaturedUnitViewModel = {
  id: string
  name: string
  descriptor: string
  imageUrl: string | null
  progress: number
  progressLabel: string
  stageLabel: string
  statusLabel: string
}

export type DashboardActiveUnitCardViewModel = {
  id: string
  name: string
  imageUrl: string | null
  progress: number
  stageLabel: string
  status: DashboardActiveUnitViewStatus
  statusLabel: string
}

export type DashboardActiveUnitsViewModel = {
  nextActions: DashboardActiveUnitsNextActionsViewModel | null
  featuredUnit: DashboardFeaturedUnitViewModel | null
  units: DashboardActiveUnitCardViewModel[]
}

const statusLabels: Record<DashboardActiveUnitViewStatus, string> = {
  complete: 'Complete',
  active: 'Active',
  bench: 'On Bench',
  pile: 'Pile',
  other: 'Other',
}

function clampProgress(value: number | null | undefined) {
  return Math.max(0, Math.min(100, Math.round(value ?? 0)))
}

function getStageLabel(progress: number) {
  if (progress >= 100) {
    return 'Stage 6 of 6'
  }

  const stage = Math.max(1, Math.min(6, Math.ceil((progress / 100) * 6)))
  return `Stage ${stage} of 6`
}

function getCompactStageLabel(progress: number) {
  return getStageLabel(progress).replace(' of 6', '')
}

function normalizeStatus(status: DashboardStatus): DashboardActiveUnitViewStatus {
  return status === 'complete' ||
    status === 'active' ||
    status === 'bench' ||
    status === 'pile' ||
    status === 'other'
    ? status
    : 'other'
}

function getDescriptor(unit: DashboardFeedUnit) {
  const projectNames = unit.parent_project_names?.filter(Boolean) ?? []
  return projectNames.length > 0 ? projectNames.join(' / ') : 'Current unit'
}

function mapUnitImage(imageUrl: string | null, size: number) {
  return getSupabaseImageUrl(imageUrl, {
    width: size,
    height: size,
    quality: 48,
    resize: 'cover',
  })
}

function mapNextActions(
  state: DashboardNextActionsState | null,
  featuredUnit: DashboardFeaturedUnitViewModel | null
): DashboardActiveUnitsNextActionsViewModel | null {
  if (!state) {
    if (!featuredUnit) {
      return null
    }

    return {
      title: 'Next Actions',
      flowName: null,
      description: null,
      copy: `Resume ${featuredUnit.name}`,
      totalCount: 1,
      completedCount: 0,
      canMutate: false,
      actions: [
        {
          id: `resume-featured-${featuredUnit.id}`,
          label: 'Resume painting',
          breadcrumb: 'Dashboard / Featured Unit',
          href: `/units/${featuredUnit.id}?session=started&autostart=1`,
          order: 1,
          isActive: true,
          completedAt: null,
        },
      ],
      milestones: [
        {
          key: 'resume',
          label: 'Continue painting',
          order: 1,
          totalCount: 1,
          completedCount: 0,
          actions: [
            {
              id: `resume-featured-${featuredUnit.id}`,
              label: 'Resume painting',
              breadcrumb: 'Dashboard / Featured Unit',
              href: `/units/${featuredUnit.id}?session=started&autostart=1`,
              order: 1,
              isActive: true,
              completedAt: null,
            },
          ],
        },
      ],
    }
  }

  const firstOpenAction = state.actions.find((action) => !action.completedAt)
  const firstOpenMilestone = state.milestones.find((milestone) =>
    milestone.actions.some((action) => !action.completedAt)
  )
  const copy =
    firstOpenMilestone?.label ??
    state.milestones[0]?.label ??
    firstOpenAction?.label ??
    'All next actions complete'
  const activeActionId = firstOpenAction?.id ?? null
  const mappedActions = state.actions.map((action) => ({
    id: action.id,
    label: action.label,
    breadcrumb: action.breadcrumb,
    href: action.href,
    order: action.order,
    isActive: action.id === activeActionId,
    completedAt: action.completedAt,
  }))
  const mappedActionsById = new Map(
    mappedActions.map((action) => [action.id, action])
  )

  return {
    flowName: state.flowName,
    title: 'Next Action',
    description: null,
    copy,
    totalCount: state.totalCount,
    completedCount: state.completedCount,
    canMutate: true,
    actions: mappedActions,
    milestones: state.milestones.map((milestone) => ({
      key: milestone.key,
      label: milestone.label,
      order: milestone.order,
      totalCount: milestone.totalCount,
      completedCount: milestone.completedCount,
      actions: milestone.actions
        .map((action) => mappedActionsById.get(action.id))
        .filter(
          (action): action is DashboardActiveUnitsNextActionViewModel =>
            Boolean(action)
        ),
    })),
  }
}

function mapFeaturedUnit(
  unit: DashboardFeedUnit | null
): DashboardFeaturedUnitViewModel | null {
  if (!unit) {
    return null
  }

  const progress = clampProgress(unit.progress_percent)

  return {
    id: unit.unit_id,
    name: unit.name,
    descriptor: getDescriptor(unit),
    imageUrl: mapUnitImage(unit.primary_image_url, 640),
    progress,
    progressLabel: 'Campaign Progress',
    stageLabel: getStageLabel(progress),
    statusLabel: statusLabels[normalizeStatus(unit.status)],
  }
}

function mapActiveUnit(unit: DashboardFeedUnit): DashboardActiveUnitCardViewModel {
  const progress = clampProgress(unit.progress_percent)
  const status = normalizeStatus(unit.status)

  return {
    id: unit.unit_id,
    name: unit.name,
    imageUrl: mapUnitImage(unit.primary_image_url, 320),
    progress,
    stageLabel: getCompactStageLabel(progress),
    status,
    statusLabel: statusLabels[status],
  }
}

export function createDashboardActiveUnitsViewModel({
  feed,
  nextActions,
}: {
  feed: DashboardPaintingTableFeed
  nextActions: DashboardNextActionsState | null
}): DashboardActiveUnitsViewModel {
  const featuredUnit = mapFeaturedUnit(feed.heroUnit)

  return {
    nextActions: mapNextActions(nextActions, featuredUnit),
    featuredUnit,
    units: feed.units.map(mapActiveUnit),
  }
}
