'use client'

import Image from 'next/image'
import { FormEvent, useMemo, useState } from 'react'

type PreviewGuide = {
  id: string
  title: string
  subtitle: string
  steps: string
  status: string
  image: string
  accent: string
  saved: boolean
}

const initialGuides: PreviewGuide[] = [
  {
    id: 'samurai-teal-armor',
    title: 'Samurai Teal Armor',
    subtitle: 'Fast layered armor with crisp turquoise edges.',
    steps: '6 steps',
    status: 'Draft',
    image: '/onboarding/first-project-bg.jpeg',
    accent: '#17b9c2',
    saved: true,
  },
  {
    id: 'desert-basing',
    title: 'Desert Basing',
    subtitle: 'Cracked earth, drybrush passes, and sun-bleached stone.',
    steps: '5 steps',
    status: 'Saved',
    image: '/onboarding/pains/pile-of-shame.jpeg',
    accent: '#d29631',
    saved: true,
  },
  {
    id: 'blood-effects',
    title: 'Gloss Blood Effects',
    subtitle: 'Controlled technical paint for wounds, blades, and bases.',
    steps: '4 steps',
    status: 'Library',
    image: '/onboarding/pains/tough-choices.jpeg',
    accent: '#b51d20',
    saved: false,
  },
  {
    id: 'cold-shadow-skin',
    title: 'Cold Shadow Skin',
    subtitle: 'Purple and blue glazes for dramatic face shadows.',
    steps: '7 steps',
    status: 'Library',
    image: '/onboarding/pains/scheme-loss.jpeg',
    accent: '#5943a7',
    saved: false,
  },
]

