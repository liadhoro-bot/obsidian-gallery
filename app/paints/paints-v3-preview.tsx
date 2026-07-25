'use client'

import { FormEvent, useMemo, useState } from 'react'
import Image from 'next/image'

type PaintRecord = {
  id: string
  name: string
  brand: string
  line: string
  finish: string
  size: string
  color: string
  owned: boolean
  wish: boolean
  notes: string
}

const paints: PaintRecord[] = [
  {
    id: 'abaddon-black',
    name: 'Abaddon Black',
    brand: 'WHC',
    line: 'Base',
    finish: 'Matte',
    size: '18ml',
    color: '#111417',
    owned: true,
    wish: false,
    notes: 'Reliable deep black for lining, armor joints, and final cleanup.',
  },
  {
    id: 'aethermatic-blue',
    name: 'Aethermatic Blue',
    brand: 'WHC',
    line: 'Technical',
    finish: 'Satin',
    size: '18ml',
    color: '#5aa7c9',
    owned: true,
    wish: false,
    notes: 'Useful transparent blue for glow effects and cold shadows.',
  },
  {
    id: 'agrellan-earth',
    name: 'Agrellan Earth',
    brand: 'WHC',
    line: 'Technical',
    finish: 'Crackle',
    size: '24ml',
    color: '#7a5d37',
    owned: true,
    wish: false,
    notes: 'Cracked earth texture for desert bases and weathered terrain.',
  },
  {
    id: 'angel-green',
    name: 'Angel Green',
    brand: 'VAL',
    line: 'Game Color',
    finish: 'Matte',
    size: '17ml',
    color: '#4eb282',
    owned: true,
    wish: false,
    notes: 'Clean green midtone for cloth, heraldry, and creature skin.',
  },
  {
    id: 'aztec-gold',
    name: 'Aztec Gold',
    brand: 'TAP',
    line: 'Warpaints',
    finish: 'Metallic',
    size: '18ml',
    color: '#d29631',
    owned: true,
    wish: false,
    notes: 'Warm metallic gold for trim, jewelry, and aged ornament.',
  },
  {
    id: 'bag-of-bones',
    name: 'Bag of Bones',
    brand: 'VAL',
    line: 'Game Color',
    finish: 'Matte',
    size: '17ml',
    color: '#d8bd83',
    owned: true,
    wish: false,
    notes: 'Bone highlight for skulls, parchment, cloth, and warm ivory.',
  },
  {
    id: 'black',
    name: 'Black',
    brand: 'VAL',
    line: 'Model Color',
    finish: 'Matte',
    size: '17ml',
    color: '#171815',
    owned: true,
    wish: false,
    notes: 'Neutral black with a soft finish for brush and airbrush work.',
  },
  {
    id: 'blood-for-the-blood-god',
    name: 'Blood for the Blood God',
    brand: 'WHC',
    line: 'Technical',
    finish: 'Gloss',
    size: '18ml',
    color: '#b51d20',
    owned: true,
    wish: false,
    notes: 'Gloss blood effect for wounds, blades, bases, and horror details.',
  },
  {
    id: 'caribbean-turquoise',
    name: 'Caribbean Turquoise',
    brand: 'VAL',
    line: 'Game Color',
    finish: 'Matte',
    size: '17ml',
    color: '#17b9c2',
    owned: true,
    wish: false,
    notes: 'High-saturation turquoise for cloth, gems, and bright accents.',
  },
  {
    id: 'cavalry-brown',
    name: 'Cavalry Brown',
    brand: 'VAL',
    line: 'Model Color',
    finish: 'Matte',
    size: '17ml',
    color: '#9b4b2f',
    owned: false,
    wish: true,
    notes: 'Earthy red-brown for leather, rust, and muted red shadows.',
  },
  {
    id: 'deep-blue',
    name: 'Deep Blue',
    brand: 'AK',
    line: '3rd Gen',
    finish: 'Matte',
    size: '17ml',
    color: '#1e4f92',
    owned: true,
    wish: false,
    notes: 'Strong navy blue for armor panels and cool shadow mixes.',
  },
  {
    id: 'druchii-violet',
    name: 'Druchii Violet',
    brand: 'WHC',
    line: 'Shade',
    finish: 'Satin',
    size: '18ml',
    color: '#4d315f',
    owned: false,
    wish: true,
    notes: 'Purple shade for shadows over skin, gold, red, and bone.',
  },
  {
    id: 'ivory',
    name: 'Ivory',
    brand: 'VAL',
    line: 'Model Color',
    finish: 'Matte',
    size: '17ml',
    color: '#efe3c5',
    owned: true,
    wish: false,
    notes: 'Soft off-white for highlights without a chalky pure white jump.',
  },
  {
    id: 'jungle-green',
    name: 'Jungle Green',
    brand: 'TAP',
    line: 'Warpaints',
    finish: 'Matte',
    size: '18ml',
    color: '#1f8f63',
    owned: true,
    wish: false,
    notes: 'Saturated green for foliage, scales, and lively midtones.',
  },
  {
    id: 'moon-dust',
    name: 'Moon Dust',
    brand: 'AK',
    line: '3rd Gen',
    finish: 'Matte',
    size: '17ml',
    color: '#b7b3a0',
    owned: true,
    wish: false,
    notes: 'Grey-beige neutral for stone, weathering, and desaturated cloth.',
  },
  {
    id: 'orange-fire',
    name: 'Orange Fire',
    brand: 'VAL',
    line: 'Game Color',
    finish: 'Matte',
    size: '17ml',
    color: '#f47622',
    owned: true,
    wish: false,
    notes: 'Bright orange for flame, hazard markings, and hot highlights.',
  },
  {
    id: 'royal-purple',
    name: 'Royal Purple',
    brand: 'TAP',
    line: 'Warpaints',
    finish: 'Matte',
    size: '18ml',
    color: '#5943a7',
    owned: true,
    wish: false,
    notes: 'Clean purple for cloaks, banners, and rich accent colors.',
  },
  {
    id: 'wolf-grey',
    name: 'Wolf Grey',
    brand: 'VAL',
    line: 'Game Color',
    finish: 'Matte',
    size: '17ml',
    color: '#9aafbd',
    owned: true,
    wish: false,
    notes: 'Cool grey-blue for space armor, winter cloth, and edge highlights.',
  },
]

