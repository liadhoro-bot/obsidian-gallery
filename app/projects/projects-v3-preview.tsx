'use client'

import Image from 'next/image'
import { FormEvent, useMemo, useState } from 'react'

type PreviewProject = {
  id: string
  name: string
  units: string
  progress: number
  due?: string
  image: string
  markers: string[]
}

const initialProjects: PreviewProject[] = [
  {
    id: 'gloomhaven',
    name: 'Gloomhaven 2nd ed.',
    units: '4 units',
    progress: 8,
    image: '/onboarding/pains/fragmentation.jpeg',
    markers: ['#173235', '#264a56', '#d7c399'],
  },
  {
    id: 'desert-table',
    name: 'Desert Table',
    units: '1 unit',
    progress: 6,
    image: '/onboarding/pains/pile-of-shame.jpeg',
    markers: ['#37665b'],
  },
  {
    id: 'samurai-pizza-cats',
    name: 'Samurai Pizza Cats',
    units: '1 unit',
    progress: 40,
    due: 'Due May 23, 2026',
    image: '/onboarding/first-project-bg.jpeg',
    markers: ['#8f9fd9'],
  },
  {
    id: 'golden-automaton',
    name: 'Golden Automaton',
    units: '3 units',
    progress: 27,
    image: '/onboarding/pains/tough-choices.jpeg',
    markers: ['#d6a73a', '#243447'],
  },
]

