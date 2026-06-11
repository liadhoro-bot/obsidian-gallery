'use client'

import Image from 'next/image'
import PrefetchLink from '../../app/components/prefetch-link'

export type UnitTileData = {
  id: string
  name: string
  imageUrl?: string | null
  status?: string | null
  progress?: number | null
  deadline?: string | null
}

function formatStatus(value: string) {
  return value
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

function getDeadlineWarning(deadline: string | null | undefined) {
  if (!deadline) return null

  const deadlineDate = new Date(deadline)
  if (Number.isNaN(deadlineDate.getTime())) return null

  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const target = new Date(
    deadlineDate.getFullYear(),
    deadlineDate.getMonth(),
    deadlineDate.getDate()
  )
  const days = Math.ceil(
    (target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
  )

  if (days < 0) return 'Overdue'
  if (days <= 7) return days === 0 ? 'Due today' : `Due ${days}d`
  return null
}

export default function UnitTile({ unit }: { unit: UnitTileData }) {
  const progress =
    typeof unit.progress === 'number'
      ? Math.max(0, Math.min(100, Math.round(unit.progress)))
      : null
  const deadlineWarning = getDeadlineWarning(unit.deadline)

  return (
    <PrefetchLink
      href={`/units/${unit.id}`}
      viewportPrefetch
      className="group block overflow-hidden rounded-2xl border border-white/10 bg-white/[0.05] transition active:scale-[0.98] active:opacity-70 hover:border-cyan-400/70 hover:bg-white/[0.08]"
    >
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-neutral-950">
        {unit.imageUrl ? (
          <Image
            src={unit.imageUrl}
            alt={unit.name}
            fill
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 180px"
            className="object-cover transition duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-[radial-gradient(circle_at_30%_20%,rgba(34,211,238,0.18),transparent_34%),linear-gradient(135deg,#111827,#020617)] text-[11px] font-semibold uppercase text-white/35">
            No image
          </div>
        )}
      </div>

      <div className="space-y-2 p-3">
        <h3 className="line-clamp-2 min-h-10 text-sm font-semibold leading-5 text-white">
          {unit.name}
        </h3>

        <div className="flex min-h-6 flex-wrap items-center gap-1.5">
          {unit.status ? (
            <span className="rounded-full border border-cyan-300/25 bg-cyan-400/10 px-2 py-0.5 text-[10px] font-black uppercase text-cyan-200">
              {formatStatus(unit.status)}
            </span>
          ) : null}

          {progress !== null ? (
            <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] font-black uppercase text-white/65">
              {progress}%
            </span>
          ) : null}

          {deadlineWarning ? (
            <span className="rounded-full border border-orange-300/25 bg-orange-400/10 px-2 py-0.5 text-[10px] font-black uppercase text-orange-200">
              {deadlineWarning}
            </span>
          ) : null}
        </div>
      </div>
    </PrefetchLink>
  )
}
