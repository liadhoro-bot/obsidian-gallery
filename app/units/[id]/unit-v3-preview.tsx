'use client'

import Image from 'next/image'
import type { FormEvent, ReactNode } from 'react'
import { useMemo, useState, useTransition } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import FeatureGuideTour from '../../components/feature-guide-tour'
import { findVisibleFeatureGuideIndex } from '../../components/feature-guide-navigation'
import { unitPreviewFeatureGuides } from '../../components/feature-guide-presets'
import type { FeatureGuideEntry } from '../../components/feature-guide-types'
import V3PerfIndicator from '../../components/v3-perf-indicator'
import {
  assignRecipeToStage,
  deleteUnit,
  scheduleUnitSession,
  startUnitSession,
  toggleStepDone,
  updateUnitDetails,
  updateUnitHeader,
  updateUnitStatus,
} from './actions'
import ProjectPaletteStarter from '../../projects/[id]/project-palette-starter'
import StagePaintPicker from './components/stage-paint-picker'
import styles from './unit-v3-silver.module.css'

type UnitV3PreviewProps = {
  id: string
  initialTab?: UnitTab
  initialEditTarget?: EditTarget | null
  featureGuides?: FeatureGuideEntry[]
  liveUnit?: PreviewUnit | null
}

type UnitTab = 'details' | 'paint' | 'progress'

type PreviewUnit = {
  id: string
  name: string
  notes?: string | null
  label: string
  image: string
  galleryImages?: PreviewGalleryImage[]
  paintSessions?: UnitPaintSession[]
  scheduledSessions?: ScheduledPaintSession[]
  lastPainted?: string | null
  project: string
  deadline: string
  status: string
  rawStatus?: UnitStatus
  progress: number
  stage: string
  logged: string
  complexity: number
  modelCount: number
  rawDeadline?: string | null
  palette: string[]
  palettePaints?: PreviewPalettePaint[]
  progressSteps?: PreviewProgressStep[]
  stagePaints?: PreviewStagePaint[]
  assignedGuides?: PreviewAssignedGuide[]
  availableGuideChoices?: PreviewGuideChoice[]
  availableProjects?: PreviewProject[]
  selectedProjectIds?: string[]
}

export type UnitV3LiveUnit = PreviewUnit

type PreviewGalleryImage = {
  id: string
  image: string
  alt: string
  isFeatured: boolean
  stageKey?: string | null
}

type PreviewProject = {
  id: string
  name: string | null
}

type UnitStatus = 'complete' | 'active' | 'bench' | 'pile' | 'other'
type EditTarget = 'details' | 'header' | 'gallery'

type PreviewPalettePaint = {
  id: string
  source: 'catalog' | 'custom'
  name: string
  brand: string | null
  line: string | null
  hex: string | null
  swatchImageUrl: string | null
}

type PreviewProgressStep = {
  id: string
  step_key: string
  step_label: string
  step_order: number
  status: 'pending' | 'in_progress' | 'done'
  progress: number
}

