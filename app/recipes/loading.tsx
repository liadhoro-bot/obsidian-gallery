export default function RecipesLoading() {
  return (
    <main className="min-h-screen bg-[#03070b] pb-24 text-white">
      <div className="mx-auto flex w-full max-w-md flex-col gap-5 px-4 pb-24 pt-5">
        <div className="h-12 animate-pulse rounded-full bg-white/10" />

        <section className="space-y-4">
          <p className="text-xs font-bold uppercase tracking-[0.35em] text-cyan-400">
            Paint Scheme Management
          </p>
          <h1 className="text-4xl font-black tracking-tight text-white">
            The Recipe Library
          </h1>
          <p className="text-sm font-medium text-neutral-200">
            Record, share, and discover painting recipes.
          </p>
          <p className="text-base leading-7 text-neutral-400">
            Browse community recipes for inspiration, or turn your techniques
            into step-by-step guides with paint combinations and progress photos.
            Learn from the community, preserve your knowledge, and make it easy
            to recreate successful paint schemes across projects.
          </p>
        </section>

        <section className="space-y-5 animate-pulse">
          <div className="grid grid-cols-3 overflow-hidden rounded-xl border border-white/10 bg-white/[0.03] p-1">
            <div className="h-10 rounded-lg bg-white/10" />
            <div className="h-10 rounded-lg bg-white/10" />
            <div className="h-10 rounded-lg bg-white/10" />
          </div>

          <div className="h-11 rounded-xl bg-white/10" />
          <div className="grid grid-cols-2 gap-3">
            {Array.from({ length: 4 }).map((_, index) => (
              <div
                key={index}
                className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]"
              >
                <div className="aspect-square bg-white/10" />
                <div className="p-3">
                  <div className="h-4 w-24 rounded bg-white/10" />
                  <div className="mt-2 h-3 w-full rounded bg-white/10" />
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  )
}
