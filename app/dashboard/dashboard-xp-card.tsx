import {
  getDashboardCurrentUser,
  getDashboardXpState,
} from './dashboard-data'

export default async function DashboardXpCard({
  userId,
}: {
  userId?: string
}) {
  const resolvedUserId = userId ?? (await getDashboardCurrentUser())?.id

  if (!resolvedUserId) return null

  const {
    currentLevel,
    xpIntoLevel,
    xpNeededForLevel,
    xpToNextLevel,
    progressPercent,
  } = await getDashboardXpState(resolvedUserId)

  return (
    <section className="rounded-3xl border border-white/10 bg-white/5 p-5">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-300">
        Path to Grandmastery
      </p>

      <div className="mt-3 flex items-end justify-between gap-4">
        <p className="text-3xl font-semibold text-white">
          {xpIntoLevel} / {xpNeededForLevel}
        </p>
        <p className="text-sm text-white/55">
          Level {currentLevel} · {xpToNextLevel} XP to Level {currentLevel + 1}
        </p>
      </div>

      <div className="mt-4 h-3 w-full overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full rounded-full bg-cyan-400 transition-all"
          style={{ width: `${progressPercent}%` }}
        />
      </div>
    </section>
  )
}
