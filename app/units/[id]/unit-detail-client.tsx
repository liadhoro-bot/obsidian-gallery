'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import type { ChangeEvent } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import {
  deleteUnitImage,
  deleteUnit,
  expireUnitSessionAtTwoHours,
  removePaintFromStage,
  setFeaturedUnitImage,
  toggleStepDone,
  updateUnitDetails,
} from './actions'
import { createClient } from '../../../utils/supabase/client'
import UnitSessionTracker from './components/unit-session-tracker'
import ProjectPaletteCard from '../../projects/[id]/project-palette-card'
import GalleryImageCard from '@/app/components/gallery/gallery-image-card'
import StagePaintPicker from './components/stage-paint-picker'
import DeleteConfirmationCard from '../../components/delete-confirmation-card'

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
type StagePaint = {
  id: string
  unit_id: string
  progress_step_id: string
  paint_source: 'catalog' | 'custom'
  paint_catalog_id: string | null
  custom_paint_id: string | null
  sort_order: number | null
  catalog_paint?: {
    id: string
    name: string | null
    brand: string | null
    line: string | null
    hex_approx: string | null
    swatch_image_url: string | null
  } | null
  custom_paint?: {
    id: string
    name: string | null
    manufacturer: string | null
    series: string | null
    color_hex: string | null
  } | null
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

type Props = {
  unit: Unit
  projectTheme: Theme
  images: UnitImage[]
  steps: ProgressStep[]
  totalLoggedSeconds: number
  activeSession: Session | null
  sessions: Session[]
  stagePaints: StagePaint[]
}

function BrushIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none">
      <path
        d="M14 4.5L19.5 10L10 19.5C8.7 20.8 6.6 20.8 5.3 19.5C4 18.2 4 16.1 5.3 14.8L14 4.5Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path
        d="M13 6L18 11"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  )
}

function SprayIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none">
      <path
        d="M9 4H15V7H9V4Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path
        d="M8 7H16L17 20H7L8 7Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path
        d="M10 11H14"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  )
}

function PaletteIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none">
      <path
        d="M12 4C7.6 4 4 7.1 4 11C4 15.2 7.8 20 12.4 20C14.1 20 14.8 19.1 14.8 18.1C14.8 17.4 14.4 16.8 14.4 16.1C14.4 15 15.3 14.4 16.5 14.4H17.4C19 14.4 20 13.4 20 11.9C20 7.6 16.5 4 12 4Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path d="M8.3 11H8.4" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
      <path d="M10.5 8H10.6" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
      <path d="M14 8.4H14.1" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  )
}

function SparkIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none">
      <path
        d="M12 3L13.8 9.2L20 11L13.8 12.8L12 19L10.2 12.8L4 11L10.2 9.2L12 3Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path
        d="M18 16L18.8 18.2L21 19L18.8 19.8L18 22L17.2 19.8L15 19L17.2 18.2L18 16Z"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function BaseIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none">
      <path
        d="M7 10L12 7L17 10V16L12 19L7 16V10Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path
        d="M7 10L12 13L17 10"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path
        d="M12 13V19"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  )
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none">
      <path
        d="M5 12.5L9.2 16.7L19 7"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function StageIcon({
  stepKey,
  isDone,
}: {
  stepKey: string
  isDone: boolean
}) {
  const icon =
    stepKey === 'assembled' ? (
      <BrushIcon />
    ) : stepKey === 'primed' ? (
      <SprayIcon />
    ) : stepKey === 'initial_paints' ? (
      <PaletteIcon />
    ) : stepKey === 'fine_details' ? (
      <SparkIcon />
    ) : stepKey === 'base_rim' ? (
      <BaseIcon />
    ) : (
      <CheckIcon />
    )

  return (
    <div
      className={`flex h-12 w-12 items-center justify-center rounded-2xl border transition ${
        isDone
          ? 'border-cyan-400 bg-cyan-400 text-black shadow-[0_0_20px_rgba(34,211,238,0.3)]'
          : 'border-white/10 bg-white/[0.04] text-white/35'
      }`}
    >
      {icon}
    </div>
  )
}

