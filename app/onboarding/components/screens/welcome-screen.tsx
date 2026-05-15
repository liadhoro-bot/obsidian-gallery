export default function WelcomeScreen() {
  return (
    <section className="flex min-h-[520px] flex-col justify-between rounded-[2rem] border border-white/10 bg-slate-950/70 p-6 shadow-[0_0_40px_rgba(34,211,238,0.06)]">
      <div className="space-y-4">
        <div className="inline-flex w-fit rounded-full border border-cyan-400/30 bg-cyan-400/10 px-3 py-1 text-xs font-black uppercase tracking-[0.2em] text-cyan-300">
          Obsidian Gallery
        </div>

        <div className="space-y-4 pt-8">
          <h1 className="text-4xl font-black leading-tight text-white">
            Your miniature hobby.
            <br />
            Organized beautifully.
          </h1>

          <p className="max-w-sm text-base leading-7 text-white/60">
            Track projects, manage paints, build recipes, create themes, and
            see your hobby progress come to life.
          </p>
        </div>
      </div>

      <div className="rounded-3xl border border-white/10 bg-black/30 p-4">
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-2xl border border-cyan-400/20 bg-cyan-400/10 p-4 text-center text-xs font-black text-cyan-200 shadow-[0_0_18px_rgba(34,211,238,0.12)]">
            Projects
          </div>

          <div className="rounded-2xl border border-cyan-400/20 bg-cyan-400/10 p-4 text-center text-xs font-black text-cyan-200 shadow-[0_0_18px_rgba(34,211,238,0.12)]">
            Vault
          </div>

          <div className="rounded-2xl border border-cyan-400/20 bg-cyan-400/10 p-4 text-center text-xs font-black text-cyan-200 shadow-[0_0_18px_rgba(34,211,238,0.12)]">
            Recipes
          </div>
        </div>
      </div>
    </section>
  )
}