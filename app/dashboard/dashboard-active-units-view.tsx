'use client'

import Image from 'next/image'
import Link from 'next/link'
import type { ReactNode } from 'react'
import { useEffect, useMemo, useState, useTransition } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'
import {
  OgButton,
  OgIconButton,
  OgPlaque,
  OgProgressTrack,
} from '@/src/components/v3'
import PrefetchLink from '../components/prefetch-link'
import DashboardQuickActionStartButton from './dashboard-quick-action-start-button'
import DashboardResumeButton from './dashboard-resume-button'
import type {
  DashboardActiveUnitCardViewModel,
  DashboardActiveUnitViewStatus,
  DashboardActiveUnitsNextActionViewModel,
  DashboardActiveUnitsViewModel,
} from './dashboard-active-units-model'
import {
  dismissDashboardNextActions,
  setDashboardNextActionDone,
} from './actions'
import styles from './dashboard-og.module.css'

type ActiveTab = 'profile' | 'painting-table'
type DisplayMode = 'cards' | 'tiles'

type StatusOption = {
  value: DashboardActiveUnitViewStatus
  label: string
}

const STORAGE_KEY = 'og_unit_view_mode'

const statusOptions: StatusOption[] = [
  { value: 'active', label: 'Active' },
  { value: 'bench', label: 'Bench' },
  { value: 'pile', label: 'Pile' },
  { value: 'complete', label: 'Complete' },
  { value: 'other', label: 'Other' },
]

function isDisplayMode(value: string | null): value is DisplayMode {
  return value === 'cards' || value === 'tiles'
}

function MenuIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden="true">
      <path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" strokeLinecap="round" strokeWidth="2" />
    </svg>
  )
}

function HelpIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden="true">
      <path d="M9.6 9a2.6 2.6 0 0 1 4.95 1.15c0 1.75-1.55 2.25-2.25 3.3-.22.33-.3.68-.3 1.05" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.9" />
      <path d="M12 18h.01" stroke="currentColor" strokeLinecap="round" strokeWidth="2.6" />
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.6" />
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

function TilesIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" aria-hidden="true">
      <path d="M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z" stroke="currentColor" strokeLinejoin="round" strokeWidth="2" />
    </svg>
  )
}

function CardsIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" aria-hidden="true">
      <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" stroke="currentColor" strokeLinecap="round" strokeWidth="2" />
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

function DashboardHeader() {
  return (
    <header className={styles.appHeader}>
      <Link href="/settings" className={`${styles.headerControl} ${styles.menuControl}`} aria-label="Open menu">
        <MenuIcon />
      </Link>

      <h1 className={styles.appTitle}>Dashboard</h1>

      <div className={styles.appHeaderActions}>
        <Link href="/support" className={styles.headerControl} aria-label="Open help">
          <HelpIcon />
        </Link>
        <DashboardQuickActionStartButton className={styles.headerControl}>
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
        onClick={() => onChange('profile')}
      >
        My Progress
      </button>
    </div>
  )
}

