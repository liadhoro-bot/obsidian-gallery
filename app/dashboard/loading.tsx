const shimmer = 'animate-pulse bg-white/10'

export default function DashboardLoading() {
  return (
    <main className="min-h-screen bg-[#05090b] text-white">
      <div className="mx-auto flex w-full max-w-md flex-col gap-5 px-4 pb-28 pt-8">
        <TopNavLoading />

        <section className="space-y-5">
          <div className="flex items-center justify-between gap-4">
            <div className={`h-9 w-44 rounded-[8px] ${shimmer}`} />
            <div className="flex shrink-0 items-center gap-2">
              <div className={`h-10 w-10 rounded-full ${shimmer}`} />
              <div className={`h-10 w-10 rounded-full ${shimmer}`} />
            </div>
          </div>

          <div className="grid grid-cols-2 rounded-[8px] border border-white/[0.04] bg-white/[0.055] p-1">
            <div className="h-11 rounded-[6px] bg-[#101822]" />
            <div className="h-11 rounded-[6px]" />
          </div>
        </section>

        <NextActionLoading />
        <FeaturedUnitLoading />
        <ActiveUnitsLoading />
      </div>
    </main>
  )
}

function TopNavLoading() {
  return (
    <header className="flex items-center justify-between gap-4">
      <div className="flex min-w-0 items-center gap-3">
        <div className={`h-10 w-10 shrink-0 rounded-full ${shimmer}`} />
        <div className="min-w-0 space-y-2">
          <div className={`h-2 w-28 rounded-full ${shimmer}`} />
          <div className={`h-3 w-24 rounded-full ${shimmer}`} />
        </div>
      </div>

      <div className={`h-10 w-10 shrink-0 rounded-full ${shimmer}`} />
    </header>
  )
}

function NextActionLoading() {
  return (
    <section className="overflow-hidden rounded-[8px] border border-white/[0.06] bg-[#111821]">
      <div className="flex items-center justify-between gap-4 px-5 py-4">
        <div className="flex min-w-0 items-center gap-3">
          <div className={`h-9 w-9 rounded-full ${shimmer}`} />
          <div className="space-y-2">
            <div className={`h-4 w-36 rounded-full ${shimmer}`} />
            <div className={`h-3 w-20 rounded-full ${shimmer}`} />
          </div>
        </div>
        <div className="flex gap-1.5">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className={`h-2 w-4 rounded-full ${shimmer}`} />
          ))}
        </div>
      </div>

      {Array.from({ length: 3 }).map((_, index) => (
        <div
          key={index}
          className="grid grid-cols-[32px_1fr_56px] items-center gap-3 border-t border-white/[0.06] px-5 py-4"
        >
          <div className={`h-6 w-6 rounded-[6px] ${shimmer}`} />
          <div className="min-w-0 space-y-2">
            <div className={`h-4 w-full max-w-[210px] rounded-full ${shimmer}`} />
            <div className={`h-3 w-28 rounded-full ${shimmer}`} />
          </div>
          <div className={`h-9 rounded-[8px] ${shimmer}`} />
        </div>
      ))}
    </section>
  )
}

function FeaturedUnitLoading() {
  return (
    <section className="overflow-hidden rounded-[8px] border border-white/[0.06] bg-[#111821]">
      <div className="relative h-64">
        <div className={`absolute inset-0 ${shimmer}`} />
        <div className="absolute inset-x-5 bottom-5 space-y-3">
          <div className={`h-5 w-28 rounded-full ${shimmer}`} />
          <div className={`h-8 w-56 rounded-[8px] ${shimmer}`} />
          <div className={`h-4 w-40 rounded-full ${shimmer}`} />
        </div>
        <div className={`absolute bottom-5 right-5 h-16 w-16 rounded-full ${shimmer}`} />
      </div>

      <div className="grid grid-cols-[1fr_auto] items-center gap-4 px-5 py-4">
        <div className="min-w-0 space-y-3">
          <div className="flex justify-between gap-4">
            <div className={`h-3 w-24 rounded-full ${shimmer}`} />
            <div className={`h-3 w-20 rounded-full ${shimmer}`} />
          </div>
          <div className={`h-1.5 rounded-full ${shimmer}`} />
        </div>
        <div className={`h-11 w-28 rounded-[8px] ${shimmer}`} />
      </div>
    </section>
  )
}

function ActiveUnitsLoading() {
  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div className={`h-3 w-32 rounded-full ${shimmer}`} />
        <div className="flex h-10 rounded-[8px] border border-white/10 bg-[#111821] p-1">
          <div className={`h-8 w-9 rounded-[6px] ${shimmer}`} />
          <div className={`h-8 w-9 rounded-[6px] ${shimmer}`} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {Array.from({ length: 4 }).map((_, index) => (
          <div
            key={index}
            className="overflow-hidden rounded-[8px] border border-white/[0.06] bg-white/[0.045]"
          >
            <div className={`h-28 ${shimmer}`} />
            <div className="space-y-2 p-3">
              <div className={`h-4 w-24 rounded-full ${shimmer}`} />
              <div className={`h-3 w-16 rounded-full ${shimmer}`} />
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
