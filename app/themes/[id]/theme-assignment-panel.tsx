'use client'

import { useEffect, useMemo, useState, useTransition } from 'react'
import { assignThemeToProjects, assignThemeToUnits } from './actions'

type AssignableProject = {
  id: string
  name: string
  themeId: string | null
}

type AssignableUnit = {
  id: string
  name: string
  currentThemeId: string | null
}

type ProjectUnitGroup = {
  projectId: string
  projectName: string
  units: AssignableUnit[]
}

type Props = {
  themeId: string
  projects: AssignableProject[]
  projectUnitGroups: ProjectUnitGroup[]
}

type ConflictState = {
  kind: 'project' | 'unit'
  names: string[]
} | null

export default function ThemeAssignmentPanel({
  themeId,
  projects,
  projectUnitGroups,
}: Props) {
  const [isOpen, setIsOpen] = useState(false)
  const [mode, setMode] = useState<'project' | 'unit' | null>(null)
  const [localProjects, setLocalProjects] = useState(projects)
  const [localProjectUnitGroups, setLocalProjectUnitGroups] =
    useState(projectUnitGroups)
  const [selectedProjectIds, setSelectedProjectIds] = useState<string[]>([])
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null)
  const [selectedUnitIds, setSelectedUnitIds] = useState<string[]>([])
  const [conflict, setConflict] = useState<ConflictState>(null)
  const [error, setError] = useState('')
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    setLocalProjects(projects)
  }, [projects])

  useEffect(() => {
    setLocalProjectUnitGroups(projectUnitGroups)
  }, [projectUnitGroups])

  const activeProject = useMemo(
    () =>
      localProjectUnitGroups.find((project) => project.projectId === activeProjectId) ??
      null,
    [activeProjectId, localProjectUnitGroups]
  )

  function reset() {
    setMode(null)
    setSelectedProjectIds([])
    setActiveProjectId(null)
    setSelectedUnitIds([])
    setConflict(null)
  }

  function closePanel() {
    setIsOpen(false)
    reset()
  }

  function toggleValue(values: string[], value: string) {
    return values.includes(value)
      ? values.filter((item) => item !== value)
      : [...values, value]
  }

  function submitProjects() {
    const formData = new FormData()
    formData.set('themeId', themeId)

    for (const projectId of selectedProjectIds) {
      formData.append('projectIds', projectId)
    }

    const previousProjects = localProjects

    setError('')
    setLocalProjects((current) =>
      current.map((project) =>
        selectedProjectIds.includes(project.id)
          ? { ...project, themeId }
          : project
      )
    )
    closePanel()

    startTransition(async () => {
      try {
        await assignThemeToProjects(formData)
      } catch (assignError) {
        setLocalProjects(previousProjects)
        setError(
          assignError instanceof Error
            ? assignError.message
            : 'Could not assign theme.'
        )
      }
    })
  }

  function submitUnits() {
    const formData = new FormData()
    formData.set('themeId', themeId)

    for (const unitId of selectedUnitIds) {
      formData.append('unitIds', unitId)
    }

    const previousGroups = localProjectUnitGroups

    setError('')
    setLocalProjectUnitGroups((current) =>
      current.map((project) => ({
        ...project,
        units: project.units.map((unit) =>
          selectedUnitIds.includes(unit.id)
            ? { ...unit, currentThemeId: themeId }
            : unit
        ),
      }))
    )
    closePanel()

    startTransition(async () => {
      try {
        await assignThemeToUnits(formData)
      } catch (assignError) {
        setLocalProjectUnitGroups(previousGroups)
        setError(
          assignError instanceof Error
            ? assignError.message
            : 'Could not assign theme.'
        )
      }
    })
  }

  function requestProjectAssign() {
    const conflicts = localProjects
      .filter(
        (project) =>
          selectedProjectIds.includes(project.id) &&
          project.themeId &&
          project.themeId !== themeId
      )
      .map((project) => project.name)

    if (conflicts.length > 0) {
      setConflict({ kind: 'project', names: conflicts })
      return
    }

    submitProjects()
  }

  function requestUnitAssign() {
    const units = localProjectUnitGroups.flatMap((project) => project.units)
    const conflicts = units
      .filter(
        (unit) =>
          selectedUnitIds.includes(unit.id) &&
          unit.currentThemeId &&
          unit.currentThemeId !== themeId
      )
      .map((unit) => unit.name)

    if (conflicts.length > 0) {
      setConflict({ kind: 'unit', names: conflicts })
      return
    }

    submitUnits()
  }

  function confirmOverwrite() {
    if (conflict?.kind === 'project') {
      submitProjects()
    } else if (conflict?.kind === 'unit') {
      submitUnits()
    }
  }

  const canAssignProjects = selectedProjectIds.length > 0 && !isPending
  const canAssignUnits = selectedUnitIds.length > 0 && !isPending

  return (
    <section>
      <button
        type="button"
        onClick={() => setIsOpen((current) => !current)}
        className="w-full rounded-2xl bg-cyan-500 px-4 py-4 text-sm font-bold text-slate-950 shadow-lg shadow-cyan-500/20 transition hover:bg-cyan-400"
      >
        Add to Project / Unit
      </button>

      {isOpen ? (
        <div className="mt-3 rounded-2xl border border-white/10 bg-white/[0.03] p-3">
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => {
                setMode('project')
                setActiveProjectId(null)
              }}
              className={[
                'rounded-xl border px-3 py-3 text-sm font-semibold transition',
                mode === 'project'
                  ? 'border-cyan-400/50 bg-cyan-400/15 text-cyan-100'
                  : 'border-white/10 bg-white/[0.04] text-white/70 hover:bg-white/[0.07]',
              ].join(' ')}
            >
              Assign to Project
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('unit')
                setActiveProjectId(null)
              }}
              className={[
                'rounded-xl border px-3 py-3 text-sm font-semibold transition',
                mode === 'unit'
                  ? 'border-cyan-400/50 bg-cyan-400/15 text-cyan-100'
                  : 'border-white/10 bg-white/[0.04] text-white/70 hover:bg-white/[0.07]',
              ].join(' ')}
            >
              Assign to Unit
            </button>
          </div>

          {mode === 'project' ? (
            <div className="mt-3 rounded-2xl border border-white/10 bg-[#10131a] p-3">
              <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
                {localProjects.length > 0 ? (
                  localProjects.map((project) => (
                    <label
                      key={project.id}
                      className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-3 text-sm text-white/80"
                    >
                      <input
                        type="checkbox"
                        checked={selectedProjectIds.includes(project.id)}
                        onChange={() =>
                          setSelectedProjectIds((current) =>
                            toggleValue(current, project.id)
                          )
                        }
                        className="h-4 w-4 rounded border-white/20 bg-black/40 accent-cyan-400"
                      />
                      <span className="min-w-0 flex-1 truncate">
                        {project.name}
                      </span>
                      {project.themeId && project.themeId !== themeId ? (
                        <span className="rounded-full border border-amber-300/30 bg-amber-300/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-amber-100">
                          Has theme
                        </span>
                      ) : null}
                    </label>
                  ))
                ) : (
                  <p className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-4 text-sm text-white/45">
                    No projects yet.
                  </p>
                )}
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={closePanel}
                  className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-semibold text-white/70"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={requestProjectAssign}
                  disabled={!canAssignProjects}
                  className="rounded-xl bg-cyan-400 px-4 py-3 text-sm font-bold text-slate-950 disabled:cursor-not-allowed disabled:bg-neutral-700 disabled:text-white/60"
                >
                  {isPending ? 'Assigning...' : 'Assign'}
                </button>
              </div>
            </div>
          ) : null}

          {mode === 'unit' ? (
            <div className="mt-3 rounded-2xl border border-white/10 bg-[#10131a] p-3">
              {!activeProject ? (
                <div className="space-y-2">
                  {localProjectUnitGroups.length > 0 ? (
                    localProjectUnitGroups.map((project) => (
                      <button
                        key={project.projectId}
                        type="button"
                        onClick={() => setActiveProjectId(project.projectId)}
                        className="flex w-full items-center justify-between rounded-xl border border-white/10 bg-white/[0.03] px-3 py-3 text-left text-sm font-semibold text-white/80 transition hover:bg-white/[0.07]"
                      >
                        <span className="truncate">{project.projectName}</span>
                        <span className="text-xs text-white/40">
                          {project.units.length}
                        </span>
                      </button>
                    ))
                  ) : (
                    <p className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-4 text-sm text-white/45">
                      No projects with units yet.
                    </p>
                  )}
                </div>
              ) : (
                <>
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <button
                      type="button"
                      onClick={() => setActiveProjectId(null)}
                      className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-300"
                    >
                      Back
                    </button>
                    <p className="min-w-0 truncate text-sm font-semibold text-white/75">
                      {activeProject.projectName}
                    </p>
                  </div>

                  <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
                    {activeProject.units.length > 0 ? (
                      activeProject.units.map((unit) => (
                        <label
                          key={unit.id}
                          className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-3 text-sm text-white/80"
                        >
                          <input
                            type="checkbox"
                            checked={selectedUnitIds.includes(unit.id)}
                            onChange={() =>
                              setSelectedUnitIds((current) =>
                                toggleValue(current, unit.id)
                              )
                            }
                            className="h-4 w-4 rounded border-white/20 bg-black/40 accent-cyan-400"
                          />
                          <span className="min-w-0 flex-1 truncate">
                            {unit.name}
                          </span>
                          {unit.currentThemeId &&
                          unit.currentThemeId !== themeId ? (
                            <span className="rounded-full border border-amber-300/30 bg-amber-300/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-amber-100">
                              Has theme
                            </span>
                          ) : null}
                        </label>
                      ))
                    ) : (
                      <p className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-4 text-sm text-white/45">
                        No units in this project yet.
                      </p>
                    )}
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={closePanel}
                      className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-semibold text-white/70"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={requestUnitAssign}
                      disabled={!canAssignUnits}
                      className="rounded-xl bg-cyan-400 px-4 py-3 text-sm font-bold text-slate-950 disabled:cursor-not-allowed disabled:bg-neutral-700 disabled:text-white/60"
                    >
                      {isPending ? 'Assigning...' : 'Assign'}
                    </button>
                  </div>
                </>
              )}
            </div>
          ) : null}
        </div>
      ) : null}

      {error ? <p className="mt-2 text-sm text-red-300">{error}</p> : null}

      {conflict ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 px-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="assign-theme-conflict-title"
        >
          <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-[#10131a] p-4 shadow-2xl">
            <h2 id="assign-theme-conflict-title" className="text-base font-bold">
              Theme already assigned
            </h2>
            <p className="mt-2 text-sm leading-6 text-white/60">
              {conflict.kind === 'project'
                ? 'One or more selected projects already has a theme assigned.'
                : 'One or more selected units already has a theme assigned.'}
            </p>
            <div className="mt-3 max-h-28 space-y-1 overflow-y-auto rounded-xl border border-white/10 bg-white/[0.03] p-2">
              {conflict.names.map((name) => (
                <p key={name} className="truncate text-xs text-white/70">
                  {name}
                </p>
              ))}
            </div>

            <div className="mt-5 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setConflict(null)}
                disabled={isPending}
                className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-semibold text-white/70 transition hover:bg-white/[0.07] disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmOverwrite}
                disabled={isPending}
                className="rounded-xl bg-cyan-400 px-4 py-3 text-sm font-bold text-slate-950 transition hover:bg-cyan-300 disabled:opacity-50"
              >
                {isPending ? 'Assigning...' : 'Assign'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  )
}
