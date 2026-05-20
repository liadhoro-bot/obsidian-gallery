'use client'

import Image from 'next/image'

export type PainId =
  | 'pile'
  | 'schemes'
  | 'paints'
  | 'fragmentation'
  | 'choices'

const painPoints: {
  id: PainId
  number: string
  title: string
  text: string
  image: string
  glow: string
}[] = [
  {
    id: 'pile',
    number: '1',
    title: 'The Pile of Shame',
    text: 'I don’t get enough models painted.',
    image: '/onboarding/pains/pile-of-shame.jpeg',
    glow: 'from-amber-300/25',
  },
  {
    id: 'schemes',
    number: '2',
    title: 'Scheme Loss',
    text: 'My recipes are scattered and sometimes lost.',
    image: '/onboarding/pains/scheme-loss.jpeg',
    glow: 'from-purple-300/25',
  },
  {
    id: 'paints',
    number: '3',
    title: 'Paint Management',
    text: 'It’s insane to remember all the paints I own.',
    image: '/onboarding/pains/paint-management.jpeg',
    glow: 'from-cyan-300/25',
  },
  {
    id: 'fragmentation',
    number: '4',
    title: 'Fragmentation',
    text: 'Notes, messages, video links, screenshots - it’s all over the place.',
    image: '/onboarding/pains/fragmentation.jpeg',
    glow: 'from-violet-300/25',
  },
  {
    id: 'choices',
    number: '5',
    title: 'Tough Choices',
    text: 'Takes ages to make up my mind on palettes and techniques.',
    image: '/onboarding/pains/tough-choices.jpeg',
    glow: 'from-cyan-300/25',
  },
]

type ProblemScreenProps = {
  selectedPains: PainId[]
  onSelectedPainsChange: (pains: PainId[]) => void
  onBack: () => void
  onSkip: () => void
  onContinue: () => void
}

