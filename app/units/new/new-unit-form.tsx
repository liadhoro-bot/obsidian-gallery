'use client'

import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { useMemo, useState, useTransition } from 'react'
import { createStandaloneUnitAction } from './actions'

type ProjectOption = {
  id: string
  name: string | null
}

type NewUnitFormProps = {
  projects: ProjectOption[]
}

type ProjectMode = 'new' | 'existing'

export default function NewUnitForm({ projects }: NewUnitFormProps) {
  const router = useRouter()
  const [projectMode, setProjectMode] = useState<ProjectMode>('new')
  const [projectName, setProjectName] = useState('')
  const [selectedProjectIds, setSelectedProjectIds] = useState<string[]>([])
  const [unitName, setUnitName] = useState('')
  const [modelCount, setModelCount] = useState('1')
  const [deadline, setDeadline] = useState('')
  const [notes, setNotes] = useState('')
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const hasProjectTarget =
    projectMode === 'new'
      ? projectName.trim().length > 1
      : selectedProjectIds.length > 0
  const canSubmit = hasProjectTarget && unitName.trim().length > 1 && !isPending
  const selectedProjectNames = projects
    .filter((project) => selectedProjectIds.includes(project.id))
    .map((project) => project.name || 'Untitled Project')
  const previewProjectName =
    projectMode === 'new'
      ? projectName.trim() || 'New Project'
      : selectedProjectNames.join(', ') || 'Choose Projects'

  const formattedDeadline = useMemo(() => {
    if (!deadline) return 'No deadline set'

    try {
      return new Intl.DateTimeFormat('en', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      }).format(new Date(`${deadline}T12:00:00`))
    } catch {
      return 'No deadline set'
    }
  }, [deadline])

  function handleImageChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]

    setImagePreview(file ? URL.createObjectURL(file) : null)
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!canSubmit) return

    const formData = new FormData(event.currentTarget)
    setError(null)

    startTransition(async () => {
      const result = await createStandaloneUnitAction(formData)

      if (!result.ok) {
        setError(result.error)
        return
      }

      router.push(`/units/${result.unitId}`)
    })
  }

  function toggleProject(projectId: string) {
    setSelectedProjectIds((current) =>
      current.includes(projectId)
        ? current.filter((id) => id !== projectId)
        : [...current, projectId]
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <section className="rounded-2xl border border-cyan-300/25 bg-black/40 p-4 shadow-[0_0_22px_rgba(34,211,238,0.12)]">
        <div className="space-y-4">
          <input type="hidden" name="projectMode" value={projectMode} />

          <div className="grid grid-cols-2 rounded-xl border border-white/10 bg-slate-950/70 p-1 shadow-[0_0_18px_rgba(34,211,238,0.08)]">
            {[
              { key: 'new' as const, label: 'New Project' },
              { key: 'existing' as const, label: 'Existing Project' },
            ].map((mode) => {
              const isActive = projectMode === mode.key

              return (
                <button
                  key={mode.key}
                  type="button"
                  onClick={() => setProjectMode(mode.key)}
                  className={[
                    'rounded-lg px-2 py-3 text-center text-xs font-black transition active:scale-[0.98]',
                    isActive
                      ? 'bg-cyan-400/15 text-cyan-300 ring-1 ring-cyan-400/50 shadow-[0_0_18px_rgba(34,211,238,0.18)]'
                      : 'text-white/45 hover:bg-white/5 hover:text-white/75',
                  ].join(' ')}
                >
                  {mode.label}
                </button>
              )
            })}
          </div>

          {projectMode === 'new' ? (
            <label className="block space-y-2">
              <span className="text-xs font-bold uppercase tracking-[0.22em] text-white/50">
                Project Name
              </span>
              <input
                name="projectName"
                value={projectName}
                onChange={(event) => setProjectName(event.target.value)}
                placeholder="e.g. Tyranid Hive Fleet Kraken"
                required={projectMode === 'new'}
                className="w-full rounded-xl border border-white/12 bg-white/[0.08] px-4 py-3 text-sm font-semibold text-white outline-none transition placeholder:text-white/28 focus:border-cyan-300/60 focus:bg-white/[0.12]"
              />
            </label>
          ) : (
            <div className="space-y-2">
              <span className="text-xs font-bold uppercase tracking-[0.22em] text-white/50">
                Existing Projects
              </span>

              {projects.length > 0 ? (
                <div className="grid max-h-48 gap-2 overflow-y-auto pr-1">
                  {projects.map((project) => {
                    const isSelected = selectedProjectIds.includes(project.id)

                    return (
                      <label
                        key={project.id}
                        className={[
                          'flex cursor-pointer items-center gap-3 rounded-xl border px-3 py-3 transition',
                          isSelected
                            ? 'border-cyan-300/50 bg-cyan-300/[0.1] text-white'
                            : 'border-white/10 bg-white/[0.05] text-white/70 hover:border-cyan-300/30',
                        ].join(' ')}
                      >
                        <input
                          type="checkbox"
                          name="projectIds"
                          value={project.id}
                          checked={isSelected}
                          onChange={() => toggleProject(project.id)}
                          className="h-4 w-4 accent-cyan-300"
                        />
                        <span className="min-w-0 text-sm font-bold">
                          {project.name || 'Untitled Project'}
                        </span>
                      </label>
                    )
                  })}
                </div>
              ) : (
                <div className="rounded-xl border border-white/10 bg-white/[0.05] px-4 py-3 text-sm text-white/55">
                  No projects yet. Create a new project for this unit.
                </div>
              )}
            </div>
          )}

          <label className="block space-y-2">
            <span className="text-xs font-bold uppercase tracking-[0.22em] text-white/50">
              Unit Name
            </span>
            <input
              name="unitName"
              value={unitName}
              onChange={(event) => setUnitName(event.target.value)}
              placeholder="e.g. Winged Tyranid Prime"
              required
              className="w-full rounded-xl border border-white/12 bg-white/[0.08] px-4 py-3 text-sm font-semibold text-white outline-none transition placeholder:text-white/28 focus:border-cyan-300/60 focus:bg-white/[0.12]"
            />
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="block space-y-2">
              <span className="text-xs font-bold uppercase tracking-[0.18em] text-white/50">
                Models
              </span>
              <input
                name="modelCount"
                type="number"
                min="1"
                value={modelCount}
                onChange={(event) => setModelCount(event.target.value)}
                className="w-full rounded-xl border border-white/12 bg-white/[0.08] px-4 py-3 text-sm font-semibold text-white outline-none transition focus:border-cyan-300/60 focus:bg-white/[0.12]"
              />
            </label>

            <label className="block space-y-2">
              <span className="text-xs font-bold uppercase tracking-[0.18em] text-white/50">
                Deadline
              </span>
              <input
                name="deadline"
                type="date"
                value={deadline}
                onChange={(event) => setDeadline(event.target.value)}
                className="w-full rounded-xl border border-white/12 bg-white/[0.08] px-4 py-3 text-sm font-semibold text-white outline-none transition focus:border-cyan-300/60 focus:bg-white/[0.12]"
              />
            </label>
          </div>

          <div className="space-y-2">
            <span className="text-xs font-bold uppercase tracking-[0.22em] text-white/50">
              Thumbnail Picture
            </span>
            <div className="flex gap-3">
              <label className="relative flex h-24 w-24 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-xl border border-dashed border-cyan-300/35 bg-cyan-300/[0.06] text-3xl font-light text-cyan-200 transition hover:border-cyan-200 hover:bg-cyan-300/[0.12]">
                {imagePreview ? (
                  <Image
                    src={imagePreview}
                    alt=""
                    fill
                    className="object-cover"
                    unoptimized
                  />
                ) : (
                  '+'
                )}
                <input
                  name="image"
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={handleImageChange}
                  className="sr-only"
                />
              </label>

              <div className="flex min-w-0 flex-1 items-center rounded-xl border border-white/10 bg-white/[0.06] px-4">
                <p className="text-xs leading-5 text-white/48">
                  Add a first photo to give the unit card a thumbnail from the
                  start.
                </p>
              </div>
            </div>
          </div>

          <label className="block space-y-2">
            <span className="text-xs font-bold uppercase tracking-[0.22em] text-white/50">
              Notes
            </span>
            <textarea
              name="notes"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              rows={3}
              placeholder="Optional assembly notes, paint goals, or basing ideas"
              className="w-full resize-none rounded-xl border border-white/12 bg-white/[0.08] px-4 py-3 text-sm font-semibold text-white outline-none transition placeholder:text-white/28 focus:border-cyan-300/60 focus:bg-white/[0.12]"
            />
          </label>
        </div>
      </section>

      <section className="relative overflow-hidden rounded-2xl border border-cyan-300/25 bg-[#061018] p-5 shadow-xl shadow-cyan-950/20">
        <div className="absolute inset-0">
          {imagePreview ? (
            <Image
              src={imagePreview}
              alt=""
              fill
              className="object-cover opacity-60"
              unoptimized
            />
          ) : (
            <Image
              src="/onboarding/first-project-bg.jpeg"
              alt=""
              fill
              className="object-cover opacity-35"
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/50 to-black/10" />
          <div className="absolute inset-0 bg-gradient-to-t from-[#061018]/85 via-[#061018]/15 to-transparent" />
        </div>

        <div className="relative z-10 min-h-[210px]">
          <p className="text-[10px] font-black uppercase tracking-[0.22em] text-cyan-300/80">
            {previewProjectName}
          </p>
          <h2 className="mt-2 max-w-[260px] text-2xl font-black leading-tight text-white">
            {unitName.trim() || 'New Unit'}
          </h2>

          <div className="mt-5 grid grid-cols-2 gap-2">
            <div className="rounded-xl border border-white/10 bg-black/35 px-3 py-2">
              <p className="text-[9px] font-black uppercase tracking-[0.18em] text-white/35">
                Models
              </p>
              <p className="mt-1 text-sm font-black text-white">
                {modelCount || '1'}
              </p>
            </div>

            <div className="rounded-xl border border-orange-300/20 bg-orange-300/10 px-3 py-2">
              <p className="text-[9px] font-black uppercase tracking-[0.18em] text-orange-200/70">
                Deadline
              </p>
              <p className="mt-1 text-sm font-black text-orange-300">
                {formattedDeadline}
              </p>
            </div>
          </div>

          <div className="mt-5 rounded-xl border border-cyan-300/15 bg-cyan-300/[0.07] p-3">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-cyan-300">
                Progress
              </p>
              <p className="text-sm font-black text-cyan-200">0%</p>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/15">
              <div className="h-full w-0 rounded-full bg-cyan-300" />
            </div>
          </div>
        </div>
      </section>

      {error ? (
        <div className="rounded-xl border border-red-400/25 bg-red-500/10 px-4 py-3 text-sm font-semibold text-red-100">
          {error}
        </div>
      ) : null}

      <button
        type="submit"
        disabled={!canSubmit}
        className="tap-press tap-target w-full rounded-xl bg-cyan-300 px-5 py-4 text-sm font-black uppercase tracking-[0.18em] text-[#041016] shadow-xl shadow-cyan-500/25 transition disabled:cursor-not-allowed disabled:bg-white/12 disabled:text-white/30 disabled:shadow-none"
      >
        {isPending ? 'Creating Unit...' : 'Create Unit'}
      </button>
    </form>
  )
}
