'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useEffect, useMemo, useState, useTransition } from 'react'
import V3PerfIndicator from '../components/v3-perf-indicator'
import FeatureGuideTour from '../components/feature-guide-tour'
import { getSupabaseImageUrl } from '../../utils/images/supabase-image'
import { setDashboardNextActionDone } from './actions'
import type { DashboardFeatureGuide } from './feature-guide-types'
import type {
  DashboardFeedUnit,
  DashboardMetadataSummary,
  DashboardNextActionsState,
  DashboardXpState,
} from './dashboard-data'

type DashboardTab = 'active-units' | 'my-progress'

type NextAction = {
  id: string
  title: string
  path: string
  href: string
  completedAt?: string | null
  persistCompletion?: boolean
}

const initialNextActions: NextAction[] = [
  {
    id: 'add-miniature',
    title: 'Add or photograph a miniature',
    path: 'Unit Detail > Details > Gallery',
    href: '/units/guido?preview=1',
  },
  {
    id: 'choose-guide',
    title: 'Choose a beginner guide',
    path: 'Guides > My Guides',
    href: '/guides?preview=1',
  },
  {
    id: 'first-painting-step',
    title: 'Complete the first painting step',
    path: 'Home > Featured Unit',
    href: '/units/guido?preview=1',
  },
]

type DashboardV3UnitCard = {
  id: string
  title: string
  status: DashboardFeedUnit['status']
  meta: string
  progress: string
  progressValue: number
  image: string
  deadline: string | null
  isFeatured: boolean
  projectNames: string[]
  activityLabel: string
}

const fallbackActiveUnits: DashboardV3UnitCard[] = [
  {
    id: 'storm-chapel',
    title: 'Storm Chapel',
    status: 'active',
    meta: 'Prime and basecoat',
    progress: '15%',
    progressValue: 15,
    image: '/onboarding/pains/tough-choices.jpeg',
    deadline: null,
    isFeatured: false,
    projectNames: [],
    activityLabel: 'No recent session',
  },
  {
    id: 'ashen-patrol',
    title: 'Ashen Patrol',
    status: 'bench',
    meta: 'Guide selected',
    progress: '28%',
    progressValue: 28,
    image: '/onboarding/pains/paint-management.jpeg',
    deadline: null,
    isFeatured: false,
    projectNames: [],
    activityLabel: 'No recent session',
  },
  {
    id: 'copper-warden',
    title: 'Copper Warden',
    status: 'pile',
    meta: 'Paints gathered',
    progress: '52%',
    progressValue: 52,
    image: '/onboarding/pains/scheme-loss.jpeg',
    deadline: null,
    isFeatured: false,
    projectNames: [],
    activityLabel: 'No recent session',
  },
  {
    id: 'night-market',
    title: 'Night Market',
    status: 'other',
    meta: 'Details next',
    progress: '63%',
    progressValue: 63,
    image: '/onboarding/pains/pile-of-shame.jpeg',
    deadline: null,
    isFeatured: false,
    projectNames: [],
    activityLabel: 'No recent session',
  },
]

const dashboardStats = [
  { label: 'Total Units', value: '10' },
  { label: 'Time Logged', value: '7h' },
  { label: 'Colors', value: '121' },
  { label: 'Avg Session', value: '13m' },
  { label: 'Sessions/Wk', value: '3.2/wk' },
  { label: 'Completed', value: '0' },
]

function mapDashboardNextActions(state?: DashboardNextActionsState | null) {
  if (!state?.actions.length) {
    return null
  }

  return state.actions.map((action) => ({
    id: action.id,
    title: action.label,
    path: action.breadcrumb,
    href: withPreview(action.href),
    completedAt: action.completedAt,
    persistCompletion: true,
  }))
}

function mapDashboardUnit(unit: DashboardFeedUnit | null) {
  if (!unit) {
    return null
  }

  const progressValue = Math.max(0, Math.min(100, unit.progress_percent ?? 0))
  const projectNames = unit.parent_project_names ?? []

  return {
    id: unit.unit_id,
    title: unit.name || 'Untitled Unit',
    status: unit.status,
    meta:
      projectNames[0] ??
      (unit.status === 'active' ? 'Active unit' : formatStatus(unit.status)),
    progress: `${progressValue}%`,
    progressValue,
    image:
      getSupabaseImageUrl(unit.primary_image_url, {
        width: 900,
        height: 620,
        resize: 'cover',
        quality: 72,
      }) ?? '/onboarding/first-project-bg.jpeg',
    deadline: unit.deadline,
    isFeatured: unit.is_featured,
    projectNames,
    activityLabel: unit.last_session_at
      ? `Last session ${formatDisplayDate(unit.last_session_at)}`
      : `Updated ${formatDisplayDate(unit.updated_at)}`,
  } satisfies DashboardV3UnitCard
}

function mapDashboardUnits(units: DashboardFeedUnit[]) {
  return units
    .sort((first, second) => {
      if (first.is_featured && !second.is_featured) return -1
      if (!first.is_featured && second.is_featured) return 1
      return (
        new Date(second.updated_at).getTime() -
        new Date(first.updated_at).getTime()
      )
    })
    .map((unit) => mapDashboardUnit(unit))
    .filter((unit): unit is DashboardV3UnitCard => Boolean(unit))
}

function mapDashboardStats(metadata?: DashboardMetadataSummary | null) {
  if (!metadata) {
    return null
  }

  return [
    { label: 'Total Units', value: String(metadata.totalUnits) },
    { label: 'Time Logged', value: metadata.timeLogged },
    { label: 'Colors', value: String(metadata.ownedColors) },
    { label: 'Avg Session', value: metadata.averageSessionLength },
    { label: 'Sessions/Wk', value: metadata.weeklySessions },
    { label: 'Completed', value: String(metadata.completedSessionsCount) },
  ]
}