export default function ProjectsV3Preview() {
  const [projects, setProjects] = useState(initialProjects)
  const [isHelpOpen, setIsHelpOpen] = useState(false)
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [projectName, setProjectName] = useState('')
  const [projectType, setProjectType] = useState('Warband')
  const [dueDate, setDueDate] = useState('')

  const previewName = useMemo(
    () => projectName.trim() || 'New Display Force',
    [projectName]
  )

  function createPreviewProject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const nextProject: PreviewProject = {
      id: `preview-${Date.now()}`,
      name: previewName,
      units: '0 units',
      progress: 0,
      due: dueDate ? `Due ${dueDate}` : undefined,
      image: '/onboarding/pains/paint-management.jpeg',
      markers: ['#22d3ee'],
    }

    setProjects((currentProjects) => [nextProject, ...currentProjects])
    setProjectName('')
    setProjectType('Warband')
    setDueDate('')
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
                Projects
              </h1>
              <p className="mt-1 text-sm font-semibold text-white/44">
                Armies, warbands & display forces
              </p>
            </div>

            <div className="flex shrink-0 gap-2">
              <button
                type="button"
                aria-expanded={isHelpOpen}
                aria-controls="projects-help"
                aria-label="About projects"
                onClick={() => setIsHelpOpen((open) => !open)}
                className="grid h-10 w-10 place-items-center rounded-full bg-[#11171d] text-sm font-black text-white/58 transition hover:bg-white/12 hover:text-cyan-300"
              >
                ?
              </button>
              <button
                type="button"
                aria-label="Create project"
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
              id="projects-help"
              className="absolute right-12 top-12 z-20 w-[min(280px,calc(100vw-40px))] rounded-[8px] border border-cyan-300/20 bg-[#11171d] p-4 shadow-2xl shadow-black/45"
            >
              <p className="text-[10px] font-black uppercase tracking-[0.22em] text-cyan-300">
                Projects
              </p>
              <p className="mt-2 text-sm font-semibold leading-6 text-white/70">
                Group related units into one army, warband, display force, or
                event build. Each project keeps its units, progress, deadlines,
                reference images, paints, and guides together.
              </p>
            </aside>
          ) : null}
        </header>

        <section className="grid gap-3" aria-label="Projects">
          {projects.map((project) => (
            <ProjectCard key={project.id} project={project} />
          ))}
        </section>
      </div>

      {isCreateOpen ? (
        <div className="fixed inset-0 z-[60] grid place-items-end bg-black/65 px-3 py-4 backdrop-blur-sm">
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="new-project-title"
            className="w-full max-w-md rounded-[8px] border border-white/10 bg-[#10161d] p-4 shadow-2xl shadow-black/50"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.22em] text-cyan-300">
                  New Project
                </p>
                <h2
                  id="new-project-title"
                  className="mt-1 text-2xl font-black leading-tight"
                >
                  Create project
                </h2>
              </div>
              <button
                type="button"
                aria-label="Close create project"
                onClick={() => setIsCreateOpen(false)}
                className="grid h-10 w-10 place-items-center rounded-full bg-white/[0.06] text-lg font-black text-white/48 transition hover:text-white"
              >
                x
              </button>
            </div>

            <form onSubmit={createPreviewProject} className="mt-5 grid gap-4">
              <label className="grid gap-2">
                <span className="text-xs font-black uppercase tracking-[0.18em] text-white/42">
                  Project name
                </span>
                <input
                  value={projectName}
                  onChange={(event) => setProjectName(event.target.value)}
                  placeholder="e.g. Winter Warband"
                  className="h-12 rounded-[8px] border border-white/10 bg-black/24 px-4 text-sm font-semibold text-white outline-none transition placeholder:text-white/25 focus:border-cyan-300/70"
                />
              </label>

              <label className="grid gap-2">
                <span className="text-xs font-black uppercase tracking-[0.18em] text-white/42">
                  Type
                </span>
                <select
                  value={projectType}
                  onChange={(event) => setProjectType(event.target.value)}
                  className="h-12 rounded-[8px] border border-white/10 bg-black/24 px-4 text-sm font-semibold text-white outline-none transition focus:border-cyan-300/70"
                >
                  <option>Warband</option>
                  <option>Army</option>
                  <option>Display force</option>
                  <option>Terrain table</option>
                </select>
              </label>

              <label className="grid gap-2">
                <span className="text-xs font-black uppercase tracking-[0.18em] text-white/42">
                  Due date
                </span>
                <input
                  type="date"
                  value={dueDate}
                  onChange={(event) => setDueDate(event.target.value)}
                  className="h-12 rounded-[8px] border border-white/10 bg-black/24 px-4 text-sm font-semibold text-white outline-none transition focus:border-cyan-300/70"
                />
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
                  <div className="absolute inset-0 bg-gradient-to-r from-black/80 to-black/15" />
                  <div className="absolute inset-x-0 bottom-0 p-4">
                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-cyan-300">
                      Preview
                    </p>
                    <p className="mt-1 truncate text-xl font-black">
                      {previewName}
                    </p>
                    <p className="mt-1 text-xs font-bold text-white/44">
                      {projectType}
                    </p>
                  </div>
                </div>
              </div>

              <button
                type="submit"
                className="h-12 rounded-[8px] bg-cyan-300 text-sm font-black text-black transition hover:bg-cyan-200"
              >
                Create preview project
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

function ProjectCard({ project }: { project: PreviewProject }) {
  return (
    <article className="overflow-hidden rounded-[8px] border border-white/[0.055] bg-[#111821] shadow-[0_14px_40px_rgba(0,0,0,0.22)]">
      <div className="relative h-[126px] overflow-hidden">
        <Image
          src={project.image}
          alt=""
          fill
          sizes="(max-width: 640px) 100vw, 448px"
          className="object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-black/18 to-black/78" />
        <h2 className="absolute bottom-4 left-4 right-16 truncate text-base font-black leading-tight text-white">
          {project.name}
        </h2>
        <div className="absolute bottom-3 right-4 grid h-10 w-10 place-items-center rounded-full bg-black/48">
          <div
            className="grid h-8 w-8 place-items-center rounded-full text-[9px] font-black text-white"
            style={{
              background: `conic-gradient(#22d3ee 0 ${project.progress}%, rgba(255,255,255,0.14) ${project.progress}% 100%)`,
            }}
            aria-label={`${project.name} progress ${project.progress} percent`}
          >
            <span className="grid h-6 w-6 place-items-center rounded-full bg-[#070b0f]">
              {project.progress}%
            </span>
          </div>
        </div>
      </div>

      <div className="px-4 py-3">
        <div className="h-1 overflow-hidden rounded-full bg-white/8">
          <div
            className="h-full rounded-full bg-cyan-300"
            style={{ width: `${Math.max(project.progress, 6)}%` }}
          />
        </div>
        <div className="mt-3 flex items-center justify-between gap-3">
          <div className="flex min-w-0 -space-x-2">
            {project.markers.map((color, index) => (
              <span
                key={`${project.id}-${color}-${index}`}
                className="h-5 w-5 rounded-full border border-[#111821]"
                style={{ backgroundColor: color }}
              />
            ))}
          </div>
          <div className="min-w-0 truncate text-right text-[11px] font-black text-white/34">
            <span>{project.units}</span>
            {project.due ? (
              <span className="ml-3 text-yellow-300">{project.due}</span>
            ) : null}
          </div>
        </div>
      </div>
    </article>
  )
}