export default function UnitDetailClient({
  unit,
  projectTheme,
  images,
  steps,
  totalLoggedSeconds,
  activeSession,
  sessions,
  stagePaints,
}: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [liveNow, setLiveNow] = useState(() => Date.now())
  const [optimisticSteps, setOptimisticSteps] = useState(steps)
  const [activeTab, setActiveTab] = useState<'overview' | 'progress'>(
    'overview'
  )
  const [openStageId, setOpenStageId] = useState<string | null>(null)
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

  useEffect(() => {
    setOptimisticSteps(steps)
  }, [steps])

  const displayedLoggedSeconds = activeSession
    ? totalLoggedSeconds +
      Math.min(
        7200,
        Math.floor(
          (liveNow - new Date(activeSession.started_at).getTime()) / 1000
        )
      )
    : totalLoggedSeconds

  const completedCount = optimisticSteps.filter(
    (step) => step.status === 'done'
  ).length

  const sortedSteps = [...optimisticSteps].sort(
    (a, b) => a.step_order - b.step_order
  )

  const handleToggleStep = (step: ProgressStep) => {
    if (step.step_key === 'done') {
      return
    }

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
      formData.set('nextStatus', nextStatus)

      await toggleStepDone(formData)

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

const handleRemoveStagePaint = (stagePaintId: string) => {
  startTransition(async () => {
    const formData = new FormData()

    formData.set('unitId', unit.id)
    formData.set('stagePaintId', stagePaintId)

    await removePaintFromStage(formData)

    router.refresh()
  })
}
const handleRemoveStagePhoto = (imageId: string) => {
  startTransition(async () => {
    const formData = new FormData()

    formData.set('unitId', unit.id)
    formData.set('imageId', imageId)

    await deleteUnitImage(formData)

    router.refresh()
  })
}

  const handleUploadClick = () => {
    fileInputRef.current?.click()
  }

  const uploadUnitImage = async ({
    file,
    altText,
    makeFeaturedIfEmpty,
  }: {
    file: File
    altText: string | null
    makeFeaturedIfEmpty: boolean
  }) => {
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
        is_featured: makeFeaturedIfEmpty && images.length === 0,
        sort_order: 0,
        alt_text: altText,
      })

    if (insertError) {
      alert(insertError.message)
      return
    }

    router.refresh()
  }

  const handleFileChange = async (
    event: ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0]

    if (!file) {
      return
    }

    await uploadUnitImage({
      file,
      altText: null,
      makeFeaturedIfEmpty: true,
    })

    event.target.value = ''
  }

  const handleStageFileChange = async (
    event: ChangeEvent<HTMLInputElement>,
    step: ProgressStep
  ) => {
    const file = event.target.files?.[0]

    if (!file) {
      return
    }

    await uploadUnitImage({
      file,
      altText: `stage:${step.step_key}`,
      makeFeaturedIfEmpty: true,
    })

    event.target.value = ''
  }

  return (
    <div className="w-full">

      <div className="mt-4 grid gap-5">
  <div className="grid grid-cols-2 rounded-2xl border border-white/10 bg-slate-950/70 p-1 shadow-[0_0_24px_rgba(34,211,238,0.08)]">
    {[
      { key: 'overview' as const, label: 'Overview' },
      { key: 'progress' as const, label: 'Progress' },
    ].map((tab) => {
      const isActive = activeTab === tab.key

      return (
        <button
          key={tab.key}
          type="button"
          onClick={() => setActiveTab(tab.key)}
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
</div>

      {activeTab === 'overview' && (
        <div>
          <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-4">
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
                    setComplexityInput(
                      unit.complexity ? String(unit.complexity) : ''
                    )
                    setUnitSizeInput(
                      unit.unit_size ? String(unit.unit_size) : ''
                    )
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
                  <div className="text-[11px] text-white/50">
                    Complexity
                  </div>
                  <div className="text-lg font-bold">
                    {unit.complexity ? `${unit.complexity}/5` : '—'}
                  </div>
                </div>

                <div>
                  <div className="text-[11px] text-white/50">
                    Unit Size
                  </div>
                  <div className="text-lg font-bold">
                    {unit.unit_size || '—'}
                  </div>
                </div>

                <div>
                  <div className="text-[11px] text-white/50">
                    Deadline
                  </div>
                  <div className="text-lg font-bold">
                    {unit.deadline
                      ? new Date(unit.deadline).toLocaleDateString()
                      : '—'}
                  </div>
                </div>
              </div>
            ) : (
              <form action={handleUpdateDetails} className="space-y-3">
                <input type="hidden" name="unitId" value={unit.id} />

                <div>
                  <label className="text-xs text-white/50">
                    Complexity 1–5
                  </label>
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
                  <label className="text-xs text-white/50">
                    Unit Size
                  </label>
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
                  <label className="text-xs text-white/50">
                    Deadline
                  </label>
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

          <UnitSessionTracker
            unitId={unit.id}
            activeSession={activeSession}
            sessions={sessions}
            totalLoggedSeconds={displayedLoggedSeconds}
          />

          <section className="mt-6">
            <ProjectPaletteCard
              theme={projectTheme}
              projectId={unit.project_id || ''}
            />
          </section>

          <section className="mt-10">
            <div className="mb-2 flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold">
                  Inspiration & Art Gallery
                </h2>
                <p className="text-sm text-white/50">
                  Concept art, stage photos, and reference images
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
                <GalleryImageCard
                  key={image.id}
                  image={image}
                  canEdit={true}
                  onToggleFeatured={async (imageId) => {
                    handleSetFeatured(imageId)
                  }}
                />
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
      )}

      {activeTab === 'progress' && (
        <section className="mt-5">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-black">Progress Stages</h2>
              <p className="text-sm text-white/45">
                Track recipes, photos, and paints per stage.
              </p>
            </div>

            <span className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-xs font-bold text-cyan-300">
              {completedCount}/{optimisticSteps.length}
            </span>
          </div>

          <div className="space-y-3">
            {sortedSteps.map((step) => {
              const isDone = step.status === 'done'
              const isOpen = openStageId === step.id
              const stagePhoto = images.find(
                (image) => image.alt_text === `stage:${step.step_key}`
              )
const paintsForStage = stagePaints
  .filter((paint) => paint.progress_step_id === step.id)
  .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
              return (
                <div
                  key={step.id}
                  className={`overflow-hidden rounded-2xl border transition ${
                    isDone
                      ? 'border-cyan-400/40 bg-cyan-400/[0.07]'
                      : 'border-white/10 bg-white/[0.035]'
                  }`}
                >
                  <div className="flex items-center gap-4 p-4">
                    <button
                      type="button"
                      onClick={() => handleToggleStep(step)}
                      disabled={isPending || step.step_key === 'done'}
                      className="shrink-0 disabled:opacity-80"
                      aria-label={`Toggle ${step.step_label}`}
                    >
                      <StageIcon stepKey={step.step_key} isDone={isDone} />
                    </button>

                    <div className="min-w-0 flex-1">
  <div
    className={`text-base font-black ${
      isDone ? 'text-white' : 'text-white/55'
    }`}
  >
    {step.step_label}
  </div>

  <div className="mt-1 text-xs uppercase tracking-[0.16em] text-white/30">
    {isDone ? 'Complete' : 'Not complete'}
  </div>

  {paintsForStage.length > 0 ? (
    <div className="mt-2 flex -space-x-1.5">
      {paintsForStage.slice(0, 5).map((paint) => {
        const displayHex =
          paint.paint_source === 'custom'
            ? paint.custom_paint?.color_hex
            : paint.catalog_paint?.hex_approx

        const imageUrl =
          paint.paint_source === 'custom'
            ? null
            : paint.catalog_paint?.swatch_image_url

        return imageUrl ? (
          <Image
            key={paint.id}
            src={imageUrl}
            alt="Paint"
            width={24}
            height={24}
            sizes="24px"
            className="h-6 w-6 rounded-full border border-[#07111b] object-cover"
          />
        ) : (
          <div
            key={paint.id}
            className="h-6 w-6 rounded-full border border-[#07111b]"
            style={{ backgroundColor: displayHex || '#262626' }}
          />
        )
      })}

      {paintsForStage.length > 5 ? (
        <div className="flex h-6 w-6 items-center justify-center rounded-full border border-[#07111b] bg-white/10 text-[10px] font-black text-white/70">
          +{paintsForStage.length - 5}
        </div>
      ) : null}
    </div>
  ) : null}
</div>

                    {stagePhoto ? (
                      <div className="relative h-12 w-12 overflow-hidden rounded-xl border border-white/10 bg-black/30">
                        <Image
                          src={stagePhoto.image_url}
                          alt={stagePhoto.alt_text || step.step_label}
                          fill
                          sizes="48px"
                          className="object-cover"
                        />
                      </div>
                    ) : null}

                    <button
                      type="button"
                      onClick={() =>
                        setOpenStageId(isOpen ? null : step.id)
                      }
                      className="flex h-10 w-10 items-center justify-center rounded-xl border border-cyan-400/30 bg-cyan-400/10 text-2xl font-light leading-none text-cyan-300"
                      aria-label="Add stage details"
                    >
                      +
                    </button>
                  </div>

                  {isOpen && (
                    <div className="border-t border-white/10 bg-black/20 p-4">
                      <div className="space-y-4">
                        <div>
  <label className="text-xs font-bold uppercase tracking-[0.16em] text-white/40">
    Paints Used
  </label>

  {stagePaints.filter((paint) => paint.progress_step_id === step.id).length > 0 ? (
    <div className="mt-2 grid grid-cols-5 gap-2">
      {stagePaints
        .filter((paint) => paint.progress_step_id === step.id)
        .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
        .map((paint) => {
          const displayName =
            paint.paint_source === 'custom'
              ? paint.custom_paint?.name
              : paint.catalog_paint?.name

          const displayMeta =
            paint.paint_source === 'custom'
              ? [paint.custom_paint?.manufacturer, paint.custom_paint?.series]
                  .filter(Boolean)
                  .join(' · ')
              : [paint.catalog_paint?.brand, paint.catalog_paint?.line]
                  .filter(Boolean)
                  .join(' · ')

          const displayHex =
            paint.paint_source === 'custom'
              ? paint.custom_paint?.color_hex
              : paint.catalog_paint?.hex_approx

          const imageUrl =
            paint.paint_source === 'custom'
              ? null
              : paint.catalog_paint?.swatch_image_url

          return (
            <div
              key={paint.id}
              className="relative min-w-0 rounded-xl border border-white/10 bg-black/25 p-1.5"
            >
              <button
                type="button"
                onClick={() => handleRemoveStagePaint(paint.id)}
                disabled={isPending}
                className="absolute right-1 top-1 z-10 flex h-5 w-5 items-center justify-center rounded-full bg-black/75 text-[10px] font-black text-white/70"
                aria-label="Remove paint"
              >
                ×
              </button>

              {imageUrl ? (
                <Image
                  src={imageUrl}
                  alt={displayName || 'Paint swatch'}
                  width={96}
                  height={96}
                  sizes="64px"
                  className="aspect-square w-full rounded-lg border border-white/10 object-cover"
                />
              ) : (
                <div
                  className="aspect-square w-full rounded-lg border border-white/10"
                  style={{ backgroundColor: displayHex || '#262626' }}
                />
              )}

              <div className="mt-1 truncate text-[10px] font-black leading-tight text-white">
                {displayName || 'Unnamed paint'}
              </div>

              <div className="mt-0.5 truncate text-[9px] leading-tight text-white/35">
                {displayMeta || paint.paint_source}
              </div>
            </div>
          )
        })}
    </div>
  ) : (
    <p className="mt-2 rounded-xl border border-white/10 bg-black/20 p-3 text-xs text-white/35">
      No paints added to this stage yet.
    </p>
  )}

  <StagePaintPicker unitId={unit.id} progressStepId={step.id} />
</div>

                        <div>
                          <label className="text-xs font-bold uppercase tracking-[0.16em] text-white/40">
                            Stage Photo
                          </label>

                          <input
                            id={`stage-photo-${step.id}`}
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(event) =>
                              handleStageFileChange(event, step)
                            }
                          />

                          <label
                            htmlFor={`stage-photo-${step.id}`}
                            className="mt-2 flex w-full cursor-pointer items-center justify-center rounded-xl border border-dashed border-white/15 bg-white/[0.03] px-3 py-5 text-sm font-semibold text-white/50"
                          >
                            Upload Stage Photo +
                          </label>

                          {stagePhoto ? (
  <div className="mt-3 flex items-center gap-3 rounded-xl border border-white/10 bg-black/30 p-2">
    <div className="relative h-14 w-14 overflow-hidden rounded-lg bg-black">
      <Image
        src={stagePhoto.image_url}
        alt={stagePhoto.alt_text || step.step_label}
        fill
        className="object-cover"
      />
    </div>

    <div className="min-w-0 flex-1">
      <div className="text-sm font-bold text-white">
        Stage photo added
      </div>
      <div className="text-xs text-white/40">
        Also appears in the unit gallery.
      </div>
    </div>

    <button
      type="button"
      onClick={() => handleRemoveStagePhoto(stagePhoto.id)}
      disabled={isPending}
      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/10 bg-black/60 text-sm font-black text-white/70 transition hover:border-red-400/40 hover:bg-red-500/10 hover:text-red-300 disabled:opacity-50"
      aria-label="Remove stage photo"
    >
      ×
    </button>
  </div>
) : null}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </section>
      )}

      <div className="mt-5">
        <DeleteConfirmationCard
          itemId={unit.id}
          itemIdFieldName="unitId"
          title="Delete Unit"
          buttonLabel="Delete This Unit"
          initialDescription="Permanently delete this unit from your gallery."
          confirmDescription="If you delete this unit, it will be removed along with all the progress, sessions, paints, recipes, and images it contains. This action cannot be undone."
          deleteAction={deleteUnit}
        />
      </div>
    </div>
  )
}