function NextActionsObject({ nextActions }: { nextActions: NonNullable<DashboardActiveUnitsViewModel['nextActions']> | null }) {
  const [isOpen, setIsOpen] = useState(false)
  const [hidden, setHidden] = useState(false)
  const [completionOverrides, setCompletionOverrides] = useState(() => new Map<string, boolean>())
  const [isPending, startTransition] = useTransition()

  if (!nextActions || hidden) {
    return null
  }

  const isActionDone = (action: DashboardActiveUnitsNextActionViewModel) =>
    completionOverrides.get(action.id) ?? Boolean(action.completedAt)
  const completedCount = nextActions.actions.filter(isActionDone).length
  const totalCount = Math.max(1, nextActions.totalCount)
  const progress = Math.round((completedCount / totalCount) * 100)

  function toggleAction(action: DashboardActiveUnitsNextActionViewModel) {
    const nextDone = !isActionDone(action)
    setCompletionOverrides((current) => {
      const next = new Map(current)
      next.set(action.id, nextDone)
      return next
    })

    if (!nextActions?.canMutate) return

    startTransition(async () => {
      const result = await setDashboardNextActionDone(action.id, nextDone)
      if (!result.ok) {
        setCompletionOverrides((current) => {
          const next = new Map(current)
          next.set(action.id, !nextDone)
          return next
        })
      }
    })
  }

  function dismiss() {
    setHidden(true)
    if (!nextActions?.canMutate) return

    startTransition(async () => {
      const result = await dismissDashboardNextActions()
      if (!result.ok) setHidden(false)
    })
  }

  return (
    <section className={styles.nextActionObject} data-pending={isPending} aria-label="Next actions">
      <button type="button" className={styles.nextActionSummary} onClick={() => setIsOpen((open) => !open)} aria-expanded={isOpen}>
        <span className={styles.nextActionMedallion} aria-hidden="true">
          <BottleIcon />
        </span>
        <span className={styles.nextActionCopy}>
          <strong>Next Actions</strong>
          <span>{nextActions.copy}</span>
        </span>
        <span className={styles.nextActionProgress} aria-label={`${completedCount} of ${nextActions.totalCount} complete`}>
          <span className={styles.nextActionCount}>{completedCount}/{nextActions.totalCount} complete</span>
          <span className={styles.nextActionTrack} aria-hidden="true">
            <span style={{ width: `${progress}%` }} />
          </span>
        </span>
        <span className={styles.nextActionChevron} aria-hidden="true">
          <ChevronIcon open={isOpen} />
        </span>
      </button>

      {isOpen ? (
        <div className={styles.nextActionDrawer}>
          {nextActions.actions.map((action) => {
            const isDone = isActionDone(action)
            return (
              <div key={action.id} className={styles.nextActionRow}>
                <button
                  type="button"
                  className={styles.nextActionCheck}
                  data-done={isDone}
                  aria-pressed={isDone}
                  onClick={() => toggleAction(action)}
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
          <button type="button" className={styles.nextActionDismiss} onClick={dismiss}>
            Dismiss
          </button>
        </div>
      ) : null}
    </section>
  )
}

function FeaturedUnit({ unit }: { unit: DashboardActiveUnitsViewModel['featuredUnit'] }) {
  if (!unit) {
    return (
      <section className={styles.featuredPanel} id="featured-unit">
        <OgPlaque className={styles.panelPlaque}>Featured Unit</OgPlaque>
        <div className={styles.emptyFeatured}>
          <h2>No active units yet</h2>
          <p>Add or activate a unit to make the dashboard come alive.</p>
        </div>
      </section>
    )
  }

  return (
    <section className={styles.featuredPanel} id="featured-unit">
      <OgPlaque className={styles.panelPlaque}>Featured Unit</OgPlaque>
      <PrefetchLink href={`/units/${unit.id}`} className={styles.featuredImageMount} aria-label={`Open ${unit.name}`}>
        <span className={styles.featuredImageFrame}>
          <MiniatureImage imageUrl={unit.imageUrl} name={unit.name} priority />
        </span>
      </PrefetchLink>

      <div className={styles.featuredDetails}>
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
          <DashboardResumeButton unitId={unit.id} icon={<PlayIcon />} label="Resume" />
        </div>
      </div>
    </section>
  )
}

function ActiveUnitCard({ unit, mode }: { unit: DashboardActiveUnitCardViewModel; mode: DisplayMode }) {
  return (
    <article className={mode === 'tiles' ? styles.unitTile : styles.unitListCard}>
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
  const [mode, setMode] = useState<DisplayMode>('tiles')

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      const storedMode = window.localStorage.getItem(STORAGE_KEY)
      if (isDisplayMode(storedMode)) setMode(storedMode)
    }, 0)
    return () => window.clearTimeout(timeoutId)
  }, [])

  function handleModeChange(nextMode: DisplayMode) {
    setMode(nextMode)
    window.localStorage.setItem(STORAGE_KEY, nextMode)
    void import('../../utils/analytics/client').then(({ capturePostHog }) => {
      void capturePostHog('display_mode_changed', {
        entity: 'unit',
        mode: nextMode,
        surface: 'dashboard_active_bench',
      })
    })
  }

  const selectedOption = statusOptions.find((option) => option.value === selectedStatus) ?? statusOptions[0]
  const displayUnits = useMemo(
    () => units.filter((unit) => unit.status === selectedStatus).slice(0, 8),
    [selectedStatus, units]
  )

  return (
    <section className={styles.activeUnitsPanel}>
      <OgPlaque className={styles.panelPlaque}>Up Next</OgPlaque>
      <div className={styles.activeUnitsControls}>
          <div className={styles.statusMenuWrap}>
            <span className={styles.showingLabel}>Showing</span>
            <OgButton
              aria-expanded={isStatusMenuOpen}
              aria-haspopup="menu"
              aria-label={`Change unit status filter, currently ${selectedOption.label}`}
              className={styles.statusTrigger}
              onClick={() => setIsStatusMenuOpen((open) => !open)}
              size="compact"
              variant="primary"
            >
              {selectedOption.label}
              <ChevronIcon />
            </OgButton>
            {isStatusMenuOpen ? (
              <div className={styles.statusMenu} role="menu">
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
                      }}
                    >
                      {option.label}
                    </button>
                  )
                })}
              </div>
            ) : null}
          </div>

          <div className={styles.viewToggle} aria-label="Display mode">
            <OgIconButton label="Show units as tiles" aria-pressed={mode === 'tiles'} className={styles.iconToggle} data-selected={mode === 'tiles'} onClick={() => handleModeChange('tiles')} size="compact">
              <TilesIcon />
            </OgIconButton>
            <OgIconButton label="Show units as cards" aria-pressed={mode === 'cards'} className={styles.iconToggle} data-selected={mode === 'cards'} onClick={() => handleModeChange('cards')} size="compact">
              <CardsIcon />
            </OgIconButton>
          </div>
      </div>

      {displayUnits.length > 0 ? (
        <div className={mode === 'tiles' ? styles.unitGrid : styles.unitStack}>
          {displayUnits.map((unit) => (
            <ActiveUnitCard key={unit.id} unit={unit} mode={mode} />
          ))}
        </div>
      ) : (
        <div className={styles.emptyUnits}>No {selectedOption.label.toLowerCase()} units yet.</div>
      )}
    </section>
  )
}