type PreviewStagePaint = {
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

type PreviewGuideStepPaint = {
  id: string
  name: string
  brand: string
  line: string
  color: string
  swatchImageUrl: string | null
  isOwned: boolean
  isWishlist: boolean
  ratioText: string | null
}

type PreviewGuideStep = {
  id: string
  number: number
  title: string
  instructions: string
  image: string | null
  paints: PreviewGuideStepPaint[]
}

type PreviewAssignedGuide = {
  assignmentId: string
  progressStepId: string
  id: string
  title: string
  subtitle: string
  image: string
  cards: number
  paints: number
  steps: PreviewGuideStep[]
  paintList: Array<Omit<PreviewGuideStepPaint, 'ratioText'>>
}

type PreviewGuideChoice = {
  id: string
  type: 'guide' | 'deck'
  title: string
  subtitle: string
  image: string
  cards: number
  paints: number
  recipeId: string
}

const unitStatusOptions: { value: UnitStatus; label: string }[] = [
  { value: 'complete', label: 'Complete' },
  { value: 'active', label: 'Active' },
  { value: 'bench', label: 'Bench' },
  { value: 'pile', label: 'Pile of Shame' },
  { value: 'other', label: 'Other' },
]

const previewUnits: PreviewUnit[] = [
  {
    id: 'guido',
    name: 'Guido (אנשובי)',
    label: 'Featured',
    image: '/onboarding/first-project-bg.jpeg',
    project: 'Samurai Pizza Cats',
    deadline: 'May 23, 2026',
    status: 'Active',
    progress: 40,
    stage: 'Stage 2/6',
    logged: '2h 58m',
    complexity: 3,
    modelCount: 1,
    palette: ['#a92322', '#d6b84d', '#171821', '#e1c58d', '#72c888'],
  },
  {
    id: 'storm-chapel',
    name: 'Storm Chapel',
    label: 'Active',
    image: '/onboarding/pains/tough-choices.jpeg',
    project: 'Gloomhaven 2nd ed.',
    deadline: 'June 4, 2026',
    status: 'Active',
    progress: 15,
    stage: 'Stage 1/5',
    logged: '38m',
    complexity: 2,
    modelCount: 4,
    palette: ['#1e2834', '#9aafbd', '#d8bd83', '#22d3ee', '#a92322'],
  },
  {
    id: 'ashen-patrol',
    name: 'Ashen Patrol',
    label: 'Active',
    image: '/onboarding/pains/paint-management.jpeg',
    project: 'Desert Table',
    deadline: 'June 11, 2026',
    status: 'Active',
    progress: 28,
    stage: 'Stage 2/5',
    logged: '1h 12m',
    complexity: 2,
    modelCount: 3,
    palette: ['#171815', '#7a5d37', '#efe3c5', '#4eb282', '#5aa7c9'],
  },
  {
    id: 'copper-warden',
    name: 'Copper Warden',
    label: 'Active',
    image: '/onboarding/pains/scheme-loss.jpeg',
    project: 'Golden Automaton',
    deadline: 'June 20, 2026',
    status: 'Active',
    progress: 52,
    stage: 'Stage 3/6',
    logged: '3h 24m',
    complexity: 4,
    modelCount: 1,
    palette: ['#d29631', '#7a5d37', '#111417', '#17b9c2', '#efe3c5'],
  },
  {
    id: 'night-market',
    name: 'Night Market',
    label: 'Active',
    image: '/onboarding/pains/pile-of-shame.jpeg',
    project: 'Samurai Pizza Cats',
    deadline: 'July 2, 2026',
    status: 'Active',
    progress: 63,
    stage: 'Stage 4/6',
    logged: '4h 06m',
    complexity: 3,
    modelCount: 2,
    palette: ['#111417', '#5943a7', '#5aa7c9', '#d8bd83', '#b51d20'],
  },
]

const gallerySlots = ['hero', 'angle', 'paint', 'detail']

type UnitPaintSession = {
  id: string
  dateKey: string
  startedAt: string
  title: string
  duration: string
  notes: string
}

type ScheduledPaintSession = {
  id?: string
  dateKey: string
  time: string
  duration: string
  focus: string
  notes: string
  notify: boolean
}

const fallbackPaintSessions: UnitPaintSession[] = [
  {
    id: 'fallback-2026-07-01',
    dateKey: '2026-07-01',
    startedAt: '2026-07-01T18:00:00.000Z',
    title: 'Assembled',
    duration: '0h 58m',
    notes: 'Cleaned mold lines, pinned the arm, and tested the base fit.',
  },
  {
    id: 'fallback-2026-07-07',
    dateKey: '2026-07-07',
    startedAt: '2026-07-07T18:00:00.000Z',
    title: 'Prime and first basecoat',
    duration: '0h 42m',
    notes: 'Black primer, teal armor base, and the first pass on cloth.',
  },
  {
    id: 'fallback-2026-07-14',
    dateKey: '2026-07-14',
    startedAt: '2026-07-14T18:00:00.000Z',
    title: 'Shadows blocked in',
    duration: '0h 39m',
    notes: 'Deepened recesses and mapped the cold shadow areas.',
  },
  {
    id: 'fallback-2026-07-21',
    dateKey: '2026-07-21',
    startedAt: '2026-07-21T18:00:00.000Z',
    title: 'Edge highlight pass',
    duration: '0h 39m',
    notes: 'Crisp armor edges, lens cleanup, and base rim touch-up.',
  },
]

const progressStages = [
  {
    id: 'assembled',
    label: 'Assembled',
    title: 'Assembled',
    status: 'complete',
    icon: 'check',
    description: 'Parts cleaned, fitted, assembled, and ready for primer.',
  },
  {
    id: 'primed',
    label: 'Primed',
    title: 'Primed',
    status: 'current',
    icon: 'primer',
    description: 'Primer coat applied and cured',
  },
  {
    id: 'initial-paint',
    label: 'Initial Pa...',
    title: 'Initial Paint',
    status: 'todo',
    icon: 'palette',
    description: 'Block in the main colors before moving into detail work.',
  },
  {
    id: 'fine-detail',
    label: 'Fine Detai...',
    title: 'Fine Detail',
    status: 'todo',
    icon: 'sparkles',
    description: 'Highlights, shadows, lenses, markings, and character moments.',
  },
  {
    id: 'base-rim',
    label: 'Base & Rim',
    title: 'Base & Rim',
    status: 'todo',
    icon: 'mountain',
    description: 'Finish the base texture, edge cleanup, and final rim color.',
  },
  {
    id: 'done',
    label: 'Done',
    title: 'Done',
    status: 'todo',
    icon: 'done',
    description: 'Final photos, project notes, and gallery-ready wrap-up.',
  },
] as const

type ProgressStage = (typeof progressStages)[number]
type ProgressStageIcon = ProgressStage['icon']
type DisplayProgressStage = {
  id: string
  stepId?: string
  stepKey?: string
  label: string
  title: string
  status: ProgressStage['status']
  icon: ProgressStageIcon
  description: string
}

const weekDayLabels = ['S', 'M', 'T', 'W', 'T', 'F', 'S']

export default function UnitV3Preview({
  id,
  initialTab = 'details',
  initialEditTarget = null,
  featureGuides = unitPreviewFeatureGuides,
  liveUnit = null,
}: UnitV3PreviewProps) {
  const [activeTab, setActiveTab] = useState<UnitTab>(initialTab)
  const [activeGuideIndex, setActiveGuideIndex] = useState<number | null>(null)
  const [isPending, startTransition] = useTransition()
  const router = useRouter()
  const pathname = usePathname()
  const [localUnit, setLocalUnit] = useState<PreviewUnit | null>(liveUnit)
  const unit = useMemo(
    () =>
      localUnit ??
      previewUnits.find((previewUnit) => previewUnit.id === id) ??
      previewUnits[0],
    [id, localUnit]
  )
  const [editTarget, setEditTarget] = useState<EditTarget | null>(initialEditTarget)
  const activeGuide =
    activeGuideIndex === null ? null : featureGuides[activeGuideIndex] ?? null

  function showGuideAt(index: number) {
    setActiveGuideIndex(index)
  }

  function goBack() {
    if (window.history.length > 1) {
      window.history.back()
      return
    }

    window.location.assign('/dashboard?preview=1')
  }

  function openLiveEditor(target: EditTarget) {
    setEditTarget(target)
    window.history.replaceState(null, '', `${pathname}?preview=1&edit=${target}`)
  }

  function closeLiveEditor() {
    setEditTarget(null)
    window.history.replaceState(null, '', `${pathname}?preview=1`)
  }

  function handleHeaderSubmit(formData: FormData) {
    startTransition(async () => {
      await updateUnitHeader(formData)
      const nextName = String(formData.get('name') ?? '').trim()
      const nextNotes = String(formData.get('description') ?? '').trim()
      setLocalUnit((current) =>
        current
          ? {
              ...current,
              name: nextName || current.name,
              notes: nextNotes || null,
            }
          : current
      )
      closeLiveEditor()
      router.refresh()
    })
  }

  function handleDetailsSubmit(formData: FormData) {
    startTransition(async () => {
      const nextStatus = String(formData.get('status') ?? unit.rawStatus) as
        | UnitStatus
        | undefined

      await updateUnitDetails(formData)

      if (nextStatus && nextStatus !== unit.rawStatus) {
        await updateUnitStatus(unit.id, nextStatus)
      }

      const projectIds = formData
        .getAll('projectIds')
        .map((value) => String(value))
        .filter(Boolean)
      const projects = unit.availableProjects ?? []
      const nextProjectName =
        projects.find((project) => project.id === projectIds[0])?.name ??
        (projectIds.length > 0 ? unit.project : 'Standalone unit')
      const nextComplexity = Number(formData.get('complexity') || unit.complexity)
      const nextModelCount = Number(formData.get('unit_size') || unit.modelCount)
      const nextDeadline = String(formData.get('deadline') ?? '').trim() || null
      const statusLabel =
        unitStatusOptions.find((option) => option.value === nextStatus)?.label ??
        unit.status

      setLocalUnit((current) =>
        current
          ? {
              ...current,
              complexity: Number.isFinite(nextComplexity)
                ? Math.max(1, Math.min(5, nextComplexity))
                : current.complexity,
              modelCount: Number.isFinite(nextModelCount)
                ? Math.max(1, nextModelCount)
                : current.modelCount,
              rawDeadline: nextDeadline,
              deadline: formatDisplayDeadline(nextDeadline),
              rawStatus: nextStatus ?? current.rawStatus,
              status: statusLabel,
              label: current.label === current.status ? statusLabel : current.label,
              project: nextProjectName || 'Standalone unit',
              selectedProjectIds: projectIds,
            }
          : current
      )
      closeLiveEditor()
      router.refresh()
    })
  }

  return (
    <main
      className={styles.unitSilver}
      data-v3-unit-indicator="root"
      data-v3-unit-source={liveUnit ? 'live' : 'fallback'}
    >
      <V3PerfIndicator surface="unit" detail={activeTab} />
      <div className="mx-auto min-h-dvh w-full max-w-md pb-10" data-v3-unit-indicator="content">
        <section
          className="relative min-h-[252px] overflow-hidden"
          data-v3-unit-indicator="hero"
          data-v3-unit-hero-image={unit.image}
          data-v3-unit-gallery-count={unit.galleryImages?.length ?? 0}
        >
          <Image
            src={unit.image}
            alt=""
            fill
            sizes="(max-width: 640px) 100vw, 448px"
            className="object-cover"
            priority
          />
          <div className="absolute inset-0 bg-gradient-to-b from-black/5 via-black/18 to-[#05090b]" />

          <div
            className="absolute inset-x-0 top-0 z-10 flex items-center justify-between px-4 pt-5"
            data-v3-unit-indicator="hero-controls"
          >
            <button
              type="button"
              onClick={goBack}
              aria-label="Back"
              className="grid h-10 w-10 place-items-center rounded-full bg-black/28 text-white shadow-[0_10px_28px_rgba(0,0,0,0.28)] backdrop-blur-md transition hover:bg-white/10"
            >
              <svg
                aria-hidden="true"
                viewBox="0 0 24 24"
                className="h-5 w-5"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="m15 18-6-6 6-6" />
              </svg>
            </button>

            <div className="flex items-center gap-2" data-v3-unit-indicator="hero-actions">
              <button
                type="button"
                aria-expanded={activeGuide !== null}
                aria-label="Show unit explanation"
                onClick={() =>
                  showGuideAt(
                    findVisibleFeatureGuideIndex(featureGuides, null, 1) ?? 0
                  )
                }
                className="grid h-10 w-10 place-items-center rounded-full bg-[#111827]/88 text-white backdrop-blur-md transition hover:text-cyan-300"
              >
                ?
              </button>
              <button
                type="button"
                aria-label="Edit unit"
                onClick={() => openLiveEditor('header')}
                className="grid h-10 w-10 place-items-center rounded-full bg-[#111827]/88 text-white backdrop-blur-md transition hover:text-cyan-300"
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
                  <path d="M12 20h9" />
                  <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
                </svg>
              </button>

              <span
                className="rounded-full bg-cyan-300 px-3 py-2 text-[10px] font-black text-black"
                data-v3-unit-indicator="unit-label"
              >
                {unit.label}
              </span>
            </div>
          </div>

          <div className="absolute inset-x-0 bottom-4 z-10 px-4" data-v3-unit-indicator="hero-title">
            <p className="text-[9px] font-black uppercase tracking-[0.28em] text-cyan-300">
              Unit
            </p>
            <h1
              className="mt-1 text-[26px] font-black leading-none tracking-normal"
              data-feature-guide-target="units.detail.page"
            >
              {unit.name}
            </h1>
          </div>
        </section>

        <div className="px-3">
          <div
            className="grid grid-cols-3 rounded-[8px] border border-white/[0.04] bg-white/[0.055] p-1"
            data-v3-unit-indicator="unit-tabs"
            role="tablist"
            aria-label="Unit sections"
          >
            {(['details', 'paint', 'progress'] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                role="tab"
                aria-selected={activeTab === tab}
                data-feature-guide-target={`units.detail.tabs.${tab}`}
                onClick={() => setActiveTab(tab)}
                className={[
                  'h-10 rounded-[6px] px-1 text-xs font-black transition',
                  activeTab === tab
                    ? 'bg-[#101822] text-cyan-300 shadow-[inset_0_0_24px_rgba(34,211,238,0.06)]'
                    : 'text-white/38 hover:text-white/70',
                ].join(' ')}
              >
                {tab === 'paint' ? 'Painting Sessions' : tab}
              </button>
            ))}
          </div>

          <div className="mt-4 grid gap-3" data-v3-unit-indicator="tab-content">
            {activeTab === 'details' ? (
              <DetailsTab
                unit={unit}
                onEditDetails={() => openLiveEditor('details')}
                onEditGallery={() => openLiveEditor('gallery')}
                onLocalUnitChange={setLocalUnit}
              />
            ) : null}
            {activeTab === 'paint' ? <PaintTab unit={unit} /> : null}
            {activeTab === 'progress' ? (
              <ProgressTab
                unit={unit}
                onEditGallery={() => openLiveEditor('gallery')}
                onLocalUnitChange={setLocalUnit}
              />
            ) : null}
          </div>
        </div>
      </div>

      {activeGuide ? (
        <FeatureGuideTour
          activeIndex={activeGuideIndex ?? 0}
          guide={activeGuide}
          onClose={() => setActiveGuideIndex(null)}
          onNext={() =>
            showGuideAt(
              findVisibleFeatureGuideIndex(featureGuides, activeGuideIndex, 1) ??
                activeGuideIndex ??
                0
            )
          }
          onPrevious={() =>
            showGuideAt(
              findVisibleFeatureGuideIndex(featureGuides, activeGuideIndex, -1) ??
                activeGuideIndex ??
                0
            )
          }
          totalGuides={featureGuides.length}
        />
      ) : null}

      {editTarget ? (
        <UnitEditSheet
          unit={unit}
          target={editTarget}
          isPending={isPending}
          onClose={closeLiveEditor}
          onHeaderSubmit={handleHeaderSubmit}
          onDetailsSubmit={handleDetailsSubmit}
        />
      ) : null}
    </main>
  )
}

