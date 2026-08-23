'use client'

import Image from 'next/image'
import { FormEvent, useMemo, useState } from 'react'
import FeatureGuideTour from '../components/feature-guide-tour'
import type { FeatureGuideEntry } from '../components/feature-guide-types'
import V3PerfIndicator from '../components/v3-perf-indicator'

type PreviewTheme = {
  id: string
  name: string
  subtitle: string
  status: string
  image: string
  saved: boolean
  projects: string
  paints: string
  guides: string
  palette: string[]
}

const initialThemes: PreviewTheme[] = [
  {
    id: 'verdigris-relics',
    name: 'Verdigris Relics',
    subtitle: 'Ancient bronze, turquoise corrosion, and warm bone accents.',
    status: 'Active',
    image: '/onboarding/pains/paint-management.jpeg',
    saved: true,
    projects: '2 projects',
    paints: '8 paints',
    guides: '1 guide',
    palette: ['#14201d', '#16b8bc', '#6f5c37', '#d8bd83'],
  },
  {
    id: 'desert-sun',
    name: 'Desert Sun',
    subtitle: 'Dry ochres, cracked earth, and high-contrast teal shadows.',
    status: 'Saved',
    image: '/onboarding/pains/pile-of-shame.jpeg',
    saved: true,
    projects: '1 project',
    paints: '6 paints',
    guides: '2 guides',
    palette: ['#d29631', '#7a5d37', '#efe3c5', '#1e4f92'],
  },
  {
    id: 'cold-shadow',
    name: 'Cold Shadow Armor',
    subtitle: 'Blue-black armor with violet shade and bright edge hits.',
    status: 'Library',
    image: '/onboarding/pains/scheme-loss.jpeg',
    saved: false,
    projects: 'Community',
    paints: '7 paints',
    guides: '3 guides',
    palette: ['#111417', '#1e4f92', '#5943a7', '#9aafbd'],
  },
  {
    id: 'blood-and-ivory',
    name: 'Blood and Ivory',
    subtitle: 'Gloss reds, parchment highlights, and neutral black grounding.',
    status: 'Library',
    image: '/onboarding/pains/tough-choices.jpeg',
    saved: false,
    projects: 'Community',
    paints: '5 paints',
    guides: '1 guide',
    palette: ['#b51d20', '#efe3c5', '#171815', '#9b4b2f'],
  },
]