type ProgressBadge = {
  title: string
  description: string
  current: number
  required: number
  icon: 'person' | 'lock'
}

function getProgressBadges(
  metadata?: DashboardMetadataSummary | null
): ProgressBadge[] {
  const totalUnits = metadata?.totalUnits ?? 0
  const completedSessions = metadata?.completedSessionsCount ?? 0
  const ownedColors = metadata?.ownedColors ?? 0
  const loggedHours = Math.floor((metadata?.totalLoggedSeconds ?? 0) / 3600)
  const streakDays = metadata?.paintStreakDays ?? 0

  return [
    {
      title: 'Unproven Organism',
      description: 'Earned by existing. Your pile of shame grows.',
      current: 1,
      required: 1,
      icon: 'person',
    },
    {
      title: 'First Muster',
      description: 'Create your first unit.',
      current: totalUnits,
      required: 1,
      icon: 'lock',
    },
    {
      title: 'First Blood',
      description: 'Log your first painting session.',
      current: completedSessions,
      required: 1,
      icon: 'lock',
    },
    {
      title: 'Paint Keeper',
      description: 'Track 25 paints in your collection.',
      current: ownedColors,
      required: 25,
      icon: 'lock',
    },
    {
      title: 'Seven Hour Ritual',
      description: 'Log 7 total hours of painting time.',
      current: loggedHours,
      required: 7,
      icon: 'lock',
    },
    {
      title: 'Three Day Flame',
      description: 'Build a 3 day painting streak.',
      current: streakDays,
      required: 3,
      icon: 'lock',
    },
  ]
}

function withPreview(href: string) {
  try {
    const url = new URL(href, 'http://preview.local')
    url.searchParams.set('preview', '1')
    return `${url.pathname}${url.search}${url.hash}`
  } catch {
    return href
  }
}

function formatStatus(status: DashboardFeedUnit['status']) {
  if (status === 'bench') return 'On the bench'
  if (status === 'pile') return 'Pile of shame'
  if (status === 'other') return 'Other unit'
  if (status === 'complete') return 'Complete'
  return 'Active unit'
}

type UnitStatusFilter = 'all' | DashboardFeedUnit['status']

const unitStatusFilters: Array<{
  value: UnitStatusFilter
  label: string
}> = [
  { value: 'all', label: 'All Status' },
  { value: 'active', label: 'active' },
  { value: 'complete', label: 'complete' },
  { value: 'bench', label: 'bench' },
  { value: 'pile', label: 'pile of shame' },
  { value: 'other', label: 'other' },
]
function getUnitStatusFilterLabel(status: UnitStatusFilter) {
  return (
    unitStatusFilters.find((option) => option.value === status)?.label ??
    'active'
  )
}

function formatDisplayDate(value: string | null | undefined) {
  if (!value) {
    return 'No deadline'
  }

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return value
  }

  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date)
}

