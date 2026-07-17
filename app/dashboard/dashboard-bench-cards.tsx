'use client'

import Image from 'next/image'
import ProgressWheel from '../components/progress-wheel'
import { getSupabaseImageUrl } from '../../utils/images/supabase-image'
import PrefetchLink from '../components/prefetch-link'
import DashboardStartPaintingButton from './dashboard-start-painting-button'
import type { DashboardStatusUnit } from './dashboard-unit-status-list'

function formatDate(value: string | null | undefined) {
  if (!value) return '-'

  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(value))
}

export default function DashboardBenchCards({
  units,
  emptyMessage,
}: {
  units: DashboardStatusUnit[]
  emptyMessage: string
}) {
  if (units.length === 0) {
    return (
      <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
        <p className="text-sm text-white/60">{emptyMessage}</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {units.map((unit) => {
        const cardImageUrl = getSupabaseImageUrl(unit.imageUrl, {
          width: 240,
          height: 240,
          quality: 45,
          resize: 'cover',
        })

        return (
          <div
            key={unit.id}
            className="group relative flex overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04] transition hover:bg-white/[0.08]"
          >
            <PrefetchLink
              href={`/units/${unit.id}`}
              className="absolute inset-0 z-10"
              aria-label={`Open ${unit.name}`}
            >
              <span className="sr-only">Open {unit.name}</span>
            </PrefetchLink>

            <div className="relative min-h-[110px] w-[30%]">
              {cardImageUrl ? (
                <Image
                  src={cardImageUrl}
                  alt={unit.name}
                  fill
                  className="object-cover"
                  sizes="120px"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-white/5 text-xs text-white/40">
                  No image
                </div>
              )}
            </div>

            <div className="flex min-w-0 flex-1 items-center justify-between gap-3 px-3 py-2.5">
              <div className="min-w-0">
                <p className="text-lg font-semibold leading-tight text-white">
                  {unit.name}
                </p>

                <p className="mt-1 text-[10px] uppercase leading-4 text-white/60">
                  LAST SESSION: {formatDate(unit.lastSession)}
                </p>

                <p className="text-[10px] font-semibold uppercase leading-4 text-orange-400">
                  DEADLINE: {formatDate(unit.deadline)}
                </p>

                <div className="mt-1.5">
                  <div className="relative z-20">
                    <DashboardStartPaintingButton unitId={unit.id} />
                  </div>
                </div>
              </div>

              <ProgressWheel
                value={unit.progress}
                showLabel={false}
                className="shrink-0"
                svgClassName="h-16 w-16"
                centerTextSize={30}
              />
            </div>
          </div>
        )
      })}
    </div>
  )
}