function UnitEditSheet({
  unit,
  target,
  isPending,
  onClose,
  onHeaderSubmit,
  onDetailsSubmit,
}: {
  unit: PreviewUnit
  target: EditTarget
  isPending: boolean
  onClose: () => void
  onHeaderSubmit: (formData: FormData) => void
  onDetailsSubmit: (formData: FormData) => void
}) {
  const isHeader = target === 'header'
  const isDetails = target === 'details'
  const selectedProjectIds = unit.selectedProjectIds ?? []
  const availableProjects = unit.availableProjects ?? []

  return (
    <div
      className="fixed inset-0 z-[80] grid place-items-end bg-black/65 px-3 py-4"
      data-v3-unit-indicator="edit-scrim"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose()
        }
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="unit-edit-title"
        className="max-h-[88dvh] w-full max-w-md overflow-y-auto rounded-[14px] border border-white/10 bg-[#10161d] p-4 shadow-2xl shadow-black/50"
        data-v3-unit-indicator="edit-sheet"
      >
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-cyan-300">
              {isHeader ? 'Unit Identity' : isDetails ? 'Unit Details' : 'Gallery'}
            </p>
            <h2
              id="unit-edit-title"
              className="mt-1 text-2xl font-black leading-tight"
            >
              {isHeader
                ? 'Edit unit'
                : isDetails
                  ? 'Edit details'
                  : 'Gallery editor'}
            </h2>
          </div>
          <button
            type="button"
            aria-label="Close unit editor"
            onClick={onClose}
            className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white/[0.06] text-lg font-black text-white/48 transition hover:text-white"
          >
            x
          </button>
        </div>

        {isHeader ? (
          <>
            <form action={onHeaderSubmit} className="mt-5 grid gap-4">
              <input type="hidden" name="unitId" value={unit.id} />

              <label className="grid min-w-0 gap-2">
                <span className="text-xs font-black uppercase tracking-[0.18em] text-white/42">
                  Name
                </span>
                <input
                  name="name"
                  defaultValue={unit.name}
                  required
                  className="h-12 w-full min-w-0 rounded-[10px] border border-white/10 bg-black/24 px-4 text-sm font-semibold text-white outline-none transition focus:border-cyan-300/70"
                />
              </label>

              <label className="grid min-w-0 gap-2">
                <span className="text-xs font-black uppercase tracking-[0.18em] text-white/42">
                  Notes
                </span>
                <textarea
                  name="description"
                  defaultValue={unit.notes || ''}
                  rows={4}
                  className="w-full min-w-0 resize-none rounded-[10px] border border-white/10 bg-black/24 px-4 py-3 text-sm font-semibold text-white outline-none transition focus:border-cyan-300/70"
                />
              </label>

              <EditSheetActions
                isPending={isPending}
                saveLabel="Save Unit"
                onClose={onClose}
              />
            </form>
            <DeleteUnitFailsafe unit={unit} />
          </>
        ) : null}

        {isDetails ? (
          <>
            <form action={onDetailsSubmit} className="mt-5 grid gap-4">
              <input type="hidden" name="unitId" value={unit.id} />

              <div className="grid grid-cols-2 gap-3">
                <label className="grid min-w-0 gap-2">
                  <span className="text-xs font-black uppercase tracking-[0.18em] text-white/42">
                    Complexity
                  </span>
                  <input
                    name="complexity"
                    type="number"
                    min="1"
                    max="5"
                    defaultValue={unit.complexity}
                    className="h-12 w-full min-w-0 rounded-[10px] border border-white/10 bg-black/24 px-4 text-sm font-black text-white outline-none transition focus:border-cyan-300/70"
                  />
                </label>

                <label className="grid min-w-0 gap-2">
                  <span className="text-xs font-black uppercase tracking-[0.18em] text-white/42">
                    Models
                  </span>
                  <input
                    name="unit_size"
                    type="number"
                    min="1"
                    defaultValue={unit.modelCount}
                    className="h-12 w-full min-w-0 rounded-[10px] border border-white/10 bg-black/24 px-4 text-sm font-black text-white outline-none transition focus:border-cyan-300/70"
                  />
                </label>
              </div>

              <label className="grid min-w-0 gap-2">
                <span className="text-xs font-black uppercase tracking-[0.18em] text-white/42">
                  Deadline
                </span>
                <input
                  name="deadline"
                  type="date"
                  defaultValue={unit.rawDeadline || ''}
                  className="h-12 w-full min-w-0 rounded-[10px] border border-white/10 bg-black/24 px-4 text-sm font-semibold text-white outline-none transition focus:border-cyan-300/70"
                />
              </label>

              <label className="grid min-w-0 gap-2">
                <span className="text-xs font-black uppercase tracking-[0.18em] text-white/42">
                  Status
                </span>
                <select
                  name="status"
                  defaultValue={unit.rawStatus ?? 'active'}
                  className="h-12 w-full min-w-0 rounded-[10px] border border-white/10 bg-black/24 px-4 text-sm font-black text-white outline-none transition focus:border-cyan-300/70"
                >
                  {unitStatusOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

              <fieldset className="grid gap-2 rounded-[10px] border border-white/10 bg-black/24 p-3">
                <legend className="px-1 text-xs font-black uppercase tracking-[0.18em] text-white/42">
                  Parent Projects
                </legend>
                {availableProjects.length > 0 ? (
                  availableProjects.map((project) => (
                    <label
                      key={project.id}
                      className="flex min-h-11 items-center gap-3 rounded-[8px] px-2 text-sm font-semibold text-white/75 transition hover:bg-white/5"
                    >
                      <input
                        type="checkbox"
                        name="projectIds"
                        value={project.id}
                        defaultChecked={selectedProjectIds.includes(project.id)}
                        className="h-4 w-4 accent-cyan-400"
                      />
                      <span>{project.name || 'Untitled project'}</span>
                    </label>
                  ))
                ) : (
                  <p className="px-2 py-3 text-sm font-semibold text-white/40">
                    No parent projects yet.
                  </p>
                )}
              </fieldset>

              <EditSheetActions
                isPending={isPending}
                saveLabel="Save Details"
                onClose={onClose}
              />
            </form>
            <DeleteUnitFailsafe unit={unit} />
          </>
        ) : null}

        {target === 'gallery' ? (
          <div className="mt-5 grid gap-4">
            <div className="grid grid-cols-2 gap-2">
              {getGalleryImages(unit).map((image) => (
                <div
                  key={image.id}
                  className="relative aspect-[1.32] overflow-hidden rounded-[10px] bg-black"
                >
                  <Image
                    src={image.image}
                    alt={image.alt}
                    fill
                    sizes="180px"
                    className="object-cover"
                  />
                </div>
              ))}
            </div>
            <p className="text-sm font-semibold leading-6 text-white/55">
              The V3 gallery tools are being brought forward next. This drawer
              keeps you in the V3 unit while the full image manager is migrated.
            </p>
            <button
              type="button"
              onClick={onClose}
              className="h-12 rounded-[10px] bg-cyan-300 text-sm font-black text-black transition hover:bg-cyan-200"
            >
              Done
            </button>
          </div>
        ) : null}
      </section>
    </div>
  )
}

function DeleteUnitFailsafe({ unit }: { unit: PreviewUnit }) {
  const [pressCount, setPressCount] = useState(0)
  const remainingPresses = Math.max(0, 3 - pressCount)
  const isArmed = pressCount >= 2

  return (
    <section
      className="mt-4 rounded-[10px] border border-red-400/25 bg-red-950/10 p-3"
      data-v3-unit-indicator="delete-unit-failsafe"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-red-300">
            Delete Unit
          </p>
          <p className="mt-1 text-xs font-semibold leading-5 text-white/52">
            Removes this unit, images, sessions, paints, and progress.
          </p>
        </div>
        <span
          className="shrink-0 rounded-[6px] border border-red-300/25 px-2 py-1 text-[10px] font-black text-red-200"
          aria-live="polite"
        >
          {isArmed ? 'Final press' : `${remainingPresses} presses`}
        </span>
      </div>

      <form action={deleteUnit} className="mt-3">
        <input type="hidden" name="unitId" value={unit.id} />
        <button
          type="submit"
          data-v3-unit-indicator="delete-unit-button"
          data-delete-armed={isArmed ? 'true' : 'false'}
          onClick={(event) => {
            if (!isArmed) {
              event.preventDefault()
              setPressCount((current) => Math.min(2, current + 1))
            }
          }}
          className="h-11 w-full rounded-[8px] px-4 text-sm font-black transition"
        >
          {pressCount === 0
            ? 'Delete Unit'
            : pressCount === 1
              ? 'Press Again to Arm'
              : 'Delete Permanently'}
        </button>
      </form>
    </section>
  )
}

function EditSheetActions({
  isPending,
  saveLabel,
  onClose,
}: {
  isPending: boolean
  saveLabel: string
  onClose: () => void
}) {
  return (
    <div className="grid grid-cols-[1fr_auto] gap-3 pt-1">
      <button
        type="submit"
        disabled={isPending}
        className="h-12 rounded-[10px] bg-cyan-300 text-sm font-black text-black transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isPending ? 'Saving...' : saveLabel}
      </button>
      <button
        type="button"
        onClick={onClose}
        disabled={isPending}
        className="h-12 rounded-[10px] border border-white/10 px-4 text-sm font-black text-white/62 transition hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
      >
        Cancel
      </button>
    </div>
  )
}