export default function DashboardV3Preview({
  feed,
  featureGuides,
  metadata,
  nextActions: initialNextActionsState,
  xpState,
}: {
  feed?: {
    heroUnit: DashboardFeedUnit | null
    units: DashboardFeedUnit[]
  } | null
  featureGuides: DashboardFeatureGuide[]
  metadata?: DashboardMetadataSummary | null
  nextActions?: DashboardNextActionsState | null
  xpState?: DashboardXpState | null
}) {
  const [activeTab, setActiveTab] = useState<DashboardTab>('active-units')
  const [activeGuideIndex, setActiveGuideIndex] = useState<number | null>(null)
  const seededNextActions = useMemo(
    () => mapDashboardNextActions(initialNextActionsState) ?? initialNextActions,
    [initialNextActionsState]
  )
  const [nextActions, setNextActions] =
    useState<NextAction[]>(seededNextActions)

  useEffect(() => {
    performance.mark('v3-dashboard-hydrated')
  }, [])

  const activeGuide =
    activeGuideIndex === null ? null : featureGuides[activeGuideIndex] ?? null

  function getGuideTab(uid: string): DashboardTab {
    if (
      uid === 'dashboard.tabs.my_progress' ||
      uid === 'dashboard.xp_card' ||
      uid === 'dashboard.paint_streak' ||
      uid === 'dashboard.hobby_badges' ||
      uid === 'dashboard.stats'
    ) {
      return 'my-progress'
    }

    if (
      uid === 'dashboard.tabs.active_units' ||
      uid === 'dashboard.next_actions.panel' ||
      uid === 'dashboard.featured_unit' ||
      uid === 'dashboard.resume_painting' ||
      uid === 'dashboard.up_next.panel'
    ) {
      return 'active-units'
    }

    return activeTab
  }

  function showGuideAt(index: number) {
    const guide = featureGuides[index]
    if (guide) {
      setActiveTab(getGuideTab(guide.uid))
    }
    setActiveGuideIndex(index)
  }

  const realUnits = useMemo(() => mapDashboardUnits(feed?.units ?? []), [feed])
  const displayUnits = realUnits.length ? realUnits : fallbackActiveUnits
  const heroUnit =
    mapDashboardUnit(feed?.heroUnit ?? null) ??
    displayUnits.find((unit) => unit.isFeatured) ??
    displayUnits[0] ??
    null
  const stats = useMemo(
    () => mapDashboardStats(metadata) ?? dashboardStats,
    [metadata]
  )

  function startFeatureTour() {
    if (!featureGuides.length) return
    showGuideAt(0)
  }

  function closeFeatureTour() {
    setActiveGuideIndex(null)
  }

  function showPreviousGuide() {
    const nextIndex =
      activeGuideIndex === null ? 0 : Math.max(0, activeGuideIndex - 1)
    showGuideAt(nextIndex)
  }

  function showNextGuide() {
    const nextIndex =
      activeGuideIndex === null
        ? 0
        : Math.min(featureGuides.length - 1, activeGuideIndex + 1)
    showGuideAt(nextIndex)
  }

  function addDashboardTask() {
    setActiveTab('active-units')
    setNextActions((current) => {
      const taskNumber =
        current.filter((action) => action.id.startsWith('custom-task-'))
          .length + 1

      return [
        ...current,
        {
          id: `custom-task-${taskNumber}`,
          title: `New dashboard task ${taskNumber}`,
          path: 'Dashboard > Next Actions',
          href: '/dashboard?preview=1',
        },
      ]
    })
  }

  return (
    <main
      className="v3-material-walnut min-h-screen overflow-x-hidden text-[#2b2117]"
      data-v3-dashboard-indicator="root"
      data-v3-dashboard-feed={feed?.units.length ? 'live' : 'fallback'}
    >
      <V3PerfIndicator surface="dashboard" detail={activeTab} />
      <div className="v3-dashboard-shell mx-auto flex min-h-screen w-full max-w-[430px] flex-col gap-4 px-3 pb-28 pt-0 sm:my-3 sm:min-h-[calc(100vh-1.5rem)] sm:max-w-[520px] sm:gap-5 sm:rounded-[28px] sm:px-5 sm:pb-32">
        <DashboardHeader
          helpExpanded={activeGuide !== null}
          onHelp={startFeatureTour}
          onAdd={addDashboardTask}
        />

        <section className="v3-walnut-header rounded-[18px] border p-1.5 shadow-[0_8px_18px_rgba(0,0,0,0.34)]">
          <div
            className="grid grid-cols-2 rounded-[14px] border border-[#120a05] bg-[#170d07]/90 p-1 shadow-[inset_0_2px_8px_rgba(0,0,0,0.64)]"
            role="tablist"
            aria-label="Dashboard sections"
          >
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'active-units'}
              onClick={() => setActiveTab('active-units')}
              data-feature-guide-target="dashboard.tabs.active_units"
              className={[
                'h-10 rounded-[8px] text-sm font-semibold transition',
                activeTab === 'active-units'
                  ? 'v3-parchment-panel border border-[#8e6a42] text-[#24180f] shadow-[0_2px_5px_rgba(0,0,0,0.35)]'
                  : 'v3-walnut-control text-[#dac49e]/82 hover:text-[#f1dfbd]',
              ].join(' ')}
            >
              Active Units
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'my-progress'}
              onClick={() => setActiveTab('my-progress')}
              data-feature-guide-target="dashboard.tabs.my_progress"
              className={[
                'h-10 rounded-[8px] text-sm font-semibold transition',
                activeTab === 'my-progress'
                  ? 'v3-parchment-panel border border-[#8e6a42] text-[#24180f] shadow-[0_2px_5px_rgba(0,0,0,0.35)]'
                  : 'v3-walnut-control text-[#dac49e]/82 hover:text-[#f1dfbd]',
              ].join(' ')}
            >
              My Progress
            </button>
          </div>
        </section>

        {activeTab === 'active-units' ? (
          <>
            <NextActionCard actions={nextActions} />
            <FeaturedUnitCard unit={heroUnit} />
            <ActiveUnits units={displayUnits} />
          </>
        ) : (
          <MyProgressTab metadata={metadata} stats={stats} xpState={xpState} />
        )}

        {activeGuide !== null && activeGuideIndex !== null ? (
          <FeatureGuideTour
            guide={activeGuide}
            activeIndex={activeGuideIndex}
            totalGuides={featureGuides.length}
            onPrevious={showPreviousGuide}
            onNext={showNextGuide}
            onClose={closeFeatureTour}
          />
        ) : null}
      </div>
    </main>
  )
}

function DashboardHeader({
  helpExpanded,
  onHelp,
  onAdd,
}: {
  helpExpanded: boolean
  onHelp: () => void
  onAdd: () => void
}) {
  return (
    <header className="v3-walnut-header -mx-3 grid grid-cols-[52px_1fr_auto] items-center gap-3 rounded-b-[22px] border-x-0 border-b border-t-0 px-4 pb-7 pt-5 sm:-mx-5 sm:rounded-t-[28px] sm:border-x sm:px-5">
      <button
        type="button"
        aria-label="Open dashboard menu"
        className="v3-walnut-button grid h-12 w-12 place-items-center rounded-full border border-[#b88945]/45 text-[#e7c891] shadow-[inset_0_1px_0_rgba(255,235,190,0.16),0_4px_10px_rgba(0,0,0,0.42)] transition hover:text-[#f4ddb1]"
      >
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          className="h-7 w-7"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
        >
          <path d="M5 7h14" />
          <path d="M5 12h14" />
          <path d="M5 17h14" />
        </svg>
      </button>
      <h1
        className="min-w-0 text-center font-serif text-[38px] font-semibold leading-none tracking-normal text-[#f4e4c6] drop-shadow-[0_2px_1px_rgba(0,0,0,0.72)] sm:text-[42px]"
        data-feature-guide-target="dashboard.page"
      >
        Dashboard
      </h1>
      <div className="flex shrink-0 items-center gap-2">
        <button
          type="button"
          onClick={onHelp}
          aria-expanded={helpExpanded}
          aria-label="Show dashboard explanation"
          data-feature-guide-target="dashboard.help"
          className="v3-walnut-button grid h-12 w-12 place-items-center rounded-full border border-[#b88945]/50 text-[21px] font-black text-[#d7b06c] shadow-[inset_0_1px_0_rgba(255,235,190,0.14),0_4px_10px_rgba(0,0,0,0.42)] transition hover:border-[#e3bd74] hover:text-[#f0d59c]"
        >
          ?
        </button>
        <button
          type="button"
          onClick={onAdd}
          aria-label="Add next action"
          data-feature-guide-target="dashboard.add_next_action"
          className="v3-brass-button grid h-12 w-12 place-items-center rounded-full border border-[#f0cf83]/70 text-[30px] font-black leading-none text-[#241609] shadow-[inset_0_1px_0_rgba(255,244,198,0.36),0_5px_12px_rgba(0,0,0,0.44)] transition hover:brightness-110"
        >
          +
        </button>
      </div>
    </header>
  )
}

