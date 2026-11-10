'use client'

import Image from 'next/image'
import dynamic from 'next/dynamic'
import { useCallback, useEffect, useMemo, useState, useTransition } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'
import { useRouter } from '@/app/components/navigation-feedback/navigation-provider'
import { findVisibleFeatureGuideIndex } from '../../components/feature-guide-navigation'
import { unitPreviewFeatureGuides } from '../../components/feature-guide-presets'
import type { FeatureGuideEntry } from '../../components/feature-guide-types'
import V3PerfIndicator from '../../components/v3-perf-indicator'
import {
  deleteUnitImage,
  deleteUnit,
  reorderUnitImages,
  setFeaturedUnit,
  setFeaturedUnitImage,
  unfeatureUnit,
  updateUnitDetails,
  updateUnitHeader,
  updateUnitStatus,
  uploadUnitGalleryImages,
} from './actions'
import type { GalleryUploadResult } from '../../../utils/images/gallery-upload'
import WorkbenchGallery from '../../components/gallery/workbench-gallery'
import FeatureOnDashboardButton from '../../components/feature-on-dashboard-button'
import styles from './unit-v3-silver.module.css'
import { OverviewTab, WorkflowTab, type WorkbenchTab } from './unit-workbench-tabs'
import type { UnitWorkflow } from './unit-workflow-model'

const FeatureGuideTour = dynamic(() => import('../../components/feature-guide-tour'), {
  ssr: false,
})

type UnitV3PreviewProps = {
  id: string
  autoStartSession?: boolean
  initialTab?: UnitTab
  initialEditTarget?: EditTarget | null
  featureGuides?: FeatureGuideEntry[]
  liveUnit?: PreviewUnit | null
}

type UnitTab = WorkbenchTab

export type PreviewUnit = {
  id: string
  name: string
  notes?: string | null
  label: string
  isFeatured?: boolean
  image: string
  galleryImages?: PreviewGalleryImage[]
  paintSessions?: UnitPaintSession[]
  activeSession?: { id: string; started_at: string; paused_at?: string | null; paused_seconds?: number | null } | null
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
  // The old six fixed stages; kept for Paint Mode and the dashboard until
  // they move to guide-driven progress too.
  progressSteps?: PreviewProgressStep[]
  // Guide-driven checklist (Workflow tab).
  workflow?: UnitWorkflow
  // Painting Notes added on the unit page (unit_notes), newest first.
  unitNotes?: UnitNote[]
  unitNotesAvailable?: boolean
  availableProjects?: PreviewProject[]
  selectedProjectIds?: string[]
}

export type UnitV3LiveUnit = PreviewUnit

export type PreviewGalleryImage = {
  id: string
  image: string
  alt: string
  isFeatured: boolean
  stageKey?: string | null
  // Progress / Snapshots (Paint Mode snapshots and old stage photos) as
  // opposed to Inspiration / Art.
  isSnapshot?: boolean
  sessionId?: string | null
  createdAt?: string | null
  sortOrder?: number | null
  storageBucket?: string | null
  storagePath?: string | null
  isOptimistic?: boolean
}

export type UnitNote = {
  id: string
  body: string
  createdAt: string
  updatedAt: string
}

export type UnitPaintSession = {
  durationSeconds?: number | null
  id: string
  dateKey: string
  startedAt: string
  title: string
  duration: string
  notes: string
}

type PreviewProject = {
  id: string
  name: string | null
}

export type UnitStatus = 'complete' | 'active' | 'bench' | 'pile' | 'other'
type EditTarget = 'details' | 'header' | 'gallery'

