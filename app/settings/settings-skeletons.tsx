export function SettingsProfileSkeleton() {
  return (
    <div className="animate-pulse rounded-3xl border border-white/5 bg-white/[0.04] p-5">
      <div className="mx-auto h-28 w-28 rounded-3xl bg-white/10" />
      <div className="mx-auto mt-5 h-6 w-40 rounded bg-white/10" />
      <div className="mx-auto mt-3 h-4 w-52 rounded bg-white/10" />
      <div className="mx-auto mt-5 h-10 w-28 rounded-xl bg-white/10" />
    </div>
  )
}

export function SettingsCardSkeleton() {
  return (
    <div className="animate-pulse rounded-3xl border border-white/5 bg-white/[0.04] p-5">
      <div className="mb-6 h-5 w-44 rounded bg-white/10" />
      <div className="space-y-4">
        <div className="h-5 rounded bg-white/10" />
        <div className="h-5 rounded bg-white/10" />
        <div className="h-5 rounded bg-white/10" />
      </div>
    </div>
  )
}