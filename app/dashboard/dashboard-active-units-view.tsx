'use client'

import Image from 'next/image'
import { createPortal } from 'react-dom'
import type { ReactNode } from 'react'
import { useEffect, useMemo, useRef, useState, useTransition } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import {
  OgButton,
  OgPlaque,
  OgProgressTrack,
} from '@/src/components/v3'
import V3PerfIndicator from '../components/v3-perf-indicator'
import AppHamburgerMenu from '../components/app-hamburger-menu'
import FeatureGuideTour from '../components/feature-guide-tour'
import { findVisibleFeatureGuideIndex } from '../components/feature-guide-navigation'
import PrefetchLink from '../components/prefetch-link'
import DashboardQuickActionStartButton from './dashboard-quick-action-start-button'
import DashboardResumeButton from './dashboard-resume-button'
import { setDashboardNextActionDone } from './actions'
import type { DashboardFeatureGuide } from './feature-guide-types'
import type {
  DashboardActiveUnitCardViewModel,
  DashboardActiveUnitViewStatus,
  DashboardActiveUnitsNextActionViewModel,
  DashboardActiveUnitsViewModel,
} from './dashboard-active-units-model'
import styles from './dashboard-og.module.css'

type ActiveTab = 'profile' | 'painting-table'

type StatusOption = {
  value: DashboardActiveUnitViewStatus
  label: string
}

const statusOptions: StatusOption[] = [
  { value: 'active', label: 'Active' },
  { value: 'bench', label: 'Bench' },
  { value: 'pile', label: 'Pile' },
  { value: 'complete', label: 'Complete' },
  { value: 'other', label: 'Other' },
]

function HelpIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" aria-hidden="true">
      <path d="M9.6 9a2.6 2.6 0 0 1 4.95 1.15c0 1.75-1.55 2.25-2.25 3.3-.22.33-.3.68-.3 1.05" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.9" />
      <path d="M12 18h.01" stroke="currentColor" strokeLinecap="round" strokeWidth="2.6" />
    </svg>
  )
}

function PlusIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden="true">
      <path d="M12 5v14M5 12h14" stroke="currentColor" strokeLinecap="round" strokeWidth="2" />
    </svg>
  )
}

function BottleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" aria-hidden="true">
      <path d="M9 3.5h6v3l1.9 2.2v10.05c0 .95-.75 1.75-1.7 1.75H8.8c-.95 0-1.7-.8-1.7-1.75V8.7L9 6.5v-3Z" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.7" />
      <path d="M8.2 13h7.6M9.2 6.5h5.6" stroke="currentColor" strokeLinecap="round" strokeWidth="1.7" />
    </svg>
  )
}

function ChevronIcon({ open = false }: { open?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden="true" data-open={open}>
      <path d="m6 9 6 6 6-6" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
    </svg>
  )
}

function PlayIcon() {
  return (
    <span className={styles.ctaIcon} aria-hidden="true">
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
        <path d="M8 5.75v12.5L18 12 8 5.75Z" />
      </svg>
    </span>
  )
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" aria-hidden="true">
      <path d="m5 12.5 4.2 4.1L19 7" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
    </svg>
  )
}

function MiniatureImage({
  imageUrl,
  name,
  priority = false,
}: {
  imageUrl: string | null
  name: string
  priority?: boolean
}) {
  if (imageUrl) {
    return (
      <Image
        src={imageUrl}
        alt={name}
        fill
        className="object-cover"
        sizes="(max-width: 480px) 42vw, 164px"
        priority={priority}
      />
    )
  }

  return (
    <div className={styles.imageFallback} aria-label={`${name} has no image yet`}>
      <span className={styles.imageFallbackFigure} aria-hidden="true" />
      <span>{name.slice(0, 2).toUpperCase()}</span>
    </div>
  )
}

