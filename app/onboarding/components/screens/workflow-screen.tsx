'use client'

import Image from 'next/image'
import { useMemo, useState } from 'react'

type WorkflowScreenId =
  | 'themes'
  | 'recipes'
  | 'vault'
  | 'projects'
  | 'dashboard'

const workflowItems = [
  {
    id: 'themes',
    label: 'Themes',
    caption: 'Discover and build paint palettes and concepts, and assign them to armies and units.',
    icon: '/icons/nav/themes.svg',
    mockTitle: 'Themes',
    mockSubtitle: 'Manage palettes and paint themes',
    mockContent: 'themes',
  },
  {
    id: 'recipes',
    label: 'Guides',
    caption: 'Never lose a scheme again. Save mixes, techniques, and every step behind your best results.',
    icon: '/icons/nav/recipes.svg',
    mockTitle: 'Ice Blue Armor',
    mockSubtitle: 'Guide workflow',
    mockContent: 'recipes',
  },
  {
    id: 'vault',
    label: 'Vault',
    caption: 'Track your entire paint collection, wishlist missing colors, and finally organize paint chaos.',
    icon: '/icons/nav/vault.svg',
    mockTitle: 'Vault',
    mockSubtitle: 'Your paint collection',
    mockContent: 'vault',
  },
  {
    id: 'projects',
    label: 'Projects',
    caption: 'Manage armies, units, deadlines, and hobby progress so unfinished projects finally get completed.'
,
    icon: '/icons/nav/projects.svg',
    mockTitle: 'Projects',
    mockSubtitle: 'Organize armies and units',
    mockContent: 'projects',
  },
  {
    id: 'dashboard',
    label: 'Dashboard',
    caption: 'Monitor your painting workflow at a glance - active units, recent sessions, progress, and motivation.',
    icon: '/icons/nav/dashboard.svg',
    mockTitle: 'Dashboard',
    mockSubtitle: 'Track your progress',
    mockContent: 'dashboard',
  },
]

