'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useState } from 'react'
import ProjectCreateForm from './project-create-form'
import ProjectLibrary, { ProjectWithImage } from './project-library'

type ProjectsTabsProps = {
  projects: ProjectWithImage[]
  addProjectAction: (formData: FormData) => Promise<void>
  initialTab?: ActiveTab
}

type ActiveTab = 'mine' | 'create'

export default function ProjectsTabs({
  projects,
  addProjectAction,
  initialTab = 'mine',
}: ProjectsTabsProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const currentTab = searchParams.get('tab') === 'create' ? 'create' : 'mine'
  const [activeTab, setActiveTab] = useState<ActiveTab>(initialTab)

  useEffect(() => {
    setActiveTab(currentTab)
  }, [currentTab])

  const tabs: {
    key: ActiveTab
    label: string
  }[] = [
    { key: 'mine', label: 'My Projects' },
    { key: 'create', label: 'New Project' },
  ]

  return (
    <div className="grid gap-5">
      <div className="grid grid-cols-2 rounded-2xl border border-white/10 bg-slate-950/70 p-1 shadow-[0_0_24px_rgba(34,211,238,0.08)]">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.key

          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => {
                setActiveTab(tab.key)
                const params = new URLSearchParams(searchParams.toString())
                if (tab.key === 'mine') {
                  params.delete('tab')
                } else {
                  params.set('tab', tab.key)
                }
                const query = params.toString()
                router.push(query ? `/projects?${query}` : '/projects')
              }}
              className={[
                'rounded-xl px-2 py-3 text-center text-xs font-black transition active:scale-[0.98] active:opacity-70',
                isActive
                  ? 'bg-cyan-400/15 text-cyan-300 ring-1 ring-cyan-400/50 shadow-[0_0_18px_rgba(34,211,238,0.18)]'
                  : 'text-white/45 hover:bg-white/5 hover:text-white/75',
              ].join(' ')}
            >
              {tab.label}
            </button>
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
