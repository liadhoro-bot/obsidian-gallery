'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  OgButton,
  OgCaption,
  OgIconButton,
  OgSectionHeading,
  SurfacePanel,
} from '@/src/components/v3'
import DashboardBenchCards from './dashboard-bench-cards'
import styles from './dashboard-og.module.css'

export type UnitStatus = 'complete' | 'active' | 'bench' | 'pile' | 'other'

type DisplayMode = 'cards' | 'tiles'

export type DashboardStatusUnit = {
  id: string
  name: string
  deadline: string | null
  created_at: string
  status: UnitStatus
  progress: number
  imageUrl: string | null
  lastSession: string | null
}

type StatusOption = {
  value: UnitStatus
  label: string
  headingLabel: string
}

const STORAGE_KEY = 'og_unit_view_mode'

const STATUS_OPTIONS: StatusOption[] = [
  { value: 'complete', label: 'Complete', headingLabel: 'complete' },
  { value: 'active', label: 'Active', headingLabel: 'active' },
  { value: 'bench', label: 'Bench', headingLabel: 'bench' },
  { value: 'pile', label: 'Pile of Shame', headingLabel: 'pile of shame' },
  { value: 'other', label: 'Other', headingLabel: 'other' },
]

function isDisplayMode(value: string | null): value is DisplayMode {
  return value === 'cards' || value === 'tiles'
}

function TilesIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" aria-hidden="true">
      <path
        d="M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z"
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth="2"
      />
    </svg>
  )
}

function CardsIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" aria-hidden="true">
      <path
        d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
      />
    </svg>
  )
}

export default function DashboardUnitStatusList({
  units,
}: {
  units: DashboardStatusUnit[]
}) {
  const [selectedStatus, setSelectedStatus] = useState<UnitStatus>('active')
  const [isStatusMenuOpen, setIsStatusMenuOpen] = useState(false)
  const [mode, setMode] = useState<DisplayMode>('tiles')

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      const storedMode = window.localStorage.getItem(STORAGE_KEY)
      if (isDisplayMode(storedMode)) {
        setMode(storedMode)
      }
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

  const selectedOption =
    STATUS_OPTIONS.find((option) => option.value === selectedStatus) ??
    STATUS_OPTIONS[1]

  const selectedUnits = useMemo(
    () => units.filter((unit) => unit.status === selectedStatus),
    [selectedStatus, units]
  )
  const displayUnits = selectedUnits.slice(0, 8)
  const emptyMessage = `No ${selectedOption.headingLabel} units yet.`

  return (
    <SurfacePanel density="default" elevation="contact">
      <div className={styles.sectionHeader}>
        <div className={styles.sectionTitleBlock}>
          <OgCaption className={styles.sectionEyebrow}>Up next</OgCaption>
          <OgSectionHeading as="h2">
            Your{' '}
            <span className={styles.statusMenuWrap}>
              <OgButton
                aria-expanded={isStatusMenuOpen}
                aria-haspopup="menu"
                aria-label={`Change unit status filter, currently showing ${selectedOption.headingLabel} units`}
                className={styles.statusTrigger}
                onClick={() => setIsStatusMenuOpen((isOpen) => !isOpen)}
                size="compact"
                variant="tertiary"
              >
                {selectedOption.headingLabel}
              </OgButton>

              {isStatusMenuOpen ? (
                <div role="menu" className={styles.statusMenu}>
                  {STATUS_OPTIONS.map((option) => {
                    const isSelected = option.value === selectedStatus

                    return (
                      <button
                        key={option.value}
                        type="button"
                        role="menuitemradio"
                        aria-checked={isSelected}
                        onClick={() => {
                          setSelectedStatus(option.value)
                          setIsStatusMenuOpen(false)
                        }}
                        className={styles.statusMenuItem}
                        data-selected={isSelected}
                      >
                        {option.label}
                      </button>
                    )
                  })}
                </div>
              ) : null}
            </span>{' '}
            units
          </OgSectionHeading>
        </div>

        <div className={styles.viewToggle} aria-label="Display mode">
          <OgIconButton
            label="Show units as cards"
            aria-pressed={mode === 'cards'}
            className={styles.iconToggle}
            data-selected={mode === 'cards'}
            onClick={() => handleModeChange('cards')}
            size="compact"
          >
            <CardsIcon />
          </OgIconButton>
          <OgIconButton
            label="Show units as tiles"
            aria-pressed={mode === 'tiles'}
            className={styles.iconToggle}
            data-selected={mode === 'tiles'}
            onClick={() => handleModeChange('tiles')}
            size="compact"
          >
            <TilesIcon />
          </OgIconButton>
        </div>
      </div>

      <DashboardBenchCards
        units={displayUnits}
        emptyMessage={emptyMessage}
        mode={mode}
      />
    </SurfacePanel>
  )
}
