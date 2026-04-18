export function RecipesStatsSkeleton() {
  return (
    <section className="grid gap-3 sm:grid-cols-2 animate-pulse">
      {[1, 2].map((item) => (
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

export function RecipesFiltersSkeleton() {
  return (
    <section className="rounded-3xl border border-neutral-800 bg-neutral-900 p-4 animate-pulse">
      <div className="h-5 w-24 rounded bg-neutral-800" />
      <div className="mt-2 h-4 w-56 rounded bg-neutral-800" />

      <div className="mt-4 flex flex-col gap-3 sm:flex-row">
        <div className="h-10 flex-1 rounded-xl bg-neutral-800" />
        <div className="h-10 w-28 rounded-xl bg-neutral-800" />
      </div>
    </section>
  )
}

export function RecipesListSkeleton() {
  return (
    <section className="animate-pulse">
      <div className="mb-3 h-5 w-28 rounded bg-neutral-800" />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <div
            key={index}
            className="overflow-hidden rounded-3xl border border-neutral-800 bg-neutral-900"
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
  )
}