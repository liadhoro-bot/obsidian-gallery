import Image from 'next/image'

const badges = [
  {
    title: 'Unproven Organism',
    trigger: '“Earned” by simply existing. Woot',
    flavor:
      'No accomplishment detected, but your pile of shame senses a disturbance in the force.',
    image: '/badges/unproven-organism.png',
  },
]

export default function DashboardHobbyBadges() {
  return (
    <section className="space-y-3">
      <p className="text-xs font-bold uppercase tracking-[0.32em] text-white/60">
        Badges Earned
      </p>

      <div className="space-y-4">
        {badges.map((badge) => (
          <div
            key={badge.title}
            className="relative overflow-hidden rounded-3xl border border-white/10 bg-[#10161d]/95 p-4 shadow-[0_0_24px_rgba(0,0,0,0.35)]"
          >
            {/* subtle blue glow */}
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(71,133,255,0.10),transparent_45%)]" />

            <div className="relative flex items-start gap-4">
              {/* badge image */}
              <div className="flex-shrink-0 overflow-hidden rounded-2xl border border-white/10 bg-black/30">
                <Image
                  src={badge.image}
                  alt={badge.title}
                  width={96}
                  height={96}
                  className="h-24 w-24 object-cover"
                />
              </div>

              {/* text */}
              <div className="min-w-0 flex-1">
                <h3 className="text-base font-black uppercase tracking-wide text-white">
                  {badge.title}
                </h3>

                <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.22em] text-cyan-300/70">
                  {badge.trigger}
                </p>

                <div className="my-3 h-px w-full bg-gradient-to-r from-[#6d5840] via-white/10 to-transparent" />

                <p className="text-sm leading-relaxed text-white/75">
                  {badge.flavor}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}