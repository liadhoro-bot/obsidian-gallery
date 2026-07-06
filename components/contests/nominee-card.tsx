import Image from 'next/image'
import type { ContestNomination } from '../../lib/contests/types'

function formatSubmittedDate(value: string) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
  }).format(new Date(value))
}

export default function NomineeCard({
  nomination,
  hideIdentity,
  control,
}: {
  nomination: ContestNomination
  hideIdentity?: boolean
  control?: React.ReactNode
}) {
  return (
    <article className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04]">
      <div className="relative aspect-square bg-[#0b1622]">
        <Image
          src={nomination.snapshot_image_url}
          alt=""
          fill
          sizes="(max-width: 768px) 50vw, 240px"
          className="object-cover"
        />
      </div>
      <div className="space-y-2 p-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-cyan-300">
              {nomination.source_type}
            </p>
            <h3 className="truncate text-base font-black text-white">
              {nomination.snapshot_title}
            </h3>
          </div>
          {control}
        </div>
        {nomination.snapshot_description ? (
          <p className="line-clamp-3 text-sm text-white/55">
            {nomination.snapshot_description}
          </p>
        ) : null}
        <div className="flex flex-wrap gap-1.5 pt-1">
          {!hideIdentity && nomination.snapshot_owner_display_name ? (
            <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] font-black uppercase text-white/60">
              By {nomination.snapshot_owner_display_name}
            </span>
          ) : null}
          <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] font-black uppercase text-white/60">
            {nomination.status}
          </span>
          <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] font-black uppercase text-white/60">
            {formatSubmittedDate(nomination.submitted_at)}
          </span>
        </div>
      </div>
    </article>
  )
}