type PreviewPalettePaint = {
  themePaintId: string
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
  notes?: string | null
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

export type ScheduledPaintSession = {
  scheduledStartAt?: string
  id?: string
  dateKey: string
  time: string
  duration: string
  focus: string
  notes: string
  notify: boolean
  reminderHoursBefore?: number
  reminderChannel?: 'push' | 'email'
}

export default function UnitV3Preview({
  autoStartSession = false,
  id,
  initialTab = 'overview',
  initialEditTarget = null,
  featureGuides = unitPreviewFeatureGuides,
  liveUnit = null,
}: UnitV3PreviewProps) {
  const [activeGuideIndex, setActiveGuideIndex] = useState<number | null>(null)
  const [isPending, startTransition] = useTransition()
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [localUnit, setLocalUnit] = useState<PreviewUnit | null>(liveUnit)
  // Both tabs render from the same server payload, so switching is local
  // state mirrored into ?tab= (no server round trip).
  // Read the URL first: coming Back (e.g. from a guide card opened from the
  // Workflow tab) restores ?tab= but reuses the payload rendered for the
  // tab the page was first opened on.
  const [activeTab, setActiveTab] = useState<UnitTab>(() => {
    const tabParam = searchParams.get('tab')
    if (tabParam === 'workflow' || tabParam === 'paint' || tabParam === 'progress') return 'workflow'
    // No ?tab= means Overview; initialTab only covers a missing URL.
    return searchParams.size || tabParam !== null ? 'overview' : initialTab
  })
  // ?autostart=1 starts a session once, on first render only.
  const [autoStart, setAutoStart] = useState(autoStartSession)
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

  useEffect(() => {
    setLocalUnit(liveUnit)
  }, [liveUnit])

  function showGuideAt(index: number) {
    setActiveGuideIndex(index)
  }

  function navigateTab(tab: UnitTab) {
    setActiveTab(tab)
    setAutoStart(false)
    const params = new URLSearchParams(searchParams.toString())
    params.delete('edit')
    if (tab === 'overview') {
      params.delete('tab')
    } else {
      params.set('tab', tab)
    }
    const query = params.toString()
    window.history.replaceState(null, '', query ? `${pathname}?${query}` : pathname)
  }

  function editorUrl(target: EditTarget | null) {
    const params = new URLSearchParams()
    params.set('preview', '1')
    if (activeTab !== 'overview') params.set('tab', activeTab)
    if (target) params.set('edit', target)
    return `${pathname}?${params.toString()}`
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
    window.history.replaceState(null, '', editorUrl(target))
  }

  function closeLiveEditor() {
    setEditTarget(null)
    window.history.replaceState(null, '', editorUrl(null))
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
            fetchPriority="high"
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
                data-v3-unit-indicator="hero-help"
                data-feature-guide-launcher-button="true"
                className="grid h-10 w-10 place-items-center rounded-full"
              >
                <span className="relative z-10">?</span>
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

            </div>
          </div>

          <div
            className="absolute inset-x-0 bottom-4 z-10 flex items-end justify-between gap-3 px-4"
            data-v3-unit-indicator="hero-title"
          >
            <div className="min-w-0">
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
            {liveUnit ? (
              <FeatureOnDashboardButton
                entityLabel="unit"
                isFeatured={Boolean(unit.isFeatured)}
                onToggle={async (nextFeatured) => {
                  setLocalUnit((current) =>
                    current ? { ...current, isFeatured: nextFeatured } : current
                  )
                  try {
                    if (nextFeatured) {
                      await setFeaturedUnit(unit.id)
                    } else {
                      await unfeatureUnit(unit.id)
                    }
                  } catch (error) {
                    setLocalUnit((current) =>
                      current ? { ...current, isFeatured: !nextFeatured } : current
                    )
                    throw error
                  }
                }}
              />
            ) : null}
          </div>
        </section>

        <div className="px-3">
          <div
            className="grid grid-cols-2 rounded-[8px] p-1"
            data-v3-unit-indicator="unit-tabs"
            role="tablist"
            aria-label="Unit sections"
          >
            {(['overview', 'workflow'] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                role="tab"
                id={`unit-tab-${tab}`}
                aria-selected={activeTab === tab}
                aria-controls={`unit-panel-${tab}`}
                data-feature-guide-target={`units.detail.tabs.${tab}`}
                onClick={() => navigateTab(tab)}
                className="h-11 rounded-[6px] px-1 text-base transition"
              >
                {tab === 'overview' ? 'Overview' : 'Workflow'}
              </button>
            ))}
          </div>

          <div
            role="tabpanel"
            id={`unit-panel-${activeTab}`}
            aria-labelledby={`unit-tab-${activeTab}`}
            data-v3-unit-indicator="workbench"
          >
            {activeTab === 'overview' ? (
              <OverviewTab
                key={`overview-${unit.id}`}
                unit={unit}
                autoStart={autoStart}
                onEditGallery={() => openLiveEditor('gallery')}
                onLocalUnitChange={setLocalUnit}
              />
            ) : (
              <WorkflowTab
                key={`workflow-${unit.id}`}
                unit={unit}
                autoStart={autoStart}
                onLocalUnitChange={setLocalUnit}
              />
            )}
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
          onLocalUnitChange={setLocalUnit}
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
  onLocalUnitChange,
}: {
  unit: PreviewUnit
  target: EditTarget
  isPending: boolean
  onClose: () => void
  onHeaderSubmit: (formData: FormData) => void
  onDetailsSubmit: (formData: FormData) => void
  onLocalUnitChange: (updater: (current: PreviewUnit | null) => PreviewUnit | null) => void
}) {
  const isHeader = target === 'header'
  const isDetails = target === 'details'
  const selectedProjectIds = unit.selectedProjectIds ?? []
  const availableProjects = unit.availableProjects ?? []
  const selectedProjectNames = availableProjects
    .filter((project) => selectedProjectIds.includes(project.id))
    .map((project) => project.name || 'Untitled project')
  const projectDropdownLabel =
    selectedProjectNames.length > 0
      ? selectedProjectNames.join(', ')
      : 'No parent project selected'

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
                  : 'Unit gallery'}
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

              <details
                className="grid gap-2 rounded-[10px] border border-white/10 bg-black/24 p-3"
                data-v3-unit-indicator="project-picker"
              >
                <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 rounded-[8px] px-2 text-sm font-black">
                  <span className="min-w-0">
                    <span className="block text-xs font-black uppercase tracking-[0.18em]">
                      Parent Project
                    </span>
                    <span className="mt-1 block truncate text-sm">
                      {projectDropdownLabel}
                    </span>
                  </span>
                  <span aria-hidden="true">v</span>
                </summary>
                {availableProjects.length > 0 ? (
                  <div className="mt-2 grid max-h-56 gap-2 overflow-y-auto pr-1">
                    {availableProjects.map((project) => (
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
                    ))}
                  </div>
                ) : (
                  <p className="px-2 py-3 text-sm font-semibold text-white/40">
                    No parent projects yet.
                  </p>
                )}
              </details>

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
          <div className="mt-5">
            <UnitV3GalleryCard unit={unit} onLocalUnitChange={onLocalUnitChange} />
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

