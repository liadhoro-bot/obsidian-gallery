import Image from 'next/image'
import Link from 'next/link'
import ProgressWheel from '../components/progress-wheel'
import { getSupabaseImageUrl } from '../../utils/images/supabase-image'
import DashboardResumeButton from './dashboard-resume-button'
import type { DashboardFeedUnit } from './dashboard-data'

function formatDate(value: string | null | undefined) {
  if (!value) return 'No deadline set'

  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(value))
}

export default function DashboardUnitInProgress({
  unit,
}: {
  unit: DashboardFeedUnit | null
}) {
  if (!unit) {
    return (
      <section className="rounded-3xl border border-white/10 bg-white/5 p-5">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/45">
          Unit in Progress
        </p>
        <p className="mt-4 text-sm text-white/60">No unit in progress yet.</p>
      </section>
    )
  }

  const progress = unit.progress_percent ?? 0
  const unitHref = `/units/${unit.unit_id}`
  const heroImageUrl = getSupabaseImageUrl(unit.primary_image_url, {
    width: 640,
    quality: 40,
    resize: 'cover',
  })

  return (
    <section className="relative overflow-hidden rounded-3xl border border-white/10 bg-white/5">
      <Link
        href={unitHref}
        className="absolute inset-0 z-20"
        aria-label={`Open ${unit.name}`}
      >
        <span className="sr-only">Open {unit.name}</span>
      </Link>

      <div className="relative min-h-[300px] sm:min-h-[320px]">
        {heroImageUrl ? (
          <>
            <Image
              src={heroImageUrl}
              alt={unit.name}
              fill
              className="object-cover"
              sizes="(max-width: 480px) calc(100vw - 2rem), (max-width: 768px) 420px, 480px"
              priority
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#081018] via-[#081018]/60 to-[#081018]/15" />
          </>
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-cyan-950/40 to-slate-900" />
        )}

        <div className="relative z-10 flex min-h-[300px] flex-col justify-end p-5 sm:min-h-[320px] sm:p-6">
          <div className="flex items-end justify-between gap-4 sm:gap-5">
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-orange-400">
                {unit.is_featured ? 'Featured Unit' : 'In Progress'}
              </p>

              <div className="mt-3 space-y-2">
                <h2 className="max-w-xl text-2xl font-semibold leading-tight text-white sm:text-4xl">
                  {unit.name}
                </h2>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-cyan-200/85 sm:text-sm">
                  Deadline: {formatDate(unit.deadline)}
                </p>
                {unit.is_featured && (unit.parent_project_names?.length ?? 0) > 0 ? (
                  <p className="text-xs font-semibold text-cyan-200/80">
                    {unit.parent_project_names?.join(' / ')}
                  </p>
                ) : null}
              </div>
              <div className="relative z-30 mt-5">
                <DashboardResumeButton unitId={unit.unit_id} />
              </div>
            </div>

            <ProgressWheel value={progress} className="shrink-0 self-end" />
          </div>
        </div>
      </div>
    </section>
  )
}
