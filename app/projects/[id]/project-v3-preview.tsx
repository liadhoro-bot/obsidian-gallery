'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useMemo, useState } from 'react'
import V3PerfIndicator from '../../components/v3-perf-indicator'

type ProjectV3PreviewProps = {
  id: string
}

type ProjectTab = 'details' | 'units' | 'add'
type UnitView = 'list' | 'grid'

type PreviewProject = {
  id: string
  name: string
  image: string
  type: string
  progress: number
  deadline?: string
  description: string
  palette: string[]
  units: PreviewUnit[]
}

type PreviewUnit = {
  id: string
  name: string
  image: string
  progress: number
  status: string
}

const projects: PreviewProject[] = [
  {
    id: 'gloomhaven',
    name: 'Gloomhaven 2nd ed.',
    image: '/onboarding/pains/fragmentation.jpeg',
    type: 'Campaign box',
    progress: 8,
    description:
      'A compact campaign project for heroes, monsters, and table-ready encounters.',
    palette: ['#173235', '#264a56', '#d7c399', '#a92322', '#72c888'],
    units: [
      {
        id: 'mindthief',
        name: 'Mindthief',
        image: '/onboarding/pains/scheme-loss.jpeg',
        progress: 12,
        status: 'Basecoat',
      },
      {
        id: 'tinkerer',
        name: 'Tinkerer',
        image: '/onboarding/pains/paint-management.jpeg',
        progress: 8,
        status: 'Planning',
      },
      {
        id: 'cragheart',
        name: 'Cragheart',
        image: '/onboarding/pains/tough-choices.jpeg',
        progress: 18,
        status: 'Prime',
      },
      {
        id: 'spellweaver',
        name: 'Spellweaver',
        image: '/onboarding/pains/pile-of-shame.jpeg',
        progress: 5,
        status: 'Queued',
      },
    ],
  },
  {
    id: 'desert-table',
    name: 'Desert Table',
    image: '/onboarding/pains/pile-of-shame.jpeg',
    type: 'Terrain table',
    progress: 6,
    description:
      'Rock, sand, drybrush passes, and fast scenic pieces for a warm table setup.',
    palette: ['#7a5d37', '#d29631', '#efe3c5', '#4eb282'],
    units: [
      {
        id: 'ashen-patrol',
        name: 'Ashen Patrol',
        image: '/onboarding/pains/paint-management.jpeg',
        progress: 28,
        status: 'Guide selected',
      },
    ],
  },
  {
    id: 'samurai-pizza-cats',
    name: 'Samurai Pizza Cats',
    image: '/onboarding/first-project-bg.jpeg',
    type: 'Display force',
    progress: 40,
    deadline: 'May 23, 2026',
    description:
      'A bright character project anchored by clean armor, graphic markings, and playful bases.',
    palette: ['#8f9fd9', '#17b9c2', '#111417', '#d8bd83', '#b51d20'],
    units: [
      {
        id: 'guido',
        name: 'Guido',
        image: '/onboarding/first-project-bg.jpeg',
        progress: 40,
        status: 'Stage 2/6',
      },
      {
        id: 'night-market',
        name: 'Night Market',
        image: '/onboarding/pains/pile-of-shame.jpeg',
        progress: 63,
        status: 'Details next',
      },
    ],
  },
  {
    id: 'golden-automaton',
    name: 'Golden Automaton',
    image: '/onboarding/pains/tough-choices.jpeg',
    type: 'Warband',
    progress: 27,
    description:
      'Metallic trim, teal patina, and high-contrast shadows for a small elite force.',
    palette: ['#d29631', '#7a5d37', '#111417', '#17b9c2'],
    units: [
      {
        id: 'copper-warden',
        name: 'Copper Warden',
        image: '/onboarding/pains/scheme-loss.jpeg',
        progress: 52,
        status: 'Paints gathered',
      },
      {
        id: 'storm-chapel',
        name: 'Storm Chapel',
        image: '/onboarding/pains/tough-choices.jpeg',
        progress: 15,
        status: 'Prime and basecoat',
      },
    ],
  },
]