function NextActionCard({ actions }: { actions: NextAction[] }) {
  const [completedActionIds, setCompletedActionIds] = useState<Set<string>>(
    () =>
      new Set(
        actions
          .filter((action) => action.completedAt)
          .map((action) => action.id)
      )
  )
  const [isExpanded, setIsExpanded] = useState(false)
  const [isPending, startTransition] = useTransition()
  const completedCount = useMemo(
    () =>
      actions.filter((action) => completedActionIds.has(action.id)).length,
    [actions, completedActionIds]
  )
  const progressPercent = actions.length
    ? Math.round((completedCount / actions.length) * 100)
    : 0

  function toggleAction(action: NextAction) {
    const nextDone = !completedActionIds.has(action.id)
    setCompletedActionIds((current) => {
      const next = new Set(current)
      if (nextDone) {
        next.add(action.id)
      } else {
        next.delete(action.id)
      }
      return next
    })

    if (!action.persistCompletion) {
      return
    }

    startTransition(async () => {
      const result = await setDashboardNextActionDone(action.id, nextDone)

      if (!result.ok) {
        setCompletedActionIds((current) => {
          const next = new Set(current)
          if (nextDone) {
            next.delete(action.id)
          } else {
            next.add(action.id)
          }
          return next
        })
      }
    })
  }

  return (
    <section
      data-feature-guide-target="dashboard.next_actions.panel"
      data-v3-dashboard-indicator="next-actions"
      data-v3-dashboard-pending={isPending ? 'true' : 'false'}
      className="v3-parchment-panel overflow-hidden rounded-[14px] border text-[#2b2117]"
    >
      <button
        type="button"
        onClick={() => setIsExpanded((current) => !current)}
        aria-expanded={isExpanded}
        className="flex w-full items-center gap-3.5 px-4 py-4 text-left transition hover:bg-[#f5e8cf]/55"
      >
        <span className="grid h-14 w-14 shrink-0 place-items-center rounded-full border border-[#7c5a33]/60 bg-[#6f5637] text-[#ead5ad] shadow-[inset_0_1px_0_rgba(255,255,255,0.2),0_3px_7px_rgba(0,0,0,0.3)]">
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            className="h-6 w-6"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M8 7h8" />
            <path d="M9 3h6v4H9z" />
            <path d="M7 7h10l1 14H6L7 7Z" />
            <path d="M9 12h6" />
          </svg>
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-serif text-[27px] font-semibold leading-tight text-[#2c2118]">
            Next Actions
          </span>
          <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] font-semibold text-[#5e4a35]">
            <span>Your first miniature</span>
            <span aria-hidden="true">-</span>
            <span>{completedCount}/{actions.length} complete</span>
          </span>
        </span>
        <span className="v3-progress-track hidden w-[112px] shrink-0 overflow-hidden rounded-full min-[390px]:block" aria-hidden="true">
          <span
            className="v3-progress-fill block h-2 rounded-full"
            style={{ width: `${Math.max(progressPercent, 4)}%` }}
          />
        </span>
        <span className="grid h-9 w-9 shrink-0 place-items-center text-[#4a331f]">
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            className={[
              'h-6 w-6 transition-transform',
              isExpanded ? 'rotate-180' : '',
            ].join(' ')}
            fill="none"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="m6 9 6 6 6-6" />
          </svg>
        </span>
      </button>

      {isExpanded ? (
        <div className="v3-paper-card mx-3 mb-3 overflow-hidden rounded-[8px] border border-[#c9b28b] shadow-[inset_0_1px_3px_rgba(70,46,25,0.12)]">
          {actions.map((action) => {
            const isDone = completedActionIds.has(action.id)

            return (
              <div
                key={action.id}
                className="grid grid-cols-[36px_1fr_42px] items-center gap-2 border-b border-[#cdb994] px-3 py-2.5 last:border-b-0"
              >
                <button
                  type="button"
                  onClick={() => toggleAction(action)}
                  aria-pressed={isDone}
                  aria-label={
                    isDone
                      ? `Mark ${action.title} incomplete`
                      : `Mark ${action.title} complete`
                  }
                  className={[
                    'grid h-8 w-8 shrink-0 place-items-center rounded-[6px] border transition',
                    isDone
                      ? 'border-[#7b613e] bg-[#7c6747] text-[#f5e6c8] shadow-[inset_0_1px_0_rgba(255,255,255,0.18)]'
                      : 'border-[#8e744f] bg-[#efe0c4] text-transparent hover:text-[#5a3e24]',
                  ].join(' ')}
                >
                  <svg
                    aria-hidden="true"
                    viewBox="0 0 24 24"
                    className="h-4 w-4"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="m5 12 4 4L19 6" />
                  </svg>
                </button>
                <div className="min-w-0">
                  <p
                    className={[
                      'truncate text-[14px] font-semibold leading-tight transition',
                      isDone
                        ? 'text-[#806d51] line-through'
                        : 'text-[#302418]',
                    ].join(' ')}
                  >
                    {action.title}
                  </p>
                  <p className="mt-1 truncate text-[11px] font-medium text-[#6f5a3d]">
                    {action.path}
                  </p>
                </div>
                <Link
                  href={action.href}
                  aria-label={`${isDone ? 'Review' : 'Open'} ${action.title}`}
                  className="grid h-9 w-9 shrink-0 place-items-center rounded-[7px] border border-[#927346] bg-[#ead9ba] text-[#4a331f] shadow-[0_1px_3px_rgba(69,45,24,0.24)] transition hover:bg-[#f6ead0]"
                >
                  <svg
                    aria-hidden="true"
                    viewBox="0 0 24 24"
                    className="h-5 w-5"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="m9 18 6-6-6-6" />
                  </svg>
                </Link>
              </div>
            )
          })}
        </div>
      ) : null}
    </section>
  )
}

function MyProgressTab({
  metadata,
  stats,
  xpState,
}: {
  metadata?: DashboardMetadataSummary | null
  stats: Array<{ label: string; value: string }>
  xpState?: DashboardXpState | null
}) {
  const progressPercent = Math.max(
    0,
    Math.min(100, xpState?.progressPercent ?? 0)
  )
  const filledXpSegments = Math.round((progressPercent / 100) * 24)
  const badges = getProgressBadges(metadata)
  const earnedBadges = badges.filter((badge) => badge.current >= badge.required)
  const lockedBadges = badges.filter((badge) => badge.current < badge.required)
  const visibleBadges = [...earnedBadges, ...lockedBadges].slice(0, 4)

  return (
    <section
      className="grid gap-4"
      data-v3-dashboard-indicator="my-progress"
      data-v3-dashboard-progress-source={metadata ? 'live' : 'fallback'}
    >
      <section
        className="rounded-[12px] border border-white/[0.06] bg-[#121720] p-5 shadow-[0_18px_50px_rgba(0,0,0,0.22)]"
        data-v3-dashboard-indicator="xp-card"
      >
        <p className="text-[9px] font-black uppercase tracking-[0.28em] text-white/26">
          Path to Grandmastery
        </p>

        <div className="mt-3 flex items-end justify-between gap-4">
          <div className="flex items-baseline gap-2">
            <span className="text-[30px] font-black leading-none text-white">
              {xpState?.xpIntoLevel ?? 0}
            </span>
            <span className="text-sm font-black text-white/34">
              / {xpState?.xpNeededForLevel ?? 1} XP
            </span>
          </div>
          <p className="pb-1 text-[10px] font-black text-cyan-300">
            Level {xpState?.currentLevel ?? 0} - {xpState?.xpToNextLevel ?? 0}{' '}
            to next
          </p>
        </div>

        <div
          className="mt-4 grid grid-cols-[repeat(24,minmax(0,1fr))] gap-1"
          aria-label="XP progress toward next level"
        >
          {Array.from({ length: 24 }).map((_, index) => (
            <span
              key={index}
              className={[
                'h-1.5 rounded-full',
                index < filledXpSegments ? 'bg-cyan-300' : 'bg-white/12',
              ].join(' ')}
            />
          ))}
        </div>
      </section>

      <section className="rounded-[12px] border border-white/[0.06] bg-[#121720] p-5 shadow-[0_18px_50px_rgba(0,0,0,0.22)]">
        <div className="flex items-start justify-between gap-4">
          <div className="flex min-w-0 gap-3">
            <span className="mt-1 text-cyan-300/38">
              <StreakIcon />
            </span>
            <div className="min-w-0">
              <p className="text-[9px] font-black uppercase tracking-[0.28em] text-white/26">
                Paint Streak
              </p>
              <h2 className="mt-2 text-xl font-black leading-none text-white/38">
                {metadata?.paintStreakDays
                  ? metadata.paintStreak
                  : 'No streak'}
              </h2>
            </div>
          </div>

          <div className="text-right">
            <p className="text-[9px] font-black uppercase tracking-[0.22em] text-white/26">
              Last Session
            </p>
            <p className="mt-2 text-sm font-black text-white/42">
              {metadata?.timeSinceLastSession ?? 'No sessions'}
            </p>
          </div>
        </div>

        <Link
          href="/units/guido?preview=1&tab=paint"
          className="mt-4 flex min-h-10 items-center gap-2 rounded-[10px] bg-[#162033] px-4 py-3 text-xs font-semibold text-white/48 transition hover:bg-cyan-300/12 hover:text-cyan-200"
        >
          <span className="grid h-4 w-4 place-items-center rounded-full border border-cyan-300/45 text-[9px] font-black text-cyan-300">
            +
          </span>
          {metadata?.paintStreakDays
            ? 'Continue your streak with a painting session'
            : 'Start a session today to begin a new streak'}
        </Link>
      </section>

      <section className="grid gap-2">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-[10px] font-black uppercase tracking-[0.24em] text-white/26">
            Badges Earned
          </h2>
          <p className="text-[10px] font-black text-cyan-300/70">
            {earnedBadges.length}/{badges.length}
          </p>
        </div>

        {visibleBadges.map((badge) => (
          <ProgressBadgeRow key={badge.title} badge={badge} />
        ))}
      </section>

      <section className="grid gap-2">
        <h2 className="text-[10px] font-black uppercase tracking-[0.24em] text-white/26">
          Stats
        </h2>
        <div className="grid grid-cols-3 gap-2">
          {stats.map((stat) => (
            <div
              key={stat.label}
              className="min-h-[82px] rounded-[10px] border border-white/[0.05] bg-[#121720] p-3"
            >
              <p className="text-[8px] font-black uppercase tracking-[0.2em] text-white/28">
                {stat.label}
              </p>
              <p className="mt-3 text-lg font-black leading-none text-white">
                {stat.value}
              </p>
            </div>
          ))}
        </div>
      </section>
    </section>
  )
}

function ProgressBadgeRow({ badge }: { badge: ProgressBadge }) {
  const isEarned = badge.current >= badge.required
  const progressLabel = isEarned
    ? 'Earned'
    : `${Math.min(badge.current, badge.required)}/${badge.required}`

  return (
    <div
      className={[
        'flex items-center gap-3 rounded-[12px] border px-4 py-3',
        isEarned
          ? 'border-white/[0.06] bg-[#121720]'
          : 'border-white/[0.03] bg-white/[0.025] opacity-55',
      ].join(' ')}
      data-v3-dashboard-indicator={isEarned ? 'badge-earned' : 'badge-locked'}
    >
      <span
        className={[
          'grid h-10 w-10 shrink-0 place-items-center rounded-full',
          isEarned
            ? 'bg-[#182334] text-cyan-300'
            : 'bg-white/[0.04] text-white/26',
        ].join(' ')}
      >
        {badge.icon === 'person' ? <BadgePersonIcon /> : <LockBadgeIcon />}
      </span>
      <span className="min-w-0 flex-1">
        <span
          className={[
            'block truncate text-xs font-black',
            isEarned ? 'text-white' : 'text-white/48',
          ].join(' ')}
        >
          {badge.title}
        </span>
        <span
          className={[
            'mt-1 block truncate text-[10px] font-semibold',
            isEarned ? 'text-white/36' : 'text-white/28',
          ].join(' ')}
        >
          {badge.description}
        </span>
      </span>
      <span
        className={[
          'shrink-0 text-[10px] font-black',
          isEarned ? 'text-cyan-300' : 'text-white/34',
        ].join(' ')}
      >
        {progressLabel}
      </span>
    </div>
  )
}

function StreakIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 3c2.2 2.4 3.3 4.6 3.3 6.7 0 2.1-1.5 3.8-3.3 3.8s-3.3-1.7-3.3-3.8c0-1 .3-2 .8-3" />
      <path d="M6.5 11.5a5.5 5.5 0 1 0 11 0" />
    </svg>
  )
}

function BadgePersonIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 4a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z" />
      <path d="M8 20v-4a4 4 0 0 1 8 0v4" />
      <path d="M9 12h6" />
      <path d="M6 7 4 5" />
      <path d="m18 7 2-2" />
    </svg>
  )
}

function LockBadgeIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M7 10V8a5 5 0 0 1 10 0v2" />
      <path d="M6 10h12v10H6z" />
    </svg>
  )
}

function FeaturedUnitCard({ unit }: { unit: DashboardV3UnitCard | null }) {
  if (!unit) {
    return (
      <section
        data-feature-guide-target="dashboard.featured_unit"
        data-v3-dashboard-indicator="featured-unit-empty"
        className="v3-parchment-panel rounded-[12px] border p-5 text-[#2b2117]"
      >
        <p className="v3-brass-plaque inline-flex rounded-[5px] border border-[#6e4d25] px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-[#26180b] shadow-[inset_0_1px_0_rgba(255,239,190,0.25),0_2px_4px_rgba(55,34,15,0.32)]">
          Featured Unit
        </p>
        <h2 className="mt-3 font-serif text-2xl font-semibold text-[#2c2118]">
          No active units yet
        </h2>
        <p className="mt-2 text-sm font-semibold leading-6 text-[#6b543b]">
          Add or activate a unit to make the dashboard come alive.
        </p>
      </section>
    )
  }

  return (
    <section
      data-feature-guide-target="dashboard.featured_unit"
      data-v3-dashboard-indicator="featured-unit"
      className="v3-parchment-panel rounded-[14px] border p-4 text-[#2b2117] sm:p-5"
    >
      <div className="v3-brass-plaque mb-3 inline-flex rounded-[5px] border border-[#6e4d25] px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-[#26180b] shadow-[inset_0_1px_0_rgba(255,239,190,0.25),0_2px_4px_rgba(55,34,15,0.32)]">
        Featured Unit
      </div>
      <div className="grid grid-cols-[minmax(138px,0.92fr)_minmax(0,1fr)] gap-4">
        <div className="v3-photo-mount rounded-[12px] border border-[#8b673e] p-2 shadow-[0_4px_10px_rgba(69,45,24,0.42)]">
          <div className="relative aspect-[4/5] overflow-hidden rounded-[8px] border border-[#4b321d] bg-[#20140b] shadow-[inset_0_0_18px_rgba(0,0,0,0.45)]">
            <Image
              src={unit.image}
              alt=""
              fill
              sizes="(max-width: 640px) 42vw, 178px"
              className="object-cover transition duration-500 hover:scale-[1.025]"
              priority
            />
          </div>
        </div>
        <div className="flex min-w-0 flex-col py-1.5">
          <h2 className="line-clamp-2 font-serif text-[29px] font-semibold leading-[0.98] text-[#2c2118]">
            {unit.title}
          </h2>
          <p className="mt-1 truncate text-[14px] font-semibold italic text-[#4e3b28]">
            {unit.meta}
          </p>
          <div className="my-3 h-px bg-[#b79b70]/85 shadow-[0_1px_0_rgba(255,255,255,0.32)]" />
          <p className="text-[11px] font-black uppercase tracking-normal text-[#453220]">
            Campaign Progress
          </p>
          <div className="mt-2 flex items-center gap-3">
            <div className="v3-progress-track h-3 min-w-0 flex-1 overflow-hidden rounded-full">
              <div
                className="v3-progress-fill h-full rounded-full"
                style={{ width: `${Math.max(unit.progressValue, 4)}%` }}
              />
            </div>
            <span className="shrink-0 font-serif text-[24px] font-semibold leading-none text-[#25190f]">
              {unit.progress}
            </span>
          </div>
          <p className="mt-3 text-[13px] font-semibold leading-5 text-[#4f3c28]">
            {unit.activityLabel}
          </p>
          <Link
            href={`/units/${unit.id}?preview=1`}
            data-feature-guide-target="dashboard.resume_painting"
            className="v3-walnut-button mt-auto inline-flex h-12 items-center justify-center gap-2 rounded-[8px] border border-[#0c0c0b] px-4 text-[15px] font-black text-[#f2dfb8] shadow-[inset_0_1px_0_rgba(255,255,255,0.1),0_4px_10px_rgba(0,0,0,0.38)] transition hover:brightness-110"
          >
            <span className="grid h-6 w-6 place-items-center rounded-full text-[#d4a449]">
              <svg
                aria-hidden="true"
                viewBox="0 0 24 24"
                className="h-5 w-5"
                fill="currentColor"
              >
                <path d="M8 5.5v13l10-6.5-10-6.5Z" />
              </svg>
            </span>
            Resume
          </Link>
        </div>
      </div>
    </section>
  )
}

