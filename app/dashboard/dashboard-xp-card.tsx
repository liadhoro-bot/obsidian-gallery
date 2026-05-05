import { createClient } from '../../utils/supabase/server'

export default async function DashboardXpCard() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return null

  const { data: profile } = await supabase
    .from('profiles')
    .select('xp, level')
    .eq('id', user.id)
    .single()

  const currentXp = profile?.xp ?? 0
  const currentLevel = profile?.level ?? 0

  const { data: currentLevelRow } = await supabase
    .from('levels')
    .select('xp_required')
    .eq('level', currentLevel)
    .maybeSingle()

  const { data: nextLevelRow } = await supabase
    .from('levels')
    .select('xp_required')
    .eq('level', currentLevel + 1)
    .maybeSingle()

  const currentLevelXp = currentLevelRow?.xp_required ?? 0
  const nextLevelXp = nextLevelRow?.xp_required ?? currentXp

  const xpIntoLevel = Math.max(0, currentXp - currentLevelXp)
  const xpNeededForLevel = Math.max(1, nextLevelXp - currentLevelXp)
  const xpToNextLevel = Math.max(0, nextLevelXp - currentXp)

  const progressPercent = Math.min(
    100,
    (xpIntoLevel / xpNeededForLevel) * 100
  )

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