function DetailsTab({
  unit,
  onEditDetails,
  onEditGallery,
  onLocalUnitChange,
}: {
  unit: PreviewUnit
  onEditDetails: () => void
  onEditGallery: () => void
  onLocalUnitChange: (updater: (current: PreviewUnit | null) => PreviewUnit | null) => void
}) {
  const galleryImages = getGalleryImages(unit)
  const firstProgressStepId =
    unit.progressSteps
      ?.slice()
      .sort((a, b) => a.step_order - b.step_order)
      .find((step) => step.step_key !== 'done')?.id ?? null

  return (
    <>
      <section
        className="rounded-[8px] border border-white/[0.06] bg-[#111821]"
        data-v3-unit-indicator="details-card"
        data-feature-guide-target="units.detail.details"
      >
        <div className="flex items-center justify-between px-3 py-2.5">
          <h2 className="text-[10px] font-black uppercase tracking-[0.24em] text-white/26">
            Unit Details
          </h2>
          <button
            type="button"
            onClick={onEditDetails}
            className="rounded-full px-2 py-1 text-[10px] font-black text-cyan-300 transition hover:bg-cyan-300/10"
          >
            Edit
          </button>
        </div>

        <div className="grid grid-cols-3 border-y border-white/[0.06]">
          <InfoCell label="Complexity">
            <span className="flex gap-1">
              {Array.from({ length: 5 }).map((_, index) => (
                <span
                  key={index}
                  className={[
                    'h-2 w-2 rounded-full',
                    index < unit.complexity ? 'bg-cyan-300' : 'bg-white/12',
                  ].join(' ')}
                />
              ))}
            </span>
          </InfoCell>
          <InfoCell label="Model count">
            <span className="text-lg font-black text-white">{unit.modelCount}</span>
          </InfoCell>
          <InfoCell label="Deadline">
            <span className="text-xs font-black text-yellow-300">{unit.deadline}</span>
          </InfoCell>
        </div>

        <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 px-3 py-2.5">
          <div>
            <p className="text-[9px] font-black uppercase tracking-[0.2em] text-white/26">
              Parent Project
            </p>
            <span
              className="mt-1.5 inline-flex max-w-full rounded-full bg-cyan-300/12 px-2.5 py-1 text-[10px] font-black text-cyan-300"
              data-v3-unit-indicator="project-chip"
            >
              {unit.project}
            </span>
          </div>
          <div className="text-right">
            <p className="text-[9px] font-black uppercase tracking-[0.2em] text-white/26">
              Status
            </p>
            <button
              type="button"
              onClick={onEditDetails}
              className="mt-1.5 rounded-full border border-white/10 bg-white/[0.06] px-2.5 py-1 text-[10px] font-black text-white/76"
              data-v3-unit-indicator="status-control"
            >
              {unit.status} v
            </button>
          </div>
        </div>
      </section>

      <section className="rounded-[8px] border border-white/[0.06] bg-[#111821] p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-[10px] font-black uppercase tracking-[0.24em] text-white/26">
            Palette
          </h2>
          <span className="text-[9px] font-black uppercase tracking-[0.16em] text-white/34">
            Assign paints
          </span>
        </div>
        <div className="mt-4 grid grid-cols-5 gap-2">
          {Array.from({ length: 5 }).map((_, index) => {
            const paint = unit.palettePaints?.[index]

            return (
              <ProjectPaletteStarter
                key={`palette-slot-${index}`}
                projectId=""
                unitId={unit.id}
                slotIndex={index}
                initialPaint={
                  paint
                    ? {
                        id: paint.id,
                        source: paint.source,
                        name: paint.name,
                        brand: paint.brand,
                        line: paint.line,
                        swatch_image_url: paint.swatchImageUrl,
                        hex: paint.hex,
                      }
                    : null
                }
              />
            )
          })}
        </div>
        {unit.palettePaints?.length ? (
          <div className="mt-3 grid grid-cols-5 gap-2">
            {unit.palettePaints.slice(0, 5).map((paint, index) => (
              <div
                key={`${paint.source}-${paint.id}-label-${index}`}
                title={paint.name}
              >
                <p className="truncate text-center text-[8px] font-black uppercase tracking-[0.12em] text-[color:var(--og-brass-700)]">
                  {paint.brand || paint.line || 'Paint'}
                </p>
                <p className="mt-0.5 truncate text-center text-[9px] font-black text-[color:var(--og-text-primary)]">
                  {paint.name}
                </p>
              </div>
            ))}
          </div>
        ) : null}
      </section>

      <UnitGuidesCard
        unit={unit}
        firstProgressStepId={firstProgressStepId}
        onLocalUnitChange={onLocalUnitChange}
      />

      <section
        className="rounded-[18px] border border-white/[0.06] bg-[#111821] p-4"
        data-feature-guide-target="units.detail.gallery"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-[10px] font-black uppercase tracking-[0.24em] text-white/26">
            Gallery
          </h2>
          <button
            type="button"
            onClick={onEditGallery}
            className="rounded-full px-2 py-1 text-[10px] font-black text-white/38 transition hover:bg-white/[0.06] hover:text-cyan-300"
          >
            See all -&gt;
          </button>
        </div>

        <div className="mt-8 grid grid-cols-[repeat(5,minmax(0,1fr))] gap-2">
          {galleryImages.map((image, index) => (
            <button
              key={image.id}
              type="button"
              onClick={onEditGallery}
              aria-label={`${unit.name} gallery image ${index + 1}`}
              className="relative aspect-[1.32] min-w-0 overflow-hidden rounded-[12px] bg-black transition hover:ring-1 hover:ring-cyan-300/60"
            >
              <Image
                src={image.image}
                alt={image.alt}
                fill
                sizes="72px"
                className="object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-b from-transparent to-black/28" />
              {image.isFeatured ? (
                <span className="absolute bottom-1 left-1 rounded-[6px] bg-cyan-300 px-1.5 py-1 text-[9px] font-black text-black">
                  Hero
                </span>
              ) : null}
            </button>
          ))}

          <button
            type="button"
            onClick={onEditGallery}
            aria-label="Add gallery image"
            className="aspect-[1.32] rounded-[12px] border border-dashed border-white/14 bg-white/[0.02] text-xl font-black text-white/16 transition hover:border-cyan-300/45 hover:text-cyan-300"
          >
            +
          </button>
        </div>
      </section>
    </>
  )
}

function UnitGuidesCard({
  unit,
  firstProgressStepId,
  onLocalUnitChange,
}: {
  unit: PreviewUnit
  firstProgressStepId: string | null
  onLocalUnitChange: (updater: (current: PreviewUnit | null) => PreviewUnit | null) => void
}) {
  const [isPickerOpen, setIsPickerOpen] = useState(false)
  const [activeGuide, setActiveGuide] = useState<PreviewAssignedGuide | null>(null)
  const [isAssigning, startAssigning] = useTransition()
  const assignedGuides = unit.assignedGuides ?? []
  const choices = unit.availableGuideChoices ?? []

  function assignChoice(choice: PreviewGuideChoice) {
    if (!firstProgressStepId) return

    startAssigning(async () => {
      const formData = new FormData()
      formData.set('unitId', unit.id)
      formData.set('progressStepId', firstProgressStepId)
      formData.set('recipeId', choice.recipeId)
      await assignRecipeToStage(formData)
      onLocalUnitChange((current) =>
        current
          ? {
              ...current,
              assignedGuides: [
                {
                  assignmentId: `pending-${choice.recipeId}`,
                  progressStepId: firstProgressStepId,
                  id: choice.recipeId,
                  title: choice.title,
                  subtitle: choice.subtitle,
                  image: choice.image,
                  cards: choice.cards,
                  paints: choice.paints,
                  steps: [],
                  paintList: [],
                },
                ...(current.assignedGuides ?? []).filter(
                  (guide) => guide.id !== choice.recipeId
                ),
              ],
            }
          : current
      )
      setIsPickerOpen(false)
    })
  }

  return (
    <section className="rounded-[8px] border border-white/[0.06] bg-[#111821]">
      <div className="flex items-center justify-between px-4 py-4">
        <h2 className="text-[10px] font-black uppercase tracking-[0.24em] text-white/26">
          Guides
        </h2>
        <button
          type="button"
          onClick={() => setIsPickerOpen(true)}
          disabled={!firstProgressStepId || choices.length === 0}
          className="rounded-full px-2 py-1 text-[10px] font-black text-cyan-300 transition hover:bg-cyan-300/10 disabled:cursor-not-allowed disabled:opacity-45"
        >
          Add
        </button>
      </div>
      <div className="divide-y divide-white/[0.06]">
        {assignedGuides.length ? (
          assignedGuides.map((guide) => (
            <button
              key={guide.assignmentId}
              type="button"
              onClick={() => setActiveGuide(guide)}
              className="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-white/[0.04]"
            >
              <span className="relative h-9 w-9 shrink-0 overflow-hidden rounded-full bg-white/10">
                <Image src={guide.image} alt="" fill sizes="36px" className="object-cover" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-xs font-black text-white">
                  {guide.title}
                </span>
                <span className="mt-1 block text-[10px] font-black text-white/30">
                  {guide.cards} cards - {guide.paints} paints
                </span>
              </span>
              <span className="text-white/24">&gt;</span>
            </button>
          ))
        ) : (
          <p className="px-4 pb-4 text-sm font-semibold leading-5 text-white/42">
            Assign a saved guide or deck to this unit.
          </p>
        )}
      </div>

      {isPickerOpen ? (
        <div
          className="fixed inset-0 z-[70] grid place-items-end bg-black/65 px-3 py-4"
          data-v3-unit-indicator="guide-scrim"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setIsPickerOpen(false)
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="unit-guide-picker-title"
            className="max-h-[82dvh] w-full max-w-md overflow-y-auto rounded-[14px] border border-white/10 bg-[#10161d] p-4 shadow-2xl shadow-black/50"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.22em] text-cyan-300">
                  Guides & Decks
                </p>
                <h2 id="unit-guide-picker-title" className="mt-1 text-2xl font-black">
                  Assign to unit
                </h2>
              </div>
              <button
                type="button"
                aria-label="Close guide picker"
                onClick={() => setIsPickerOpen(false)}
                className="grid h-10 w-10 place-items-center rounded-full bg-white/[0.06] text-lg font-black text-white/48 transition hover:text-white"
              >
                x
              </button>
            </div>

            <div className="mt-4 grid gap-2">
              {choices.map((choice) => (
                <button
                  key={`${choice.type}-${choice.id}`}
                  type="button"
                  disabled={isAssigning}
                  onClick={() => assignChoice(choice)}
                  className="flex min-h-16 w-full items-center gap-3 rounded-[10px] border border-white/10 bg-black/20 p-2 text-left transition hover:border-cyan-300/45 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <span className="relative h-12 w-12 shrink-0 overflow-hidden rounded-[8px] bg-black">
                    <Image src={choice.image} alt="" fill sizes="48px" className="object-cover" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-black text-white">
                      {choice.title}
                    </span>
                    <span className="mt-1 block truncate text-[10px] font-semibold text-white/38">
                      {choice.type} - {choice.cards} cards - {choice.paints} paints
                    </span>
                  </span>
                </button>
              ))}
            </div>
          </section>
        </div>
      ) : null}

      {activeGuide ? (
        <GuideCardPopup guide={activeGuide} onClose={() => setActiveGuide(null)} />
      ) : null}
    </section>
  )
}