function PhoneMockup({
  item,
  active,
}: {
  item: (typeof workflowItems)[number]
  active: boolean
}) {
  return (
    <div
      className={[
        'h-[360px] w-[185px] rounded-[2rem] border border-white/15 bg-[#05070d] p-2 shadow-2xl transition-all duration-500',
        active
          ? 'opacity-100 shadow-[0_0_45px_rgba(34,211,238,0.24)]'
          : 'opacity-70',
      ].join(' ')}
    >
      <div className="h-full overflow-hidden rounded-[1.55rem] border border-white/10 bg-[#070b13]">
        <div className="flex items-center justify-between px-4 pt-3 text-[9px] font-bold text-white/80">
          <span>9:41</span>
          <span>● ● ●</span>
        </div>

        <div className="px-4 pt-5">
          <div className="mb-3 flex h-8 w-8 items-center justify-center rounded-xl bg-cyan-400/15 shadow-[0_0_22px_rgba(34,211,238,0.28)]">
            <Image
              src={item.icon}
              alt={item.label}
              width={22}
              height={22}
              className="transition-all duration-300"
              style={{
                filter: active
                  ? 'brightness(0) saturate(100%) invert(78%) sepia(30%) saturate(1034%) hue-rotate(148deg) brightness(101%) contrast(101%)'
                  : 'brightness(0) saturate(100%) invert(72%) opacity(0.9)',
              }}
            />
          </div>

          <h3 className="text-xl font-black text-white">{item.mockTitle}</h3>

          <p className="mt-1 text-xs leading-5 text-white/50">
            {item.mockSubtitle}
          </p>
        </div>

        <div className="mt-5 space-y-3 px-4">
          {item.mockContent === 'themes' && (
            <>
              {['Space Wolves', 'Fire & Ice', 'Necron Dynasties'].map((name) => (
                <div
                  key={name}
                  className="rounded-2xl border border-white/10 bg-white/[0.04] p-3"
                >
                  <p className="text-xs font-bold text-white">{name}</p>

                  <div className="mt-3 flex gap-1.5">
                    {['#295f8f', '#6ea8ca', '#d9dde2', '#535a62', '#1a2533'].map(
                      (c) => (
                        <span
                          key={c}
                          className="h-5 w-5 rounded-md"
                          style={{ backgroundColor: c }}
                        />
                      )
                    )}
                  </div>
                </div>
              ))}
            </>
          )}

          {item.mockContent === 'recipes' && (
            <>
              {['Prime', 'Basecoat', 'Layer', 'Shade', 'Highlight'].map(
                (step, i) => (
                  <div
                    key={step}
                    className="flex items-center gap-3 rounded-xl bg-white/[0.04] p-2"
                  >
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white/10 text-[10px] text-white/70">
                      {i + 1}
                    </span>

                    <div>
                      <p className="text-xs font-bold text-white">{step}</p>
                      <p className="text-[10px] text-white/40">
                        Saved technique
                      </p>
                    </div>
                  </div>
                )
              )}
            </>
          )}

          {item.mockContent === 'vault' && (
            <>
              <div className="rounded-2xl bg-white/[0.05] px-3 py-2 text-xs text-white/40">
                Search paints
              </div>

              {['Citadel Colour', 'Vallejo', 'AK Interactive', 'Pro Acryl'].map(
                (brand, i) => (
                  <div
                    key={brand}
                    className="flex items-center justify-between border-b border-white/5 py-2"
                  >
                    <span className="text-xs font-bold text-white/80">
                      {brand}
                    </span>
                    <span className="text-xs text-white/40">
                      {[317, 142, 48, 35][i]}
                    </span>
                  </div>
                )
              )}

              <div className="grid grid-cols-4 gap-2 pt-3">
                {['#7aa6c7', '#dde7ec', '#a23d42', '#1d2938'].map((c) => (
                  <span
                    key={c}
                    className="h-10 rounded-xl border border-white/10"
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </>
          )}

          {item.mockContent === 'projects' && (
            <>
              {[
                ['Space Wolves', 65],
                ['Blood Angels', 35],
                ['Necrons', 12],
              ].map(([name, progress]) => (
                <div
                  key={name}
                  className="rounded-2xl border border-white/10 bg-white/[0.04] p-3"
                >
                  <div className="flex justify-between">
                    <p className="text-xs font-bold text-white">{name}</p>
                    <p className="text-[10px] text-white/40">{progress}%</p>
                  </div>

                  <div className="mt-3 h-1.5 rounded-full bg-white/10">
                    <div
                      className="h-full rounded-full bg-cyan-300"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>
              ))}
            </>
          )}

          {item.mockContent === 'dashboard' && (
            <>
              <div className="mx-auto flex h-28 w-28 items-center justify-center rounded-full border-[10px] border-cyan-300/80 text-2xl font-black text-white">
                72%
              </div>

              {[
                ['35', 'Projects'],
                ['128', 'Models completed'],
                ['540', 'Hours logged'],
              ].map(([num, label]) => (
                <div
                  key={label}
                  className="flex justify-between rounded-xl bg-white/[0.04] p-3"
                >
                  <span className="text-lg font-black text-white">{num}</span>
                  <span className="text-xs text-white/40">{label}</span>
                </div>
              ))}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export default function WorkflowScreen({
  initialScreen = 'projects',
}: {
  initialScreen?: WorkflowScreenId
}) {
  const initialIndex = workflowItems.findIndex(
    (item) => item.id === initialScreen
  )

  const [activeIndex, setActiveIndex] = useState(
    initialIndex >= 0 ? initialIndex : 0
  )

  const [touchStartX, setTouchStartX] = useState<number | null>(null)

  const activeItem = workflowItems[activeIndex]

  function goPrev() {
    setActiveIndex((value) => Math.max(0, value - 1))
  }

  function goNext() {
    setActiveIndex((value) => Math.min(workflowItems.length - 1, value + 1))
  }

  const positionedItems = useMemo(() => {
    return workflowItems.map((item, index) => {
      const offset = index - activeIndex
      const distance = Math.abs(offset)

      return {
        item,
        index,
        active: index === activeIndex,
        style: {
          zIndex: 30 - distance,
          opacity: distance > 2 ? 0 : 1,
          transform: `
            translateX(calc(-50% + ${offset * 145}px))
            translateY(${distance * 28}px)
            rotate(${offset * 6}deg)
            scale(${index === activeIndex ? 1 : 0.78})
          `,
        },
      }
    })
  }, [activeIndex])

  return (
    <section className="relative flex min-h-[720px] flex-col overflow-hidden rounded-[2rem] border border-white/10 bg-[#04070d] px-5 pb-6 pt-6 shadow-[0_0_50px_rgba(34,211,238,0.1)]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(34,211,238,0.18),transparent_35%),radial-gradient(circle_at_bottom,rgba(14,165,233,0.12),transparent_35%)]" />

      <div className="relative z-10 flex justify-center gap-2">
        {[0, 1, 2, 3].map((dot) => (
          <span
            key={dot}
            className={[
              'h-2 rounded-full transition-all',
              dot === 2 ? 'w-7 bg-cyan-300' : 'w-2 bg-white/20',
            ].join(' ')}
          />
        ))}
      </div>

      <div className="relative z-10 mt-8 text-center">
        <p className="text-xs font-black uppercase tracking-[0.35em] text-cyan-300">
          Everything Connected
        </p>

        <h2 className="mt-4 text-4xl font-black leading-tight text-white">
          Your hobby.
          <br />
          All in one <span className="text-cyan-300">workflow.</span>
        </h2>

        <p className="mx-auto mt-4 max-w-xs text-base leading-7 text-white/55">
          From inspiration to finished armies, Obsidian Gallery keeps every step
          connected.
        </p>
      </div>

      <div
        className="relative z-10 mt-8 h-[430px] touch-pan-y overflow-visible"
        onTouchStart={(event) => {
          setTouchStartX(event.touches[0].clientX)
        }}
        onTouchEnd={(event) => {
          if (touchStartX === null) return

          const touchEndX = event.changedTouches[0].clientX
          const distance = touchStartX - touchEndX

          if (distance > 40) goNext()
          if (distance < -40) goPrev()

          setTouchStartX(null)
        }}
      >
        <div className="absolute inset-x-0 bottom-0 mx-auto h-16 w-56 rounded-full bg-cyan-400/15 blur-2xl" />

        <button
          type="button"
          onClick={goPrev}
          aria-label="Previous workflow item"
          className="absolute left-0 top-0 z-40 h-full w-1/3"
        />

        <button
          type="button"
          onClick={goNext}
          aria-label="Next workflow item"
          className="absolute right-0 top-0 z-40 h-full w-1/3"
        />

        {positionedItems.map(({ item, index, style, active }) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setActiveIndex(index)}
            className="absolute left-1/2 top-0 cursor-pointer transition-all duration-500"
            style={style}
            aria-label={`Show ${item.label}`}
          >
            <PhoneMockup item={item} active={active} />
          </button>
        ))}
      </div>

      <div className="relative z-10 mt-3 rounded-[2rem] border border-cyan-300/25 bg-cyan-400/[0.08] p-5 text-center shadow-[0_0_26px_rgba(34,211,238,0.16)]">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-cyan-300/50 bg-cyan-400/10 shadow-[0_0_22px_rgba(34,211,238,0.28)]">
          <Image
            src={activeItem.icon}
            alt={activeItem.label}
            width={30}
            height={30}
            style={{
              filter:
                'brightness(0) saturate(100%) invert(78%) sepia(30%) saturate(1034%) hue-rotate(148deg) brightness(101%) contrast(101%)',
            }}
          />
        </div>

        <p className="mt-4 text-sm font-black uppercase tracking-[0.24em] text-cyan-300">
          {activeItem.label}
        </p>

        <p className="mx-auto mt-3 max-w-xs text-base font-semibold leading-7 text-white/75">
          {activeItem.caption}
        </p>

        <div className="mt-5 flex justify-center gap-2">
          {workflowItems.map((item, index) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setActiveIndex(index)}
              aria-label={`Go to ${item.label}`}
              className={[
                'h-2 rounded-full transition-all',
                index === activeIndex
                  ? 'w-8 bg-cyan-300'
                  : 'w-2 bg-white/25 hover:bg-white/45',
              ].join(' ')}
            />
          ))}
        </div>
      </div>
    </section>
  )
}
