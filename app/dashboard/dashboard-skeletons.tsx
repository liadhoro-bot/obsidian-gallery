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
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {Array.from({ length: 4 }).map((_, index) => (
        <div
          key={index}
          className="rounded-2xl border border-white/10 bg-white/5 p-4 animate-pulse"
        >
          <div className="h-4 w-20 rounded bg-white/10" />
          <div className="mt-3 h-8 w-12 rounded bg-white/10" />
        </div>
      ))}
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

      <div className="h-8 w-24 rounded-full bg-white/10" />
    </div>
  )
}

export function FeaturedUnitSkeleton() {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/5 p-5 animate-pulse">
      <div className="h-3 w-24 rounded bg-white/10" />
      <div className="mt-4 h-8 w-48 rounded bg-white/10" />
      <div className="mt-2 h-4 w-32 rounded bg-white/10" />
      <div className="mt-5 h-12 w-40 rounded-2xl bg-white/10" />
    </div>
  )
}

export function BenchUnitsSkeleton() {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/5 p-5 animate-pulse">
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