export default function DashboardActiveUnitsView({
  initialTab,
  model,
  profilePanel,
}: {
  initialTab: ActiveTab
  model: DashboardActiveUnitsViewModel
  profilePanel: ReactNode
}) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const requestedTab = searchParams.get('tab')
  const currentTab = requestedTab === 'profile' || requestedTab === 'painting-table' ? requestedTab : initialTab

  function navigate(nextTab: ActiveTab) {
    if (nextTab === currentTab) return
    const params = new URLSearchParams(searchParams.toString())
    params.set('tab', nextTab)
    window.history.replaceState(null, '', `${pathname}?${params.toString()}`)
  }

  return (
    <div className={styles.dashboardApp}>
      <DashboardHeader />
      <div className={styles.tabBand}>
        <DashboardTabs currentTab={currentTab} onChange={navigate} />
      </div>

      <div hidden={currentTab !== 'painting-table'} aria-hidden={currentTab !== 'painting-table'}>
        <div className={styles.dashboardBody}>
          <NextActionsObject nextActions={model.nextActions} />
          <FeaturedUnit unit={model.featuredUnit} />
          <ActiveUnitsPanel units={model.units} />
        </div>
      </div>

      <div hidden={currentTab !== 'profile'} aria-hidden={currentTab !== 'profile'} className={styles.profilePanel}>
        {profilePanel}
      </div>
    </div>
  )
}


