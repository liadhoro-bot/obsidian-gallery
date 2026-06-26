'use client'

import dynamic from 'next/dynamic'
import { useMemo, useState } from 'react'
import UnitListView from '../../components/units/unit-list-view'
import { PrefetchButton } from '../components/prefetch-link'
import { startDashboardUnitSession } from './actions'

const DashboardBenchCards = dynamic(() => import('./dashboard-bench-cards'), {
  loading: () => (
    <div className="space-y-3">
      {Array.from({ length: 3 }).map((_, index) => (
        <div
          key={index}
          className="min-h-[110px] rounded-2xl border border-white/10 bg-white/[0.04]"
        />
      ))}
    </div>
  ),
})

export type UnitStatus = 'complete' | 'active' | 'bench' | 'pile' | 'other'

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

const STATUS_OPTIONS: StatusOption[] = [
  { value: 'complete', label: 'Complete', headingLabel: 'complete' },
  { value: 'active', label: 'Active', headingLabel: 'active' },
  { value: 'bench', label: 'Bench', headingLabel: 'bench' },
  { value: 'pile', label: 'Pile of Shame', headingLabel: 'pile of shame' },
  { value: 'other', label: 'Other', headingLabel: 'other' },
]

function StartPaintingForm({ unitId }: { unitId: string }) {
  return (
    <form action={startDashboardUnitSession} className="relative z-20">
      <input type="hidden" name="unitId" value={unitId} />
      <PrefetchButton
        type="submit"
        prefetchHref={`/units/${unitId}`}
        onClick={(event) => event.stopPropagation()}
        className="rounded-xl border border-cyan-300/55 bg-black/55 px-2.5 py-1.5 text-[10px] font-black uppercase text-cyan-100 shadow-[0_0_16px_rgba(34,211,238,0.22)] backdrop-blur-md transition hover:border-cyan-200/80 hover:bg-cyan-400/15 hover:text-cyan-50 active:bg-cyan-400 active:text-slate-950"
      >
        Start Painting
      </PrefetchButton>
    </form>
  )
}

export default function DashboardUnitStatusList({
  units,
}: {
  units: DashboardStatusUnit[]
}) {
  const [selectedStatus, setSelectedStatus] = useState<UnitStatus>('active')
  const [isStatusMenuOpen, setIsStatusMenuOpen] = useState(false)

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
    <section className="space-y-3">
      <UnitListView
        units={displayUnits.map((unit) => ({
          id: unit.id,
          name: unit.name,
          imageUrl: unit.imageUrl,
          action: <StartPaintingForm unitId={unit.id} />,
        }))}
        renderCards={() => (
          <DashboardBenchCards units={displayUnits} emptyMessage={emptyMessage} />
        )}
        surface="dashboard_active_bench"
        emptyMessage={emptyMessage}
        initialMode="tiles"
        header={(toggle) => (
          <div className="relative z-40 mb-3 flex items-end justify-between gap-3">
            <h2 className="min-w-0 text-xl font-semibold text-white">
              Your{' '}
              <span className="relative inline-flex">
                <button
                  type="button"
                  onClick={() => setIsStatusMenuOpen((isOpen) => !isOpen)}
                  className="rounded-lg text-cyan-300 underline decoration-cyan-300/35 underline-offset-4 transition hover:text-cyan-200 focus:outline-none focus:ring-2 focus:ring-cyan-400/50"
                  aria-expanded={isStatusMenuOpen}
                  aria-haspopup="menu"
                >
                  {selectedOption.headingLabel}
                </button>

                {isStatusMenuOpen ? (
                  <div
                    role="menu"
                    className="absolute left-0 top-full z-50 mt-2 w-44 overflow-hidden rounded-2xl border border-white/10 bg-slate-950/95 p-1 shadow-2xl shadow-black/45 backdrop-blur"
                  >
                    {STATUS_OPTIONS.map((option) => {
                      const isSelected = option.value === selectedStatus

                      return (
                        <button
                          key={option.value}
                          type="button"
                          role="menuitem"
                          onClick={() => {
                            setSelectedStatus(option.value)
                            setIsStatusMenuOpen(false)
                          }}
                          className={[
                            'block w-full rounded-xl px-3 py-2 text-left text-sm font-semibold transition',
                            isSelected
                              ? 'bg-cyan-400/15 text-cyan-200'
                              : 'text-white/70 hover:bg-white/5 hover:text-white',
                          ].join(' ')}
                        >
                          {option.label}
                        </button>
                      )
                    })}
                  </div>
                ) : null}
              </span>{' '}
              units
            </h2>

            <div className="shrink-0">{toggle}</div>
          </div>
        )}
      />
    </section>
  )
}
