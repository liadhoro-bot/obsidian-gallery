export function VaultStatsSkeleton() {
  return (
    <section className="grid gap-3 sm:grid-cols-3 animate-pulse">
      {[1, 2, 3].map((item) => (
        <div
          key={item}
          className="rounded-2xl border border-neutral-800 bg-neutral-900 p-4"
        >
          <div className="h-3 w-20 rounded bg-neutral-800" />
          <div className="mt-3 h-8 w-16 rounded bg-neutral-800" />
        </div>
      ))}
    </section>
  )
}

export function VaultFiltersSkeleton() {
  return (
    <section className="rounded-3xl border border-neutral-800 bg-neutral-900 p-4 animate-pulse">
      <div className="h-5 w-24 rounded bg-neutral-800" />
      <div className="mt-2 h-4 w-64 rounded bg-neutral-800" />

      <div className="mt-4 grid gap-3 lg:grid-cols-12">
        <div className="h-10 rounded-xl bg-neutral-800 lg:col-span-4" />
        <div className="h-10 rounded-xl bg-neutral-800 lg:col-span-3" />
        <div className="h-10 rounded-xl bg-neutral-800 lg:col-span-3" />
        <div className="h-10 rounded-xl bg-neutral-800 lg:col-span-2" />
        <div className="h-10 w-32 rounded-xl bg-neutral-800 lg:col-span-12" />
      </div>
    </section>
  )
}

export function VaultGridSkeleton() {
  return (
    <section className="animate-pulse">
      <div className="mb-3 h-5 w-40 rounded bg-neutral-800" />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 9 }).map((_, index) => (
          <div
            key={index}
            className="rounded-3xl border border-neutral-800 bg-neutral-900 p-4"
          >
            <div className="flex items-start gap-4">
              <div className="h-14 w-14 rounded-2xl bg-neutral-800" />
              <div className="flex-1">
                <div className="h-3 w-24 rounded bg-neutral-800" />
                <div className="mt-2 h-5 w-36 rounded bg-neutral-800" />
                <div className="mt-2 h-4 w-28 rounded bg-neutral-800" />
              </div>
            </div>

            <div className="mt-4 flex gap-2">
              <div className="h-6 w-16 rounded-full bg-neutral-800" />
              <div className="h-6 w-20 rounded-full bg-neutral-800" />
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}