function DashboardHeader({
  helpExpanded,
  onHelp,
}: {
  helpExpanded: boolean
  onHelp: () => void
}) {
  return (
    <header className={styles.appHeader}>
      <AppHamburgerMenu
        buttonClassName={`${styles.headerControl} ${styles.menuControl}`}
        aria-label="Open dashboard menu"
      />

      <h1 className={styles.appTitle} data-feature-guide-target="dashboard.page">
        Dashboard
      </h1>

      <div className={styles.appHeaderActions}>
        <button
          type="button"
          className={styles.headerControl}
          aria-expanded={helpExpanded}
          aria-label="Show dashboard explanation"
          onClick={onHelp}
          data-feature-guide-target="dashboard.help"
          data-feature-guide-launcher-button="true"
        >
          <HelpIcon />
        </button>
        <DashboardQuickActionStartButton
          className={styles.headerControl}
          data-feature-guide-target="dashboard.add_next_action"
        >
          <PlusIcon />
          <span className="sr-only">Create project or unit</span>
        </DashboardQuickActionStartButton>
      </div>
    </header>
  )
}

function DashboardTabs({ currentTab, onChange }: { currentTab: ActiveTab; onChange: (tab: ActiveTab) => void }) {
  return (
    <div className={styles.primaryTabs} role="tablist" aria-label="Dashboard sections">
      <button
        type="button"
        role="tab"
        aria-selected={currentTab === 'painting-table'}
        className={styles.primaryTab}
        data-active={currentTab === 'painting-table'}
        data-feature-guide-target="dashboard.tabs.active_units"
        onClick={() => onChange('painting-table')}
      >
        Active Units
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={currentTab === 'profile'}
        className={styles.primaryTab}
        data-active={currentTab === 'profile'}
        data-feature-guide-target="dashboard.tabs.my_progress"
        onClick={() => onChange('profile')}
      >
        My Progress
      </button>
    </div>
  )
}

function NextActionsObject({ nextActions }: { nextActions: NonNullable<DashboardActiveUnitsViewModel['nextActions']> | null }) {
  const router = useRouter()
  const [isOpen, setIsOpen] = useState(true)
  const [completionOverrides, setCompletionOverrides] = useState<
    Map<string, boolean>
  >(() => new Map())
  const [isPending, startTransition] = useTransition()

  if (!nextActions) {
    return null
  }

  const isActionDone = (action: DashboardActiveUnitsNextActionViewModel) =>
    completionOverrides.get(action.id) ?? Boolean(action.completedAt)
  const batchSize = 3
  const completedCount = nextActions.actions.filter(isActionDone).length
  const progress = Math.round((completedCount / batchSize) * 100)

  function toggleAction(action: DashboardActiveUnitsNextActionViewModel) {
    if (!nextActions?.canMutate) {
      return
    }

    const nextDone = !isActionDone(action)

    setCompletionOverrides((current) => {
      const next = new Map(current)
      next.set(action.id, nextDone)
      return next
    })

    startTransition(async () => {
      const result = await setDashboardNextActionDone(action.id, nextDone)

      if (!result.ok) {
        setCompletionOverrides((current) => {
          const next = new Map(current)
          next.set(action.id, !nextDone)
          return next
        })
        return
      }

      const isBatchComplete =
        nextDone &&
        nextActions.actions.every((currentAction) =>
          currentAction.id === action.id ? true : isActionDone(currentAction)
        )

      if (isBatchComplete) {
        router.refresh()
      }
    })
  }

  return (
    <section
      className={styles.nextActionObject}
      data-v3-dashboard-indicator="next-actions"
      data-feature-guide-target="dashboard.next_actions.panel"
      data-v3-dashboard-next-actions-source={
        nextActions.canMutate ? 'onboarding-flow' : 'featured-unit-fallback'
      }
      aria-label="Next actions"
    >
      <button type="button" className={styles.nextActionSummary} onClick={() => setIsOpen((open) => !open)} aria-expanded={isOpen}>
        <span className={styles.nextActionMedallion} aria-hidden="true">
          <BottleIcon />
        </span>
        <span className={styles.nextActionCopy}>
          <strong>{nextActions.title}</strong>
          <span>{nextActions.copy}</span>
        </span>
        <span className={styles.nextActionProgress} aria-label={`${completedCount} of ${batchSize} visible actions complete`}>
          <span className={styles.nextActionCount}>{completedCount}/{batchSize} complete</span>
          <span className={styles.nextActionTrack} aria-hidden="true">
            <span style={{ width: `${progress}%` }} />
          </span>
        </span>
        <span className={styles.nextActionChevron} aria-hidden="true">
          <ChevronIcon open={isOpen} />
        </span>
      </button>

      {isOpen ? (
        <div
          className={styles.nextActionDrawer}
          data-pending={isPending}
        >
          {nextActions.milestones.map((milestone) => (
            <section key={milestone.key} className={styles.nextActionMilestone}>
              <div className={styles.nextActionMilestoneHeader}>
                <strong>{milestone.label}</strong>
                <span>
                  {milestone.actions.filter(isActionDone).length}/{milestone.totalCount} complete
                </span>
              </div>

              <div className={styles.nextActionMilestoneRows}>
                {milestone.actions.map((action) => {
                  const isDone = isActionDone(action)

                  return (
                    <div
                      key={action.id}
                      className={styles.nextActionRow}
                      data-active={action.isActive}
                      data-complete={isDone}
                    >
                      <button
                        type="button"
                        onClick={() => toggleAction(action)}
                        className={styles.nextActionCheck}
                        data-done={isDone}
                        disabled={!nextActions.canMutate || isPending}
                        aria-pressed={isDone}
                        aria-label={
                          isDone
                            ? `Mark ${action.label} incomplete`
                            : `Mark ${action.label} complete`
                        }
                      >
                        <CheckIcon />
                      </button>
                      <div className={styles.nextActionRowText}>
                        <span data-done={isDone}>{action.label}</span>
                        <small>{action.breadcrumb}</small>
                      </div>
                      <PrefetchLink href={action.href} className={styles.nextActionGo} aria-label={`Go to ${action.label}`}>
                        Go
                      </PrefetchLink>
                    </div>
                  )
                })}
              </div>
            </section>
          ))}
        </div>
      ) : null}
    </section>
  )
}