export default function ThemesV3Preview({
  featureGuides = [],
}: {
  featureGuides?: FeatureGuideEntry[]
}) {
  const [themes, setThemes] = useState(initialThemes)
  const [activeTab, setActiveTab] = useState<'mine' | 'library'>('mine')
  const [activeGuideIndex, setActiveGuideIndex] = useState<number | null>(null)
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [themeName, setThemeName] = useState('')
  const [themeMood, setThemeMood] = useState('Cinematic contrast')
  const [themeVisibility, setThemeVisibility] = useState('Private theme')

  const previewName = useMemo(
    () => themeName.trim() || 'New Visual Theme',
    [themeName]
  )

  const visibleThemes = themes.filter((theme) =>
    activeTab === 'mine' ? theme.saved : true
  )
  const activeGuide =
    activeGuideIndex === null ? null : featureGuides[activeGuideIndex] ?? null

  function startFeatureTour() {
    if (!featureGuides.length) return
    setIsCreateOpen(false)
    setActiveGuideIndex(0)
  }

  function createPreviewTheme(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const nextTheme: PreviewTheme = {
      id: `preview-${Date.now()}`,
      name: previewName,
      subtitle: `${themeMood} palette ready for references, paints, and guides.`,
      status: themeVisibility,
      image: '/onboarding/first-project-bg.jpeg',
      saved: true,
      projects: '0 projects',
      paints: '0 paints',
      guides: '0 guides',
      palette: ['#22d3ee', '#1e4f92', '#5943a7', '#efe3c5'],
    }

    setThemes((currentThemes) => [nextTheme, ...currentThemes])
    setThemeName('')
    setThemeMood('Cinematic contrast')
    setThemeVisibility('Private theme')
    setActiveTab('mine')
    setIsCreateOpen(false)
  }

  return (
    <main
      className="min-h-screen bg-[#05090b] text-white"
      data-feature-guide-target="themes.page"
    >
      <V3PerfIndicator surface="themes" detail={activeTab} />
      <div className="mx-auto flex w-full max-w-md flex-col gap-4 px-3 pb-28 pt-8">
        <TopNav />

        <header className="relative">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <h1 className="text-[30px] font-black leading-none tracking-normal">
                Themes
              </h1>
              <p className="mt-1 text-sm font-semibold text-white/44">
                Solve the hardest part: choosing the colors
              </p>
            </div>

            <div className="flex shrink-0 gap-2">
              <button
                type="button"
                aria-expanded={activeGuide !== null}
                aria-label="Show themes explanation"
                data-feature-guide-target="themes.help"
                onClick={startFeatureTour}
                className="grid h-10 w-10 place-items-center rounded-full bg-[#11171d] text-sm font-black text-white/58 transition hover:bg-white/12 hover:text-cyan-300"
              >
                ?
              </button>
              <button
                type="button"
                aria-label="Create theme"
                data-feature-guide-target="themes.create_button"
                onClick={() => {
                  setActiveGuideIndex(null)
                  setIsCreateOpen(true)
                }}
                className="grid h-10 w-10 place-items-center rounded-full bg-cyan-300 text-2xl font-black leading-none text-black shadow-[0_0_24px_rgba(34,211,238,0.22)] transition hover:bg-cyan-200"
              >
                +
              </button>
            </div>
          </div>
        </header>

        <div
          className="grid grid-cols-2 rounded-[8px] border border-white/[0.04] bg-white/[0.055] p-1"
          role="tablist"
          aria-label="Theme views"
        >
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'mine'}
            onClick={() => setActiveTab('mine')}
            data-feature-guide-target="themes.tabs.mine"
            className={[
              'h-10 rounded-[6px] text-xs font-black transition',
              activeTab === 'mine'
                ? 'bg-[#101822] text-cyan-300 shadow-[inset_0_0_24px_rgba(34,211,238,0.06)]'
                : 'text-white/38 hover:text-white/70',
            ].join(' ')}
          >
            My Themes
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'library'}
            onClick={() => setActiveTab('library')}
            data-feature-guide-target="themes.tabs.library"
            className={[
              'h-10 rounded-[6px] text-xs font-black transition',
              activeTab === 'library'
                ? 'bg-[#101822] text-cyan-300 shadow-[inset_0_0_24px_rgba(34,211,238,0.06)]'
                : 'text-white/38 hover:text-white/70',
            ].join(' ')}
          >
            Theme Library
          </button>
        </div>

        <section className="grid gap-3" aria-label="Themes">
          {visibleThemes.map((theme) => (
            <ThemeCard key={theme.id} theme={theme} />
          ))}
        </section>
      </div>

      {isCreateOpen ? (
        <div className="fixed inset-0 z-[60] grid place-items-end bg-black/65 px-3 py-4 backdrop-blur-sm">
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="new-theme-title"
            data-feature-guide-target="themes.form"
            className="w-full max-w-md rounded-[8px] border border-white/10 bg-[#10161d] p-4 shadow-2xl shadow-black/50"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.22em] text-cyan-300">
                  New Theme
                </p>
                <h2
                  id="new-theme-title"
                  className="mt-1 text-2xl font-black leading-tight"
                >
                  Create theme
                </h2>
              </div>
              <button
                type="button"
                aria-label="Close create theme"
                onClick={() => setIsCreateOpen(false)}
                className="grid h-10 w-10 place-items-center rounded-full bg-white/[0.06] text-lg font-black text-white/48 transition hover:text-white"
              >
                x
              </button>
            </div>

            <form onSubmit={createPreviewTheme} className="mt-5 grid gap-4">
              <label className="grid gap-2">
                <span className="text-xs font-black uppercase tracking-[0.18em] text-white/42">
                  Theme name
                </span>
                <input
                  value={themeName}
                  onChange={(event) => setThemeName(event.target.value)}
                  placeholder="e.g. Moonlit Copper"
                  className="h-12 rounded-[8px] border border-white/10 bg-black/24 px-4 text-sm font-semibold text-white outline-none transition placeholder:text-white/25 focus:border-cyan-300/70"
                />
              </label>

              <label className="grid gap-2">
                <span className="text-xs font-black uppercase tracking-[0.18em] text-white/42">
                  Direction
                </span>
                <select
                  value={themeMood}
                  onChange={(event) => setThemeMood(event.target.value)}
                  className="h-12 rounded-[8px] border border-white/10 bg-black/24 px-4 text-sm font-semibold text-white outline-none transition focus:border-cyan-300/70"
                >
                  <option>Cinematic contrast</option>
                  <option>Warm desert palette</option>
                  <option>Cold shadow armor</option>
                  <option>Bright display scheme</option>
                </select>
              </label>

              <label className="grid gap-2">
                <span className="text-xs font-black uppercase tracking-[0.18em] text-white/42">
                  Visibility
                </span>
                <select
                  value={themeVisibility}
                  onChange={(event) => setThemeVisibility(event.target.value)}
                  className="h-12 rounded-[8px] border border-white/10 bg-black/24 px-4 text-sm font-semibold text-white outline-none transition focus:border-cyan-300/70"
                >
                  <option>Private theme</option>
                  <option>Shared link</option>
                  <option>Public theme</option>
                </select>
              </label>

              <div className="overflow-hidden rounded-[8px] border border-cyan-300/20 bg-black/24">
                <div className="relative h-28">
                  <Image
                    src="/onboarding/first-project-bg.jpeg"
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
                    <div className="mt-2 flex gap-1.5">
                      {['#22d3ee', '#1e4f92', '#5943a7', '#efe3c5'].map(
                        (color) => (
                          <span
                            key={color}
                            className="h-4 flex-1 rounded-full"
                            style={{ backgroundColor: color }}
                          />
                        )
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <button
                type="submit"
                className="h-12 rounded-[8px] bg-cyan-300 text-sm font-black text-black transition hover:bg-cyan-200"
              >
                Create preview theme
              </button>
            </form>
          </section>
        </div>
      ) : null}

      {activeGuide ? (
        <FeatureGuideTour
          activeIndex={activeGuideIndex ?? 0}
          guide={activeGuide}
          onClose={() => setActiveGuideIndex(null)}
          onNext={() =>
            setActiveGuideIndex((current) =>
              current === null
                ? 0
                : Math.min(featureGuides.length - 1, current + 1)
            )
          }
          onPrevious={() =>
            setActiveGuideIndex((current) =>
              current === null ? 0 : Math.max(0, current - 1)
            )
          }
          totalGuides={featureGuides.length}
        />
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

function ThemeCard({ theme }: { theme: PreviewTheme }) {
  return (
    <article className="overflow-hidden rounded-[8px] border border-white/[0.055] bg-[#111821] shadow-[0_14px_40px_rgba(0,0,0,0.22)]">
      <div className="relative h-[132px] overflow-hidden">
        <Image
          src={theme.image}
          alt=""
          fill
          sizes="(max-width: 640px) 100vw, 448px"
          className="object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-black/22 to-black/84" />
        <span className="absolute left-4 top-4 rounded-[6px] bg-cyan-300 px-3 py-1.5 text-[9px] font-black uppercase tracking-[0.16em] text-black">
          {theme.status}
        </span>
        <div className="absolute inset-x-0 bottom-0 p-4">
          <h2 className="truncate text-lg font-black leading-tight text-white">
            {theme.name}
          </h2>
          <p className="mt-1 line-clamp-2 text-xs font-semibold leading-4 text-white/58">
            {theme.subtitle}
          </p>
        </div>
      </div>

      <div className="px-4 py-3">
        <div className="grid grid-cols-4 gap-1.5">
          {theme.palette.map((color, index) => (
            <span
              key={`${theme.id}-${color}-${index}`}
              className="h-5 rounded-full border border-white/10"
              style={{ backgroundColor: color }}
            />
          ))}
        </div>

        <div className="mt-3 flex items-center justify-between gap-3">
          <div className="min-w-0 truncate text-[10px] font-black uppercase tracking-[0.14em] text-white/32">
            {theme.projects}
          </div>
          <div className="flex shrink-0 gap-2">
            <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[10px] font-black text-white/42">
              {theme.paints}
            </span>
            <span className="rounded-full border border-cyan-300/30 bg-cyan-300/10 px-3 py-1 text-[10px] font-black text-cyan-300">
              {theme.guides}
            </span>
          </div>
        </div>
      </div>
    </article>
  )
}
