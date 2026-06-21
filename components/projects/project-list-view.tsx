'use client'

import type { ReactNode } from 'react'
import { useEffect, useState } from 'react'
import { capturePostHog } from '../../utils/analytics/client'
import DisplayModeToggle, {
  type DisplayMode,
} from '../display-mode-toggle'
import ProjectTile, { type ProjectTileData } from './project-tile'

const STORAGE_KEY = 'og_project_view_mode'

type ProjectListViewProps = {
  projects: ProjectTileData[]
  cards: ReactNode
  surface: string
  header?: (toggle: ReactNode) => ReactNode
  emptyMessage?: string
  className?: string
}

function isDisplayMode(value: string | null): value is DisplayMode {
  return value === 'cards' || value === 'tiles'
}

export default function ProjectListView({
  projects,
  cards,
  surface,
  header,
  emptyMessage = 'No projects yet.',
  className = '',
}: ProjectListViewProps) {
  const [mode, setMode] = useState<DisplayMode>('cards')

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      const storedMode = window.localStorage.getItem(STORAGE_KEY)
      if (isDisplayMode(storedMode)) {
        setMode(storedMode)
      }
    }, 0)

    return () => window.clearTimeout(timeoutId)
  }, [])

  function handleModeChange(nextMode: DisplayMode) {
    setMode(nextMode)
    window.localStorage.setItem(STORAGE_KEY, nextMode)
    capturePostHog('display_mode_changed', {
      entity: 'project',
      mode: nextMode,
      surface,
    })
  }

  const toggle = (
    <DisplayModeToggle mode={mode} onModeChange={handleModeChange} />
  )

  return (
    <div className={className}>
      {header ? header(toggle) : <div className="mb-3 flex justify-end">{toggle}</div>}

      {mode === 'cards' ? (
        cards
      ) : projects.length > 0 ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {projects.map((project) => (
            <ProjectTile key={project.id} project={project} />
          ))}
        </div>
      ) : (
        <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
          <p className="text-sm text-white/60">{emptyMessage}</p>
        </div>
      )}
    </div>
  )
}
