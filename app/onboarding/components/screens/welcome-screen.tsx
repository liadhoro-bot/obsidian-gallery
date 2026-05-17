import Image from 'next/image'

export default function WelcomeScreen() {
  return (
    <section className="relative min-h-screen overflow-hidden bg-black">
      <Image
        src="/onboarding/welcome-hero.jpeg"
        alt="Miniature painting hobby workspace"
        fill
        priority
        className="object-cover brightness-110"
      />

      <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-black/10 to-black/65" />

      <div className="relative z-10 flex min-h-screen flex-col justify-between p-5">
        <div className="w-full rounded-full border border-cyan-300/45 bg-black/15 px-5 py-4 text-center text-lg font-black uppercase tracking-[0.28em] text-cyan-100 shadow-[0_0_24px_rgba(34,211,238,0.14)] backdrop-blur-sm">
          Obsidian Gallery
        </div>

        <div className="space-y-5 pb-14">
          <h1 className="max-w-sm text-[2.6rem] font-black leading-[1.08] tracking-[-0.03em] text-white drop-shadow-[0_6px_22px_rgba(0,0,0,0.9)]">
            Your miniature workspace.
            <br />
            Organized to perfection.
          </h1>

          <p className="max-w-sm text-base leading-7 text-white/80 drop-shadow-[0_2px_12px_rgba(0,0,0,0.8)]">
            Track projects, manage paints, build recipes, create themes, and
            see your model progress come to life.
          </p>
          <button
  type="button"
  className="mt-2 h-14 w-full rounded-3xl bg-cyan-300 px-6 text-sm font-black uppercase tracking-[0.22em] text-slate-950 shadow-[0_0_40px_rgba(34,211,238,0.35)] transition hover:bg-cyan-200 active:scale-[0.99]"
>
  Start Here
</button>
        </div>
      </div>
    </section>
  )
}