const pageSize = 9

export default function PaintsV3Preview() {
  const [activeTab, setActiveTab] = useState<'owned' | 'library'>('owned')
  const [query, setQuery] = useState('')
  const [isHelpOpen, setIsHelpOpen] = useState(false)
  const [isFilterOpen, setIsFilterOpen] = useState(false)
  const [isMixOpen, setIsMixOpen] = useState(false)
  const [brandFilter, setBrandFilter] = useState('all')
  const [finishFilter, setFinishFilter] = useState('all')
  const [pageIndex, setPageIndex] = useState(0)
  const [selectedPaintId, setSelectedPaintId] = useState(paints[7].id)
  const [mixName, setMixName] = useState('')
  const [mixBase, setMixBase] = useState('Abaddon Black')

  const filteredPaints = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()

    return paints.filter((paint) => {
      const matchesTab = activeTab === 'library' || paint.owned || paint.wish
      const matchesQuery =
        !normalizedQuery ||
        paint.name.toLowerCase().includes(normalizedQuery) ||
        paint.brand.toLowerCase().includes(normalizedQuery) ||
        paint.line.toLowerCase().includes(normalizedQuery)
      const matchesBrand = brandFilter === 'all' || paint.brand === brandFilter
      const matchesFinish =
        finishFilter === 'all' || paint.finish === finishFilter

      return matchesTab && matchesQuery && matchesBrand && matchesFinish
    })
  }, [activeTab, brandFilter, finishFilter, query])

  const pageCount = Math.max(1, Math.ceil(filteredPaints.length / pageSize))
  const normalizedPageIndex = Math.min(pageIndex, pageCount - 1)
  const visiblePaints = filteredPaints.slice(
    normalizedPageIndex * pageSize,
    normalizedPageIndex * pageSize + pageSize
  )
  const selectedPaint =
    paints.find((paint) => paint.id === selectedPaintId) ??
    filteredPaints[0] ??
    paints[0]

  function showPreviousPage() {
    setPageIndex((current) => (current === 0 ? pageCount - 1 : current - 1))
  }

  function showNextPage() {
    setPageIndex((current) => (current + 1 >= pageCount ? 0 : current + 1))
  }

  function handleTabChange(nextTab: 'owned' | 'library') {
    setActiveTab(nextTab)
    setPageIndex(0)
  }

  function handleMixSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setMixName('')
    setMixBase('Abaddon Black')
    setIsMixOpen(false)
  }

  return (
    <main className="min-h-screen bg-[#05090b] text-white">
      <div className="mx-auto flex w-full max-w-md flex-col gap-4 px-3 pb-48 pt-8">
        <TopNav />

        <header className="relative">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <h1 className="text-[28px] font-black leading-none tracking-normal">
                Paint Vault
              </h1>
              <p className="mt-2 text-[11px] font-black text-white/34">
                22 owned <span className="mx-1 text-white/18">-</span> 2 on wishlist
              </p>
            </div>

            <div className="flex shrink-0 gap-2">
              <button
                type="button"
                aria-expanded={isHelpOpen}
                aria-controls="paints-help"
                aria-label="About paint vault"
                onClick={() => {
                  setIsFilterOpen(false)
                  setIsHelpOpen((open) => !open)
                }}
                className="grid h-10 w-10 place-items-center rounded-full bg-[#11171d] text-sm font-black text-white/58 transition hover:bg-white/12 hover:text-cyan-300"
              >
                ?
              </button>
              <button
                type="button"
                aria-label="Create custom mix"
                onClick={() => {
                  setIsHelpOpen(false)
                  setIsFilterOpen(false)
                  setIsMixOpen(true)
                }}
                className="grid h-10 w-10 place-items-center rounded-full bg-cyan-300 text-2xl font-black leading-none text-black shadow-[0_0_24px_rgba(34,211,238,0.26)] transition hover:bg-cyan-200"
              >
                +
              </button>
            </div>
          </div>

          {isHelpOpen ? (
            <aside
              id="paints-help"
              className="absolute right-12 top-12 z-20 w-[min(300px,calc(100vw-40px))] rounded-[8px] border border-cyan-300/20 bg-[#11171d] p-4 shadow-2xl shadow-black/45"
            >
              <p className="text-[10px] font-black uppercase tracking-[0.22em] text-cyan-300">
                Paint Vault
              </p>
              <p className="mt-2 text-sm font-semibold leading-6 text-white/70">
                Keep track of every paint you own or want, and the custom mixes
                you&apos;ve created. Manage your collection, avoid buying
                duplicates, export with ease, and seamlessly connect to your
                guides and themes.
              </p>
            </aside>
          ) : null}
        </header>

        <div
          className="grid grid-cols-2 rounded-[8px] border border-white/[0.04] bg-white/[0.055] p-1"
          role="tablist"
          aria-label="Paint views"
        >
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'owned'}
            onClick={() => handleTabChange('owned')}
            className={[
              'h-10 rounded-[6px] text-xs font-black transition',
              activeTab === 'owned'
                ? 'bg-[#101822] text-cyan-300 shadow-[inset_0_0_24px_rgba(34,211,238,0.06)]'
                : 'text-white/38 hover:text-white/70',
            ].join(' ')}
          >
            My Paints
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'library'}
            onClick={() => handleTabChange('library')}
            className={[
              'h-10 rounded-[6px] text-xs font-black transition',
              activeTab === 'library'
                ? 'bg-[#101822] text-cyan-300 shadow-[inset_0_0_24px_rgba(34,211,238,0.06)]'
                : 'text-white/38 hover:text-white/70',
            ].join(' ')}
          >
            Paint Library
          </button>
        </div>

        <section className="relative">
          <div className="grid grid-cols-[1fr_auto] gap-2">
            <label className="relative block">
              <span className="sr-only">Search paints</span>
              <svg
                aria-hidden="true"
                viewBox="0 0 24 24"
                className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/28"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.3-4.3" />
              </svg>
              <input
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value)
                  setPageIndex(0)
                }}
                placeholder="Search by name or brand..."
                className="h-12 w-full rounded-[8px] border border-white/10 bg-[#111821] pl-10 pr-3 text-sm font-semibold text-white outline-none transition placeholder:text-white/28 focus:border-cyan-300/70"
              />
            </label>

            <button
              type="button"
              aria-expanded={isFilterOpen}
              aria-controls="paint-filters"
              onClick={() => {
                setIsHelpOpen(false)
                setIsFilterOpen((open) => !open)
              }}
              className="flex h-12 items-center gap-2 rounded-[8px] border border-white/10 bg-[#111821] px-4 text-xs font-black text-white/48 transition hover:text-cyan-300"
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
                <path d="M3 5h18" />
                <path d="M6 12h12" />
                <path d="M10 19h4" />
              </svg>
              Filter
            </button>
          </div>

          {isFilterOpen ? (
            <div
              id="paint-filters"
              className="absolute inset-x-0 top-14 z-20 grid gap-3 rounded-[8px] border border-white/10 bg-[#111821] p-4 shadow-2xl shadow-black/45"
            >
              <div className="grid grid-cols-2 gap-3">
                <label className="grid gap-2">
                  <span className="text-[10px] font-black uppercase tracking-[0.18em] text-white/36">
                    Brand
                  </span>
                  <select
                    value={brandFilter}
                    onChange={(event) => {
                      setBrandFilter(event.target.value)
                      setPageIndex(0)
                    }}
                    className="h-10 rounded-[8px] border border-white/10 bg-black/24 px-3 text-xs font-bold text-white outline-none"
                  >
                    <option value="all">All</option>
                    <option value="WHC">WHC</option>
                    <option value="VAL">VAL</option>
                    <option value="TAP">TAP</option>
                    <option value="AK">AK</option>
                  </select>
                </label>

                <label className="grid gap-2">
                  <span className="text-[10px] font-black uppercase tracking-[0.18em] text-white/36">
                    Finish
                  </span>
                  <select
                    value={finishFilter}
                    onChange={(event) => {
                      setFinishFilter(event.target.value)
                      setPageIndex(0)
                    }}
                    className="h-10 rounded-[8px] border border-white/10 bg-black/24 px-3 text-xs font-bold text-white outline-none"
                  >
                    <option value="all">All</option>
                    <option value="Matte">Matte</option>
                    <option value="Satin">Satin</option>
                    <option value="Gloss">Gloss</option>
                    <option value="Metallic">Metallic</option>
                  </select>
                </label>
              </div>

              <div className="flex items-center justify-between gap-3">
                <span className="text-xs font-bold text-white/42">
                  {filteredPaints.length} paints shown
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setBrandFilter('all')
                    setFinishFilter('all')
                    setIsFilterOpen(false)
                    setPageIndex(0)
                  }}
                  className="rounded-[8px] bg-white/[0.07] px-3 py-2 text-xs font-black text-white/58 transition hover:text-white"
                >
                  Reset
                </button>
              </div>
            </div>
          ) : null}
        </section>

        <section className="grid grid-cols-[1fr_auto] gap-2">
          <button className="flex h-9 items-center justify-between rounded-[8px] border border-white/10 bg-[#111821] px-3 text-[11px] font-black text-white/45">
            Name A-Z
            <span className="text-white/28">v</span>
          </button>
          <div className="flex h-9 rounded-[8px] border border-white/10 bg-[#111821] p-1">
            <span className="grid w-8 place-items-center rounded-[6px] bg-cyan-300/10 text-cyan-300">
              <svg
                aria-hidden="true"
                viewBox="0 0 24 24"
                className="h-4 w-4"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z" />
              </svg>
            </span>
            <span className="grid w-8 place-items-center text-white/28">
              <svg
                aria-hidden="true"
                viewBox="0 0 24 24"
                className="h-4 w-4"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />
              </svg>
            </span>
          </div>
        </section>

        <section className="relative pr-8">
          <div className="grid grid-cols-3 gap-2" aria-label="Paint swatches">
            {visiblePaints.map((paint) => (
              <PaintSwatch
                key={paint.id}
                paint={paint}
                isSelected={paint.id === selectedPaint.id}
                onSelect={() => setSelectedPaintId(paint.id)}
              />
            ))}
          </div>

          <div className="absolute bottom-0 right-0 top-0 flex w-6 flex-col items-center justify-between rounded-full border border-white/10 bg-[#111821]/92 py-2">
            <button
              type="button"
              aria-label="Previous paints"
              onClick={showPreviousPage}
              className="grid h-8 w-5 place-items-center text-white/42 transition hover:text-cyan-300"
            >
              ^
            </button>
            <span className="text-[10px] font-black text-white/30">
              {normalizedPageIndex + 1}/{pageCount}
            </span>
            <button
              type="button"
              aria-label="Next paints"
              onClick={showNextPage}
              className="grid h-8 w-5 place-items-center text-white/42 transition hover:text-cyan-300"
            >
              v
            </button>
          </div>
        </section>
      </div>

      <PaintInfoPanel paint={selectedPaint} />

      {isMixOpen ? (
        <div className="fixed inset-0 z-[60] grid place-items-end bg-black/65 px-3 py-4 backdrop-blur-sm">
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="custom-mix-title"
            className="w-full max-w-md rounded-[8px] border border-white/10 bg-[#10161d] p-4 shadow-2xl shadow-black/50"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.22em] text-cyan-300">
                  Custom Mix
                </p>
                <h2
                  id="custom-mix-title"
                  className="mt-1 text-2xl font-black leading-tight"
                >
                  Create mix
                </h2>
              </div>
              <button
                type="button"
                aria-label="Close custom mix"
                onClick={() => setIsMixOpen(false)}
                className="grid h-10 w-10 place-items-center rounded-full bg-white/[0.06] text-lg font-black text-white/48 transition hover:text-white"
              >
                x
              </button>
            </div>

            <form onSubmit={handleMixSubmit} className="mt-5 grid gap-4">
              <label className="grid gap-2">
                <span className="text-xs font-black uppercase tracking-[0.18em] text-white/42">
                  Mix name
                </span>
                <input
                  value={mixName}
                  onChange={(event) => setMixName(event.target.value)}
                  placeholder="e.g. Dried Blood Shadow"
                  className="h-12 rounded-[8px] border border-white/10 bg-black/24 px-4 text-sm font-semibold text-white outline-none transition placeholder:text-white/25 focus:border-cyan-300/70"
                />
              </label>

              <label className="grid gap-2">
                <span className="text-xs font-black uppercase tracking-[0.18em] text-white/42">
                  Base paint
                </span>
                <select
                  value={mixBase}
                  onChange={(event) => setMixBase(event.target.value)}
                  className="h-12 rounded-[8px] border border-white/10 bg-black/24 px-4 text-sm font-semibold text-white outline-none transition focus:border-cyan-300/70"
                >
                  {paints.slice(0, 9).map((paint) => (
                    <option key={paint.id}>{paint.name}</option>
                  ))}
                </select>
              </label>

              <label className="grid gap-2">
                <span className="text-xs font-black uppercase tracking-[0.18em] text-white/42">
                  Formula
                </span>
                <textarea
                  rows={3}
                  placeholder="2 drops base, 1 drop black, glaze medium"
                  className="resize-none rounded-[8px] border border-white/10 bg-black/24 px-4 py-3 text-sm font-semibold text-white outline-none transition placeholder:text-white/25 focus:border-cyan-300/70"
                />
              </label>

              <button
                type="submit"
                className="h-12 rounded-[8px] bg-cyan-300 text-sm font-black text-black transition hover:bg-cyan-200"
              >
                Save preview mix
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

function PaintSwatch({
  isSelected,
  onSelect,
  paint,
}: {
  isSelected: boolean
  onSelect: () => void
  paint: PaintRecord
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={isSelected}
      className={[
        'relative h-[86px] overflow-hidden rounded-[8px] border bg-[#111821] text-left transition',
        isSelected
          ? 'border-cyan-300/75 shadow-[0_0_0_1px_rgba(34,211,238,0.35)]'
          : 'border-white/[0.055] hover:border-cyan-300/45',
      ].join(' ')}
    >
      <span
        className="absolute inset-x-0 top-0 h-[39%]"
        style={{ backgroundColor: paint.color }}
      />
      {(paint.owned || paint.wish) && (
        <span className="absolute right-2 top-2 grid h-4 w-4 place-items-center rounded-full bg-cyan-300 text-[10px] font-black text-black">
          {paint.owned ? (
            <svg
              aria-hidden="true"
              viewBox="0 0 12 12"
              className="h-2.5 w-2.5"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="m2.5 6 2 2 5-5" />
            </svg>
          ) : (
            '+'
          )}
        </span>
      )}
      <span className="absolute inset-x-0 bottom-0 p-2">
        <span className="line-clamp-2 text-[11px] font-black leading-tight text-white">
          {paint.name}
        </span>
        <span className="mt-2 block text-[8px] font-black uppercase tracking-[0.13em] text-white/36">
          {paint.brand}
        </span>
      </span>
    </button>
  )
}

function PaintInfoPanel({ paint }: { paint: PaintRecord }) {
  return (
    <aside className="fixed inset-x-2 bottom-16 z-40 mx-auto max-w-md overflow-hidden rounded-[8px] border border-cyan-300/18 bg-[#10161d]/96 shadow-2xl shadow-black/50 backdrop-blur">
      <div className="grid grid-cols-[64px_1fr]">
        <div style={{ backgroundColor: paint.color }} />
        <div className="min-w-0 p-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="truncate text-sm font-black uppercase text-white">
                {paint.name}
              </h2>
              <p className="mt-1 text-[10px] font-bold text-white/36">
                {paint.line}
              </p>
            </div>
            <div className="flex shrink-0 gap-2">
              <span className="rounded-full border border-cyan-300/45 bg-cyan-300/10 px-3 py-1 text-[10px] font-black text-cyan-300">
                {paint.owned ? 'Owned' : 'Not owned'}
              </span>
              <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[10px] font-black text-white/42">
                {paint.wish ? 'Wish' : 'Use'}
              </span>
            </div>
          </div>

          <div className="mt-3 grid grid-cols-4 gap-2 text-[9px] font-black text-white/34">
            <InfoPair label="Brand" value={paint.brand} />
            <InfoPair label="Line" value={paint.line} />
            <InfoPair label="Finish" value={paint.finish} />
            <InfoPair label="Size" value={paint.size} />
          </div>

          <p className="mt-2 line-clamp-2 text-[10px] font-semibold leading-4 text-white/46">
            {paint.notes}
          </p>

          <button className="mt-2 h-8 w-full rounded-[8px] border border-white/10 bg-black/20 text-[10px] font-black text-white/52 transition hover:border-cyan-300/45 hover:text-cyan-300">
            View Details -&gt;
          </button>
        </div>
      </div>
    </aside>
  )
}

function InfoPair({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="uppercase tracking-[0.12em]">{label}</p>
      <p className="mt-1 truncate text-white/62">{value}</p>
    </div>
  )
}
