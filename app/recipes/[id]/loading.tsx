export default function RecipeDetailLoading() {
  return (
    <main className="min-h-screen bg-[#081018] text-white">
      <div className="mx-auto flex w-full max-w-md flex-col gap-5 px-4 pb-24 pt-5">
        <div className="h-12 animate-pulse rounded-full bg-white/10" />
        <div className="h-5 w-28 animate-pulse rounded bg-cyan-400/20" />
        <div className="h-[260px] animate-pulse rounded-3xl bg-white/10" />
        <div className="grid grid-cols-3 animate-pulse rounded-2xl border border-white/10 bg-slate-950/70 p-1">
          <div className="h-10 rounded-xl bg-white/10" />
          <div className="h-10 rounded-xl bg-white/10" />
          <div className="h-10 rounded-xl bg-white/10" />
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4 animate-pulse">
          <div className="h-5 w-32 rounded bg-white/10" />
          <div className="mt-4 h-24 rounded-xl bg-white/10" />
        </div>
      </div>
    </main>
  )
}