export default function ProjectV3Preview({ id }: ProjectV3PreviewProps) {
  const [activeTab, setActiveTab] = useState<ProjectTab>('units')
  const [unitView, setUnitView] = useState<UnitView>('grid')
  const project = useMemo(
    () => projects.find((previewProject) => previewProject.id === id) ?? projects[0],
    [id]
  )

  function goBack() {
    if (window.history.length > 1) {
      window.history.back()
      return
    }

    window.location.assign('/projects?preview=1')
  }

  return (
    <main className="min-h-screen bg-[#061119] text-white">
      <V3PerfIndicator surface="project-detail" detail={activeTab} />
      <div className="mx-auto flex w-full max-w-md flex-col gap-5 px-3 pb-28 pt-5">
        <TopNav />

        <section className="relative overflow-hidden rounded-[22px] border border-white/10 bg-[#111821]">
          <div className="relative h-[254px]">
            <Image
              src={project.image}
              alt=""
              fill
              sizes="(max-width: 640px) 100vw, 448px"
              className="object-cover"
              priority
            />
            <div className="absolute inset-0 bg-gradient-to-b from-black/12 via-black/28 to-black/84" />

            <div className="absolute inset-x-0 top-0 flex items-center justify-between p-4">
              <button
                type="button"
                onClick={goBack}
                className="rounded-full bg-black/50 px-4 py-3 text-sm font-black text-white backdrop-blur-md transition hover:bg-white/12"
              >
                back
              </button>
              <button
                type="button"
                className="rounded-full bg-black/50 px-4 py-3 text-sm font-black text-white backdrop-blur-md transition hover:bg-white/12"
              >
                Edit
              </button>
            </div>

            <div className="absolute inset-x-0 bottom-0 p-4">
              <p className="text-[10px] font-black uppercase tracking-[0.38em] text-cyan-300">
                Project Detail
              </p>
              <h1 className="mt-3 text-[33px] font-black leading-none tracking-normal">
                {project.name}
              </h1>
            </div>
          </div>
        </section>

        <div
          className="grid grid-cols-3 rounded-[14px] border border-white/[0.07] bg-[#05081d] p-1"
          role="tablist"
          aria-label="Project sections"
        >
          {[
            { id: 'details' as const, label: 'Project Details' },
            { id: 'units' as const, label: 'Units' },
            { id: 'add' as const, label: 'Add Unit' },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={activeTab === tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={[
                'h-11 rounded-[12px] text-xs font-black transition',
                activeTab === tab.id
                  ? 'border border-cyan-300/70 bg-cyan-300/12 text-cyan-300'
                  : 'text-white/45 hover:text-white/75',
              ].join(' ')}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === 'details' ? <DetailsPanel project={project} /> : null}
        {activeTab === 'units' ? (
          <UnitsPanel
            project={project}
            unitView={unitView}
            onUnitViewChange={setUnitView}
          />
        ) : null}
        {activeTab === 'add' ? <AddUnitPanel projectName={project.name} /> : null}
      </div>
    </main>
  )
}

function TopNav() {
  return (
    <header className="flex items-center justify-between gap-4">
      <div className="flex min-w-0 items-center gap-3">
        <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-full border border-cyan-300/20 bg-white/10">
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
          <p className="text-sm font-medium uppercase leading-tight tracking-[0.24em] text-white/70">
            Obsidian
            <br />
            Gallery
          </p>
          <p className="mt-1 text-sm font-black text-white">
            Lv. 4 Painter
          </p>
        </div>
      </div>

      <button
        type="button"
        className="flex h-11 items-center gap-2 rounded-full border border-cyan-300/50 bg-cyan-300/8 px-5 text-sm font-black text-white shadow-[0_0_24px_rgba(34,211,238,0.12)] transition hover:bg-cyan-300/14"
      >
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          className="h-4 w-4 text-red-400"
          fill="currentColor"
        >
          <path d="M12 21s-7-4.4-9.4-8.1C.5 9.6 2.4 5 6.2 5c2 0 3.4 1.1 4.1 2.2C11 6.1 12.4 5 14.4 5c3.8 0 5.7 4.6 3.6 7.9C15.6 16.6 12 21 12 21Z" />
        </svg>
        Support
      </button>
    </header>
  )
}

function DetailsPanel({ project }: { project: PreviewProject }) {
  return (
    <section className="rounded-[14px] border border-white/[0.07] bg-[#111821] p-5">
      <p className="text-[10px] font-black uppercase tracking-[0.28em] text-cyan-300">
        Overview
      </p>
      <h2 className="mt-3 text-2xl font-black">{project.type}</h2>
      <p className="mt-3 text-sm font-semibold leading-6 text-white/55">
        {project.description}
      </p>
      <div className="mt-5 grid grid-cols-3 gap-3">
        <Metric label="Progress" value={`${project.progress}%`} />
        <Metric label="Units" value={String(project.units.length)} />
        <Metric label="Due" value={project.deadline ?? 'Open'} />
      </div>
      <div className="mt-5 flex gap-2">
        {project.palette.map((color) => (
          <span
            key={color}
            className="h-8 w-8 rounded-full border border-white/10"
            style={{ backgroundColor: color }}
          />
        ))}
      </div>
    </section>
  )
}

function UnitsPanel({
  onUnitViewChange,
  project,
  unitView,
}: {
  onUnitViewChange: (view: UnitView) => void
  project: PreviewProject
  unitView: UnitView
}) {
  return (
    <section className="rounded-[14px] border border-white/[0.07] bg-[#121212] p-5 shadow-[0_16px_44px_rgba(0,0,0,0.24)]">
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-2xl font-black">Project Units</h2>
        <div className="flex rounded-full bg-[#202733] p-1">
          <button
            type="button"
            aria-label="List view"
            onClick={() => onUnitViewChange('list')}
            className={[
              'grid h-8 w-8 place-items-center rounded-full text-white/45 transition',
              unitView === 'list' ? 'bg-[#0e1420] text-white' : '',
            ].join(' ')}
          >
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              className="h-5 w-5"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            >
              <path d="M8 6h12" />
              <path d="M8 12h12" />
              <path d="M8 18h12" />
              <path d="M4 6h.01" />
              <path d="M4 12h.01" />
              <path d="M4 18h.01" />
            </svg>
          </button>
          <button
            type="button"
            aria-label="Grid view"
            onClick={() => onUnitViewChange('grid')}
            className={[
              'grid h-8 w-8 place-items-center rounded-full text-white/45 transition',
              unitView === 'grid' ? 'bg-cyan-300/12 text-cyan-300' : '',
            ].join(' ')}
          >
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              className="h-5 w-5"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M4 4h7v7H4z" />
              <path d="M13 4h7v7h-7z" />
              <path d="M4 13h7v7H4z" />
              <path d="M13 13h7v7h-7z" />
            </svg>
          </button>
        </div>
      </div>

      <div
        className={[
          'mt-7 gap-3',
          unitView === 'grid' ? 'grid grid-cols-3' : 'grid',
        ].join(' ')}
      >
        {project.units.map((unit) => (
          <Link
            key={unit.id}
            href={`/units/${unit.id}?preview=1`}
            className={[
              'group overflow-hidden rounded-[12px] border border-white/10 bg-white/[0.035] transition hover:border-cyan-300/45',
              unitView === 'list' ? 'grid grid-cols-[84px_1fr] items-center' : '',
            ].join(' ')}
          >
            <div
              className={[
                'relative overflow-hidden',
                unitView === 'grid' ? 'h-[88px]' : 'h-[84px]',
              ].join(' ')}
            >
              <Image
                src={unit.image}
                alt=""
                fill
                sizes="(max-width: 640px) 33vw, 140px"
                className="object-cover transition duration-500 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-b from-black/0 to-black/56" />
            </div>
            <div className={unitView === 'grid' ? 'p-3' : 'min-w-0 p-4'}>
              <p className="truncate text-sm font-black text-white">
                {unit.name}
              </p>
              {unitView === 'list' ? (
                <p className="mt-1 text-[11px] font-bold text-white/38">
                  {unit.status} - {unit.progress}%
                </p>
              ) : null}
            </div>
          </Link>
        ))}
      </div>
    </section>
  )
}

function AddUnitPanel({ projectName }: { projectName: string }) {
  return (
    <section className="rounded-[14px] border border-white/[0.07] bg-[#111821] p-5">
      <p className="text-[10px] font-black uppercase tracking-[0.28em] text-cyan-300">
        Add Unit
      </p>
      <h2 className="mt-3 text-2xl font-black">New unit for {projectName}</h2>
      <div className="mt-5 grid gap-3">
        <input
          placeholder="Unit name"
          className="h-12 rounded-[8px] border border-white/10 bg-black/24 px-4 text-sm font-semibold text-white outline-none placeholder:text-white/28"
        />
        <button
          type="button"
          className="h-12 rounded-[8px] bg-cyan-300 text-sm font-black text-black"
        >
          Create preview unit
        </button>
      </div>
    </section>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[10px] bg-black/22 p-3">
      <p className="text-[9px] font-black uppercase tracking-[0.2em] text-white/28">
        {label}
      </p>
      <p className="mt-2 truncate text-sm font-black text-white">{value}</p>
    </div>
  )
}
