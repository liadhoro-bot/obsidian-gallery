'use client'

type CuratorBridgeScreenProps = {
  onEnter: () => void
}

export default function CuratorBridgeScreen({
  onEnter,
}: CuratorBridgeScreenProps) {
  return (
    <section className="flex min-h-screen flex-col bg-[#05090a] px-4 pb-8 pt-9 text-white">
      <div className="flex gap-2" aria-label="Onboarding complete">
        {[0, 1, 2].map((step) => (
          <span
            key={step}
            className="h-2 w-2 rounded-full bg-cyan-300 shadow-[0_0_12px_rgba(34,211,238,0.55)]"
          />
        ))}
      </div>

      <div className="flex flex-1 flex-col items-center justify-center text-center">
        <div className="relative flex h-14 w-14 items-center justify-center rounded-full border border-white/10 bg-[#151b24] text-xl shadow-[0_0_45px_rgba(34,211,238,0.1)]">
          <svg viewBox="0 0 24 24" className="h-6 w-6 text-amber-100" fill="none" aria-hidden="true">
            <path
              d="M7 4.5h8.5L18 7v12.5H7v-15Z"
              fill="currentColor"
              opacity="0.92"
            />
            <path
              d="M9 10h6M9 13h6M9 16h4"
              stroke="#111827"
              strokeLinecap="round"
              strokeWidth="1.5"
            />
          </svg>
          <span className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-cyan-300 text-xs font-black text-black">
            <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" aria-hidden="true">
              <path
                d="m5.5 12.5 4 4 9-9"
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="3"
              />
            </svg>
          </span>
        </div>

        <p className="mt-8 text-[10px] font-black uppercase tracking-[0.28em] text-cyan-300">
          The Curator
        </p>

        <blockquote className="mt-3 max-w-xs text-base font-bold leading-7 text-white">
          &quot;One miniature. One step at a time. We shall postpone panic until
          it becomes necessary.&quot;
        </blockquote>

        <button
          type="button"
          onClick={onEnter}
          className="tap-press tap-target mt-8 h-12 rounded-2xl bg-cyan-400 px-8 text-sm font-black text-black shadow-[0_0_28px_rgba(34,211,238,0.24)] transition hover:bg-cyan-300"
        >
          Enter the Gallery -&gt;
        </button>
      </div>
    </section>
  )
}
