'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  expireUnitSessionAtTwoHours,
  setFeaturedUnitImage,
  toggleUnitActive,
  updateUnitDetails,
} from './actions'
import { createClient } from '../../../utils/supabase/client'
import { toggleStepDone } from './actions'
import UnitSessionTracker from './components/unit-session-tracker'
import ProjectPaletteCard from '../../projects/[id]/project-palette-card'

type Unit = {
  id: string
  name: string
  complexity: number | null
  unit_size: number | null
deadline: string | null
is_active: boolean
  project_id: string | null
}

type UnitImage = {
  id: string
  image_url: string
  is_featured: boolean
  created_at: string
  sort_order: number | null
  alt_text: string | null
  storage_bucket: string | null
  storage_path: string | null
}

type ProgressStep = {
  id: string
  step_key: string
  step_label: string
  step_order: number
  status: 'pending' | 'in_progress' | 'done'
  progress: number
}

type Session = {
  id: string
  started_at: string
  ended_at: string | null
  duration_seconds: number | null
  user_id?: string | null
}

type Props = {
  unit: Unit
  projectTheme: Theme
  images: UnitImage[]
  featuredImage: UnitImage | null
  steps: ProgressStep[]
  totalLoggedSeconds: number
  activeSession: Session | null
  sessions: Session[]
}
type ThemePaint = {
  id: string
  sort_order: number | null
  paint_source: string | null
  paint_catalog_id: string | null
  custom_paint_id: string | null
  catalog_paint?: {
    id: string
    name: string | null
    hex_approx: string | null
    swatch_image_url: string | null
  } | null
  custom_paint?: {
    id: string
    name: string | null
    color_hex: string | null
  } | null
}

