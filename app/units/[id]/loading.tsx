export default function UnitDetailLoading() {
  return (
    <main className="min-h-screen bg-[#081018] text-white">
      <div className="mx-auto flex w-full max-w-md flex-col gap-5 px-4 pb-24 pt-5">
        <div className="h-12 animate-pulse rounded-full bg-white/10" />

        <div className="overflow-hidden">
          <div className="h-[260px] animate-pulse bg-white/10" />

          <div className="mt-4 grid gap-5 animate-pulse">
            <div className="grid grid-cols-2 rounded-2xl border border-white/10 bg-slate-950/70 p-1">
              <div className="h-10 rounded-xl bg-white/10" />
              <div className="h-10 rounded-xl bg-white/10" />
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="h-4 w-24 rounded bg-white/10" />
              <div className="mt-4 grid grid-cols-3 gap-3">
                <div className="h-12 rounded bg-white/10" />
                <div className="h-12 rounded bg-white/10" />
                <div className="h-12 rounded bg-white/10" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}
