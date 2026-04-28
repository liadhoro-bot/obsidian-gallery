const badges = [
  {
    label: 'Speed Painter',
    icon: 'ϟ',
    color: 'text-cyan-400',
  },
  {
    label: 'Detail King',
    icon: '♜',
    color: 'text-orange-400',
  },
]

export default function DashboardHobbyBadges() {
  return (
    <section className="space-y-3">
      <p className="text-xs font-bold uppercase tracking-[0.32em] text-white/60">
        Hobby Badges
      </p>

      <div className="flex flex-wrap gap-3">
        {badges.map((badge) => (
          <div
            key={badge.label}
            className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.08] px-4 py-3"
          >
            <span className={`text-lg font-black ${badge.color}`}>
              {badge.icon}
            </span>
            <span className="text-[11px] font-black uppercase text-white">
              {badge.label}
            </span>
          </div>
        ))}
      </div>
    </section>
  )
}