export default function ProblemScreen({
  selectedPains = [],
  onSelectedPainsChange,
  onBack,
  onSkip,
  onContinue,
}: ProblemScreenProps) {
  function togglePain(id: PainId) {
    onSelectedPainsChange(
      selectedPains.includes(id)
        ? selectedPains.filter((item) => item !== id)
        : [...selectedPains, id]
    )
  }

  const hasSelection = selectedPains.length > 0

  return (
    <section className="relative flex min-h-screen flex-col overflow-hidden bg-black">
      <Image
        src="/onboarding/problem-desk.jpeg"
        alt="Chaotic miniature painting desk"
        fill
        priority
        className="object-cover opacity-95"
      />

      <div className="absolute inset-0 bg-gradient-to-b from-black/45 via-black/35 to-black/78" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_20%,rgba(34,211,238,0.18),transparent_34%),radial-gradient(circle_at_80%_70%,rgba(124,58,237,0.14),transparent_35%)]" />

      <div className="relative z-10 flex min-h-dvh flex-col px-5 pb-8 pt-5">
        <div className="space-y-5">
          <div className="relative z-10 flex justify-center gap-2">
            {[0, 1, 2, 3].map((dot) => (
              <span
                key={dot}
                className={[
                  'h-2 rounded-full transition-all',
                  dot === 1 ? 'w-8 bg-cyan-300' : 'w-2 bg-white/20',
                ].join(' ')}
              />
            ))}
          </div>

          <div className="space-y-3 text-center">
            <p className="text-xs font-bold uppercase tracking-[0.26em] text-white/55">
              Every painter fights something.
            </p>

            <h2 className="text-4xl font-black leading-[1.05] text-white drop-shadow-[0_3px_14px_rgba(0,0,0,0.85)]">
              Let’s start with
              <br />
              the challenges.
            </h2>

            <p className="mx-auto max-w-xs text-base leading-7 text-white/70">
              What parts of miniature painting frustrate you the most?
            </p>
          </div>

          <div className="space-y-5 pt-3">
            {painPoints.map((point) => {
              const isSelected = selectedPains.includes(point.id)

              return (
                <button
                  key={point.id}
                  type="button"
                  onClick={() => togglePain(point.id)}
                  className={[
                    'group relative flex min-h-[104px] w-full items-stretch gap-0 overflow-hidden rounded-2xl border text-left transition duration-200',
                    'hover:scale-[1.01] active:scale-[0.99]',
                    'backdrop-blur-[2px]',
                    isSelected
                      ? 'border-cyan-300/70 bg-black/[0.28] shadow-[0_0_24px_rgba(34,211,238,0.24)]'
                      : 'border-white/18 bg-black/[0.24] shadow-[0_12px_28px_rgba(0,0,0,0.20)]',
                  ].join(' ')}
                >
                  <div
                    className={[
                      'pointer-events-none absolute inset-0 bg-gradient-to-r opacity-45',
                      point.glow,
                      'via-black/10 to-black/30',
                    ].join(' ')}
                  />

                  <div className="pointer-events-none absolute inset-0 bg-black/[0.16]" />

                  <div className="relative h-auto w-[112px] shrink-0 overflow-hidden">
                    <Image
                      src={point.image}
                      alt={point.title}
                      fill
                      className="object-cover opacity-95 transition duration-300 group-hover:scale-105"
                      sizes="112px"
                    />

                    <div className="absolute inset-0 bg-gradient-to-r from-black/5 via-transparent to-black/35" />
                  </div>

                  <div className="relative flex min-w-0 flex-1 items-center px-4 py-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-3">
                        <span className="text-lg font-black text-cyan-300">
                          {point.number}
                        </span>

                        <h3 className="truncate text-lg font-black text-white">
                          {point.title}
                        </h3>
                      </div>

                      <p className="mt-1 text-sm leading-5 text-white/72">
                        {point.text}
                      </p>
                    </div>

                    <div
                      className={[
                        'ml-3 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border transition',
                        isSelected
                          ? 'border-cyan-100 bg-cyan-300 text-slate-950 shadow-[0_0_18px_rgba(34,211,238,0.65)]'
                          : 'border-white/35 bg-black/20 text-transparent',
                      ].join(' ')}
                    >
                      ✓
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
        </div>

        <div className="mt-auto space-y-4 pt-8">
          <div className="text-center">
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-white/45">
              Select one or more
            </p>

            <p
              className={[
                'mt-1 text-base font-black transition',
                hasSelection ? 'text-cyan-300' : 'text-white/35',
              ].join(' ')}
            >
              {hasSelection
                ? 'Good. We can help with that.'
                : 'Be brutally honest — it’s your worktable.'}
            </p>
          </div>

          <button
            type="button"
            onClick={onContinue}
            disabled={!hasSelection}
            className={[
              'w-full rounded-2xl border px-5 py-5 text-center text-lg font-black uppercase tracking-[0.16em] transition',
              hasSelection
                ? 'border-cyan-300/80 bg-cyan-400/15 text-cyan-100 shadow-[0_0_30px_rgba(34,211,238,0.35)]'
                : 'cursor-not-allowed border-white/10 bg-white/[0.04] text-white/30',
            ].join(' ')}
          >
            See How We Solve This
          </button>

          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={onBack}
              className="h-12 rounded-2xl border border-white/15 bg-black/25 text-sm font-black text-white/70 backdrop-blur-xl transition hover:bg-black/35 hover:text-white"
            >
              Back
            </button>

            <button
              type="button"
              onClick={onSkip}
              className="h-12 rounded-2xl border border-cyan-300/35 bg-black/25 text-sm font-black uppercase tracking-[0.18em] text-cyan-200 backdrop-blur-xl shadow-[0_0_18px_rgba(34,211,238,0.18)] transition hover:bg-cyan-400/15"
            >
              Skip
            </button>
          </div>
        </div>
      </div>
    </section>
  )
}