function FeaturedUnit({ unit }: { unit: DashboardActiveUnitsViewModel['featuredUnit'] }) {
  if (!unit) {
    return (
      <section
        className={styles.featuredPanel}
        id="featured-unit"
        data-v3-dashboard-indicator="featured-unit-empty"
        data-feature-guide-target="dashboard.featured_unit"
      >
        <OgPlaque className={styles.panelPlaque}>Featured Unit</OgPlaque>
        <div className={styles.emptyFeatured}>
          <h2>No active units yet</h2>
          <p>Add or activate a unit to make the dashboard come alive.</p>
        </div>
      </section>
    )
  }

  return (
    <section
      className={styles.featuredPanel}
      id="featured-unit"
      data-v3-dashboard-indicator="featured-unit"
      data-feature-guide-target="dashboard.featured_unit"
    >
      <div className={styles.featuredDetails}>
        <OgPlaque className={styles.featuredPlaque}>Featured Unit</OgPlaque>
        <div>
          <h2 className={styles.featuredTitle}>{unit.name}</h2>
          <p className={styles.featuredDescriptor}>{unit.descriptor}</p>
        </div>

        <div className={styles.featuredProgressBlock}>
          <p className={styles.progressHeading}>{unit.progressLabel}</p>
          <div className={styles.featuredProgressLine}>
            <OgProgressTrack className={styles.featuredProgressTrack} label={`${unit.name} progress`} value={unit.progress} />
            <span className={styles.featuredPercent}>{unit.progress}%</span>
          </div>
        </div>

        <div className={styles.featuredStageBlock}>
          <span>{unit.stageLabel}</span>
          <span>{unit.statusLabel}</span>
        </div>

        <div className={styles.resumeAction}>
          <span data-feature-guide-target="dashboard.resume_painting">
            <DashboardResumeButton unitId={unit.id} icon={<PlayIcon />} label="Resume" />
          </span>
        </div>
      </div>

      <PrefetchLink href={`/units/${unit.id}`} className={styles.featuredImageMount} aria-label={`Open ${unit.name}`}>
        <span className={styles.featuredImageFrame}>
          <MiniatureImage imageUrl={unit.imageUrl} name={unit.name} priority />
        </span>
      </PrefetchLink>
    </section>
  )
}

