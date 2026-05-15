const painPoints = [
  'Paints you forgot you owned',
  'Recipes lost in old notes',
  'Half-finished units everywhere',
  'Photos scattered across your phone',
  'Buying duplicate paints',
  'No clear progress view',
]

export default function ProblemScreen() {
  return (
    <section className="flex min-h-[520px] flex-col justify-between rounded-[2rem] border border-white/10 bg-slate-950/70 p-6 shadow-[0_0_40px_rgba(34,211,238,0.06)]">
      <div className="space-y-4">
        <div className="inline-flex w-fit rounded-full border border-cyan-400/30 bg-cyan-400/10 px-3 py-1 text-xs font-black uppercase tracking-[0.2em] text-cyan-300">
          The Hobby Pile
        </div>

        <div className="space-y-3 pt-4">
          <h2 className="text-3xl font-black leading-tight text-white">
            Miniature painting
            <br />
            gets messy fast.
          </h2>

          <p className="max-w-sm text-base leading-7 text-white/60">
            Paints, recipes, projects, photos, notes, and progress all end up
            scattered across too many places.
          </p>
        </div>
      </div>

      <div className="mt-6 space-y-3">
        <div className="rounded-3xl border border-white/10 bg-black/30 p-4">
          <div className="grid grid-cols-2 gap-3">
            {painPoints.map((point) => (
              <div
                key={point}
                className="rounded-2xl border border-white/10 bg-white/[0.03] p-3 text-xs font-bold leading-5 text-white/65"
              >
                {point}
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-3xl border border-cyan-400/20 bg-cyan-400/10 p-4 shadow-[0_0_18px_rgba(34,211,238,0.12)]">
          <p className="text-sm font-black leading-6 text-cyan-200">
            Obsidian Gallery keeps your model painting in one place.
          </p>
        </div>
      </div>
    </section>
  )
}