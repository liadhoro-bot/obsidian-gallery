'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import type { ChangeEvent } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import dynamic from 'next/dynamic'

const SampleColorFromImageAction = dynamic(
  () => import('@/components/color-sampler/SampleColorFromImageAction'),
  { ssr: false }
)

const StagePaintPicker = dynamic(() => import('./components/stage-paint-picker'), {
  loading: () => (
    <div className="mt-4 h-[54px] rounded-[18px] border border-[#739aaa]/28 bg-[#03141e]/70" />
  ),
})

type ProgressStep = {
  id: string
  step_key: string
  step_label: string
  step_order: number
  status: 'pending' | 'in_progress' | 'done'
  progress: number
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
  is_optimistic?: boolean
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

type StagePaintActionResult =
  | (Omit<StagePaint, 'catalog_paint' | 'custom_paint'> & {
      catalog_paint?: StagePaint['catalog_paint'] | StagePaint['catalog_paint'][]
      custom_paint?: StagePaint['custom_paint'] | StagePaint['custom_paint'][]
    })
  | null

type ExpandedStagePhoto = {
  id: string
  src: string
  alt: string
  label: string
}

type UnitProgressTabProps = {
  unitId: string
  isPending: boolean
  completedCount: number
  totalStepCount: number
  sortedSteps: ProgressStep[]
  localImages: UnitImage[]
  localStagePaints: StagePaint[]
  openStageId: string | null
  uploadingStageId: string | null
  onToggleStep: (step: ProgressStep) => void
  onOpenStageChange: (stageId: string | null) => void
  onStageFileChange: (
    event: ChangeEvent<HTMLInputElement>,
    step: ProgressStep
  ) => void | Promise<void>
  onStagePaintAdded: (
    stagePaint: NonNullable<StagePaintActionResult> | null | undefined
  ) => void
  onRemoveStagePaint: (stagePaintId: string) => void
  onRemoveStagePhoto: (imageId: string) => void
}

function BrushIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-full w-full" fill="none">
      <path
        d="M14 4.5L19.5 10L10 19.5C8.7 20.8 6.6 20.8 5.3 19.5C4 18.2 4 16.1 5.3 14.8L14 4.5Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path d="M13 6L18 11" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  )
}

function SprayIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-full w-full" fill="none">
      <path d="M9 4H15V7H9V4Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M8 7H16L17 20H7L8 7Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M10 11H14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  )
}

function PaletteIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-full w-full" fill="none">
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
    <svg viewBox="0 0 24 24" className="h-full w-full" fill="none">
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
    <svg viewBox="0 0 24 24" className="h-full w-full" fill="none">
      <path d="M7 10L12 7L17 10V16L12 19L7 16V10Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M7 10L12 13L17 10" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M12 13V19" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  )
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-full w-full" fill="none">
      <path d="M5 12.5L9.2 16.7L19 7" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function UploadIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none">
      <path d="M12 16V5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M7.5 9.5L12 5L16.5 9.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M5 15V19H19V15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function CameraIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none">
      <path d="M8.5 7L10 5H14L15.5 7H19V19H5V7H8.5Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      <path d="M12 16A3 3 0 1 0 12 10A3 3 0 0 0 12 16Z" stroke="currentColor" strokeWidth="2" />
    </svg>
  )
}