function ActiveUnitCard({ unit }: { unit: DashboardActiveUnitCardViewModel }) {
  return (
    <article
      className={styles.unitTile}
      data-v3-dashboard-indicator="active-unit"
    >
      <PrefetchLink href={`/units/${unit.id}`} className={styles.unitCardLink} aria-label={`Open ${unit.name}`}>
        <span className={styles.unitImageMount}>
          <span className={styles.unitImageFrame}>
            <MiniatureImage imageUrl={unit.imageUrl} name={unit.name} />
          </span>
        </span>
        <span className={styles.unitCardBody}>
          <strong>{unit.name}</strong>
          <span>{unit.stageLabel}</span>
          <OgProgressTrack className={styles.unitProgressTrack} label={`${unit.name} progress`} value={unit.progress} />
        </span>
      </PrefetchLink>
    </article>
  )
}

function ActiveUnitsPanel({ units }: { units: DashboardActiveUnitCardViewModel[] }) {
  const [selectedStatus, setSelectedStatus] = useState<DashboardActiveUnitViewStatus>('active')
  const [isStatusMenuOpen, setIsStatusMenuOpen] = useState(false)
  const [statusMenuPosition, setStatusMenuPosition] = useState<{ top: number; left: number } | null>(null)
  const statusMenuWrapRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!isStatusMenuOpen) {
      return
    }

    function updatePosition() {
      const rect = statusMenuWrapRef.current?.getBoundingClientRect()
      if (!rect) return
      setStatusMenuPosition({ top: rect.bottom + 8, left: rect.left })
    }

    updatePosition()

    function closeOnScrollOrResize() {
      setIsStatusMenuOpen(false)
      setStatusMenuPosition(null)
    }

    window.addEventListener('resize', closeOnScrollOrResize)
    window.addEventListener('scroll', closeOnScrollOrResize, true)
    return () => {
      window.removeEventListener('resize', closeOnScrollOrResize)
      window.removeEventListener('scroll', closeOnScrollOrResize, true)
    }
  }, [isStatusMenuOpen])

  const selectedOption = statusOptions.find((option) => option.value === selectedStatus) ?? statusOptions[0]
  const displayUnits = useMemo(
    () => units.filter((unit) => unit.status === selectedStatus).slice(0, 8),
    [selectedStatus, units]
  )

  return (
    <section
      className={styles.activeUnitsPanel}
      data-feature-guide-target="dashboard.up_next.panel"
    >
      <div className={styles.activeUnitsHeader}>
        <OgPlaque className={styles.activeUnitsPlaque}>Up Next</OgPlaque>
        <div className={styles.activeUnitsControls}>
          <div className={styles.statusMenuWrap} ref={statusMenuWrapRef}>
            <span className={styles.showingLabel}>Showing</span>
            <OgButton
              aria-expanded={isStatusMenuOpen}
              aria-haspopup="menu"
              aria-label={`Change unit status filter, currently ${selectedOption.label}`}
              className={styles.statusTrigger}
              onClick={() => {
                if (isStatusMenuOpen) {
                  setStatusMenuPosition(null)
                }
                setIsStatusMenuOpen((open) => !open)
              }}
              size="compact"
              variant="primary"
            >
              {selectedOption.label}
              <ChevronIcon />
            </OgButton>
            {isStatusMenuOpen && statusMenuPosition && typeof document !== 'undefined'
              ? createPortal(
                  <div
                    className={styles.statusMenu}
                    role="menu"
                    style={{ position: 'fixed', top: statusMenuPosition.top, left: statusMenuPosition.left }}
                  >
                    {statusOptions.map((option) => {
                      const selected = option.value === selectedStatus
                      return (
                        <button
                          key={option.value}
                          type="button"
                          role="menuitemradio"
                          aria-checked={selected}
                          data-selected={selected}
                          className={styles.statusMenuItem}
                          onClick={() => {
                            setSelectedStatus(option.value)
                            setIsStatusMenuOpen(false)
                            setStatusMenuPosition(null)
                          }}
                        >
                          {option.label}
                        </button>
                      )
                    })}
                  </div>,
                  document.body
                )
              : null}
          </div>
        </div>
      </div>

      {displayUnits.length > 0 ? (
        <div
          className={styles.unitGrid}
          data-v3-dashboard-active-units-layout="grid"
        >
          {displayUnits.map((unit) => (
            <ActiveUnitCard key={unit.id} unit={unit} />
          ))}
        </div>
      ) : (
        <div
          className={styles.emptyUnits}
          data-v3-dashboard-indicator="active-unit-empty"
        >
          No {selectedOption.label.toLowerCase()} units yet.
        </div>
      )}
    </section>
  )
}

