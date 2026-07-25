import Image from 'next/image'
import Link from 'next/link'

const nextActions = [
  {
    title: 'Add or photograph a miniature',
    path: 'Unit Detail > Details > Gallery',
    href: '/projects?preview=1',
  },
  {
    title: 'Choose a beginner guide',
    path: 'Guides > My Guides',
    href: '/guides?preview=1',
  },
  {
    title: 'Complete the first painting step',
    path: 'Home > Featured Unit',
    href: '/dashboard?preview=1',
  },
]

const activeUnits = [
  {
    title: 'Storm Chapel',
    meta: 'Prime and basecoat',
    progress: '15%',
    image: '/onboarding/pains/tough-choices.jpeg',
  },
  {
    title: 'Ashen Patrol',
    meta: 'Guide selected',
    progress: '28%',
    image: '/onboarding/pains/paint-management.jpeg',
  },
  {
    title: 'Copper Warden',
    meta: 'Paints gathered',
    progress: '52%',
    image: '/onboarding/pains/scheme-loss.jpeg',
  },
  {
    title: 'Night Market',
    meta: 'Details next',
    progress: '63%',
    image: '/onboarding/pains/pile-of-shame.jpeg',
  },
]

export default function DashboardV3Preview() {
  return (
    <main className="min-h-screen bg-[#05090b] text-white">
      <div className="mx-auto flex w-full max-w-md flex-col gap-5 px-4 pb-28 pt-8">
        <TopNav />

        <section className="space-y-5">
          <h1 className="text-[34px] font-black leading-none tracking-normal">
            Dashboard
          </h1>
          <div
            className="grid grid-cols-2 rounded-[8px] border border-white/[0.04] bg-white/[0.055] p-1"
            role="tablist"
            aria-label="Dashboard sections"
          >
            <button
              type="button"
              role="tab"
              aria-selected="true"
              className="h-11 rounded-[6px] bg-[#101822] text-sm font-black text-cyan-300 shadow-[inset_0_0_24px_rgba(34,211,238,0.06)]"
            >
              Active Units
            </button>
            <button
              type="button"
              role="tab"
              aria-selected="false"
              className="h-11 rounded-[6px] text-sm font-bold text-white/38"
            >
              My Progress
            </button>
          </div>
        </section>

        <NextActionCard />
        <FeaturedUnitCard />
        <ActiveUnits />
      </div>
    </main>
  )
}

function TopNav() {
  return (
    <header className="flex items-center justify-between gap-4">
      <div className="flex min-w-0 items-center gap-3">
        <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-full border border-white/10 bg-white/10">
          <Image
            src="/curator/the-curator.png"
            alt=""
            fill
            sizes="48px"
            className="object-cover"
            priority
          />
        </div>
        <div className="min-w-0">
          <p className="text-[11px] font-black uppercase tracking-[0.28em] text-white/28">
            Obsidian Gallery
          </p>
          <div className="mt-2 flex items-center gap-2">
            <span className="shrink-0 text-sm font-black text-cyan-300">
              Lv.4
            </span>
            <div
              className="flex gap-1"
              aria-label="Level progress 4 out of 300"
            >
              {Array.from({ length: 10 }).map((_, index) => (
                <span
                  key={index}
                  className={[
                    'h-1.5 w-3 rounded-full',
                    index === 0 ? 'bg-cyan-300/85' : 'bg-white/10',
                  ].join(' ')}
                />
              ))}
            </div>
            <span className="shrink-0 text-xs font-black text-white/30">
              4/300
            </span>
          </div>
        </div>
      </div>

      <Link
        href="/settings?preview=1"
        aria-label="Settings"
        className="grid h-12 w-12 shrink-0 place-items-center rounded-full border border-white/[0.04] bg-white/[0.055] text-white/42 transition hover:text-cyan-300"
      >
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          className="h-5 w-5"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z" />
          <path d="M19.4 15a1.8 1.8 0 0 0 .36 1.98l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06A1.8 1.8 0 0 0 15 19.45a1.8 1.8 0 0 0-1 .55 1.8 1.8 0 0 0-.5 1.3V21a2 2 0 0 1-4 0v-.09a1.8 1.8 0 0 0-.5-1.3 1.8 1.8 0 0 0-1-.55 1.8 1.8 0 0 0-1.98.36l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.8 1.8 0 0 0 3.55 15a1.8 1.8 0 0 0-.55-1 1.8 1.8 0 0 0-1.3-.5H1.5a2 2 0 0 1 0-4h.2A1.8 1.8 0 0 0 3 9a1.8 1.8 0 0 0 .55-1 1.8 1.8 0 0 0-.36-1.98l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.8 1.8 0 0 0 8 3.55a1.8 1.8 0 0 0 1-.55 1.8 1.8 0 0 0 .5-1.3V1.5a2 2 0 0 1 4 0v.2A1.8 1.8 0 0 0 14 3a1.8 1.8 0 0 0 1 .55 1.8 1.8 0 0 0 1.98-.36l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.8 1.8 0 0 0 19.45 8a1.8 1.8 0 0 0 .55 1 1.8 1.8 0 0 0 1.3.5h.2a2 2 0 0 1 0 4h-.2a1.8 1.8 0 0 0-1.3.5 1.8 1.8 0 0 0-.6 1Z" />
        </svg>
      </Link>
    </header>
  )
}