function GuideCardPopup({
  guide,
  onClose,
}: {
  guide: PreviewAssignedGuide
  onClose: () => void
}) {
  const [activeIndex, setActiveIndex] = useState(0)
  const cards = [
    {
      key: 'cover',
      title: guide.title,
      body: guide.subtitle,
      image: guide.image,
      paints: guide.paintList.map((paint) => ({
        ...paint,
        ratioText: null,
      })),
    },
    ...guide.steps.map((step) => ({
      key: step.id,
      title: step.title,
      body: step.instructions,
      image: step.image,
      paints: step.paints,
    })),
  ]
  const activeCard = cards[activeIndex] ?? cards[0]

  return (
    <div
      className="fixed inset-0 z-[75] grid place-items-center bg-black/80 p-4"
      role="dialog"
      aria-modal="true"
      aria-label={`${guide.title} cards`}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <section className="grid max-h-[88dvh] w-full max-w-sm overflow-hidden rounded-[18px] border border-white/10 bg-[#10161d] shadow-2xl shadow-black/60">
        <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
          <button
            type="button"
            onClick={() => setActiveIndex((current) => Math.max(0, current - 1))}
            disabled={activeIndex === 0}
            aria-label="Previous guide card"
            className="grid h-9 w-9 place-items-center rounded-full bg-white/[0.06] text-white/50 disabled:opacity-30"
          >
            &lt;
          </button>
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-white/36">
            {activeIndex + 1} / {cards.length}
          </p>
          <button
            type="button"
            onClick={() =>
              setActiveIndex((current) => Math.min(cards.length - 1, current + 1))
            }
            disabled={activeIndex >= cards.length - 1}
            aria-label="Next guide card"
            className="grid h-9 w-9 place-items-center rounded-full bg-white/[0.06] text-white/50 disabled:opacity-30"
          >
            &gt;
          </button>
        </div>

        <div className="overflow-y-auto p-4">
          {activeCard?.image ? (
            <div className="relative aspect-[1.3] overflow-hidden rounded-[12px] bg-black">
              <Image src={activeCard.image} alt="" fill sizes="360px" className="object-cover" />
            </div>
          ) : null}
          <h3 className="mt-4 text-2xl font-black leading-tight text-white">
            {activeCard?.title}
          </h3>
          <p className="mt-3 text-sm font-semibold leading-6 text-white/62">
            {activeCard?.body}
          </p>
          {activeCard?.paints.length ? (
            <div className="mt-4 grid grid-cols-4 gap-2">
              {activeCard.paints.slice(0, 8).map((paint) => (
                <span
                  key={paint.id}
                  className="aspect-square overflow-hidden rounded-[8px] border border-white/10"
                  title={paint.name}
                  style={{ backgroundColor: paint.color }}
                >
                  {paint.swatchImageUrl ? (
                    <Image
                      src={paint.swatchImageUrl}
                      alt=""
                      width={64}
                      height={64}
                      className="h-full w-full object-cover"
                    />
                  ) : null}
                </span>
              ))}
            </div>
          ) : null}
        </div>

        <button
          type="button"
          onClick={onClose}
          className="m-4 mt-0 h-11 rounded-[10px] bg-cyan-300 text-sm font-black text-black"
        >
          Close
        </button>
      </section>
    </div>
  )
}

function getGalleryImages(unit: PreviewUnit) {
  if (unit.galleryImages?.length) {
    return unit.galleryImages.slice(0, 4)
  }

  return gallerySlots.map((slot, index) => ({
    id: `${unit.id}-${slot}`,
    image: unit.image,
    alt: '',
    isFeatured: index === 0,
  }))
}

function formatDisplayDeadline(deadline: string | null) {
  if (!deadline) {
    return 'No deadline'
  }

  const date = new Date(`${deadline}T00:00:00`)
  if (Number.isNaN(date.getTime())) {
    return deadline
  }

  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date)
}

function getLocalDateKey(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function dateFromDateKey(dateKey: string) {
  const [year = '2026', month = '1', day = '1'] = dateKey.split('-')
  return new Date(Number(year), Number(month) - 1, Number(day))
}

function addDays(date: Date, days: number) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days)
}

function addMonths(date: Date, months: number) {
  return new Date(date.getFullYear(), date.getMonth() + months, 1)
}

function getMonthCursorFromDateKey(dateKey: string) {
  const date = dateFromDateKey(dateKey)
  return new Date(date.getFullYear(), date.getMonth(), 1)
}

function getMonthDays(monthCursor: Date) {
  const year = monthCursor.getFullYear()
  const month = monthCursor.getMonth()
  const daysInMonth = new Date(year, month + 1, 0).getDate()

  return {
    offset: new Date(year, month, 1).getDay(),
    days: Array.from({ length: daysInMonth }, (_, index) => {
      const date = new Date(year, month, index + 1)
      return {
        day: index + 1,
        dateKey: getLocalDateKey(date),
      }
    }),
  }
}

function formatMonthLabel(monthCursor: Date) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'long',
    year: 'numeric',
  }).format(monthCursor)
}

function formatDateLabel(dateKey: string) {
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  }).format(dateFromDateKey(dateKey))
}

function formatScheduleTitle(dateKey: string) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).format(dateFromDateKey(dateKey))
}

function groupSessionsByDate<T extends { dateKey: string }>(sessions: T[]) {
  const grouped = new Map<string, T[]>()

  for (const session of sessions) {
    const current = grouped.get(session.dateKey)
    if (current) {
      current.push(session)
    } else {
      grouped.set(session.dateKey, [session])
    }
  }

  return grouped
}

function getInitialPaintDateKey() {
  return getLocalDateKey(new Date())
}

