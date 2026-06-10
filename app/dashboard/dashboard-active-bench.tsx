import { createClient } from '../../utils/supabase/server'
import DashboardUnitStatusList, {
  type DashboardStatusUnit,
  type UnitStatus,
} from './dashboard-unit-status-list'

type StageProgressRow = {
  unit_id: string
  stage_key?: string | null
  step_key?: string | null
  is_done?: boolean | null
  status?: string | null
}

type UnitImageRow = {
  entity_id: string
  image_url: string
}

type SessionRow = {
  unit_id: string
  started_at: string
}

type UnitRow = {
  id: string
  name: string
  deadline: string | null
  created_at: string
  status: UnitStatus
}

const UNIT_STATUSES: UnitStatus[] = [
  'complete',
  'active',
  'bench',
  'pile',
  'other',
]

function getUnitProgress(unit: UnitRow, stages: StageProgressRow[]) {
  if (unit.status === 'complete') return 100

  const stageDoneMap = new Map<string, boolean>()

  for (const stage of stages) {
    const key = stage.stage_key ?? stage.step_key
    if (!key) continue

    const isDone = stage.is_done === true || stage.status === 'done'

    if (isDone) {
      stageDoneMap.set(key, true)
    } else if (!stageDoneMap.has(key)) {
      stageDoneMap.set(key, false)
    }
  }

  if (stageDoneMap.get('done') === true) return 100

  const progressStageKeys = [
    'assembled',
    'primed',
    'initial_paints',
    'fine_details',
    'base_rim',
  ]

  const completed = progressStageKeys.filter(
    (key) => stageDoneMap.get(key) === true
  ).length

  return completed * 20
}

export default async function DashboardActiveBench({
  userId,
}: {
  userId?: string
}) {
  const supabase = await createClient()

  let resolvedUserId = userId

  if (!resolvedUserId) {
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) return null

    resolvedUserId = user.id
  }

  const { data: units, error } = await supabase
    .from('units')
    .select('id, name, deadline, created_at, status')
    .eq('user_id', resolvedUserId)
    .in('status', UNIT_STATUSES)

  if (error || !units?.length) {
    return <DashboardUnitStatusList units={[]} />
  }

  const dashboardUnits = units as UnitRow[]
  const unitIds = dashboardUnits.map((unit) => unit.id)

  const [
    stageProgressResult,
    progressStepsResult,
    imageResult,
    sessionResult,
  ] = await Promise.all([
    supabase
      .from('unit_stage_progress')
      .select('unit_id, stage_key, is_done')
      .in('unit_id', unitIds),

    supabase
      .from('unit_progress_steps')
      .select('unit_id, step_key, status')
      .in('unit_id', unitIds),

    supabase
      .from('image_assets')
      .select('entity_id, image_url')
      .eq('entity_type', 'unit')
      .eq('is_featured', true)
      .in('entity_id', unitIds),

    supabase
      .from('unit_sessions')
      .select('unit_id, started_at')
      .in('unit_id', unitIds)
      .order('started_at', { ascending: false }),
  ])

  const progressRows = [
    ...((stageProgressResult.data ?? []) as StageProgressRow[]),
    ...((progressStepsResult.data ?? []) as StageProgressRow[]),
  ]
  const progressRowsByUnitId = progressRows.reduce<
    Record<string, StageProgressRow[]>
  >((rowsByUnitId, row) => {
    if (!rowsByUnitId[row.unit_id]) {
      rowsByUnitId[row.unit_id] = []
    }

    rowsByUnitId[row.unit_id].push(row)
    return rowsByUnitId
  }, {})

  const imageMap = new Map<string, string>()

  for (const row of (imageResult.data ?? []) as UnitImageRow[]) {
    imageMap.set(row.entity_id, row.image_url)
  }

  const lastSessionMap = new Map<string, string>()

  for (const row of (sessionResult.data ?? []) as SessionRow[]) {
    if (!lastSessionMap.has(row.unit_id)) {
      lastSessionMap.set(row.unit_id, row.started_at)
    }
  }

  const displayUnits: DashboardStatusUnit[] = [...dashboardUnits]
    .sort((a, b) => {
      const createdAtSort =
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()

      if (a.deadline && b.deadline) {
        const deadlineSort =
          new Date(a.deadline).getTime() - new Date(b.deadline).getTime()

        return deadlineSort || createdAtSort
      }

      if (a.deadline) return -1
      if (b.deadline) return 1

      const aLastSession = lastSessionMap.get(a.id)
      const bLastSession = lastSessionMap.get(b.id)

      if (aLastSession && bLastSession) {
        const sessionSort =
          new Date(bLastSession).getTime() -
          new Date(aLastSession).getTime()

        return sessionSort || createdAtSort
      }

      if (aLastSession) return -1
      if (bLastSession) return 1

      return createdAtSort
    })
    .map((unit) => ({
      ...unit,
      progress: getUnitProgress(unit, progressRowsByUnitId[unit.id] ?? []),
      imageUrl: imageMap.get(unit.id) || null,
      lastSession: lastSessionMap.get(unit.id) || null,
    }))

  return <DashboardUnitStatusList units={displayUnits} />
}
