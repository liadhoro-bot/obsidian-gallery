function ProjectsTabsSkeleton() {
  return (
    <div className="grid gap-3">
      <div className="grid grid-cols-2 rounded-[8px] border border-white/[0.04] bg-white/[0.055] p-0.5">
        <div className="h-9 rounded-[6px] bg-[#101822]" />
        <div className="h-9 rounded-[6px] bg-white/[0.045]" />
      </div>

      <div className="grid gap-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <section
            key={index}
            className="overflow-hidden rounded-[8px] border border-white/[0.055] bg-[#111821]"
          >
            <div className="relative h-[112px] bg-white/[0.055]">
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-3">
                <div className="h-4 w-40 rounded bg-white/16" />
              </div>
            </div>
            <div className="px-3 py-2.5">
              <div className="h-1 rounded-full bg-white/[0.08]">
                <div className="h-full w-1/3 rounded-full bg-cyan-300/75" />
              </div>
              <div className="mt-2 flex items-center justify-between">
                <div className="h-4 w-16 rounded-full bg-white/10" />
                <div className="h-3 w-12 rounded bg-white/10" />
              </div>
            </div>
          </section>
        ))}
      </div>
    </div>
  )
}

export default function ProjectsLoading() {
  return (
    <main className="min-h-screen bg-[#05090b] text-white">
      <div className="mx-auto flex w-full max-w-md flex-col gap-3 px-3 pb-28 pt-6">
        <header className="flex animate-pulse items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <div className="h-9 w-9 shrink-0 rounded-full bg-white/10" />
            <div className="min-w-0">
              <div className="h-2 w-24 rounded bg-white/12" />
              <div className="mt-2 flex items-center gap-2">
                <div className="h-3 w-8 rounded bg-cyan-300/30" />
                <div className="flex gap-1">
                  {Array.from({ length: 10 }).map((_, index) => (
                    <span
                      key={index}
                      className="h-1.5 w-3 rounded-full bg-white/10"
                    />
                  ))}
                </div>
                <div className="h-2.5 w-8 rounded bg-white/10" />
              </div>
            </div>
          </div>
          <div className="h-9 w-9 rounded-full bg-white/[0.055]" />
        </header>

        <header className="flex animate-pulse items-center justify-between gap-4">
          <div className="h-7 w-28 rounded bg-white/14" />
          <div className="flex shrink-0 gap-2">
            <div className="h-9 w-9 rounded-full bg-white/[0.055]" />
            <div className="h-9 w-9 rounded-full bg-cyan-300/35" />
          </div>
        </header>

        <ProjectsTabsSkeleton />
      </div>
    </main>
  )
}
