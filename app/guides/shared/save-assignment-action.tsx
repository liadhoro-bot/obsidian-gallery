'use client'

import { useEffect, useState, useTransition } from 'react'
import { createPortal } from 'react-dom'
import {
  getAssignmentTargets,
  setContentAssignments,
  type AssignableContentType,
  type AssignmentTarget,
} from '../assignment-actions'
import projectStyles from '../../projects/[id]/project-detail-silver.module.css'

type Props = {
  contentType: AssignableContentType
  contentId: string
  title: string
  saved: boolean
  onToggleSaved: () => void
  compact?: boolean
  glass?: boolean
  count?: number
}

export default function SaveAssignmentAction({
  contentType,
  contentId,
  title,
  saved,
  onToggleSaved,
  compact = false,
  glass = false,
  count,
}: Props) {
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState<'choice' | 'targets'>('choice')
  const [targets, setTargets] = useState<AssignmentTarget[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [error, setError] = useState<string | null>(null)
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set())
  const [pending, startTransition] = useTransition()

  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && setOpen(false)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  function openTargets() {
    setStep('targets')
    setError(null)
    startTransition(async () => {
      try {
        const rows = await getAssignmentTargets(contentType, contentId)
        setTargets(rows)
        setSelected(new Set(rows.filter((row) => row.assigned).map((row) => `${row.type}:${row.id}`)))
        setExpandedGroups(new Set())
        setError(null)
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : 'Could not load projects and units.')
      }
    })
  }

  function saveTargets() {
    startTransition(async () => {
      try {
        await setContentAssignments({
          contentType,
          contentId,
          targets: targets.filter((target) => selected.has(`${target.type}:${target.id}`)).map(({ type, id }) => ({ type, id })),
        })
        setOpen(false)
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : 'Could not assign this guide.')
      }
    })
  }

  const buttonClass = glass
    ? `flex h-10 items-center gap-1.5 rounded-full px-3 text-xs font-semibold transition-colors`
    : `flex items-center rounded-full bg-black/50 font-semibold backdrop-blur-sm transition-colors ${compact ? 'gap-1 px-2 py-1 text-[10px]' : 'gap-1.5 px-2.5 py-1.5 text-xs'} ${saved ? 'text-cyan-300' : 'text-white/85'}`
  const projects = targets.filter((target) => target.type === 'project')
  const units = targets.filter((target) => target.type === 'unit')
  const ungroupedUnits = units.filter((unit) => unit.projectIds.length === 0)

  function toggleSelected(key: string) {
    setSelected((current) => {
      const next = new Set(current)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  function toggleGroup(key: string) {
    setExpandedGroups((current) => {
      const next = new Set(current)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  return (
    <>
      <button
        type="button"
        onClick={() => { setStep('choice'); setError(null); setOpen(true) }}
        aria-pressed={saved}
        aria-label={saved ? 'Saved guide options' : 'Save or assign guide'}
        data-glass-control={glass ? 'true' : undefined}
        data-action-state={glass ? (saved ? 'saved' : 'idle') : undefined}
        className={buttonClass}
      >
        <BookmarkIcon filled={saved} size={compact ? 13 : 16} />
        {typeof count === 'number' ? <span>{count}</span> : null}
      </button>

      {open && typeof document !== 'undefined' ? createPortal(
        <div className={`${projectStyles.dialogOverlay} fixed inset-0 z-[1100] grid place-items-center p-4 backdrop-blur-sm`} onMouseDown={(event) => event.target === event.currentTarget && setOpen(false)}>
          <section role="dialog" aria-modal="true" aria-labelledby="save-assignment-title" className={`${projectStyles.dialogPanel} w-full max-w-md p-5`}>
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className={projectStyles.eyebrow}>{contentType}</p>
                <h2 id="save-assignment-title" className="mt-1 truncate text-xl font-black">{title}</h2>
              </div>
              <button type="button" aria-label="Close" onClick={() => setOpen(false)} className={`${projectStyles.iconControl} !h-9 !w-9`}><span>×</span></button>
            </div>

            {step === 'choice' ? (
              <div className="mt-5 grid gap-3">
                <button type="button" onClick={() => { onToggleSaved(); setOpen(false) }} className={`${projectStyles.paintPickerRow} p-4 text-left transition`}>
                  <span className="block text-sm font-black">{saved ? 'Remove from Saved Guides' : 'Add to Saved Guides'}</span>
                  <span className="mt-1 block text-xs opacity-60">Keep it in your personal Guides library.</span>
                </button>
                <button type="button" onClick={openTargets} className={`${projectStyles.paintPickerRow} p-4 text-left transition`}>
                  <span className="block text-sm font-black">Assign to Project/Unit</span>
                  <span className="mt-1 block text-xs opacity-60">Choose one or more places where this should appear.</span>
                </button>
              </div>
            ) : (
              <>
                <div className="mt-5 max-h-[52dvh] space-y-2 overflow-y-auto pr-1">
                  <p className={projectStyles.eyebrow}>Projects</p>
                  {projects.map((project) => {
                    const projectKey = `project:${project.id}`
                    const groupKey = `group:${project.id}`
                    const projectUnits = units.filter((unit) => unit.projectIds.includes(project.id))
                    const expanded = expandedGroups.has(groupKey)
                    return <div key={projectKey} className={`${projectStyles.paintPickerRow} overflow-hidden`}>
                      <div className="flex min-h-12 items-center gap-3 px-3 py-2">
                        <input type="checkbox" aria-label={`Assign to project ${project.name}`} checked={selected.has(projectKey)} onChange={() => toggleSelected(projectKey)} className="h-4 w-4 accent-amber-700" />
                        <span className="min-w-0 flex-1 truncate text-sm font-black">{project.name}</span>
                        <button type="button" onClick={() => toggleGroup(groupKey)} aria-expanded={expanded} aria-label={`${expanded ? 'Hide' : 'Show'} units in ${project.name}`} className={`${projectStyles.secondaryAction} grid h-8 w-8 place-items-center text-xs font-black`}>
                          {expanded ? '−' : '+'}
                        </button>
                      </div>
                      {expanded ? <div className="border-t border-black/10 bg-black/[0.035] px-3 py-2">
                        {projectUnits.length ? <div className="grid gap-2">{projectUnits.map((unit) => {
                          const unitKey = `unit:${unit.id}`
                          return <label key={unitKey} className="flex min-h-10 cursor-pointer items-center gap-3 pl-4">
                            <input type="checkbox" checked={selected.has(unitKey)} onChange={() => toggleSelected(unitKey)} className="h-4 w-4 accent-amber-700" />
                            <span className="text-sm font-bold">{unit.name}</span>
                          </label>
                        })}</div> : <p className="py-2 pl-4 text-xs opacity-55">No units in this project.</p>}
                      </div> : null}
                    </div>
                  })}
                  {ungroupedUnits.length ? <div className={`${projectStyles.paintPickerRow} overflow-hidden`}>
                    <button type="button" onClick={() => toggleGroup('group:unassigned')} aria-expanded={expandedGroups.has('group:unassigned')} className="flex min-h-12 w-full items-center gap-3 px-3 py-2 text-left">
                      <span className="min-w-0 flex-1 text-sm font-black">Units without a project</span>
                      <span className={`${projectStyles.secondaryAction} grid h-8 w-8 place-items-center text-xs font-black`}>{expandedGroups.has('group:unassigned') ? '−' : '+'}</span>
                    </button>
                    {expandedGroups.has('group:unassigned') ? <div className="border-t border-black/10 bg-black/[0.035] px-3 py-2"><div className="grid gap-2">{ungroupedUnits.map((unit) => {
                      const unitKey = `unit:${unit.id}`
                      return <label key={unitKey} className="flex min-h-10 cursor-pointer items-center gap-3 pl-4"><input type="checkbox" checked={selected.has(unitKey)} onChange={() => toggleSelected(unitKey)} className="h-4 w-4 accent-amber-700" /><span className="text-sm font-bold">{unit.name}</span></label>
                    })}</div></div> : null}
                  </div> : null}
                  {!pending && projects.length === 0 && units.length === 0 ? <p className="py-5 text-sm opacity-60">No projects or units yet.</p> : null}
                </div>
                <div className="mt-5 flex gap-2">
                  <button type="button" onClick={() => setStep('choice')} className={`${projectStyles.secondaryAction} h-11 px-4 text-sm font-black`}>Back</button>
                  <button type="button" onClick={saveTargets} disabled={pending} className={`${projectStyles.primaryButton} h-11 flex-1 px-4 text-sm font-black disabled:opacity-50`}>{pending ? 'Saving…' : 'Save assignments'}</button>
                </div>
              </>
            )}
            {error ? <p role="alert" className="mt-3 text-xs font-bold text-red-700">{error}</p> : null}
          </section>
        </div>, document.body) : null}
    </>
  )
}

function BookmarkIcon({ filled, size }: { filled: boolean; size: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M6 3.5h12a1 1 0 0 1 1 1V21l-7-4-7 4V4.5a1 1 0 0 1 1-1z" strokeLinejoin="round" /></svg>
}
