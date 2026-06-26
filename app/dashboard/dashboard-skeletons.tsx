export function SectionCardSkeleton() {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4 animate-pulse">
      <div className="h-5 w-32 rounded bg-white/10" />
      <div className="mt-4 space-y-3">
        <div className="h-20 rounded-xl bg-white/10" />
        <div className="h-20 rounded-xl bg-white/10" />
        <div className="h-20 rounded-xl bg-white/10" />
      </div>
    </div>
  )
}

export function StatsSkeleton() {
  return (
    <div className="grid gap-3">
      <div className="flex items-center justify-between">
        <div className="h-4 w-24 rounded bg-white/10" />
        <div className="h-8 w-16 rounded-xl bg-white/10" />
      </div>
      <div className="grid grid-cols-3 gap-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <div
            key={index}
            className="min-h-[86px] rounded-xl border border-white/10 bg-white/5 p-3 animate-pulse"
          >
            <div className="h-3 w-16 rounded bg-white/10" />
            <div className="mt-3 h-6 w-10 rounded bg-white/10" />
          </div>
        ))}
      </div>
    </div>
  )
}

export function HeroCardSkeleton() {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/5 p-5 animate-pulse">
      <div className="h-3 w-32 rounded bg-white/10" />
      <div className="mt-4 h-8 w-48 rounded bg-white/10" />
      <div className="mt-4 h-3 w-full rounded-full bg-white/10" />
    </div>
  )
}

export function TopBarSkeleton() {
  return (
    <div className="flex items-center justify-between animate-pulse">
      <div className="flex items-center gap-3">
        <div className="h-12 w-12 rounded-full bg-white/10" />
        <div className="space-y-2">
          <div className="h-3 w-28 rounded bg-white/10" />
          <div className="h-4 w-12 rounded bg-white/10" />
        </div>
      </div>

      <div className="h-11 w-[214px] rounded-full bg-white/10" />
    </div>
  )
}

export function FeaturedUnitSkeleton() {
  return (
    <div className="overflow-hidden rounded-3xl border border-white/10 bg-white/5 animate-pulse">
      <div className="relative min-h-[260px]">
        <div className="absolute inset-0 bg-white/10" />
        <div className="relative flex min-h-[260px] flex-col justify-end p-5 sm:p-6">
          <div className="flex items-end justify-between gap-4 sm:gap-5">
            <div className="min-w-0 flex-1">
              <div className="h-3 w-24 rounded bg-white/10" />
              <div className="mt-3 space-y-2">
                <div className="h-8 w-48 max-w-full rounded bg-white/10 sm:h-10 sm:w-64" />
                <div className="h-4 w-36 rounded bg-white/10" />
              </div>
              <div className="mt-5 h-12 w-40 rounded-2xl bg-white/10" />
            </div>
            <div className="h-24 w-24 rounded-full bg-white/10 sm:h-[118px] sm:w-[118px]" />
          </div>
        </div>
      </div>
    </div>
  )
}

export function BenchUnitsSkeleton() {
  return (
    <div
      className="rounded-3xl border border-white/10 bg-white/5 p-5 animate-pulse"
      style={{
        contentVisibility: 'auto',
        containIntrinsicSize: '920px',
      }}
    >
      <div className="flex items-center justify-between">
        <div className="h-4 w-36 rounded bg-white/10" />
        <div className="h-4 w-16 rounded bg-white/10" />
      </div>

      <div className="mt-4 space-y-3">
        {Array.from({ length: 4 }).map((_, index) => (
          <div
            key={index}
            className="rounded-2xl border border-white/10 bg-black/20 p-4"
          >
            <div className="h-5 w-40 rounded bg-white/10" />
            <div className="mt-2 h-3 w-32 rounded bg-white/10" />
          </div>
        ))}
      </div>
    </div>
  )
}