function NextActionCard() {
  return (
    <section className="overflow-hidden rounded-[8px] border border-white/[0.06] bg-[#121720] shadow-[0_18px_50px_rgba(0,0,0,0.28)]">
      <div className="flex items-center gap-4 p-5">
        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-cyan-300/12 text-cyan-300">
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            className="h-5 w-5"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="m13 2-8 12h7l-1 8 8-12h-7l1-8Z" />
          </svg>
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-black leading-tight">
            Your first miniature
          </h2>
          <p className="mt-2 text-xs font-black text-white/35">0/3 complete</p>
        </div>
        <span className="text-xl font-black tracking-[0.16em] text-white/16">
          ...
        </span>
        <button
          type="button"
          className="text-lg font-bold text-white/24"
          aria-label="Dismiss next actions"
        >
          x
        </button>
      </div>

      <div className="divide-y divide-white/[0.055]">
        {nextActions.map((action) => (
          <div key={action.title} className="flex items-center gap-4 px-5 py-4">
            <span className="h-8 w-8 shrink-0 rounded-[8px] border border-white/15 bg-black/10" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium leading-tight text-white/72">
                {action.title}
              </p>
              <p className="mt-1 truncate text-[11px] font-black tracking-[0.08em] text-white/22">
                {action.path}
              </p>
            </div>
            <Link
              href={action.href}
              className="shrink-0 rounded-[8px] bg-cyan-300/12 px-4 py-3 text-sm font-black text-cyan-300 transition hover:bg-cyan-300 hover:text-black"
            >
              Go -&gt;
            </Link>
          </div>
        ))}
      </div>
    </section>
  )
}

function FeaturedUnitCard() {
  return (
    <section className="overflow-hidden rounded-[8px] border border-white/[0.06] bg-[#121720] shadow-[0_18px_50px_rgba(0,0,0,0.3)]">
      <div className="relative min-h-[278px] overflow-hidden">
        <Image
          src="/onboarding/first-project-bg.jpeg"
          alt=""
          fill
          sizes="(max-width: 640px) 100vw, 448px"
          className="object-cover"
          priority
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/0 via-black/10 to-black/82" />
        <div className="absolute left-5 top-5 rounded-[6px] bg-cyan-300 px-3 py-2 text-[10px] font-black uppercase tracking-[0.14em] text-black">
          Featured Unit
        </div>
        <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-4 p-5">
          <div className="min-w-0">
            <h2 className="truncate text-3xl font-black leading-none">
              Guido
            </h2>
            <p className="mt-3 truncate text-sm font-black text-white/34">
              <span className="text-cyan-300">Samurai Pizza Cats</span>
              <span className="mx-2 text-white/20">Due May 25, 2026</span>
            </p>
          </div>
          <div className="grid h-[70px] w-[70px] shrink-0 place-items-center rounded-full bg-black/45">
            <div
              className="grid h-[58px] w-[58px] place-items-center rounded-full text-xs font-black text-white"
              style={{
                background:
                  'conic-gradient(#22d3ee 0 40%, rgba(255,255,255,0.12) 40% 100%)',
              }}
              aria-label="Featured unit progress 40 percent"
            >
              <span className="grid h-[46px] w-[46px] place-items-center rounded-full bg-[#080b0f]">
                40%
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-[1fr_auto] items-center gap-4 px-5 py-4">
        <div className="min-w-0">
          <div className="flex items-center justify-between gap-4 text-xs font-black text-white/30">
            <span>2h 58m logged</span>
            <span>Stage 2/6</span>
          </div>
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10">
            <div className="h-full w-[40%] rounded-full bg-cyan-300" />
          </div>
        </div>
        <Link
          href="/projects?preview=1"
          className="rounded-[8px] bg-cyan-300 px-5 py-3 text-sm font-black text-black transition hover:bg-cyan-200"
        >
          Resume -&gt;
        </Link>
      </div>
    </section>
  )
}

function ActiveUnits() {
  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-[11px] font-black uppercase tracking-[0.24em] text-white/26">
          Up Next - 6 Units
        </h2>
        <Link
          href="/projects?preview=1"
          className="rounded-[8px] bg-cyan-300/12 px-4 py-2 text-sm font-black text-cyan-300 transition hover:bg-cyan-300 hover:text-black"
        >
          + Add Unit
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {activeUnits.map((unit) => (
          <Link
            key={unit.title}
            href="/projects?preview=1"
            className="group overflow-hidden rounded-[8px] border border-white/[0.06] bg-white/[0.045] transition hover:border-cyan-300/35"
          >
            <div className="relative h-28">
              <Image
                src={unit.image}
                alt=""
                fill
                sizes="(max-width: 640px) 50vw, 216px"
                className="object-cover transition duration-500 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-b from-black/0 to-black/70" />
              <span className="absolute right-3 top-3 rounded-full bg-black/55 px-2 py-1 text-[10px] font-black text-white">
                {unit.progress}
              </span>
            </div>
            <div className="p-3">
              <p className="truncate text-sm font-black text-white">
                {unit.title}
              </p>
              <p className="mt-1 truncate text-[11px] font-bold text-white/34">
                {unit.meta}
              </p>
            </div>
          </Link>
        ))}
      </div>
    </section>
  )
}
