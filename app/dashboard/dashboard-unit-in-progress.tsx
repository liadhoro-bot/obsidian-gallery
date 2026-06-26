import Image from 'next/image'
import Link from 'next/link'
import ProgressWheel from '../components/progress-wheel'
import { startDashboardUnitSession } from './actions'
import {
  getDashboardCurrentUser,
  getDashboardPaintingTableFeed,
} from './dashboard-data'

function formatDate(value: string | null | undefined) {
  if (!value) return 'No deadline set'

  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(value))
}

export default async function DashboardUnitInProgress({
  userId,
}: {
  userId?: string
}) {
  const resolvedUserId = userId ?? (await getDashboardCurrentUser())?.id
  if (!resolvedUserId) return null

  const { heroUnit: inProgressUnit } =
    await getDashboardPaintingTableFeed(resolvedUserId)

  if (!inProgressUnit) {
    return (
      <section className="rounded-3xl border border-white/10 bg-white/5 p-5">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/45">
          Unit in Progress
        </p>
        <p className="mt-4 text-sm text-white/60">No unit in progress yet.</p>
      </section>
    )
  }

  const progress = inProgressUnit.progress_percent ?? 0
  const unitHref = `/units/${inProgressUnit.unit_id}`

  return (
    <section className="relative overflow-hidden rounded-3xl border border-white/10 bg-white/5">
      <Link
        href={unitHref}
        className="absolute inset-0 z-10"
        aria-label={`Open ${inProgressUnit.name}`}
      >
        <span className="sr-only">Open {inProgressUnit.name}</span>
      </Link>

      <div className="relative min-h-[260px]">
        {inProgressUnit.primary_image_url ? (
          <>
            <Image
              src={inProgressUnit.primary_image_url}
              alt={inProgressUnit.name}
              fill
              className="object-cover"
              sizes="(max-width: 480px) calc(100vw - 2rem), 420px"
              quality={60}
              priority
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#081018] via-[#081018]/60 to-[#081018]/15" />
          </>
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-cyan-950/40 to-slate-900" />
        )}

        <div className="relative z-10 flex min-h-[260px] flex-col justify-end p-5 sm:p-6">
          <div className="flex items-end justify-between gap-4 sm:gap-5">
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-orange-400">
                {inProgressUnit.is_featured ? 'Featured Unit' : 'In Progress'}
              </p>

              <div className="mt-3 space-y-2">
                <h2 className="max-w-xl text-2xl font-semibold leading-tight text-white sm:text-4xl">
                  {inProgressUnit.name}
                </h2>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-cyan-200/85 sm:text-sm">
                  Deadline: {formatDate(inProgressUnit.deadline)}
                </p>
                {inProgressUnit.is_featured &&
                (inProgressUnit.parent_project_names?.length ?? 0) > 0 ? (
                  <p className="text-xs font-semibold text-cyan-200/80">
                    {inProgressUnit.parent_project_names?.join(' / ')}
                  </p>
                ) : null}
              </div>

              <form action={startDashboardUnitSession} className="relative z-20 mt-5">
                <input
                  type="hidden"
                  name="unitId"
                  value={inProgressUnit.unit_id}
                />
                <button
                  type="submit"
                  className="inline-flex rounded-2xl border border-cyan-300/55 bg-black/45 px-4 py-2.5 text-xs font-black uppercase text-cyan-100 shadow-[0_0_18px_rgba(34,211,238,0.22)] backdrop-blur-md transition hover:border-cyan-200/80 hover:bg-cyan-400/15 hover:text-cyan-50 active:bg-cyan-400 active:text-slate-950 sm:px-5 sm:py-3 sm:text-sm"
                >
                  Resume Painting
                </button>
              </form>
            </div>

            <ProgressWheel value={progress} className="shrink-0 self-end" />
          </div>
        </div>
      </div>
    </section>
  )
}