function ActiveUnits({ units }: { units: DashboardV3UnitCard[] }) {
  const [viewMode, setViewMode] = useState<'grid' | 'cards'>('grid')
  const [statusFilter, setStatusFilter] = useState<UnitStatusFilter>('all')
  const [isStatusMenuOpen, setIsStatusMenuOpen] = useState(false)
  const statusLabel = getUnitStatusFilterLabel(statusFilter)
  const filteredUnits =
    statusFilter === 'all'
      ? units
      : units.filter((unit) => unit.status === statusFilter)
  const visibleUnits = filteredUnits.slice(0, viewMode === 'grid' ? 3 : 2)

  return (
    <section
      className="v3-parchment-panel rounded-[14px] border p-4 text-[#2b2117] sm:p-5"
      data-feature-guide-target="dashboard.up_next.panel"
    >
      <div className="v3-brass-plaque mb-3 inline-flex rounded-[5px] border border-[#6e4d25] px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-[#26180b] shadow-[inset_0_1px_0_rgba(255,239,190,0.25),0_2px_4px_rgba(55,34,15,0.32)]">
        Up Next
      </div>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="font-serif text-[24px] font-semibold leading-none text-[#2c2118]">
            Active Units
          </h2>
          <div className="relative mt-3 inline-block">
            <button
              type="button"
              aria-haspopup="menu"
              aria-expanded={isStatusMenuOpen}
              aria-label={`Change unit status filter, currently showing ${statusLabel} units`}
              onClick={() => setIsStatusMenuOpen((isOpen) => !isOpen)}
              className="v3-walnut-control inline-flex h-9 items-center gap-2 rounded-[7px] border border-[#2c1a0f] px-3 text-sm font-semibold text-[#ecd8b2] shadow-[inset_0_1px_0_rgba(255,235,190,0.08),0_2px_5px_rgba(0,0,0,0.22)] transition hover:brightness-110"
            >
              <span className="truncate capitalize">{statusLabel}</span>
              <svg
                aria-hidden="true"
                viewBox="0 0 24 24"
                className="h-4 w-4 text-[#c99a55]"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="m6 9 6 6 6-6" />
              </svg>
            </button>
            {isStatusMenuOpen ? (
              <div
                role="menu"
                className="absolute left-0 top-full z-20 mt-2 w-44 overflow-hidden rounded-[8px] border border-[#6e4d25] bg-[#2d2016] p-1 text-left shadow-2xl shadow-black/45"
              >
                {unitStatusFilters.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    role="menuitemradio"
                    aria-checked={statusFilter === option.value}
                    onClick={() => {
                      setStatusFilter(option.value)
                      setIsStatusMenuOpen(false)
                    }}
                    className={[
                      'block w-full rounded-[6px] px-3 py-2 text-left text-[12px] font-semibold capitalize transition',
                      statusFilter === option.value
                        ? 'bg-[#ead8b6] text-[#26180b]'
                        : 'text-[#e5cfaa]/80 hover:bg-[#3b2a1c] hover:text-[#f5e7cd]',
                    ].join(' ')}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        </div>
        <div
          className="v3-walnut-control flex h-10 shrink-0 rounded-[8px] border border-[#2c1a0f] p-1 shadow-[inset_0_1px_2px_rgba(0,0,0,0.42)]"
          aria-label="Next units layout"
        >
          <button
            type="button"
            aria-label="Show units as grid"
            aria-pressed={viewMode === 'grid'}
            onClick={() => setViewMode('grid')}
            className={[
              'grid w-9 place-items-center rounded-[6px] transition',
              viewMode === 'grid'
                ? 'bg-[#9d7537] text-[#26180b] shadow-[inset_0_1px_0_rgba(255,235,190,0.25)]'
                : 'text-[#dcc196]/65 hover:text-[#f5e7cd]',
            ].join(' ')}
          >
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z" />
            </svg>
          </button>
          <button
            type="button"
            aria-label="Show units as cards"
            aria-pressed={viewMode === 'cards'}
            onClick={() => setViewMode('cards')}
            className={[
              'grid w-9 place-items-center rounded-[6px] transition',
              viewMode === 'cards'
                ? 'bg-[#9d7537] text-[#26180b] shadow-[inset_0_1px_0_rgba(255,235,190,0.25)]'
                : 'text-[#dcc196]/65 hover:text-[#f5e7cd]',
            ].join(' ')}
          >
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />
            </svg>
          </button>
        </div>
      </div>

      {viewMode === 'grid' ? (
        <div
          className="mt-5 grid grid-cols-3 gap-3"
          data-v3-dashboard-active-units-layout="grid"
        >
          {visibleUnits.length ? (
            visibleUnits.map((unit) => (
              <UnitGridCard key={unit.id} unit={unit} />
            ))
          ) : (
            <ActiveUnitsEmptyState statusLabel={statusLabel} />
          )}
        </div>
      ) : (
        <div
          className="mt-4 grid gap-3"
          data-v3-dashboard-active-units-layout="cards"
        >
          {visibleUnits.length ? (
            visibleUnits.map((unit) => (
              <UnitWideCard key={unit.id} unit={unit} />
            ))
          ) : (
            <ActiveUnitsEmptyState statusLabel={statusLabel} />
          )}
        </div>
      )}
    </section>
  )
}

function ActiveUnitsEmptyState({ statusLabel }: { statusLabel: string }) {
  return (
    <div
      data-v3-dashboard-indicator="active-unit-empty"
      className="v3-paper-card col-span-full rounded-[8px] border border-dashed border-[#a58a63] px-4 py-6 text-center text-sm font-semibold text-[#70593d]"
    >
      No {statusLabel} units to show.
    </div>
  )
}

function UnitGridCard({ unit }: { unit: DashboardV3UnitCard }) {
  return (
    <Link
      href={`/units/${unit.id}?preview=1`}
      data-v3-dashboard-indicator="active-unit"
      className="v3-paper-card group relative overflow-hidden rounded-[12px] border border-[#a88355] p-2 shadow-[0_3px_7px_rgba(69,45,24,0.32)] transition hover:border-[#7b5831] hover:brightness-105"
    >
      <div className="v3-photo-mount rounded-[9px] border border-[#9a7448] p-1.5">
        <div className="relative aspect-[4/5] overflow-hidden rounded-[7px] border border-[#5f4327] bg-[#21160d] shadow-[inset_0_0_14px_rgba(0,0,0,0.42)]">
          <Image
            src={unit.image}
            alt=""
            fill
            sizes="(max-width: 640px) 33vw, 142px"
            className="object-cover transition duration-500 group-hover:scale-[1.025]"
          />
        </div>
      </div>
      <span className="v3-pin absolute left-1/2 top-2.5 h-4 w-4 -translate-x-1/2 rounded-full border border-[#6e4d25] shadow-[0_1px_3px_rgba(0,0,0,0.42)]" aria-hidden="true" />
      <div className="px-2 pb-2.5 pt-3.5 text-center">
        <p className="truncate font-serif text-[18px] font-semibold leading-none text-[#2c2118]">
          {unit.title}
        </p>
        <p className="mt-1 truncate text-[12px] font-semibold text-[#5a4530]">
          {unit.meta}
        </p>
        <div className="v3-progress-track mt-3 h-2 overflow-hidden rounded-full">
          <div
            className="v3-progress-fill h-full rounded-full"
            style={{ width: `${Math.max(unit.progressValue, 4)}%` }}
          />
        </div>
      </div>
    </Link>
  )
}

function UnitWideCard({ unit }: { unit: DashboardV3UnitCard }) {
  return (
    <Link
      href={`/units/${unit.id}?preview=1`}
      data-v3-dashboard-indicator="active-unit"
      className="v3-paper-card group relative grid grid-cols-[104px_1fr] gap-3 rounded-[10px] border border-[#a88355] p-2 shadow-[0_2px_5px_rgba(69,45,24,0.28)] transition hover:border-[#7b5831] hover:brightness-105"
    >
      <div className="v3-photo-mount rounded-[9px] border border-[#9a7448] p-1.5">
        <div className="relative min-h-[108px] overflow-hidden rounded-[6px] border border-[#5f4327] bg-[#21160d]">
          <Image
            src={unit.image}
            alt=""
            fill
            sizes="112px"
            className="object-cover transition duration-500 group-hover:scale-[1.025]"
          />
        </div>
      </div>
      <div className="min-w-0 py-1 pr-1">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate font-serif text-[18px] font-semibold leading-none text-[#2c2118]">
              {unit.title}
            </p>
            <p className="mt-1 truncate text-[12px] font-semibold text-[#5a4530]">
              {unit.meta}
            </p>
          </div>
          <span className="v3-brass-plaque shrink-0 rounded-[6px] border border-[#9a7448] px-2 py-1 text-[11px] font-black text-[#4a331f]">
            {unit.progress}
          </span>
        </div>
        <p className="mt-3 truncate text-[12px] font-semibold text-[#735a3d]">
          {unit.activityLabel}
        </p>
        <div className="v3-progress-track mt-3 h-2 overflow-hidden rounded-full">
          <div
            className="v3-progress-fill h-full rounded-full"
            style={{ width: `${Math.max(unit.progressValue, 4)}%` }}
          />
        </div>
      </div>
    </Link>
  )
}