export default function GuidesV3Preview() {
  const [guides, setGuides] = useState(initialGuides)
  const [activeTab, setActiveTab] = useState<'mine' | 'library'>('mine')
  const [isHelpOpen, setIsHelpOpen] = useState(false)
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [guideName, setGuideName] = useState('')
  const [guideFocus, setGuideFocus] = useState('Miniature painting')
  const [guideVisibility, setGuideVisibility] = useState('Private draft')

  const previewName = useMemo(
    () => guideName.trim() || 'New Painting Guide',
    [guideName]
  )

  const visibleGuides = guides.filter((guide) =>
    activeTab === 'mine' ? guide.saved : true
  )

  function createPreviewGuide(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const nextGuide: PreviewGuide = {
      id: `preview-${Date.now()}`,
      title: previewName,
      subtitle: `${guideFocus} process ready for step-by-step notes.`,
      steps: '0 steps',
      status: guideVisibility,
      image: '/onboarding/pains/paint-management.jpeg',
      accent: '#22d3ee',
      saved: true,
    }

    setGuides((currentGuides) => [nextGuide, ...currentGuides])
    setGuideName('')
    setGuideFocus('Miniature painting')
    setGuideVisibility('Private draft')
    setActiveTab('mine')
    setIsCreateOpen(false)
  }

  return (
    <main className="min-h-screen bg-[#05090b] text-white">
      <div className="mx-auto flex w-full max-w-md flex-col gap-4 px-3 pb-28 pt-8">
        <TopNav />

        <header className="relative">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <h1 className="text-[30px] font-black leading-none tracking-normal">
                Guides
              </h1>
              <p className="mt-1 text-sm font-semibold text-white/44">
                Record, share, and discover painting guides.
              </p>
            </div>

            <div className="flex shrink-0 gap-2">
              <button
                type="button"
                aria-expanded={isHelpOpen}
                aria-controls="guides-help"
                aria-label="About guides"
                onClick={() => setIsHelpOpen((open) => !open)}
                className="grid h-10 w-10 place-items-center rounded-full bg-[#11171d] text-sm font-black text-white/58 transition hover:bg-white/12 hover:text-cyan-300"
              >
                ?
              </button>
              <button
                type="button"
                aria-label="Create guide"
                onClick={() => {
                  setIsHelpOpen(false)
                  setIsCreateOpen(true)
                }}
                className="grid h-10 w-10 place-items-center rounded-full bg-cyan-300 text-2xl font-black leading-none text-black shadow-[0_0_24px_rgba(34,211,238,0.22)] transition hover:bg-cyan-200"
              >
                +
              </button>
            </div>
          </div>

          {isHelpOpen ? (
            <aside
              id="guides-help"
              className="absolute right-12 top-12 z-20 w-[min(300px,calc(100vw-40px))] rounded-[8px] border border-cyan-300/20 bg-[#11171d] p-4 shadow-2xl shadow-black/45"
            >
              <p className="text-[10px] font-black uppercase tracking-[0.22em] text-cyan-300">
                Guides
              </p>
              <p className="mt-2 text-sm font-semibold leading-6 text-white/70">
                Browse community guides for inspiration, or turn your
                techniques into step-by-step guides with paint combinations and
                progress photos. Learn from the community, preserve your
                knowledge, and make it easy to recreate successful paint schemes
                across projects.
              </p>
            </aside>
          ) : null}
        </header>

        <div
          className="grid grid-cols-2 rounded-[8px] border border-white/[0.04] bg-white/[0.055] p-1"
          role="tablist"
          aria-label="Guide views"
        >
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'mine'}
            onClick={() => setActiveTab('mine')}
            className={[
              'h-10 rounded-[6px] text-xs font-black transition',
              activeTab === 'mine'
                ? 'bg-[#101822] text-cyan-300 shadow-[inset_0_0_24px_rgba(34,211,238,0.06)]'
                : 'text-white/38 hover:text-white/70',
            ].join(' ')}
          >
            My Guides
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'library'}
            onClick={() => setActiveTab('library')}
            className={[
              'h-10 rounded-[6px] text-xs font-black transition',
              activeTab === 'library'
                ? 'bg-[#101822] text-cyan-300 shadow-[inset_0_0_24px_rgba(34,211,238,0.06)]'
                : 'text-white/38 hover:text-white/70',
            ].join(' ')}
          >
            Guide Library
          </button>
        </div>

        <section className="grid gap-3" aria-label="Guides">
          {visibleGuides.map((guide) => (
            <GuideCard key={guide.id} guide={guide} />
          ))}
        </section>
      </div>

      {isCreateOpen ? (
        <div className="fixed inset-0 z-[60] grid place-items-end bg-black/65 px-3 py-4 backdrop-blur-sm">
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="new-guide-title"
            className="w-full max-w-md rounded-[8px] border border-white/10 bg-[#10161d] p-4 shadow-2xl shadow-black/50"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.22em] text-cyan-300">
                  New Guide
                </p>
                <h2
                  id="new-guide-title"
                  className="mt-1 text-2xl font-black leading-tight"
                >
                  Create guide
                </h2>
              </div>
              <button
                type="button"
                aria-label="Close create guide"
                onClick={() => setIsCreateOpen(false)}
                className="grid h-10 w-10 place-items-center rounded-full bg-white/[0.06] text-lg font-black text-white/48 transition hover:text-white"
              >
                x
              </button>
            </div>

            <form onSubmit={createPreviewGuide} className="mt-5 grid gap-4">
              <label className="grid gap-2">
                <span className="text-xs font-black uppercase tracking-[0.18em] text-white/42">
                  Guide name
                </span>
                <input
                  value={guideName}
                  onChange={(event) => setGuideName(event.target.value)}
                  placeholder="e.g. Shadow Knight Armor"
                  className="h-12 rounded-[8px] border border-white/10 bg-black/24 px-4 text-sm font-semibold text-white outline-none transition placeholder:text-white/25 focus:border-cyan-300/70"
                />
              </label>

              <label className="grid gap-2">
                <span className="text-xs font-black uppercase tracking-[0.18em] text-white/42">
                  Focus
                </span>
                <select
                  value={guideFocus}
                  onChange={(event) => setGuideFocus(event.target.value)}
                  className="h-12 rounded-[8px] border border-white/10 bg-black/24 px-4 text-sm font-semibold text-white outline-none transition focus:border-cyan-300/70"
                >
                  <option>Miniature painting</option>
                  <option>Armor recipe</option>
                  <option>Skin and faces</option>
                  <option>Basing and terrain</option>
                </select>
              </label>

              <label className="grid gap-2">
                <span className="text-xs font-black uppercase tracking-[0.18em] text-white/42">
                  Visibility
                </span>
                <select
                  value={guideVisibility}
                  onChange={(event) => setGuideVisibility(event.target.value)}
                  className="h-12 rounded-[8px] border border-white/10 bg-black/24 px-4 text-sm font-semibold text-white outline-none transition focus:border-cyan-300/70"
                >
                  <option>Private draft</option>
                  <option>Shared link</option>
                  <option>Public guide</option>
                </select>
              </label>

              <div className="overflow-hidden rounded-[8px] border border-cyan-300/20 bg-black/24">
                <div className="relative h-28">
                  <Image
                    src="/onboarding/pains/paint-management.jpeg"
                    alt=""
                    fill
                    sizes="(max-width: 640px) 100vw, 448px"
                    className="object-cover opacity-55"
                  />
                  <div className="absolute inset-0 bg-gradient-to-r from-black/82 to-black/18" />
                  <div className="absolute inset-x-0 bottom-0 p-4">
                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-cyan-300">
                      Preview
                    </p>
                    <p className="mt-1 truncate text-xl font-black">
                      {previewName}
                    </p>
                    <p className="mt-1 text-xs font-bold text-white/44">
                      {guideFocus}
                    </p>
                  </div>
                </div>
              </div>

              <button
                type="submit"
                className="h-12 rounded-[8px] bg-cyan-300 text-sm font-black text-black transition hover:bg-cyan-200"
              >
                Create preview guide
              </button>
            </form>
          </section>
        </div>
      ) : null}
    </main>
  )
}