export default function DashboardActiveUnitsView({
  featureGuides = [],
  initialTab,
  model,
  profilePanel,
  source = 'live',
}: {
  featureGuides?: DashboardFeatureGuide[]
  initialTab: ActiveTab
  model: DashboardActiveUnitsViewModel
  profilePanel: ReactNode
  source?: 'fixture' | 'live'
}) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const requestedTab = searchParams.get('tab')
  const currentTab = requestedTab === 'profile' || requestedTab === 'painting-table' ? requestedTab : initialTab
  const [activeGuideIndex, setActiveGuideIndex] = useState<number | null>(null)
  const activeGuide =
    activeGuideIndex === null ? null : featureGuides[activeGuideIndex] ?? null

  function showGuideAt(index: number) {
    setActiveGuideIndex(index)
  }

  function navigate(nextTab: ActiveTab) {
    if (nextTab === currentTab) return
    const params = new URLSearchParams(searchParams.toString())
    params.set('tab', nextTab)
    window.history.replaceState(null, '', `${pathname}?${params.toString()}`)
  }

  function startFeatureTour() {
    if (!featureGuides.length) return
    showGuideAt(findVisibleFeatureGuideIndex(featureGuides, null, 1) ?? 0)
  }

  function closeFeatureTour() {
    setActiveGuideIndex(null)
  }

  function showPreviousGuide() {
    const nextIndex =
      findVisibleFeatureGuideIndex(featureGuides, activeGuideIndex, -1) ??
      activeGuideIndex ??
      0
    showGuideAt(nextIndex)
  }

  function showNextGuide() {
    const nextIndex =
      findVisibleFeatureGuideIndex(featureGuides, activeGuideIndex, 1) ??
      activeGuideIndex ??
      0
    showGuideAt(nextIndex)
  }

  return (
    <div
      className={styles.dashboardApp}
      data-v3-dashboard-indicator="root"
      data-v3-dashboard-feed={source}
      data-v3-dashboard-source={source}
    >
      <V3PerfIndicator
        surface="dashboard"
        detail={currentTab === 'profile' ? 'my-progress' : 'active-units'}
      />
      <DashboardHeader
        helpExpanded={activeGuide !== null}
        onHelp={startFeatureTour}
      />
      <div className={styles.tabBand}>
        <DashboardTabs currentTab={currentTab} onChange={navigate} />
      </div>

      <div
        hidden={currentTab !== 'painting-table'}
        aria-hidden={currentTab !== 'painting-table'}
        data-v3-dashboard-indicator="active-units"
      >
        <div className={styles.dashboardBody}>
          <NextActionsObject nextActions={model.nextActions} />
          <FeaturedUnit unit={model.featuredUnit} />
          <ActiveUnitsPanel units={model.units} />
        </div>
      </div>

      <div
        hidden={currentTab !== 'profile'}
        aria-hidden={currentTab !== 'profile'}
        className={styles.profilePanel}
        data-v3-dashboard-indicator="my-progress"
      >
        {profilePanel}
      </div>

      {activeGuide !== null && activeGuideIndex !== null ? (
        <FeatureGuideTour
          activeIndex={activeGuideIndex}
          guide={activeGuide}
          onClose={closeFeatureTour}
          onNext={showNextGuide}
          onPrevious={showPreviousGuide}
          totalGuides={featureGuides.length}
        />
      ) : null}
    </div>
  )
}
