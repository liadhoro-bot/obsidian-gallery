export default function ThemeDetailLoading() {
  return (
    <main className="min-h-screen bg-[#07090d] text-white">
      <div className="mx-auto max-w-md pb-28">
        <div className="px-4 pt-4">
          <div className="h-12 animate-pulse rounded-full bg-white/10" />
        </div>

        <section className="relative mt-4">
          <div className="h-[340px] animate-pulse bg-white/10" />
          <div className="-mt-16 px-4">
            <div className="relative rounded-3xl border border-white/10 bg-[#10131a]/90 p-5 shadow-2xl backdrop-blur animate-pulse">
              <div className="h-6 w-24 rounded bg-white/10" />
              <div className="mt-4 h-9 w-52 rounded bg-white/10" />
              <div className="mt-3 h-16 rounded bg-white/10" />
            </div>
          </div>
        </section>

        <section className="px-4 pt-6 animate-pulse">
          <div className="h-4 w-24 rounded bg-white/10" />
          <div className="mt-3 h-24 rounded-2xl bg-white/10" />
        </section>
      </div>
    </main>
  )
}
