export default function ThemesLoading() {
  return (
    <main className="min-h-screen bg-[#03070b] pb-24 text-white">
      <div className="mx-auto flex w-full max-w-md flex-col gap-5 px-4 pb-24 pt-5">
        <div className="h-12 animate-pulse rounded-full bg-white/10" />

        <div>
          <h1 className="text-3xl font-bold tracking-tight">Theme Library</h1>
          <p className="mt-2 text-sm font-medium text-neutral-200">
            Solve the hardest part: choosing the colors
          </p>
          <p className="mt-2 text-sm leading-6 text-white/60">
            Themes let you capture color palettes, reference images, and visual
            concepts in one place. Explore community schemes, create your own,
            and give every project a clear artistic direction before the first
            coat of paint.
          </p>
        </div>

        <div className="grid grid-cols-3 animate-pulse rounded-2xl border border-white/10 bg-white/[0.03] p-1">
          <div className="h-10 rounded-xl bg-white/10" />
          <div className="h-10 rounded-xl bg-white/10" />
          <div className="h-10 rounded-xl bg-white/10" />
        </div>

        <div className="grid grid-cols-2 gap-3 animate-pulse">
          {Array.from({ length: 4 }).map((_, index) => (
            <div
              key={index}
              className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.035]"
            >
              <div className="aspect-square bg-white/10" />
              <div className="space-y-2 p-3">
                <div className="h-4 w-24 rounded bg-white/10" />
                <div className="h-8 rounded-xl bg-white/10" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </main>
  )
}
