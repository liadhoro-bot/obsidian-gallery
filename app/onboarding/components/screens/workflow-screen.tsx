const workflowItems = [
  {
    label: 'Vault',
    title: 'Collect paints',
    caption: 'Track your paints',
  },
  {
    label: 'Recipes',
    title: 'Build schemes',
    caption: 'Save techniques',
  },
  {
    label: 'Themes',
    title: 'Create palettes',
    caption: 'Build cohesive themes',
  },
  {
    label: 'Projects',
    title: 'Organize armies',
    caption: 'Organize armies',
  },
  {
    label: 'Units',
    title: 'Track progress',
    caption: 'Finish units',
  },
]

export default function WorkflowScreen() {
  return (
    <section className="flex min-h-[520px] flex-col justify-between rounded-[2rem] border border-white/10 bg-slate-950/70 p-6 shadow-[0_0_40px_rgba(34,211,238,0.06)]">
      <div className="space-y-4">
        <div className="inline-flex w-fit rounded-full border border-cyan-400/30 bg-cyan-400/10 px-3 py-1 text-xs font-black uppercase tracking-[0.2em] text-cyan-300">
          Hobby System
        </div>

        <div className="space-y-3 pt-4">
          <h2 className="text-3xl font-black leading-tight text-white">
            From paint collection
            <br />
            to finished army.
          </h2>

          <p className="max-w-sm text-base leading-7 text-white/60">
            Vault, recipes, themes, projects, and units work together as one
            connected hobby operating system.
          </p>
        </div>
      </div>

      <div className="mt-6 rounded-[2rem] border border-white/10 bg-black/30 p-4">
        <div className="relative mx-auto w-full max-w-[260px] rounded-[2rem] border border-white/10 bg-slate-950 p-3 shadow-[0_0_28px_rgba(34,211,238,0.1)]">
          <div className="mb-3 mx-auto h-1 w-14 rounded-full bg-white/15" />

          <div className="space-y-3">
            {workflowItems.map((item, index) => (
              <div
                key={item.label}
                className="rounded-2xl border border-white/10 bg-white/[0.03] p-3"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-cyan-400/20 bg-cyan-400/10 text-xs font-black text-cyan-300 shadow-[0_0_14px_rgba(34,211,238,0.12)]">
                    {index + 1}
                  </div>

                  <div className="min-w-0">
                    <div className="text-[10px] font-black uppercase tracking-[0.18em] text-cyan-300">
                      {item.label}
                    </div>

                    <div className="text-sm font-black text-white">
                      {item.title}
                    </div>

                    <div className="text-xs font-semibold text-white/45">
                      {item.caption}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}