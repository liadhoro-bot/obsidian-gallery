function ProjectsTabsSkeleton() {
  return (
    <div className="grid gap-5 animate-pulse">
      <div className="grid grid-cols-2 rounded-2xl border border-white/10 bg-slate-950/70 p-1">
        <div className="h-10 rounded-xl bg-white/10" />
        <div className="h-10 rounded-xl bg-white/10" />
      </div>

      <section className="rounded-2xl border border-neutral-800 bg-gradient-to-br from-neutral-900 to-neutral-950 p-5">
        <div className="h-4 w-32 rounded bg-neutral-800" />
        <div className="mt-3 h-6 w-36 rounded bg-neutral-800" />
        <div className="mt-5 grid gap-4">
          {Array.from({ length: 2 }).map((_, index) => (
            <div
              key={index}
              className="overflow-hidden rounded-2xl border border-neutral-800 bg-neutral-900/80"
            >
              <div className="h-40 bg-neutral-800" />
              <div className="p-4">
                <div className="h-5 w-32 rounded bg-neutral-800" />
                <div className="mt-3 h-4 w-full rounded bg-neutral-800" />
                <div className="mt-2 h-4 w-4/5 rounded bg-neutral-800" />
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}

export default function ProjectsLoading() {
  return (
    <main className="min-h-screen bg-[#081018] text-white">
      <div className="mx-auto flex w-full max-w-md flex-col gap-5 px-4 pb-24 pt-5">
        <div className="h-12 animate-pulse rounded-full bg-white/10" />

        <header>
          <h1 className="text-3xl font-bold">Projects</h1>
          <p className="mt-2 text-sm font-medium text-neutral-200">
            Plan and organize your painting campaigns
          </p>
          <p className="mt-2 text-sm leading-6 text-neutral-400">
            Projects group related units into a single collection - whether
            it's an army, warband, or display force. Use Projects to organize
            your units, track deadlines, manage palettes, organize your units,
            and collect inspiration, reference images, and showcase photos.
          </p>
        </header>

        <ProjectsTabsSkeleton />
      </div>
    </main>
  )
}