function UnitV3GalleryCard({
  unit,
  onLocalUnitChange,
}: {
  unit: PreviewUnit
  onLocalUnitChange: (updater: (current: PreviewUnit | null) => PreviewUnit | null) => void
}) {
  const images = useMemo(() => unit.galleryImages ?? [], [unit.galleryImages])

  const handleImagesChange = useCallback(
    (nextImages: PreviewGalleryImage[]) => {
      const featuredImage =
        nextImages.find((image) => image.isFeatured) ?? nextImages[0] ?? null

      onLocalUnitChange((current) =>
        current
          ? {
              ...current,
              galleryImages: nextImages,
              image: featuredImage?.image ?? current.image,
            }
          : current
      )
    },
    [onLocalUnitChange]
  )

  return (
    <WorkbenchGallery<PreviewGalleryImage>
      images={images}
      subtitle="unit photos and the hero image"
      emptyText="No unit photos yet."
      featureGuideTarget="units.detail.gallery"
      samplerSourceType="unit_gallery"
      getSrc={(image) => image.image}
      getAlt={(image) => image.alt || unit.name}
      isPending={(image) => Boolean(image.isOptimistic)}
      createOptimisticImage={(_file, previewUrl) => ({
        id: `optimistic-${crypto.randomUUID()}`,
        image: previewUrl,
        alt: unit.name,
        isFeatured: false,
        createdAt: new Date().toISOString(),
        sortOrder: null,
        storageBucket: null,
        storagePath: null,
        isOptimistic: true,
      })}
      onImagesChange={handleImagesChange}
      uploadImages={async (files, source) => {
        const formData = new FormData()
        formData.set('unitId', unit.id)
        formData.set('uploadSource', source)
        files.forEach((file) => formData.append('image', file))

        const result = await uploadUnitGalleryImages(formData)

        return {
          uploaded: mapUploadedUnitImages(result, unit.name),
          error: result?.failed.length
            ? `Could not upload ${result.failed
                .map((failure) => `${failure.fileName}: ${failure.reason}`)
                .join('; ')}`
            : null,
        }
      }}
      setFeaturedImage={(imageId) => setFeaturedUnitImage(unit.id, imageId)}
      deleteImages={async (imageIds) => {
        const formData = new FormData()
        formData.set('unitId', unit.id)
        imageIds.forEach((imageId) => formData.append('imageIds', imageId))
        await deleteUnitImage(formData)
      }}
      reorderImages={(imageIds) => reorderUnitImages(unit.id, imageIds)}
    />
  )
}

function mapUploadedUnitImages(
  result: GalleryUploadResult | void,
  fallbackAlt: string
): PreviewGalleryImage[] {
  return (result?.uploadedImages ?? []).map((image) => ({
    id: image.id,
    image: image.image_url,
    alt: image.alt_text || fallbackAlt,
    isFeatured: image.is_featured,
    createdAt: image.created_at,
    sortOrder: image.sort_order,
    storageBucket: image.storage_bucket,
    storagePath: image.storage_path,
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