function ChevronIcon({ direction }: { direction: 'up' | 'down' }) {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none">
      <path
        d={direction === 'up' ? 'M6 15L12 9L18 15' : 'M6 9L12 15L18 9'}
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function StageIcon({ stepKey, className = 'h-6 w-6' }: { stepKey: string; className?: string }) {
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

  return <div className={className}>{icon}</div>
}

function getStagePaintHref(paint: StagePaint) {
  const paintId =
    paint.paint_source === 'custom'
      ? paint.custom_paint_id || paint.custom_paint?.id
      : paint.paint_catalog_id || paint.catalog_paint?.id

  return paintId ? `/vault/${paint.paint_source}/${paintId}` : null
}

export default function UnitProgressTab({
  unitId,
  isPending,
  completedCount,
  totalStepCount,
  sortedSteps,
  localImages,
  localStagePaints,
  openStageId,
  uploadingStageId,
  onToggleStep,
  onOpenStageChange,
  onStageFileChange,
  onStagePaintAdded,
  onRemoveStagePaint,
  onRemoveStagePhoto,
}: UnitProgressTabProps) {
  const [expandedStagePhoto, setExpandedStagePhoto] =
    useState<ExpandedStagePhoto | null>(null)
  const [selectedStageId, setSelectedStageId] = useState(
    openStageId || sortedSteps[0]?.id || ''
  )
  const [isStageExpanded, setIsStageExpanded] = useState(false)
  const nodeRefs = useRef<Record<string, HTMLButtonElement | null>>({})

  useEffect(() => {
    nodeRefs.current[selectedStageId]?.scrollIntoView({
      behavior: 'smooth',
      block: 'nearest',
      inline: 'center',
    })
  }, [selectedStageId])

  const effectiveSelectedStageId =
    selectedStageId || openStageId || sortedSteps[0]?.id || ''

  const selectedStep = useMemo(
    () =>
      sortedSteps.find((step) => step.id === effectiveSelectedStageId) ||
      sortedSteps[0],
    [effectiveSelectedStageId, sortedSteps]
  )

  const selectedStagePhoto = selectedStep
    ? localImages.find(
        (image) => image.alt_text === `stage:${selectedStep.step_key}`
      )
    : null
  const selectedStagePaints = selectedStep
    ? localStagePaints
        .filter((paint) => paint.progress_step_id === selectedStep.id)
        .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
    : []
  const isSelectedUploading = selectedStep
    ? uploadingStageId === selectedStep.id
    : false

  const handleSelectStage = (step: ProgressStep) => {
    setSelectedStageId(step.id)
    setIsStageExpanded(false)
    onOpenStageChange(null)
  }

  const handleToggleExpansion = () => {
    if (!selectedStep) {
      return
    }

    setIsStageExpanded((current) => {
      const next = !current
      onOpenStageChange(next ? selectedStep.id : null)
      return next
    })
  }

  return (
    <>
      <section className="relative mx-auto mt-5 max-w-[470px] overflow-hidden rounded-[26px] bg-[radial-gradient(circle_at_50%_26%,rgba(17,215,244,0.16),transparent_30%),linear-gradient(180deg,#020d19_0%,#03101c_54%,#020a13_100%)] px-4 pb-7 pt-1 text-[#f7f8f7]">
        <div className="pointer-events-none absolute left-1/2 top-36 h-40 w-56 -translate-x-1/2 rounded-full bg-cyan-400/10 blur-3xl" />

        <div className="relative mb-8 mt-4 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-[30px] font-black leading-tight tracking-normal text-white">
              Progress Stages
            </h2>
            <p className="mt-1 text-[15px] leading-5 text-[#9aa9b2]">
              Track guides, photos, and paints per stage.
            </p>
          </div>

          <span className="mt-1 inline-flex h-8 min-w-14 shrink-0 items-center justify-center rounded-full border border-[#078ea8]/70 bg-[#041722]/80 px-3 text-sm font-bold text-[#22e5ff]">
            {completedCount}/{totalStepCount}
          </span>
        </div>

        <div className="relative mb-7 overflow-visible pb-1 pt-3">
          <div className="relative grid w-full grid-cols-6 items-start gap-0">
            <div className="absolute left-[8.333%] right-[8.333%] top-[calc(0.75rem+clamp(20px,6vw,28px))] h-0.5 bg-[#11d7f4]/80 shadow-[0_0_12px_rgba(17,215,244,0.55)]" />

            {sortedSteps.map((step) => {
              const isDone = step.status === 'done'
              const isSelected = selectedStep?.id === step.id

              return (
                <button
                  key={step.id}
                  ref={(node) => {
                    nodeRefs.current[step.id] = node
                  }}
                  type="button"
                  onClick={() => handleSelectStage(step)}
                  className="tap-press group relative z-10 flex min-h-[112px] min-w-0 flex-col items-center text-center outline-none focus-visible:ring-2 focus-visible:ring-[#22e5ff]/80"
                  aria-pressed={isSelected}
                  aria-label={`Select ${step.step_label} stage`}
                >
                  <span
                    className={[
                      'relative flex items-center justify-center rounded-full border-2 transition duration-200 motion-reduce:transition-none',
                      isSelected
                        ? 'h-[clamp(48px,14vw,64px)] w-[clamp(48px,14vw,64px)] border-[#22e5ff] bg-[radial-gradient(circle_at_50%_45%,rgba(34,229,255,0.78),rgba(8,117,138,0.42)_48%,rgba(4,29,41,0.98)_76%)] text-white shadow-[0_0_0_3px_rgba(17,215,244,0.12),0_0_18px_rgba(17,215,244,0.62),inset_0_0_18px_rgba(17,215,244,0.24)] min-[430px]:shadow-[0_0_0_4px_rgba(17,215,244,0.12),0_0_22px_rgba(17,215,244,0.68),inset_0_0_18px_rgba(17,215,244,0.24)]'
                        : 'mt-1 h-[clamp(40px,12vw,56px)] w-[clamp(40px,12vw,56px)] border-[#11d7f4] bg-[#04202b] text-[#22e5ff] shadow-[inset_0_0_14px_rgba(17,215,244,0.08)] group-hover:shadow-[0_0_16px_rgba(17,215,244,0.28)]',
                    ].join(' ')}
                  >
                    {isSelected ? (
                      <span className="pointer-events-none absolute -inset-1.5 rounded-full border border-[#11d7f4]/45 min-[430px]:-inset-2" />
                    ) : null}
                    <StageIcon
                      stepKey={step.step_key}
                      className="h-[clamp(19px,5.8vw,28px)] w-[clamp(19px,5.8vw,28px)]"
                    />
                    {isDone ? (
                      <span className="absolute -right-0.5 -top-0.5 flex h-[clamp(16px,4.8vw,20px)] w-[clamp(16px,4.8vw,20px)] items-center justify-center rounded-full border border-[#b8fbff] bg-[#12697a] p-0.5 text-white shadow-[0_0_8px_rgba(17,215,244,0.5)] min-[430px]:-right-1 min-[430px]:-top-1">
                        <CheckIcon />
                      </span>
                    ) : null}
                  </span>

                  <span
                    className={[
                      'mt-3 min-h-9 w-full px-0.5 text-[clamp(9px,2.85vw,13px)] font-medium leading-tight transition min-[430px]:mt-4',
                      isSelected ? 'font-black text-[#22e5ff]' : 'text-white/78',
                    ].join(' ')}
                  >
                    {step.step_label}
                  </span>
                  <span
                    className={[
                      'mt-2 h-1 w-[min(48px,72%)] rounded-full transition',
                      isSelected ? 'bg-[#22e5ff]' : 'bg-transparent',
                    ].join(' ')}
                  />
                </button>
              )
            })}
          </div>
        </div>

        {selectedStep ? (
          <div className="relative overflow-hidden rounded-[22px] border border-[#078ea8]/90 bg-[radial-gradient(circle_at_35%_0%,rgba(17,215,244,0.13),transparent_38%),rgba(4,29,41,0.94)] p-5 shadow-[0_0_24px_rgba(17,215,244,0.12)]">
            <div className="flex items-center gap-4">
              <div className="flex h-[68px] w-[68px] shrink-0 items-center justify-center rounded-[20px] bg-[linear-gradient(135deg,rgba(17,215,244,0.28),rgba(4,29,41,0.78))] text-white shadow-[inset_0_0_20px_rgba(17,215,244,0.12)]">
                <StageIcon stepKey={selectedStep.step_key} className="h-9 w-9" />
              </div>

              <div className="min-w-0 flex-1">
                <h3 className="truncate text-2xl font-black leading-tight text-white">
                  {selectedStep.step_label}
                </h3>
                <button
                  type="button"
                  onClick={() => onToggleStep(selectedStep)}
                  disabled={isPending || selectedStep.step_key === 'done'}
                  className="tap-press mt-3 inline-flex items-center gap-2 text-[13px] font-black uppercase tracking-[0.28em] text-[#22e5ff] transition disabled:cursor-not-allowed disabled:opacity-70"
                  aria-label={`Toggle ${selectedStep.step_label} completion`}
                >
                  <span
                    className={[
                      'flex h-5 w-5 items-center justify-center rounded-full border p-0.5',
                      selectedStep.status === 'done'
                        ? 'border-[#22e5ff] bg-[#041722]'
                        : 'border-[#718895] bg-transparent',
                    ].join(' ')}
                  >
                    {selectedStep.status === 'done' ? <CheckIcon /> : null}
                  </span>
                  {selectedStep.status === 'done' ? 'Complete' : 'Mark Complete'}
                </button>
              </div>

              <button
                type="button"
                onClick={handleToggleExpansion}
                className="tap-press flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[#078ea8]/80 bg-[#03141e]/70 text-[#22e5ff] transition hover:border-[#22e5ff] focus:outline-none focus:ring-2 focus:ring-[#22e5ff]/70"
                aria-expanded={isStageExpanded}
                aria-label={`${isStageExpanded ? 'Collapse' : 'Expand'} ${selectedStep.step_label} stage`}
              >
                <ChevronIcon direction={isStageExpanded ? 'up' : 'down'} />
              </button>
            </div>

            {!isStageExpanded ? (
              <p className="ml-[84px] mt-1 text-sm text-[#9aa9b2]">
                Tap to manage paints and photos
              </p>
            ) : null}

            <div
              className={[
                'grid transition-[grid-template-rows,opacity,transform] duration-200 motion-reduce:transition-none',
                isStageExpanded
                  ? 'mt-5 grid-rows-[1fr] translate-y-0 opacity-100'
                  : 'grid-rows-[0fr] -translate-y-1 opacity-0',
              ].join(' ')}
            >
              <div className="min-h-0 overflow-hidden">
                <div className="border-t border-[#739aaa]/20 pt-6">
                  <div>
                    <div className="text-[13px] font-black uppercase tracking-[0.28em] text-[#9aa9b2]">
                      Paints Used
                    </div>

                    {selectedStagePaints.length > 0 ? (
                      <div className="mt-4 grid grid-cols-3 gap-2">
                        {selectedStagePaints.map((paint) => {
                          const displayName =
                            paint.paint_source === 'custom'
                              ? paint.custom_paint?.name
                              : paint.catalog_paint?.name
                          const displayMeta =
                            paint.paint_source === 'custom'
                              ? [
                                  paint.custom_paint?.manufacturer,
                                  paint.custom_paint?.series,
                                ]
                                  .filter(Boolean)
                                  .join(' / ')
                              : [paint.catalog_paint?.brand, paint.catalog_paint?.line]
                                  .filter(Boolean)
                                  .join(' / ')
                          const displayHex =
                            paint.paint_source === 'custom'
                              ? paint.custom_paint?.color_hex
                              : paint.catalog_paint?.hex_approx
                          const imageUrl =
                            paint.paint_source === 'custom'
                              ? null
                              : paint.catalog_paint?.swatch_image_url
                          const paintHref = getStagePaintHref(paint)
                          const swatch = imageUrl ? (
                            <Image
                              src={imageUrl}
                              alt={displayName || 'Paint swatch'}
                              width={160}
                              height={160}
                              sizes="(max-width: 430px) 30vw, 128px"
                              className="aspect-square w-full rounded-lg border border-white/10 object-cover"
                            />
                          ) : (
                            <div
                              className="aspect-square w-full rounded-lg border border-white/10"
                              style={{ backgroundColor: displayHex || '#262626' }}
                            />
                          )

                          return (
                            <div
                              key={paint.id}
                              className="relative min-w-0 rounded-xl border border-[#739aaa]/25 bg-[#03141e]/75 p-2"
                            >
                              <button
                                type="button"
                                onClick={() => onRemoveStagePaint(paint.id)}
                                disabled={isPending}
                                className="tap-press absolute right-1 top-1 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-black/75 text-[10px] font-black text-white/70"
                                aria-label="Remove paint"
                              >
                                x
                              </button>

                              {paintHref ? (
                                <Link
                                  href={paintHref}
                                  className="tap-card block rounded-lg hover:ring-2 hover:ring-cyan-300/60 focus:outline-none focus:ring-2 focus:ring-cyan-300/70"
                                  aria-label={`Open ${displayName || 'paint'} details`}
                                >
                                  {swatch}
                                </Link>
                              ) : (
                                swatch
                              )}

                              <div className="mt-1.5 truncate text-[11px] font-black leading-tight text-white">
                                {displayName || 'Unnamed paint'}
                              </div>
                              <div className="mt-0.5 truncate text-[10px] leading-tight text-white/40">
                                {displayMeta || paint.paint_source}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    ) : (
                      <p className="mt-4 flex min-h-[54px] items-center rounded-[18px] border border-[#739aaa]/28 bg-[#03141e]/70 px-4 text-sm text-[#9aa9b2]">
                        No paints added to this stage yet.
                      </p>
                    )}

                    <StagePaintPicker
                      unitId={unitId}
                      progressStepId={selectedStep.id}
                      onPaintAdded={onStagePaintAdded}
                      triggerClassName="tap-press mt-4 flex min-h-[54px] w-full items-center justify-between rounded-[18px] border border-[#739aaa]/28 bg-transparent px-4 text-left text-base font-medium text-white transition hover:border-[#22e5ff]/65 hover:bg-cyan-400/10 focus:outline-none focus:ring-2 focus:ring-[#22e5ff]/60"
                    />
                  </div>

                  <div className="mt-8">
                    <div className="text-[13px] font-black uppercase tracking-[0.28em] text-[#9aa9b2]">
                      Stage Photo
                    </div>

                    <input
                      id={`stage-photo-${selectedStep.id}`}
                      type="file"
                      accept="image/*"
                      disabled={isSelectedUploading}
                      className="hidden"
                      onChange={(event) => onStageFileChange(event, selectedStep)}
                    />
                    <input
                      id={`stage-photo-camera-${selectedStep.id}`}
                      type="file"
                      accept="image/*"
                      capture="environment"
                      disabled={isSelectedUploading}
                      className="hidden"
                      onChange={(event) => onStageFileChange(event, selectedStep)}
                    />

                    <div className="mt-4 grid grid-cols-1 gap-3 min-[390px]:grid-cols-2">
                      <label
                        htmlFor={`stage-photo-${selectedStep.id}`}
                        className={`tap-press mobile-upload-action flex min-h-[58px] cursor-pointer items-center justify-center gap-3 overflow-hidden rounded-[18px] border px-3 text-center text-sm font-black ${
                          isSelectedUploading
                            ? 'stage-photo-loading-pattern cursor-wait border-cyan-300/35 bg-cyan-300/[0.08] text-cyan-100'
                            : 'border-[#739aaa]/28 bg-transparent text-white/68 hover:border-cyan-300/50 hover:text-white'
                        }`}
                      >
                        {isSelectedUploading ? (
                          <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                        ) : (
                          <UploadIcon />
                        )}
                        {isSelectedUploading ? 'Uploading...' : 'Upload from Gallery'}
                      </label>

                      <label
                        htmlFor={`stage-photo-camera-${selectedStep.id}`}
                        className={`tap-press mobile-upload-action flex min-h-[58px] cursor-pointer items-center justify-center gap-3 rounded-[18px] px-3 text-center text-sm font-black ${
                          isSelectedUploading
                            ? 'stage-photo-loading-pattern cursor-wait border border-cyan-300/35 bg-cyan-300/[0.08] text-cyan-100'
                            : 'bg-[#22e5ff] text-[#020d19] hover:bg-cyan-200'
                        }`}
                      >
                        {isSelectedUploading ? null : <CameraIcon />}
                        {isSelectedUploading ? 'Uploading...' : 'Take Photo'}
                      </label>
                    </div>

                    {isSelectedUploading ? (
                      <div className="mt-4 flex items-center gap-3 rounded-xl border border-cyan-300/20 bg-cyan-300/[0.06] p-2 text-cyan-100">
                        <div
                          className="stage-photo-loading-pattern relative flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-black"
                          aria-hidden="true"
                        >
                          <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-bold">Uploading photo</div>
                          <div className="text-xs text-cyan-100/60">
                            This will appear in the stage card and unit gallery.
                          </div>
                        </div>
                      </div>
                    ) : selectedStagePhoto ? (
                      <div className="mt-4 flex items-center gap-3 rounded-xl border border-[#739aaa]/25 bg-[#03141e]/75 p-2">
                        <button
                          type="button"
                          onClick={() =>
                            setExpandedStagePhoto({
                              id: selectedStagePhoto.id,
                              src: selectedStagePhoto.image_url,
                              alt:
                                selectedStagePhoto.alt_text ||
                                selectedStep.step_label,
                              label: selectedStep.step_label,
                            })
                          }
                          className="relative h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-black transition hover:ring-2 hover:ring-cyan-300/60 focus:outline-none focus:ring-2 focus:ring-cyan-300/70"
                          aria-label={`Expand ${selectedStep.step_label} photo`}
                        >
                          <Image
                            src={selectedStagePhoto.image_url}
                            alt={
                              selectedStagePhoto.alt_text ||
                              selectedStep.step_label
                            }
                            fill
                            sizes="56px"
                            className="object-cover"
                          />
                        </button>

                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-bold text-white">
                            Stage photo added
                          </div>
                          <div className="text-xs text-white/45">
                            Also appears in the unit gallery.
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => onRemoveStagePhoto(selectedStagePhoto.id)}
                          disabled={isPending}
                          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/10 bg-black/60 text-sm font-black text-white/70 transition hover:border-red-400/40 hover:bg-red-500/10 hover:text-red-300 disabled:opacity-50"
                          aria-label="Remove stage photo"
                        >
                          x
                        </button>
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </section>

      {expandedStagePhoto ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label={`${expandedStagePhoto.label} photo`}
          onClick={() => setExpandedStagePhoto(null)}
        >
          <div className="absolute left-4 top-4 z-10">
            <SampleColorFromImageAction
              imageSrc={expandedStagePhoto.src}
              imageAlt={expandedStagePhoto.alt}
              sourceType="unit_stage"
              sourceId={expandedStagePhoto.id}
              label="Match Paint"
            />
          </div>

          <button
            type="button"
            onClick={() => setExpandedStagePhoto(null)}
            className="absolute right-4 top-4 z-10 flex h-10 w-10 items-center justify-center rounded-full border border-white/15 bg-black/70 text-xl font-bold text-white/80 transition hover:border-white/35 hover:text-white focus:outline-none focus:ring-2 focus:ring-cyan-300/70"
            aria-label="Close expanded photo"
          >
            x
          </button>

          <div
            className="relative h-full max-h-[88vh] w-full max-w-5xl"
            onClick={(event) => event.stopPropagation()}
          >
            <Image
              src={expandedStagePhoto.src}
              alt={expandedStagePhoto.alt}
              fill
              sizes="100vw"
              className="object-contain"
              priority
            />
          </div>
        </div>
      ) : null}
    </>
  )
}
