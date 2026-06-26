'use client'

import Link from 'next/link'
import ProjectCreateForm from './project-create-form'
import ProjectLibrary, { ProjectWithImage } from './project-library'

type ProjectsTabsProps = {
  activeTab: ActiveTab
  projects: ProjectWithImage[]
  addProjectAction: (formData: FormData) => Promise<void>
}

type ActiveTab = 'mine' | 'create'

export default function ProjectsTabs({
  activeTab,
  projects,
  addProjectAction,
}: ProjectsTabsProps) {
  const tabs: Array<{
    key: ActiveTab
    label: string
    href: string
  }> = [
    { key: 'mine', label: 'My Projects', href: '/projects' },
    { key: 'create', label: 'New Project', href: '/projects?tab=create' },
  ]

  return (
    <div className="grid gap-5">
      <div className="grid grid-cols-2 rounded-2xl border border-white/10 bg-slate-950/70 p-1 shadow-[0_0_24px_rgba(34,211,238,0.08)]">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.key

          return (
            <Link
              key={tab.key}
              href={tab.href}
              className={[
                'rounded-xl px-2 py-3 text-center text-xs font-black transition',
                isActive
                  ? 'bg-cyan-400/15 text-cyan-300 ring-1 ring-cyan-400/50 shadow-[0_0_18px_rgba(34,211,238,0.18)]'
                  : 'text-white/45 hover:bg-white/5 hover:text-white/75',
              ].join(' ')}
            >
              {tab.label}
            </Link>
          )
        })}
      </div>

      {activeTab === 'mine' ? (
        <ProjectLibrary projects={projects} />
      ) : (
        <ProjectCreateForm addProjectAction={addProjectAction} />
      )}
    </div>
  )
}
