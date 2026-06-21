'use client'

import type { ReactNode } from 'react'
import { useEffect, useState } from 'react'
import { capturePostHog } from '../../utils/analytics/client'
import DisplayModeToggle, {
  type DisplayMode,
} from '../display-mode-toggle'
import UnitTile, { type UnitTileData } from './unit-tile'

const STORAGE_KEY = 'og_unit_view_mode'

type UnitListViewProps = {
  units: UnitTileData[]
  cards: ReactNode
  surface: string
  header?: (toggle: ReactNode) => ReactNode
  emptyMessage?: string
  className?: string
}

function isDisplayMode(value: string | null): value is DisplayMode {
  return value === 'cards' || value === 'tiles'
}

export default function UnitListView({
  units,
  cards,
  surface,
  header,
  emptyMessage = 'No units yet.',
  className = '',
}: UnitListViewProps) {
  const [mode, setMode] = useState<DisplayMode>('cards')

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
    capturePostHog('display_mode_changed', {
      entity: 'unit',
      mode: nextMode,
      surface,
    })
  }

  const toggle = (
    <DisplayModeToggle mode={mode} onModeChange={handleModeChange} />
  )

  return (
    <div className={className}>
      {header ? header(toggle) : <div className="mb-3 flex justify-end">{toggle}</div>}

      {mode === 'cards' ? (
        cards
      ) : units.length > 0 ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {units.map((unit) => (
            <UnitTile key={unit.id} unit={unit} />
          ))}
        </div>
      ) : (
        <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
          <p className="text-sm text-white/60">{emptyMessage}</p>
        </div>
      )}
    </div>
  )
}