type Theme = {
  id: string
  name: string | null
  description: string | null
  theme_paints: ThemePaint[]
} | null
export default function UnitDetailClient({
  unit,
  projectTheme,
  images,
  featuredImage,
  steps,
  totalLoggedSeconds,
  activeSession,
  sessions,
}: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [liveNow, setLiveNow] = useState(Date.now())
  const [optimisticSteps, setOptimisticSteps] = useState(steps)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [isEditingDetails, setIsEditingDetails] = useState(false)
const [complexityInput, setComplexityInput] = useState(
  unit.complexity ? String(unit.complexity) : ''
)
const [unitSizeInput, setUnitSizeInput] = useState(
  unit.unit_size ? String(unit.unit_size) : ''
)
const [deadlineInput, setDeadlineInput] = useState(unit.deadline || '')
    useEffect(() => {
    if (!activeSession) {
      return
    }

    const interval = setInterval(() => {
      setLiveNow(Date.now())
    }, 1000)

    const startedAtMs = new Date(activeSession.started_at).getTime()
    const stopAtMs = startedAtMs + 7200 * 1000
    const delay = Math.max(0, stopAtMs - Date.now())

    const timeout = setTimeout(() => {
      startTransition(async () => {
        await expireUnitSessionAtTwoHours(unit.id)
        router.refresh()
      })
    }, delay)

    return () => {
      clearInterval(interval)
      clearTimeout(timeout)
    }
  }, [activeSession, unit.id, router, startTransition])

  const displayedLoggedSeconds = activeSession
    ? totalLoggedSeconds +
      Math.min(
        7200,
        Math.floor((liveNow - new Date(activeSession.started_at).getTime()) / 1000)
      )
    : totalLoggedSeconds

  useEffect(() => {
  setOptimisticSteps(steps)
}, [steps])

const completedCount = optimisticSteps.filter(
  (step) => step.step_key !== 'done' && step.status === 'done'
).length

const handleToggleStep = (step: ProgressStep) => {
  const nextStatus: ProgressStep['status'] =
  step.status === 'done' ? 'pending' : 'done'

  setOptimisticSteps((currentSteps) => {
    const updatedSteps = currentSteps.map((currentStep) =>
      currentStep.id === step.id
        ? {
            ...currentStep,
            status: nextStatus,
            progress: nextStatus === 'done' ? 100 : 0,
          }
        : currentStep
    )

    const visibleSteps = updatedSteps.filter(
      (s) => s.step_key !== 'done'
    )

    const allVisibleDone =
      visibleSteps.length > 0 &&
      visibleSteps.every((s) => s.status === 'done')

    return updatedSteps.map((currentStep) =>
      currentStep.step_key === 'done'
        ? {
            ...currentStep,
            status: allVisibleDone ? 'done' : 'pending',
            progress: allVisibleDone ? 100 : 0,
          }
        : currentStep
    )
  })

  startTransition(async () => {
    const formData = new FormData()

    formData.set('stepId', step.id)
    formData.set('unitId', unit.id)
    formData.set(
      'nextStatus',
      nextStatus
    )

    await toggleStepDone(formData)

    router.refresh()
  })
}

const handleToggleActive = (nextValue: boolean) => {
  startTransition(async () => {
    await toggleUnitActive(unit.id, nextValue)
    router.refresh()
  })
}

const handleUpdateDetails = (formData: FormData) => {
  startTransition(async () => {
    await updateUnitDetails(formData)
    setIsEditingDetails(false)
    router.refresh()
  })
}
  const handleSetFeatured = (imageId: string) => {
    startTransition(async () => {
      await setFeaturedUnitImage(unit.id, imageId)
      router.refresh()
    })
  }

  const handleUploadClick = () => {
    fileInputRef.current?.click()
  }

  const handleFileChange = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0]
    if (!file) {
      return
    }

    const supabase = createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      alert('You must be logged in.')
      return
    }

    const fileExt = file.name.split('.').pop() || 'jpg'
    const filePath = `units/${unit.id}/${crypto.randomUUID()}.${fileExt}`

    const { error: uploadError } = await supabase.storage
      .from('obsidian-images')
      .upload(filePath, file)

    if (uploadError) {
      alert(uploadError.message)
      return
    }

    const { data } = supabase.storage
      .from('obsidian-images')
      .getPublicUrl(filePath)

    const { error: insertError } = await supabase
      .from('image_assets')
      .insert({
        entity_type: 'unit',
        entity_id: unit.id,
        image_url: data.publicUrl,
        user_id: user.id,
        storage_bucket: 'obsidian-images',
        storage_path: filePath,
        is_featured: images.length === 0,
        sort_order: 0,
      })

    if (insertError) {
      alert(insertError.message)
      return
    }

    event.target.value = ''
    router.refresh()
  }

  return (
  <div className="w-full">
      <div className="relative">
        <div className="relative h-[260px] w-full overflow-hidden">
          {featuredImage ? (
            <Image
              src={featuredImage.image_url}
              alt={featuredImage.alt_text || unit.name}
              fill
              className="object-cover opacity-50"
            />
          ) : (
            <div className="h-full w-full bg-[#0b1622]" />
          )}

          <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-black/20 to-[#050b12]" />
        </div>

        <div className="absolute inset-x-0 top-0 z-10 flex items-center justify-between px-4 pt-4">
  <Link
    href={unit.project_id ? `/projects/${unit.project_id}` : '/projects'}
    className="text-sm text-cyan-400"
  >
    ← Back
  </Link>

  <button
            type="button"
            onClick={() => handleToggleActive(!unit.is_active)}
            className={`rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-wide ${
              unit.is_active
                ? 'bg-cyan-400 text-black'
                : 'bg-white/10 text-white'
            }`}
            disabled={isPending}
          >
            {unit.is_active ? 'Active' : 'Inactive'}
          </button>
        </div>

        <div className="absolute inset-x-0 bottom-0 z-10 px-4 pb-6">
          <p className="text-xs uppercase tracking-[0.25em] text-cyan-400">
            Unit Details
          </p>
          <h1 className="mt-2 text-4xl font-bold leading-tight">
            {unit.name}
          </h1>
        </div>
      </div>

      <div>
        <div className="-mt-2">
  <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
  <div className="mb-3 flex items-center justify-between">
    <div className="text-[11px] uppercase tracking-wide text-white/50">
      Unit Details
    </div>

    {!isEditingDetails ? (
      <button
        type="button"
        onClick={() => setIsEditingDetails(true)}
        className="text-xs text-cyan-400"
      >
        Edit
      </button>
    ) : (
      <button
        type="button"
        onClick={() => {
          setIsEditingDetails(false)
          setComplexityInput(unit.complexity ? String(unit.complexity) : '')
          setUnitSizeInput(unit.unit_size ? String(unit.unit_size) : '')
          setDeadlineInput(unit.deadline || '')
        }}
        className="text-xs text-white/60"
      >
        Cancel
      </button>
    )}
  </div>

  {!isEditingDetails ? (
    <div className="grid grid-cols-3 gap-3">
  <div>
    <div className="text-[11px] text-white/50">Complexity</div>
    <div className="text-lg font-bold">
      {unit.complexity ? `${unit.complexity}/5` : '—'}
    </div>
  </div>

  <div>
    <div className="text-[11px] text-white/50">Unit Size</div>
    <div className="text-lg font-bold">
      {unit.unit_size || '—'}
    </div>
  </div>

  <div>
    <div className="text-[11px] text-white/50">Deadline</div>
    <div className="text-lg font-bold">
      {unit.deadline ? new Date(unit.deadline).toLocaleDateString() : '—'}
    </div>
  </div>
</div>
  ) : (
    <form action={handleUpdateDetails} className="space-y-3">
      <input type="hidden" name="unitId" value={unit.id} />

      <div>
        <label className="text-xs text-white/50">Complexity (1–5)</label>
        <input
          name="complexity"
          type="number"
          min="1"
          max="5"
          value={complexityInput}
          onChange={(e) => setComplexityInput(e.target.value)}
          className="mt-1 w-full rounded-lg bg-black/40 px-3 py-2 text-sm text-white"
        />
      </div>

      <div>
        <label className="text-xs text-white/50">Unit Size</label>
        <input
          name="unit_size"
          type="number"
          min="1"
          value={unitSizeInput}
          onChange={(e) => setUnitSizeInput(e.target.value)}
          className="mt-1 w-full rounded-lg bg-black/40 px-3 py-2 text-sm text-white"
        />
      </div>
<div>
  <label className="text-xs text-white/50">Deadline</label>
  <input
    name="deadline"
    type="date"
    value={deadlineInput}
    onChange={(e) => setDeadlineInput(e.target.value)}
    className="mt-1 w-full rounded-lg bg-black/40 px-3 py-2 text-sm text-white"
  />
</div>
      <button
        type="submit"
        disabled={isPending}
        className="w-full rounded-xl bg-cyan-400 px-4 py-2 text-sm font-bold text-black"
      >
        Save Changes
      </button>
    </form>
  )}
</div>
        </div>


<UnitSessionTracker
  unitId={unit.id}
  activeSession={activeSession}
  sessions={sessions}
  totalLoggedSeconds={displayedLoggedSeconds}
/>

        <section className="mt-8">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-2xl font-bold">Progress Stages</h2>
            <span className="text-sm text-cyan-400">
              {completedCount}/{steps.length}
            </span>
          </div>

          {(() => {
  const visibleSteps = optimisticSteps
    .filter((s) => s.step_key !== 'done')
    .sort((a, b) => a.step_order - b.step_order)

  const doneStepIdsInOrder = visibleSteps
    .filter((s) => s.status === 'done')
    .map((s) => s.id)

const finalDoneStep = optimisticSteps.find(
  (s) => s.step_key === 'done'
)
const showFinalDone = finalDoneStep?.status === 'done'
  return (
    <div className="space-y-3">
      {visibleSteps.map((step) => {
        const isDone = step.status === 'done'
        const doneIndex = doneStepIdsInOrder.indexOf(step.id)
        const percent = isDone ? (doneIndex + 1) * 20 : 0

        return (
          <div key={step.id}>
  <button
    type="button"
    onClick={() => handleToggleStep(step)}
    disabled={isPending}
    className="flex w-full items-center gap-4 rounded-2xl bg-neutral-900 px-4 py-4 transition-all disabled:opacity-60"
  >
              <div
                className={`flex h-12 w-12 items-center justify-center rounded-2xl border ${
                  isDone
                    ? 'border-cyan-400 bg-cyan-400 text-black'
                    : 'border-neutral-700 bg-neutral-950 text-neutral-500'
                }`}
              >
                {isDone ? '✓' : '○'}
              </div>

              <div className="flex-1 text-left">
                <p className={isDone ? 'font-semibold text-white' : 'text-neutral-400'}>
                  {step.step_label}
                </p>
              </div>

              <div className={isDone ? 'font-semibold text-cyan-400' : 'text-neutral-500'}>
                {percent}%
              </div>
              </button>
</div>
        )
      })}
            {showFinalDone && (
        <div className="flex w-full items-center gap-4 rounded-2xl bg-cyan-400 px-4 py-4 text-black">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-black/20 bg-black/10">
            ✓
          </div>

          <div className="flex-1 text-left">
            <p className="font-semibold">
              {finalDoneStep?.step_label || 'Done'}
            </p>
          </div>

          <div className="font-semibold">
            100%
          </div>
        </div>
      )}
    </div>
  )
})()}
        </section>
<section className="mt-6">
  <ProjectPaletteCard
    theme={projectTheme}
    projectId={unit.project_id || ''}
  />
</section>
        <section className="mt-10">
          <div className="mb-2 flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold">Inspiration & Art Gallery</h2>
              <p className="text-sm text-white/50">
                Concept art and reference images
              </p>
            </div>

            <button
              type="button"
              onClick={handleUploadClick}
              className="text-sm font-semibold uppercase tracking-wide text-cyan-400"
            >
              Add Image +
            </button>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileChange}
          />

          <div className="mt-4 grid grid-cols-2 gap-4">
            {images.map((image) => (
              <button
                key={image.id}
                type="button"
                onClick={() => handleSetFeatured(image.id)}
                className={`group relative aspect-square overflow-hidden rounded-2xl border ${
                  image.is_featured
                    ? 'border-cyan-400 shadow-[0_0_20px_rgba(34,211,238,0.2)]'
                    : 'border-white/10'
                }`}
              >
                <Image
                  src={image.image_url}
                  alt={image.alt_text || unit.name}
                  fill
                  className="object-cover transition group-hover:scale-105"
                />

                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />

                {image.is_featured && (
                  <div className="absolute left-2 top-2 rounded-full bg-cyan-400 px-2 py-1 text-[10px] font-bold uppercase text-black">
                    Featured
                  </div>
                )}

                <div className="absolute bottom-2 left-2 text-xs font-semibold text-white">
                  {image.is_featured ? 'Main Thumbnail' : 'Set as featured'}
                </div>
              </button>
            ))}

            <button
              type="button"
              onClick={handleUploadClick}
              className="flex aspect-square items-center justify-center rounded-2xl border border-dashed border-white/20 bg-white/[0.03] text-sm font-medium text-white/60"
            >
              Upload Reference
            </button>
                    </div>
        </section>
      </div>
    </div>
  )
}