function PaintTab({ unit }: { unit: PreviewUnit }) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const loggedSessions = unit.paintSessions ?? fallbackPaintSessions
  const initialScheduledSessions = unit.scheduledSessions ?? []
  const initialDateKey = getInitialPaintDateKey()
  const [monthCursor, setMonthCursor] = useState(() =>
    getMonthCursorFromDateKey(initialDateKey)
  )
  const [selectedDateKey, setSelectedDateKey] = useState(initialDateKey)
  const [scheduledSessions, setScheduledSessions] = useState<
    ScheduledPaintSession[]
  >(initialScheduledSessions)
  const [isScheduleOpen, setIsScheduleOpen] = useState(false)
  const [scheduleTime, setScheduleTime] = useState('19:30')
  const [scheduleDuration, setScheduleDuration] = useState('60')
  const [scheduleFocus, setScheduleFocus] = useState(
    'Prime and first controlled basecoat'
  )
  const [scheduleNotes, setScheduleNotes] = useState(
    'Set paints out before starting.'
  )
  const [scheduleNotify, setScheduleNotify] = useState(false)
  const monthDays = useMemo(() => getMonthDays(monthCursor), [monthCursor])
  const loggedByDate = useMemo(
    () => groupSessionsByDate(loggedSessions),
    [loggedSessions]
  )
  const scheduledByDate = useMemo(
    () => groupSessionsByDate(scheduledSessions),
    [scheduledSessions]
  )
  const selectedLoggedSessions = loggedByDate.get(selectedDateKey) ?? []
  const selectedScheduledSessions = scheduledByDate.get(selectedDateKey) ?? []
  const selectedScheduledSession = selectedScheduledSessions[0]
  const todayKey = getLocalDateKey(new Date())
  const isFutureSelection =
    selectedDateKey > todayKey && selectedLoggedSessions.length === 0
  const nextSchedulableDay =
    selectedDateKey > todayKey
      ? selectedDateKey
      : getLocalDateKey(addDays(new Date(), 1))
  const lastPaintedDateKey = unit.lastPainted ?? loggedSessions[0]?.dateKey
  const lastPaintedLabel = lastPaintedDateKey
    ? `Last ${formatDateLabel(lastPaintedDateKey)}`
    : 'No sessions yet'

  function handleMonthStep(direction: -1 | 1) {
    setMonthCursor((current) => addMonths(current, direction))
  }

  function handleDaySelect(dateKey: string) {
    setSelectedDateKey(dateKey)
  }

  function openScheduleForm(dateKey = nextSchedulableDay) {
    const scheduledSession = scheduledSessions.find(
      (session) => session.dateKey === dateKey
    )
    setSelectedDateKey(dateKey)
    setMonthCursor(getMonthCursorFromDateKey(dateKey))
    if (scheduledSession) {
      setScheduleTime(scheduledSession.time)
      setScheduleDuration(scheduledSession.duration)
      setScheduleFocus(scheduledSession.focus)
      setScheduleNotes(scheduledSession.notes)
      setScheduleNotify(scheduledSession.notify)
    } else {
      setScheduleTime('19:30')
      setScheduleDuration('60')
      setScheduleFocus('Prime and first controlled basecoat')
      setScheduleNotes('Set paints out before starting.')
      setScheduleNotify(false)
    }
    setIsScheduleOpen(true)
  }

  function handleScheduleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const nextSession = {
      id: selectedScheduledSession?.id ?? `local-${selectedDateKey}`,
      dateKey: selectedDateKey,
      time: scheduleTime,
      duration: scheduleDuration,
      focus: scheduleFocus.trim() || 'Focused painting session',
      notes: scheduleNotes.trim(),
      notify: scheduleNotify,
    }

    setScheduledSessions((current) => {
      const nextSession = {
        id: selectedScheduledSession?.id ?? `local-${selectedDateKey}`,
        dateKey: selectedDateKey,
        time: scheduleTime,
        duration: scheduleDuration,
        focus: scheduleFocus.trim() || 'Focused painting session',
        notes: scheduleNotes.trim(),
        notify: scheduleNotify,
      }
      const withoutSelectedDay = current.filter(
        (session) => session.dateKey !== selectedDateKey
      )

      return [...withoutSelectedDay, nextSession]
    })
    setIsScheduleOpen(false)

    startTransition(async () => {
      const formData = new FormData()
      formData.set('unitId', unit.id)
      formData.set(
        'scheduledStartAt',
        `${selectedDateKey}T${nextSession.time || '19:30'}:00`
      )
      formData.set('focus', nextSession.focus)
      formData.set('notify', nextSession.notify ? 'true' : 'false')
      await scheduleUnitSession(formData)
      router.refresh()
    })
  }

  function handleStartPainting() {
    startTransition(async () => {
      await startUnitSession(unit.id)
      router.push(`/units/${unit.id}?preview=1&tab=paint&session=started`)
      router.refresh()
    })
  }

  return (
    <>
      <section className="rounded-[14px] border border-white/[0.06] bg-[#111821] p-4">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-[9px] font-black uppercase tracking-[0.26em] text-white/28">
              Time Logged
            </p>
            <div className="mt-2 flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <p className="text-[29px] font-black leading-none text-white">
                {unit.logged}
              </p>
              <p className="text-[10px] font-black text-white/28">
                {lastPaintedLabel}
              </p>
            </div>
          </div>

          <button
            type="button"
            className="mb-1 rounded-full px-2 py-1 text-[10px] font-black text-white/34 transition hover:bg-white/[0.06] hover:text-cyan-300"
          >
            History -&gt;
          </button>
        </div>

        <div className="mt-4 grid grid-cols-[1fr_auto] gap-2">
          <button
            type="button"
            onClick={handleStartPainting}
            className="tap-press flex h-11 items-center justify-center gap-2 rounded-[10px] bg-[color:var(--og-brass-500)] bg-[image:var(--og-material-brass)] text-sm font-black text-[color:var(--og-ink-950)] shadow-[var(--og-shadow-brass-plate)] transition hover:bg-[color:var(--og-brass-400)]"
          >
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              className="h-4 w-4"
              fill="currentColor"
            >
              <path d="M8 5v14l11-7Z" />
            </svg>
            Start Painting
          </button>

          <button
            type="button"
            onClick={() => openScheduleForm()}
            className="tap-press h-11 rounded-[10px] px-4 text-sm font-black transition"
          >
            Schedule
          </button>
        </div>
      </section>

      <section className="overflow-hidden rounded-[14px] border border-white/[0.06] bg-[#111821]">
        <div className="flex items-center justify-between border-b border-white/[0.05] px-3 py-3">
          <button
            type="button"
            aria-label="Previous month"
            onClick={() => handleMonthStep(-1)}
            className="grid h-8 w-8 place-items-center rounded-full bg-white/[0.06] text-white/38 transition hover:text-white"
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
              <path d="m15 18-6-6 6-6" />
            </svg>
          </button>

          <h2
            className="text-sm font-black text-white"
            data-v3-unit-calendar-month={formatMonthLabel(monthCursor)}
          >
            {formatMonthLabel(monthCursor)}
          </h2>

          <button
            type="button"
            aria-label="Next month"
            onClick={() => handleMonthStep(1)}
            className="grid h-8 w-8 place-items-center rounded-full bg-white/[0.06] text-white/38 transition hover:text-white"
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
              <path d="m9 18 6-6-6-6" />
            </svg>
          </button>
        </div>

        <div className="grid grid-cols-7 px-3 pt-4 text-center text-[10px] font-black text-white/28">
          {weekDayLabels.map((dayLabel, index) => (
            <span key={`${dayLabel}-${index}`}>{dayLabel}</span>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-y-1 px-3 py-4">
          {Array.from({ length: monthDays.offset }).map((_, index) => (
            <span key={`blank-${index}`} className="h-12" />
          ))}

          {monthDays.days.map((day) => {
            const loggedCount = loggedByDate.get(day.dateKey)?.length ?? 0
            const scheduledCount = scheduledByDate.get(day.dateKey)?.length ?? 0
            const hasLogged = loggedCount > 0
            const hasScheduled = scheduledCount > 0
            const isSelected = selectedDateKey === day.dateKey
            const isToday = todayKey === day.dateKey
            const isBrassDay = hasLogged || hasScheduled || isToday
            const isFuture = day.dateKey > todayKey

            return (
              <button
                key={day.dateKey}
                type="button"
                onClick={() => handleDaySelect(day.dateKey)}
                aria-label={
                  hasLogged
                    ? `${formatDateLabel(day.dateKey)}, ${loggedCount} painting session logged`
                    : hasScheduled
                      ? `Painting session scheduled on ${formatScheduleTitle(day.dateKey)}`
                    : isFuture
                      ? `Schedule painting session on ${formatScheduleTitle(day.dateKey)}`
                      : formatScheduleTitle(day.dateKey)
                }
                className={[
                  'mx-auto flex h-12 w-12 flex-col items-center justify-center rounded-[12px] text-xs font-black transition',
                  isBrassDay
                    ? 'bg-[color:color-mix(in_srgb,var(--og-brass-500)_72%,var(--og-paper-50))] bg-[image:var(--og-material-brass)] text-[color:var(--og-ink-950)] shadow-[var(--og-shadow-contact)]'
                    : 'text-white/42 hover:bg-white/[0.05] hover:text-white/72',
                  isSelected
                    ? 'border border-[color:color-mix(in_srgb,var(--og-paper-50)_72%,var(--og-brass-500))] bg-[color:var(--og-brass-500)] text-[color:var(--og-ink-950)] shadow-[var(--og-shadow-brass-plate),0_0_0_3px_color-mix(in_srgb,var(--og-brass-500)_22%,transparent),0_0_22px_color-mix(in_srgb,var(--og-brass-500)_32%,transparent)]'
                    : 'border border-transparent',
                  isFuture && !hasLogged
                    ? 'hover:border-[color:color-mix(in_srgb,var(--og-brass-500)_42%,transparent)]'
                    : '',
                ].join(' ')}
              >
                <span>{day.day}</span>
                {hasLogged ? (
                  <span className="mt-1 h-1.5 w-1.5 rounded-full bg-[color:var(--og-ink-950)]" />
                ) : null}
                {!hasLogged && hasScheduled ? (
                  <span className="mt-1 h-1.5 w-1.5 rounded-full bg-[color:var(--og-ink-950)]" />
                ) : null}
              </button>
            )
          })}
        </div>

        {selectedLoggedSessions.length ? (
          <div className="border-t border-white/[0.06] px-4 py-4">
            <div className="flex items-start justify-between gap-4">
              <p className="text-[10px] font-black uppercase tracking-[0.24em] text-white/34">
                {formatDateLabel(selectedDateKey)}
              </p>
              <button
                type="button"
                onClick={() => openScheduleForm(selectedDateKey)}
                className="tap-press rounded-[8px] border border-[color:color-mix(in_srgb,var(--og-brass-700)_52%,var(--og-border-subtle))] bg-[color:color-mix(in_srgb,var(--og-brass-500)_14%,transparent)] px-2 py-1 text-[10px] font-black text-[color:var(--og-brass-500)] transition hover:border-[color:var(--og-brass-500)] hover:bg-[color:color-mix(in_srgb,var(--og-brass-500)_22%,transparent)]"
              >
                + Add
              </button>
            </div>
            <div className="mt-4 grid gap-4">
              {selectedLoggedSessions.map((session) => (
                <div
                  key={session.id}
                  className="flex items-start justify-between gap-4"
                >
                  <div>
                    <h3 className="text-lg font-black text-white">
                      {session.title}
                    </h3>
                    <p className="mt-2 text-xs font-black text-white/36">
                      {session.duration}
                    </p>
                    {session.notes ? (
                      <p className="mt-3 text-xs font-semibold leading-5 text-white/45">
                        {session.notes}
                      </p>
                    ) : null}
                  </div>
                  <button
                    type="button"
                    aria-label="Edit session"
                    className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white/[0.06] text-white/36 transition hover:text-cyan-300"
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
                      <path d="M12 20h9" />
                      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {selectedScheduledSession ? (
          <div className="border-t border-white/[0.06] px-4 py-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.24em] text-yellow-300">
                  Scheduled Session
                </p>
                <h3 className="mt-3 text-lg font-black text-white">
                  {formatScheduleTitle(selectedScheduledSession.dateKey)} at{' '}
                  {selectedScheduledSession.time}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => openScheduleForm(selectedScheduledSession.dateKey)}
                className="tap-press rounded-[8px] border border-[color:color-mix(in_srgb,var(--og-brass-700)_52%,var(--og-border-subtle))] bg-[color:color-mix(in_srgb,var(--og-brass-500)_14%,transparent)] px-2 py-1 text-[10px] font-black text-[color:var(--og-brass-500)] transition hover:border-[color:var(--og-brass-500)] hover:bg-[color:color-mix(in_srgb,var(--og-brass-500)_22%,transparent)]"
              >
                Edit
              </button>
            </div>
            <p className="mt-2 text-xs font-black text-white/36">
              {selectedScheduledSession.duration}m planned
              {selectedScheduledSession.notify ? ' - notify enabled' : ''}
            </p>
            <p className="mt-3 text-sm font-black leading-5 text-white/72">
              {selectedScheduledSession.focus}
            </p>
            {selectedScheduledSession.notes ? (
              <p className="mt-2 text-xs font-semibold leading-5 text-white/42">
                {selectedScheduledSession.notes}
              </p>
            ) : null}
          </div>
        ) : null}

        {isFutureSelection && !selectedScheduledSession ? (
          <div className="border-t border-white/[0.06] px-4 py-4">
            <p className="text-[10px] font-black uppercase tracking-[0.24em] text-cyan-300">
              Future Session
            </p>
            <h3 className="mt-3 text-lg font-black text-white">
              Schedule {formatScheduleTitle(selectedDateKey)}
            </h3>
            <p className="mt-2 text-xs font-semibold leading-5 text-white/45">
              Hold time for a focused painting session and decide what to work
              on before the brush hits the desk.
            </p>
            <button
              type="button"
              onClick={() => openScheduleForm(selectedDateKey)}
              className="tap-press mt-4 h-11 w-full rounded-[10px] text-sm font-black transition"
            >
              Schedule Painting Session
            </button>
          </div>
        ) : null}
      </section>

      <button
        type="button"
        className="tap-press flex h-14 items-center justify-center gap-3 rounded-[14px] border border-dashed border-[color:color-mix(in_srgb,var(--og-brass-700)_42%,var(--og-border-subtle))] bg-black/18 text-sm font-black text-white/45 transition hover:border-[color:var(--og-brass-500)] hover:text-[color:var(--og-brass-500)]"
      >
        <span className="text-xl leading-none">+</span>
        Log a Session Manually
      </button>

      {isScheduleOpen ? (
        <div
          className="fixed inset-0 z-[70] grid place-items-end bg-black/65 px-3 py-4 backdrop-blur-sm"
          data-v3-unit-indicator="schedule-scrim"
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="schedule-session-title"
            className="w-full max-w-md rounded-[14px] border border-white/10 bg-[#10161d] p-4 shadow-2xl shadow-black/50"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.22em] text-cyan-300">
                  Schedule
                </p>
                <h2
                  id="schedule-session-title"
                  className="mt-1 text-2xl font-black leading-tight"
                >
                  {formatScheduleTitle(selectedDateKey)} session
                </h2>
              </div>
              <button
                type="button"
                aria-label="Close schedule session"
                onClick={() => setIsScheduleOpen(false)}
                className="grid h-10 w-10 place-items-center rounded-full bg-white/[0.06] text-lg font-black text-white/48 transition hover:text-white"
              >
                x
              </button>
            </div>

            <form onSubmit={handleScheduleSubmit} className="mt-5 grid gap-4">
              <div className="grid grid-cols-2 gap-3">
                <label className="grid gap-2">
                  <span className="text-xs font-black uppercase tracking-[0.18em] text-white/42">
                    Time
                  </span>
                  <input
                    type="time"
                    value={scheduleTime}
                    onChange={(event) => setScheduleTime(event.target.value)}
                    className="h-12 rounded-[10px] border border-white/10 bg-black/24 px-4 text-sm font-black text-white outline-none transition focus:border-cyan-300/70"
                  />
                </label>

                <label className="grid gap-2">
                  <span className="text-xs font-black uppercase tracking-[0.18em] text-white/42">
                    Minutes
                  </span>
                  <input
                    inputMode="numeric"
                    value={scheduleDuration}
                    onChange={(event) =>
                      setScheduleDuration(event.target.value)
                    }
                    className="h-12 rounded-[10px] border border-white/10 bg-black/24 px-4 text-sm font-black text-white outline-none transition focus:border-cyan-300/70"
                  />
                </label>
              </div>

              <label className="grid gap-2">
                <span className="text-xs font-black uppercase tracking-[0.18em] text-white/42">
                  Focus
                </span>
                <input
                  value={scheduleFocus}
                  onChange={(event) => setScheduleFocus(event.target.value)}
                  className="h-12 rounded-[10px] border border-white/10 bg-black/24 px-4 text-sm font-semibold text-white outline-none transition focus:border-cyan-300/70"
                />
              </label>

              <label className="grid gap-2">
                <span className="text-xs font-black uppercase tracking-[0.18em] text-white/42">
                  Notes
                </span>
                <textarea
                  rows={3}
                  value={scheduleNotes}
                  onChange={(event) => setScheduleNotes(event.target.value)}
                  className="resize-none rounded-[10px] border border-white/10 bg-black/24 px-4 py-3 text-sm font-semibold text-white outline-none transition focus:border-cyan-300/70"
                />
              </label>

              <label className="flex items-center gap-3 rounded-[10px] border border-white/10 bg-black/24 px-4 py-3 text-sm font-black text-white/62">
                <input
                  type="checkbox"
                  checked={scheduleNotify}
                  onChange={(event) => setScheduleNotify(event.target.checked)}
                  className="h-4 w-4 accent-[var(--og-brass-500)]"
                />
                Notify me before this session
              </label>

              <button
                type="submit"
                className="h-12 rounded-[10px] bg-[color:var(--og-brass-500)] bg-[image:var(--og-material-brass)] text-sm font-black text-[color:var(--og-ink-950)] shadow-[var(--og-shadow-brass-plate)] transition hover:bg-[color:var(--og-brass-400)]"
              >
                Save Scheduled Session
              </button>
            </form>
          </section>
        </div>
      ) : null}
    </>
  )
}

function ProgressTab({
  unit,
  onEditGallery,
  onLocalUnitChange,
}: {
  unit: PreviewUnit
  onEditGallery: () => void
  onLocalUnitChange: (updater: (current: PreviewUnit | null) => PreviewUnit | null) => void
}) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [openTool, setOpenTool] = useState<'photo' | 'paint' | 'note' | null>(null)
  const [stageNotes, setStageNotes] = useState<Record<string, string>>({})
  const liveStages = useMemo(() => buildProgressStages(unit), [unit])
  const initialStageId =
    liveStages.find((stage) => stage.status !== 'complete')?.id ??
    liveStages[0]?.id ??
    'primed'
  const [selectedStageId, setSelectedStageId] = useState<string>(initialStageId)
  const selectedStage =
    liveStages.find((stage) => stage.id === selectedStageId) ??
    liveStages[0] ??
    progressStages[1]
  const selectedStepId = 'stepId' in selectedStage ? selectedStage.stepId : null
  const selectedStepKey = selectedStage.stepKey ?? getProgressStageStepKey(selectedStage.id)
  const selectedPaints = selectedStepId
    ? (unit.stagePaints ?? [])
        .filter((paint) => paint.progress_step_id === selectedStepId)
        .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
    : []
  const selectedStagePhotos = (unit.galleryImages ?? []).filter(
    (image) => image.stageKey === selectedStepKey
  )
  const selectedNoteKey = selectedStepId ?? selectedStepKey
  const selectedNote = stageNotes[selectedNoteKey] ?? ''

  function handleMarkComplete() {
    if (!selectedStepId || selectedStage.id === 'done') return

    const nextStatus = selectedStage.status === 'complete' ? 'pending' : 'done'
    onLocalUnitChange((current) =>
      current
        ? {
            ...current,
            progressSteps: current.progressSteps?.map((step) =>
              step.id === selectedStepId
                ? {
                    ...step,
                    status: nextStatus,
                    progress: nextStatus === 'done' ? 100 : 0,
                  }
                : step
            ),
          }
        : current
    )

    startTransition(async () => {
      const formData = new FormData()
      formData.set('unitId', unit.id)
      formData.set('stepId', selectedStepId)
      formData.set('nextStatus', nextStatus)
      await toggleStepDone(formData)
      router.refresh()
    })
  }

  return (
    <>
      <section className="border-b border-white/[0.08] px-2 py-3">
        <div className="grid grid-cols-6 items-start gap-1">
          {liveStages.map((stage) => {
            const isSelected = selectedStage.id === stage.id
            const isComplete = stage.status === 'complete'
            const isCurrent = stage.status === 'current'

            return (
              <button
                key={stage.id}
                type="button"
                onClick={() => setSelectedStageId(stage.id)}
                aria-pressed={isSelected}
                data-stage-state={
                  isComplete ? 'complete' : isCurrent ? 'current' : 'todo'
                }
                data-stage-selected={isSelected ? 'true' : 'false'}
                className="group grid min-h-[70px] min-w-0 justify-items-center gap-1.5 text-center"
              >
                <span
                  className={[
                    'grid h-12 w-12 place-items-center rounded-full border transition',
                    isComplete
                      ? 'text-[color:var(--og-ink-950)]'
                      : 'text-white/34 group-hover:text-white/64',
                  ].join(' ')}
                >
                  <StageIcon name={stage.icon} />
                </span>
                <span
                  className={[
                    'max-w-full truncate text-[10px] font-black',
                    isSelected || isComplete || isCurrent
                      ? 'text-white/70'
                      : 'text-white/24 group-hover:text-white/50',
                  ].join(' ')}
                >
                  {stage.label}
                </span>
              </button>
            )
          })}
        </div>
      </section>

      <section className="rounded-[18px] border border-white/[0.06] bg-[#111821] p-5 shadow-[0_18px_40px_rgba(0,0,0,0.22)]">
        <div className="flex items-start gap-4">
          <span className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-[color:color-mix(in_srgb,var(--og-brass-500)_14%,transparent)] text-[color:var(--og-brass-500)]">
            <StageIcon name={selectedStage.icon} />
          </span>

          <div className="min-w-0 pt-1">
            <h2 className="text-xl font-black leading-none text-white">
              {selectedStage.title}
            </h2>
            <p
              className={[
                'mt-2 text-[10px] font-black uppercase tracking-[0.18em]',
                selectedStage.status === 'current'
                  ? 'text-[color:var(--og-brass-500)]'
                  : selectedStage.status === 'complete'
                    ? 'text-[color:var(--og-brass-600)]'
                    : 'text-white/30',
              ].join(' ')}
            >
              {getStageStatusLabel(selectedStage.status)}
            </p>
          </div>
        </div>

        <p className="mt-6 text-base font-semibold leading-6 text-white/58">
          {selectedStage.description}
        </p>

        <div className="mt-5 grid grid-cols-3 gap-2">
          <StageToolButton
            icon="photo"
            active={openTool === 'photo'}
            onClick={() => setOpenTool((current) => (current === 'photo' ? null : 'photo'))}
          >
            Photos
          </StageToolButton>
          <StageToolButton
            icon="paint"
            active={openTool === 'paint'}
            onClick={() => setOpenTool((current) => (current === 'paint' ? null : 'paint'))}
          >
            Paints
          </StageToolButton>
          <StageToolButton
            icon="note"
            active={openTool === 'note'}
            onClick={() => setOpenTool((current) => (current === 'note' ? null : 'note'))}
          >
            Notes
          </StageToolButton>
        </div>

        {openTool === 'photo' ? (
          <div className="mt-4 rounded-[12px] border border-white/10 bg-black/18 p-3">
            {selectedStagePhotos.length ? (
              <div className="grid grid-cols-3 gap-2">
                {selectedStagePhotos.map((image) => (
                  <button
                    key={image.id}
                    type="button"
                    onClick={onEditGallery}
                    className="relative aspect-square overflow-hidden rounded-[8px] border border-white/10 bg-black/30 text-left"
                    aria-label={`Open ${selectedStage.title} photo`}
                  >
                    <Image
                      src={image.image}
                      alt={image.alt || `${selectedStage.title} progress photo`}
                      fill
                      sizes="96px"
                      className="object-cover"
                    />
                  </button>
                ))}
              </div>
            ) : (
              <p className="rounded-[10px] border border-white/10 bg-black/20 px-3 py-4 text-sm font-semibold text-white/42">
                No photos saved for {selectedStage.title} yet.
              </p>
            )}
            <button
              type="button"
              onClick={onEditGallery}
              className="tap-press mt-3 flex min-h-[48px] w-full items-center justify-between rounded-[10px] px-3 text-left text-sm font-black"
            >
              Manage {selectedStage.title} Photos
              <span aria-hidden="true">-&gt;</span>
            </button>
          </div>
        ) : null}

        {openTool === 'paint' && selectedStepId ? (
          <div className="mt-4 rounded-[12px] border border-white/10 bg-black/18 p-3">
            {selectedPaints.length ? (
              <div className="mb-3 grid grid-cols-3 gap-2">
                {selectedPaints.map((paint) => {
                  const name =
                    paint.paint_source === 'custom'
                      ? paint.custom_paint?.name
                      : paint.catalog_paint?.name
                  const brand =
                    paint.paint_source === 'custom'
                      ? paint.custom_paint?.manufacturer
                      : paint.catalog_paint?.brand
                  const line =
                    paint.paint_source === 'custom'
                      ? paint.custom_paint?.series
                      : paint.catalog_paint?.line
                  const color =
                    paint.paint_source === 'custom'
                      ? paint.custom_paint?.color_hex
                      : paint.catalog_paint?.hex_approx
                  const swatch =
                    paint.paint_source === 'custom'
                      ? null
                      : paint.catalog_paint?.swatch_image_url

                  return (
                    <div
                      key={paint.id}
                      className="min-w-0 rounded-[10px] border border-[color:color-mix(in_srgb,var(--og-brass-700)_42%,var(--og-border-subtle))] bg-[color:var(--og-paper-100)] bg-[image:var(--og-material-paper-card)] p-1.5 shadow-[var(--og-shadow-contact)]"
                      title={name || 'Paint'}
                    >
                      <div
                        className="aspect-square overflow-hidden rounded-[8px] border border-[color:color-mix(in_srgb,var(--og-brass-700)_48%,var(--og-ink-950))]"
                        style={{ backgroundColor: color || '#262626' }}
                      >
                        {swatch ? (
                          <Image
                            src={swatch}
                            alt=""
                            width={96}
                            height={96}
                            className="h-full w-full object-cover"
                          />
                        ) : null}
                      </div>
                      <p className="mt-1.5 truncate text-center text-[8px] font-black uppercase tracking-[0.12em] text-[color:var(--og-brass-700)]">
                        {brand || line || 'Paint'}
                      </p>
                      <p className="mt-0.5 truncate text-center text-[9px] font-black leading-tight text-[color:var(--og-text-primary)]">
                        {name || 'Unnamed paint'}
                      </p>
                    </div>
                  )
                })}
              </div>
            ) : null}
            <StagePaintPicker
              unitId={unit.id}
              progressStepId={selectedStepId}
              onPaintAdded={() => router.refresh()}
              triggerClassName="tap-press flex min-h-[48px] w-full items-center justify-between rounded-[10px] px-3 text-left text-sm font-black"
            />
          </div>
        ) : null}

        {openTool === 'note' ? (
          <div className="mt-4 rounded-[12px] border border-white/10 bg-black/18 p-3">
            <p className="mb-2 text-[10px] font-black uppercase tracking-[0.18em] text-white/34">
              {selectedStage.title} Notes
            </p>
            <textarea
              key={selectedNoteKey}
              rows={4}
              value={selectedNote}
              onChange={(event) =>
                setStageNotes((current) => ({
                  ...current,
                  [selectedNoteKey]: event.target.value,
                }))
              }
              placeholder={`Notes for ${selectedStage.title}`}
              className="w-full resize-none rounded-[10px] border border-white/10 bg-black/24 px-3 py-2 text-sm font-semibold text-white outline-none"
            />
          </div>
        ) : null}

        <button
          type="button"
          onClick={handleMarkComplete}
          disabled={!selectedStepId || selectedStage.id === 'done'}
          className="tap-press mt-4 flex h-14 w-full items-center justify-center gap-2 rounded-[14px] bg-[color:var(--og-brass-500)] bg-[image:var(--og-material-brass)] text-base font-black text-[color:var(--og-ink-950)] shadow-[var(--og-shadow-brass-plate)] transition hover:bg-[color:var(--og-brass-400)] disabled:cursor-not-allowed disabled:opacity-55"
        >
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            className="h-5 w-5"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="m5 12 4 4L19 6" />
          </svg>
          {selectedStage.status === 'complete'
            ? 'Mark Stage Incomplete'
            : 'Mark Stage Complete'}
        </button>

        <div className="mt-4 flex items-center justify-between text-[10px] font-black uppercase tracking-[0.18em] text-white/22">
          <span>{unit.stage}</span>
          <span>{unit.progress}% overall</span>
        </div>
      </section>
    </>
  )
}

function buildProgressStages(unit: PreviewUnit): DisplayProgressStage[] {
  if (!unit.progressSteps?.length) {
    return progressStages.map((stage) => ({
      ...stage,
      stepKey: getProgressStageStepKey(stage.id),
    }))
  }

  const sorted = unit.progressSteps.slice().sort((a, b) => a.step_order - b.step_order)
  const firstOpenStepId = sorted.find((step) => step.status !== 'done')?.id

  return sorted.map((step) => {
    const fallback =
      progressStages.find((stage) => stage.id === getProgressStageFallbackId(step.step_key)) ??
      progressStages.find((stage) => stage.id === 'done')!

    return {
      ...fallback,
      id: step.id,
      stepId: step.id,
      stepKey: step.step_key,
      label: step.step_label,
      title: step.step_label,
      status:
        step.status === 'done'
          ? 'complete'
          : step.id === firstOpenStepId
            ? 'current'
            : 'todo',
      icon: getProgressStageIcon(step.step_key),
      description: fallback.description,
    }
  })
}

function getProgressStageFallbackId(stepKey: string): ProgressStage['id'] {
  if (stepKey === 'initial_paints') return 'initial-paint'
  if (stepKey === 'fine_details') return 'fine-detail'
  if (stepKey === 'base_rim') return 'base-rim'
  if (stepKey === 'assembled') return 'assembled'
  if (stepKey === 'primed') return 'primed'
  return 'done'
}

function getProgressStageStepKey(stageId: string) {
  if (stageId === 'initial-paint') return 'initial_paints'
  if (stageId === 'fine-detail') return 'fine_details'
  if (stageId === 'base-rim') return 'base_rim'
  return stageId
}

function getProgressStageIcon(stepKey: string): ProgressStageIcon {
  if (stepKey === 'assembled') return 'check'
  if (stepKey === 'primed') return 'primer'
  if (stepKey === 'initial_paints') return 'palette'
  if (stepKey === 'fine_details') return 'sparkles'
  if (stepKey === 'base_rim') return 'mountain'
  return 'done'
}

function getStageStatusLabel(status: ProgressStage['status']) {
  if (status === 'complete') {
    return 'Complete'
  }

  if (status === 'current') {
    return 'In progress'
  }

  return 'Up next'
}

function StageToolButton({
  children,
  icon,
  active = false,
  onClick,
}: {
  children: ReactNode
  icon: 'photo' | 'paint' | 'note'
  active?: boolean
  onClick?: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`${children}`}
      data-v3-unit-indicator="stage-tool-button"
      className={[
        'flex h-11 min-w-0 items-center justify-center gap-2 rounded-full px-2 text-sm font-black transition',
        active
          ? 'bg-[color:color-mix(in_srgb,var(--og-brass-500)_18%,transparent)] text-[color:var(--og-brass-500)] shadow-[0_0_18px_color-mix(in_srgb,var(--og-brass-500)_18%,transparent)]'
          : 'bg-white/[0.06] text-white/44 hover:bg-white/[0.1] hover:text-[color:var(--og-brass-500)]',
      ].join(' ')}
    >
      <StageToolIcon name={icon} />
      <span className="truncate">{children}</span>
    </button>
  )
}

function StageIcon({ name }: { name: ProgressStageIcon }) {
  if (name === 'check') {
    return (
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        className="h-5 w-5"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="m5 12 4 4L19 6" />
      </svg>
    )
  }

  if (name === 'primer') {
    return (
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        className="h-5 w-5"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M8 5h8v14H8z" />
        <path d="M10 8h4" />
        <path d="M10 16h4" />
      </svg>
    )
  }

  if (name === 'palette') {
    return (
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        className="h-5 w-5"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M12 21a9 9 0 1 1 8.4-5.7c-.6 1.4-2 1.7-3.2 1.5-.9-.1-1.7.5-1.7 1.4 0 1.6-1.3 2.8-3.5 2.8Z" />
        <path d="M7.5 10h.01" />
        <path d="M10 6.7h.01" />
        <path d="M14.4 6.9h.01" />
        <path d="M16.8 10.5h.01" />
      </svg>
    )
  }

  if (name === 'sparkles') {
    return (
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        className="h-5 w-5"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M12 3 14 9l6 2-6 2-2 6-2-6-6-2 6-2Z" />
        <path d="M19 3v4" />
        <path d="M21 5h-4" />
        <path d="M5 17v3" />
        <path d="M6.5 18.5h-3" />
      </svg>
    )
  }

  if (name === 'mountain') {
    return (
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        className="h-5 w-5"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="m3 18 6-8 4 5 3-4 5 7Z" />
        <path d="M9 10 7.5 18" />
      </svg>
    )
  }

  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M5 5h14v14H5z" />
      <path d="m8 12 3 3 5-6" />
    </svg>
  )
}

function StageToolIcon({ name }: { name: 'photo' | 'paint' | 'note' }) {
  if (name === 'photo') {
    return (
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        className="h-4 w-4 shrink-0"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M14.5 5 13 3H8L6.5 5H4a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2Z" />
        <circle cx="12" cy="13" r="3" />
      </svg>
    )
  }

  if (name === 'paint') {
    return (
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        className="h-4 w-4 shrink-0"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M12 21a9 9 0 1 1 8.4-5.7c-.6 1.4-2 1.7-3.2 1.5-.9-.1-1.7.5-1.7 1.4 0 1.6-1.3 2.8-3.5 2.8Z" />
        <path d="M8 10h.01" />
        <path d="M12 7h.01" />
        <path d="M16 10h.01" />
      </svg>
    )
  }

  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-4 w-4 shrink-0"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M4 20h16" />
      <path d="m14 4 6 6-9 9H5v-6Z" />
      <path d="m14 4-9 9" />
    </svg>
  )
}

function InfoCell({
  children,
  label,
}: {
  children: ReactNode
  label: string
}) {
  return (
    <div className="min-h-14 border-r border-white/[0.06] px-3 py-2 last:border-r-0">
      <p className="text-[9px] font-black uppercase tracking-[0.2em] text-white/26">
        {label}
      </p>
      <div className="mt-1.5">{children}</div>
    </div>
  )
}
