export const metadata = {
  title: 'Offline - Obsidian Gallery',
}

export default function OfflinePage() {
  return (
    <main className="min-h-screen bg-neutral-950 px-6 py-10 text-white">
      <section className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-2xl flex-col justify-center">
        <div className="border-l-2 border-cyan-400 pl-5">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-300">
            Obsidian Gallery
          </p>
          <h1 className="mt-4 text-4xl font-bold tracking-tight sm:text-5xl">
            The bench is offline.
          </h1>
        </div>

        <div className="mt-8 rounded-lg border border-white/10 bg-white/[0.04] p-5 shadow-2xl shadow-black/30">
          <p className="text-base leading-7 text-neutral-200">
            Your saved app shell is ready, but this view needs a fresh
            connection before it can safely show account data.
          </p>
          <p className="mt-4 text-sm leading-6 text-neutral-400">
            Reconnect and refresh to pick up your latest projects, guides,
            themes, and paints changes.
          </p>
        </div>

        <a
          href="/dashboard"
          className="mt-6 inline-flex w-fit items-center justify-center rounded-lg bg-cyan-400 px-4 py-2 text-sm font-semibold text-neutral-950 transition hover:bg-cyan-300"
        >
          Try again
        </a>
      </section>
    </main>
  )
}