function TopNav() {
  return (
    <header className="flex items-center justify-between gap-4">
      <div className="flex min-w-0 items-center gap-3">
        <div className="relative h-9 w-9 shrink-0 overflow-hidden rounded-full border border-white/10 bg-white/10">
          <Image
            src="/curator/the-curator.png"
            alt=""
            fill
            sizes="36px"
            className="object-cover"
            priority
          />
        </div>
        <div className="min-w-0">
          <p className="text-[8px] font-black uppercase tracking-[0.28em] text-white/28">
            Obsidian Gallery
          </p>
          <div className="mt-2 flex items-center gap-2">
            <span className="shrink-0 text-xs font-black text-cyan-300">
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
            <span className="shrink-0 text-[10px] font-black text-white/30">
              4/300
            </span>
          </div>
        </div>
      </div>

      <a
        href="/settings?preview=1"
        aria-label="Settings"
        className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-white/[0.04] bg-white/[0.055] text-white/42 transition hover:text-cyan-300"
      >
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          className="h-4 w-4"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z" />
          <path d="M19.4 15a1.8 1.8 0 0 0 .36 1.98l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06A1.8 1.8 0 0 0 15 19.45a1.8 1.8 0 0 0-1 .55 1.8 1.8 0 0 0-.5 1.3V21a2 2 0 0 1-4 0v-.09a1.8 1.8 0 0 0-.5-1.3 1.8 1.8 0 0 0-1-.55 1.8 1.8 0 0 0-1.98.36l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.8 1.8 0 0 0 3.55 15a1.8 1.8 0 0 0-.55-1 1.8 1.8 0 0 0-1.3-.5H1.5a2 2 0 0 1 0-4h.2A1.8 1.8 0 0 0 3 9a1.8 1.8 0 0 0 .55-1 1.8 1.8 0 0 0-.36-1.98l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.8 1.8 0 0 0 8 3.55a1.8 1.8 0 0 0 1-.55 1.8 1.8 0 0 0 .5-1.3V1.5a2 2 0 0 1 4 0v.2A1.8 1.8 0 0 0 14 3a1.8 1.8 0 0 0 1 .55 1.8 1.8 0 0 0 1.98-.36l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.8 1.8 0 0 0 19.45 8a1.8 1.8 0 0 0 .55 1 1.8 1.8 0 0 0 1.3.5h.2a2 2 0 0 1 0 4h-.2a1.8 1.8 0 0 0-1.3.5 1.8 1.8 0 0 0-.6 1Z" />
        </svg>
      </a>
    </header>
  )
}

function GuideCard({ guide }: { guide: PreviewGuide }) {
  return (
    <article className="overflow-hidden rounded-[8px] border border-white/[0.055] bg-[#111821] shadow-[0_14px_40px_rgba(0,0,0,0.22)]">
      <div className="relative h-[132px] overflow-hidden">
        <Image
          src={guide.image}
          alt=""
          fill
          sizes="(max-width: 640px) 100vw, 448px"
          className="object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-black/22 to-black/82" />
        <span
          className="absolute left-4 top-4 rounded-[6px] px-3 py-1.5 text-[9px] font-black uppercase tracking-[0.16em] text-black"
          style={{ backgroundColor: guide.accent }}
        >
          {guide.status}
        </span>
        <div className="absolute inset-x-0 bottom-0 p-4">
          <h2 className="truncate text-lg font-black leading-tight text-white">
            {guide.title}
          </h2>
          <p className="mt-1 line-clamp-2 text-xs font-semibold leading-4 text-white/58">
            {guide.subtitle}
          </p>
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 px-4 py-3">
        <span className="text-[11px] font-black uppercase tracking-[0.16em] text-white/32">
          {guide.steps}
        </span>
        <div className="flex gap-2">
          <span className="rounded-full border border-white/10 bg-white/[0.045] px-3 py-1 text-[10px] font-black text-white/42">
            Paints
          </span>
          <span className="rounded-full border border-cyan-300/30 bg-cyan-300/10 px-3 py-1 text-[10px] font-black text-cyan-300">
            Open
          </span>
        </div>
      </div>
    </article>
  )
}
