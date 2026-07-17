import Link from 'next/link'
import Image from 'next/image'
import { getDashboardContestPrompt } from '../../lib/contests/queries'
import { getSupabaseImageUrl } from '../../utils/images/supabase-image'

export default async function DashboardContestCard({ userId }: { userId: string }) {
  const prompt = await getDashboardContestPrompt(userId)
  if (!prompt) return null

  const href = `/contests/${prompt.contest.slug}`
  const isDemoContest =
    prompt.contest.id === '00000000-0000-4000-8000-000000000001'
  const label =
    prompt.kind === 'vote'
      ? 'Open Contest'
      : prompt.kind === 'submit'
        ? 'Open Contest'
        : 'Review Nomination'
  const coverImageUrl = isDemoContest
    ? null
    : getSupabaseImageUrl(prompt.contest.cover_image_url, {
        width: 840,
        quality: 45,
        resize: 'cover',
      })

  return (
    <Link
      href={href}
      className="tap-card group grid min-h-[348px] grid-rows-[180px_1fr] overflow-hidden rounded-2xl border border-cyan-300/20 bg-cyan-300/[0.06] transition hover:border-cyan-300/45"
    >
      <div className="relative h-[180px] bg-[#0b1622]">
        {coverImageUrl ? (
          <Image
            src={coverImageUrl}
            alt=""
            fill
            sizes="(max-width: 768px) 100vw, 420px"
            className="object-cover transition duration-[180ms] group-hover:scale-[1.02]"
          />
        ) : (
          <div className="h-full bg-[radial-gradient(circle_at_25%_20%,rgba(34,211,238,0.22),transparent_34%),linear-gradient(135deg,#111827,#020617)]" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-[#061018] via-black/20 to-transparent" />
      </div>
      <div className="flex min-h-0 flex-col p-4">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-cyan-200">
          Active Contest
        </p>
        <h2 className="mt-2 line-clamp-2 text-xl font-black text-white">
          {prompt.contest.title}
        </h2>
        {prompt.contest.short_description ? (
          <p className="mt-1 line-clamp-2 text-sm text-white/55">
            {prompt.contest.short_description}
          </p>
        ) : null}
        <span className="mt-auto inline-flex rounded-xl bg-cyan-400 px-4 py-2 text-sm font-black text-black">
          {label}
        </span>
      </div>
    </Link>
  )
}
