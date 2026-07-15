'use client'

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from 'react'
import type { ChangeEvent } from 'react'
import dynamic from 'next/dynamic'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import {
  publishDashboardMetadataPatch,
  publishDashboardUnitPatch,
  type DashboardSyncStatus,
} from '../../dashboard/dashboard-sync'
import {
  deleteUnitImage,
  deleteUnit,
  expireUnitSessionAtTwoHours,
  removePaintFromStage,
  setFeaturedUnitImage,
  toggleStepDone,
  updateUnitDetails,
  updateUnitHeader,
  updateUnitStatus,
  uploadUnitGalleryImages,
} from './actions'
import { createClient } from '../../../utils/supabase/client'
import LazyUnitSessionTracker from './components/lazy-unit-session-tracker'
const DeleteConfirmationCard = dynamic(
  () => import('../../components/delete-confirmation-card')
)
const UnitCompletedShareModal = dynamic(
  () => import('@/components/share/UnitCompletedShareModal')
)
const UnitCompletedInlinePreview = dynamic(
  () => import('@/components/share/UnitCompletedInlinePreview'),
  {
    loading: () => (
      <section className="mx-auto mt-8 h-48 max-w-[470px] animate-pulse rounded-[24px] border border-[#d8a84f]/25 bg-white/[0.035]" />
    ),
  }
)
const ProjectPaletteCard = dynamic(
  () => import('../../projects/[id]/project-palette-card'),
  {
    loading: () => (
      <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 animate-pulse">
        <div className="h-4 w-32 rounded bg-white/10" />
        <div className="mt-4 h-24 rounded-2xl bg-white/[0.05]" />
      </section>
    ),
  }
)
const UnitProgressTab = dynamic(() => import('./unit-progress-tab'), {
  loading: () => (
    <section className="mt-5 rounded-2xl border border-white/10 bg-white/[0.035] p-4">
      <div className="mb-4 flex items-center justify-between">
        <div className="space-y-2">
          <div className="h-7 w-40 rounded bg-white/10" />
          <div className="h-4 w-56 rounded bg-white/5" />
        </div>
        <div className="h-7 w-14 rounded-full bg-cyan-400/10" />
      </div>
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <div
            key={index}
            className="rounded-2xl border border-white/10 bg-black/20 p-4"
          >
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-2xl bg-white/10" />
              <div className="flex-1 space-y-2">
                <div className="h-4 w-32 rounded bg-white/10" />
                <div className="h-3 w-24 rounded bg-white/5" />
              </div>
              <div className="h-12 w-12 rounded-xl bg-white/5" />
            </div>
          </div>
        ))}
      </div>
    </section>
  ),
})
const UnitGallerySection = dynamic(() => import('./components/unit-gallery-section'), {
  loading: () => (
    <section className="mt-10 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
      <div className="space-y-2">
        <div className="h-7 w-48 rounded bg-white/10" />
        <div className="h-4 w-64 rounded bg-white/5" />
      </div>
      <div className="mt-4 grid grid-cols-3 gap-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <div
            key={index}
            className="aspect-square rounded-2xl border border-white/10 bg-white/[0.04]"
          />
        ))}
      </div>
    </section>
  ),
})

type Unit = {
  id: string
  name: string
  notes: string | null
  complexity: number | null
  unit_size: number | null
  deadline: string | null
  is_active: boolean
  is_featured: boolean
  status: UnitStatus
  project_id: string | null
  completed_at: string | null
}

type UnitStatus = 'complete' | 'active' | 'bench' | 'pile' | 'other'

type ParentProject = {
  id: string
  name: string | null
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
  entry_source?: string | null
  notes?: string | null
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
  initialTab: 'overview' | 'progress'
  currentUserId: string
  autoStartSession?: boolean
  unit: Unit
  projectTheme: Theme
  images: UnitImage[]
  steps: ProgressStep[]
  totalLoggedSeconds: number
  activeSession: Session | null
  sessions: Session[]
  stagePaints: StagePaint[]
  parentProjects: ParentProject[]
  availableProjects: ParentProject[]
  selectedProjectIds: string[]
  showSessionStartedNotice?: boolean
}

type StagePaintActionResult =
  | (Omit<StagePaint, 'catalog_paint' | 'custom_paint'> & {
      catalog_paint?: StagePaint['catalog_paint'] | StagePaint['catalog_paint'][]
      custom_paint?: StagePaint['custom_paint'] | StagePaint['custom_paint'][]
    })
  | null

const UNIT_STATUS_OPTIONS: { value: UnitStatus; label: string }[] = [
  { value: 'complete', label: 'Complete' },
  { value: 'active', label: 'Active' },
  { value: 'bench', label: 'Bench' },
  { value: 'pile', label: 'Pile of Shame' },
  { value: 'other', label: 'Other' },
]
const DASHBOARD_PROGRESS_STEP_KEYS = [
  'assembled',
  'primed',
  'initial_paints',
  'fine_details',
  'base_rim',
] as const

function buildOptimisticImage({
  file,
  altText,
  isFeatured,
}: {
  file: File
  altText: string | null
  isFeatured: boolean
}): UnitImage {
  return {
    id: `optimistic-${crypto.randomUUID()}`,
    image_url: URL.createObjectURL(file),
    is_featured: isFeatured,
    created_at: new Date().toISOString(),
    sort_order: 0,
    alt_text: altText,
    storage_bucket: null,
    storage_path: null,
    is_optimistic: true,
  }
}

function getDashboardProgressPercent(
  status: UnitStatus,
  steps: ProgressStep[]
) {
  if (status === 'complete') {
    return 100
  }

  if (steps.some((step) => step.step_key === 'done' && step.status === 'done')) {
    return 100
  }

  return (
    DASHBOARD_PROGRESS_STEP_KEYS.filter((stepKey) =>
      steps.some((step) => step.step_key === stepKey && step.status === 'done')
    ).length * 20
  )
}

function getDashboardFeaturedImageUrl(images: UnitImage[]) {
  return (
    images.find((image) => image.is_featured)?.image_url ??
    images[0]?.image_url ??
    null
  )
}

function getDashboardLastSessionAt(
  activeSession: Session | null,
  sessions: Session[]
) {
  const timestamps = [
    activeSession?.started_at ?? null,
    ...sessions.map((session) => session.started_at),
  ].filter((value): value is string => Boolean(value))

  return timestamps.sort(
    (a, b) => new Date(b).getTime() - new Date(a).getTime()
  )[0] ?? null
}

function getCompletedSessionCount(sessions: Session[]) {
  return sessions.filter((session) => (session.duration_seconds ?? 0) > 0).length
}

export default function UnitDetailClient({
  initialTab,
  currentUserId,
  autoStartSession = false,
  unit: initialUnit,
  projectTheme,
  images,
  steps,
  totalLoggedSeconds,
  activeSession,
  sessions,
  stagePaints,
  parentProjects,
  availableProjects,
  selectedProjectIds,
  showSessionStartedNotice = false,
}: Props) {
  const pathname = usePathname()
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()
  const refreshTimeoutRef = useRef<number | null>(null)
  const hasPublishedDashboardUnitPatchRef = useRef(false)
  const previousDashboardMetadataRef = useRef<{
    totalLoggedSeconds: number
    completedSessionsCount: number
    lastSessionAt: string | null
  } | null>(null)
  const [isSessionNoticeVisible, setIsSessionNoticeVisible] = useState(
    showSessionStartedNotice
  )
  const [unit, setLocalUnit] = useState(initialUnit)
  const [localImages, setLocalImages] = useState(images)
  const [localSessionsState, setLocalSessionsState] = useState(sessions)
  const [localActiveSessionState, setLocalActiveSessionState] =
    useState(activeSession)
  const [localTotalLoggedSecondsState, setLocalTotalLoggedSecondsState] =
    useState(totalLoggedSeconds)
  const [selectedGalleryImageIds, setSelectedGalleryImageIds] = useState<
    string[]
  >([])
  const [isEditingGalleryImages, setIsEditingGalleryImages] = useState(false)
  const [isConfirmingGalleryDelete, setIsConfirmingGalleryDelete] =
    useState(false)
  const [localStagePaints, setLocalStagePaints] = useState(stagePaints)
  const [localParentProjects, setLocalParentProjects] = useState(parentProjects)
  const [localSelectedProjectIds, setLocalSelectedProjectIds] =
    useState(selectedProjectIds)
  const [optimisticSteps, setOptimisticSteps] = useState(steps)
  const [openStageId, setOpenStageId] = useState<string | null>(null)
  const [uploadingStageId, setUploadingStageId] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const cameraInputRef = useRef<HTMLInputElement | null>(null)
  const [selectedGalleryFiles, setSelectedGalleryFiles] = useState<File[]>([])
  const [galleryUploadSource, setGalleryUploadSource] = useState<
    'gallery_picker' | 'camera'
  >('gallery_picker')
  const [galleryUploadError, setGalleryUploadError] = useState<string | null>(
    null
  )
  const galleryFilePreviews = useMemo(
    () =>
      selectedGalleryFiles.map((file) => ({
        file,
        previewUrl: URL.createObjectURL(file),
      })),
    [selectedGalleryFiles]
  )
  const [isEditingHeader, setIsEditingHeader] = useState(false)
  const [isEditingDetails, setIsEditingDetails] = useState(false)
  const [complexityInput, setComplexityInput] = useState(
    unit.complexity ? String(unit.complexity) : ''
  )
  const [unitSizeInput, setUnitSizeInput] = useState(
    unit.unit_size ? String(unit.unit_size) : ''
  )
  const [deadlineInput, setDeadlineInput] = useState(unit.deadline || '')
  const [statusValue, setStatusValue] = useState<UnitStatus>(unit.status)
  const [isShareModalOpen, setIsShareModalOpen] = useState(false)
  const requestedTab = searchParams.get('tab')
  const resolvedTab =
    requestedTab === 'progress' || requestedTab === 'overview'
      ? requestedTab
      : initialTab
  const [currentTab, setCurrentTab] = useState<'overview' | 'progress'>(resolvedTab)

  useEffect(() => {
    let cancelled = false
    const idleWindow = window as Window & {
      requestIdleCallback?: (
        callback: IdleRequestCallback,
        options?: IdleRequestOptions
      ) => number
      cancelIdleCallback?: (handle: number) => void
    }

    const warmInteractions = () => {
      if (cancelled) {
        return
      }

      void import('./unit-progress-tab')
      void import('./components/unit-gallery-section')
    }

    let timeoutId: number | null = null
    let idleId: number | null = null

    if (idleWindow.requestIdleCallback) {
      idleId = idleWindow.requestIdleCallback(warmInteractions, { timeout: 1200 })
    } else {
      timeoutId = window.setTimeout(warmInteractions, 300)
    }

    return () => {
      cancelled = true

      if (idleId !== null && idleWindow.cancelIdleCallback) {
        idleWindow.cancelIdleCallback(idleId)
      }

      if (timeoutId !== null) {
        window.clearTimeout(timeoutId)
      }
    }
  }, [])

  useEffect(() => {
    setCurrentTab(resolvedTab)
  }, [resolvedTab])

  useEffect(() => {
    setLocalUnit(initialUnit)
  }, [initialUnit])

  useEffect(() => {
    setLocalImages(images)
  }, [images])

  useEffect(() => {
    setLocalSessionsState(sessions)
  }, [sessions])

  useEffect(() => {
    setLocalActiveSessionState(activeSession)
  }, [activeSession])

  useEffect(() => {
    setLocalTotalLoggedSecondsState(totalLoggedSeconds)
  }, [totalLoggedSeconds])

  useEffect(() => {
    setLocalStagePaints(stagePaints)
  }, [stagePaints])

  useEffect(() => {
    setLocalParentProjects(parentProjects)
  }, [parentProjects])

  useEffect(() => {
    setLocalSelectedProjectIds(selectedProjectIds)
  }, [selectedProjectIds])

  useEffect(() => {
    if (!showSessionStartedNotice) return

    setIsSessionNoticeVisible(true)
    window.history.replaceState(null, '', pathname)
  }, [pathname, showSessionStartedNotice])

  useEffect(() => {
    if (!localActiveSessionState) {
      return
    }

    const startedAtMs = new Date(localActiveSessionState.started_at).getTime()
    const stopAtMs = startedAtMs + 7200 * 1000
    const delay = Math.max(0, stopAtMs - Date.now())

    const timeout = setTimeout(() => {
      startTransition(async () => {
        await expireUnitSessionAtTwoHours(unit.id)
        router.refresh()
      })
    }, delay)

    return () => {
      clearTimeout(timeout)
    }
  }, [localActiveSessionState, unit.id, router, startTransition])

  useEffect(() => {
    setOptimisticSteps(steps)
  }, [steps])

  useEffect(() => {
    setStatusValue(unit.status)
  }, [unit.status])

  useEffect(() => {
    return () => {
      if (refreshTimeoutRef.current !== null) {
        window.clearTimeout(refreshTimeoutRef.current)
      }
      galleryFilePreviews.forEach((preview) =>
        URL.revokeObjectURL(preview.previewUrl)
      )
    }
  }, [galleryFilePreviews])

  useEffect(() => {
    function openHeaderEditor() {
      setIsEditingHeader(true)

      requestAnimationFrame(() => {
        document
          .getElementById('unit-header-editor')
          ?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      })
    }

    window.addEventListener('unit-header:edit', openHeaderEditor)

    return () => {
      window.removeEventListener('unit-header:edit', openHeaderEditor)
    }
  }, [])

  const handleSessionStateChange = useCallback(
    ({
      activeSession: nextActiveSession,
      sessions: nextSessions,
      totalLoggedSeconds: nextTotalLoggedSeconds,
    }: {
      activeSession: Session | null
      sessions: Session[]
      totalLoggedSeconds: number
    }) => {
      setLocalActiveSessionState(nextActiveSession)
      setLocalSessionsState(nextSessions)
      setLocalTotalLoggedSecondsState(nextTotalLoggedSeconds)
    },
    []
  )

  const dashboardUnitPatch = useMemo(
    () => ({
      unitId: unit.id,
      name: unit.name,
      deadline: unit.deadline,
      status: unit.status as DashboardSyncStatus,
      isFeatured: unit.is_featured,
      updatedAt: new Date().toISOString(),
      progressPercent: getDashboardProgressPercent(unit.status, optimisticSteps),
      primaryImageUrl: getDashboardFeaturedImageUrl(localImages),
      lastSessionAt: getDashboardLastSessionAt(
        localActiveSessionState,
        localSessionsState
      ),
      parentProjectNames: localParentProjects.map(
        (project) => project.name || 'Untitled project'
      ),
    }),
    [
      localActiveSessionState,
      localImages,
      localParentProjects,
      localSessionsState,
      optimisticSteps,
      unit.deadline,
      unit.id,
      unit.is_featured,
      unit.name,
      unit.status,
    ]
  )

  const dashboardMetadataSnapshot = useMemo(
    () => ({
      totalLoggedSeconds: localTotalLoggedSecondsState,
      completedSessionsCount: getCompletedSessionCount(localSessionsState),
      lastSessionAt: getDashboardLastSessionAt(
        localActiveSessionState,
        localSessionsState
      ),
    }),
    [localActiveSessionState, localSessionsState, localTotalLoggedSecondsState]
  )

  useEffect(() => {
    if (!hasPublishedDashboardUnitPatchRef.current) {
      hasPublishedDashboardUnitPatchRef.current = true
      return
    }

    publishDashboardUnitPatch(dashboardUnitPatch)
  }, [dashboardUnitPatch])

  useEffect(() => {
    const previousSnapshot = previousDashboardMetadataRef.current
    previousDashboardMetadataRef.current = dashboardMetadataSnapshot

    if (!previousSnapshot) {
      return
    }

    const totalLoggedSecondsDelta =
      dashboardMetadataSnapshot.totalLoggedSeconds -
      previousSnapshot.totalLoggedSeconds
    const completedSessionsDelta =
      dashboardMetadataSnapshot.completedSessionsCount -
      previousSnapshot.completedSessionsCount
    const hasLastSessionChanged =
      dashboardMetadataSnapshot.lastSessionAt !== previousSnapshot.lastSessionAt

    if (
      totalLoggedSecondsDelta === 0 &&
      completedSessionsDelta === 0 &&
      !hasLastSessionChanged
    ) {
      return
    }

    publishDashboardMetadataPatch({
      totalLoggedSecondsDelta:
        totalLoggedSecondsDelta === 0 ? undefined : totalLoggedSecondsDelta,
      completedSessionsDelta:
        completedSessionsDelta === 0 ? undefined : completedSessionsDelta,
      lastSessionAt: hasLastSessionChanged
        ? dashboardMetadataSnapshot.lastSessionAt
        : undefined,
      paintStreakDaysFloor: totalLoggedSecondsDelta >= 60 ? 1 : undefined,
    })
  }, [dashboardMetadataSnapshot])

  const completedCount = optimisticSteps.filter(
    (step) => step.status === 'done'
  ).length
  const isUnitComplete =
    statusValue === 'complete' ||
    unit.status === 'complete' ||
    Boolean(unit.completed_at)

  const sortedSteps = [...optimisticSteps].sort(
    (a, b) => a.step_order - b.step_order
  )

  const queueBackgroundRefresh = useCallback((delay = 160) => {
    if (refreshTimeoutRef.current !== null) {
      window.clearTimeout(refreshTimeoutRef.current)
    }

    refreshTimeoutRef.current = window.setTimeout(() => {
      refreshTimeoutRef.current = null
      startTransition(() => {
        router.refresh()
      })
    }, delay)
  }, [router, startTransition])

  const handleToggleStep = (step: ProgressStep) => {
    if (step.step_key === 'done') {
      return
    }

    const nextStatus: ProgressStep['status'] =
      step.status === 'done' ? 'pending' : 'done'
    const previousSteps = optimisticSteps

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

      try {
        const result = await toggleStepDone(formData)

        if (result?.completedAt) {
          setLocalUnit((current) => ({
            ...current,
            completed_at: result.completedAt,
          }))
        }

        if (result?.shouldOpenShareModal) {
          setIsShareModalOpen(true)
        }

        queueBackgroundRefresh()
      } catch (error) {
        setOptimisticSteps(previousSteps)
        throw error
      }
    })
  }

  const handleUpdateDetails = (formData: FormData) => {
    const complexity = complexityInput.trim() ? Number(complexityInput) : null
    const unitSize = unitSizeInput.trim() ? Number(unitSizeInput) : null
    const deadline = deadlineInput || null
    const nextProjectIds = Array.from(
      new Set(
        formData
          .getAll('projectIds')
          .map((value) => String(value))
          .filter(Boolean)
      )
    )
    const nextParentProjects = availableProjects.filter((project) =>
      nextProjectIds.includes(project.id)
    )
    const previousUnit = unit
    const previousParentProjects = localParentProjects
    const previousSelectedProjectIds = localSelectedProjectIds

    setLocalUnit((current) => ({
      ...current,
      complexity,
      unit_size: unitSize,
      deadline,
      project_id: nextProjectIds[0] ?? null,
    }))
    setLocalParentProjects(nextParentProjects)
    setLocalSelectedProjectIds(nextProjectIds)
    setIsEditingDetails(false)

    startTransition(async () => {
      try {
        await updateUnitDetails(formData)
        queueBackgroundRefresh()
      } catch (error) {
        setLocalUnit(previousUnit)
        setLocalParentProjects(previousParentProjects)
        setLocalSelectedProjectIds(previousSelectedProjectIds)
        setIsEditingDetails(true)
        throw error
      }
    })
  }

  const handleUpdateHeader = (formData: FormData) => {
    const previousUnit = unit
    const name = String(formData.get('name') ?? '').trim()
    const notes = String(formData.get('description') ?? '').trim() || null

    setLocalUnit((current) => ({
      ...current,
      name,
      notes,
    }))
    setIsEditingHeader(false)

    startTransition(async () => {
      try {
        await updateUnitHeader(formData)
        queueBackgroundRefresh()
      } catch (error) {
        setLocalUnit(previousUnit)
        setIsEditingHeader(true)
        throw error
      }
    })
  }

  const handleUpdateStatus = (nextStatus: UnitStatus) => {
    const previousStatus = statusValue
    const previousUnit = unit

    setStatusValue(nextStatus)
    setLocalUnit((current) => ({ ...current, status: nextStatus }))

    startTransition(async () => {
      try {
        const result = await updateUnitStatus(unit.id, nextStatus)

        if (result?.completedAt) {
          setLocalUnit((current) => ({
            ...current,
            completed_at: result.completedAt,
          }))
        }

        if (result?.shouldOpenShareModal) {
          setIsShareModalOpen(true)
        }

        queueBackgroundRefresh()
      } catch (error) {
        setStatusValue(previousStatus)
        setLocalUnit(previousUnit)
        throw error
      }
    })
  }

  const handleSetFeatured = (imageId: string) => {
    const previousImages = localImages

    setLocalImages((current) =>
      current.map((image) => ({
        ...image,
        is_featured: image.id === imageId,
      }))
    )

    startTransition(async () => {
      try {
        await setFeaturedUnitImage(unit.id, imageId)
        queueBackgroundRefresh()
      } catch (error) {
        setLocalImages(previousImages)
        throw error
      }
    })
  }

const handleRemoveStagePaint = (stagePaintId: string) => {
  const previousStagePaints = localStagePaints
  setLocalStagePaints((current) =>
    current.filter((paint) => paint.id !== stagePaintId)
  )

  startTransition(async () => {
    const formData = new FormData()

    formData.set('unitId', unit.id)
    formData.set('stagePaintId', stagePaintId)

    try {
      await removePaintFromStage(formData)
      queueBackgroundRefresh()
    } catch (error) {
      setLocalStagePaints(previousStagePaints)
      throw error
    }
  })
}
const handleRemoveStagePhoto = (imageId: string) => {
  const previousImages = localImages
  setLocalImages((current) => current.filter((image) => image.id !== imageId))
  setSelectedGalleryImageIds((current) =>
    current.filter((selectedImageId) => selectedImageId !== imageId)
  )

  startTransition(async () => {
    const formData = new FormData()

    formData.set('unitId', unit.id)
    formData.set('imageId', imageId)

    try {
      await deleteUnitImage(formData)
      queueBackgroundRefresh()
    } catch (error) {
      setLocalImages(previousImages)
      throw error
    }
  })
}

  const handleToggleGalleryImageSelection = (imageId: string) => {
    setIsConfirmingGalleryDelete(false)
    setSelectedGalleryImageIds((current) =>
      current.includes(imageId)
        ? current.filter((selectedImageId) => selectedImageId !== imageId)
        : [...current, imageId]
    )
  }

  const handleDeleteSelectedGalleryImages = () => {
    if (selectedGalleryImageIds.length === 0) return

    const imageIdsToDelete = selectedGalleryImageIds
    const previousImages = localImages

    setGalleryUploadError(null)
    setIsConfirmingGalleryDelete(false)
    setSelectedGalleryImageIds([])
    setLocalImages((current) =>
      current.filter((image) => !imageIdsToDelete.includes(image.id))
    )

    startTransition(async () => {
      const formData = new FormData()

      formData.set('unitId', unit.id)
      imageIdsToDelete.forEach((imageId) =>
        formData.append('imageIds', imageId)
      )

      try {
        await deleteUnitImage(formData)
        queueBackgroundRefresh()
      } catch (error) {
        setLocalImages(previousImages)
        setSelectedGalleryImageIds(imageIdsToDelete)
        setGalleryUploadError(
          error instanceof Error ? error.message : 'Could not delete images.'
        )
      }
    })
  }

  const handleUploadClick = () => {
    fileInputRef.current?.click()
  }

  const handleCameraClick = () => {
    cameraInputRef.current?.click()
  }

  const handleRemovePendingGalleryFile = (indexToRemove: number) => {
    setSelectedGalleryFiles((current) =>
      current.filter((_, index) => index !== indexToRemove)
    )
  }

  const handleUploadSelectedGalleryFiles = () => {
    if (selectedGalleryFiles.length === 0) {
      setGalleryUploadError('Choose at least one image to upload.')
      return
    }

    const optimisticImages = selectedGalleryFiles.map((file, index) =>
      buildOptimisticImage({
        file,
        altText: null,
        isFeatured: localImages.length === 0 && index === 0,
      })
    )

    setGalleryUploadError(null)
    setSelectedGalleryFiles([])
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
    if (cameraInputRef.current) {
      cameraInputRef.current.value = ''
    }
    setLocalImages((current) => [
      ...optimisticImages,
      ...current.map((image) =>
        optimisticImages.some((optimisticImage) => optimisticImage.is_featured)
          ? { ...image, is_featured: false }
          : image
      ),
    ])

    startTransition(async () => {
      const formData = new FormData()
      formData.set('unitId', unit.id)
      formData.set('uploadSource', galleryUploadSource)
      optimisticImages.forEach((image, index) =>
        formData.append('image', selectedGalleryFiles[index]!)
      )

      const result = await uploadUnitGalleryImages(formData)
      const uploadedImages = result?.uploadedImages ?? []

      setLocalImages((current) => {
        const withoutOptimistic = current.filter(
          (image) => !optimisticImages.some((optimistic) => optimistic.id === image.id)
        )

        if (uploadedImages.length === 0) {
          return withoutOptimistic
        }

        return [
          ...uploadedImages,
          ...withoutOptimistic.map((image) =>
            uploadedImages.some((uploaded) => uploaded.is_featured)
              ? { ...image, is_featured: false }
              : image
          ),
        ]
      })
      optimisticImages.forEach((image) => URL.revokeObjectURL(image.image_url))

      if (result?.failed.length) {
        setGalleryUploadError(
          `Could not upload ${result.failed
            .map((failure) => `${failure.fileName}: ${failure.reason}`)
            .join('; ')}`
        )
      }

      queueBackgroundRefresh()
    })
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

    const fileExt = file.name.split('.').pop() || 'jpg'
    const filePath = `units/${unit.id}/${crypto.randomUUID()}.${fileExt}`

    const { error: uploadError } = await supabase.storage
      .from('obsidian-images')
      .upload(filePath, file)

    if (uploadError) {
      throw new Error(uploadError.message)
    }

    const { data } = supabase.storage
      .from('obsidian-images')
      .getPublicUrl(filePath)

    const { data: imageAsset, error: insertError } = await supabase
      .from('image_assets')
      .insert({
        entity_type: 'unit',
        entity_id: unit.id,
        image_url: data.publicUrl,
        user_id: currentUserId,
        storage_bucket: 'obsidian-images',
        storage_path: filePath,
        is_featured: makeFeaturedIfEmpty && localImages.length === 0,
        sort_order: 0,
        alt_text: altText,
      })
      .select(
        'id, image_url, is_featured, created_at, sort_order, alt_text, storage_bucket, storage_path'
      )
      .single()

    if (insertError) {
      throw new Error(insertError.message)
    }

    return imageAsset
  }

  const handleFileChange = async (
    event: ChangeEvent<HTMLInputElement>,
    source: 'gallery_picker' | 'camera'
  ) => {
    setGalleryUploadError(null)
    setGalleryUploadSource(source)
    setSelectedGalleryFiles(Array.from(event.target.files ?? []))
  }

  const handleStageFileChange = async (
    event: ChangeEvent<HTMLInputElement>,
    step: ProgressStep
  ) => {
    const file = event.target.files?.[0]

    if (!file) {
      return
    }

    setUploadingStageId(step.id)
    const optimisticImage = buildOptimisticImage({
      file,
      altText: `stage:${step.step_key}`,
      isFeatured: localImages.length === 0,
    })
    setLocalImages((current) => [
      optimisticImage,
      ...current.map((image) =>
        optimisticImage.is_featured ? { ...image, is_featured: false } : image
      ),
    ])

    try {
      const imageAsset = await uploadUnitImage({
        file,
        altText: `stage:${step.step_key}`,
        makeFeaturedIfEmpty: true,
      })
      if (imageAsset) {
        setLocalImages((current) => [
          imageAsset,
          ...current.filter((image) => image.id !== optimisticImage.id).map((image) =>
            imageAsset.is_featured ? { ...image, is_featured: false } : image
          ),
        ])
      }
      queueBackgroundRefresh()
      URL.revokeObjectURL(optimisticImage.image_url)
    } catch (error) {
      setLocalImages((current) =>
        current.filter((image) => image.id !== optimisticImage.id)
      )
      URL.revokeObjectURL(optimisticImage.image_url)
      setGalleryUploadError(
        error instanceof Error ? error.message : 'Could not upload image.'
      )
    } finally {
      setUploadingStageId(null)
      event.target.value = ''
    }
  }

  const handleStagePaintAdded = (
    stagePaint: NonNullable<StagePaintActionResult> | null | undefined
  ) => {
    if (!stagePaint) return
    const normalizedStagePaint = {
      ...stagePaint,
      catalog_paint: Array.isArray(stagePaint.catalog_paint)
        ? stagePaint.catalog_paint[0] ?? null
        : stagePaint.catalog_paint ?? null,
      custom_paint: Array.isArray(stagePaint.custom_paint)
        ? stagePaint.custom_paint[0] ?? null
        : stagePaint.custom_paint ?? null,
    } as StagePaint

    setLocalStagePaints((current) => [
      ...current.filter((paint) => paint.id !== normalizedStagePaint.id),
      normalizedStagePaint,
    ])
  }

  const handleTabChange = (nextTab: 'overview' | 'progress') => {
    if (nextTab === currentTab) {
      return
    }

    setCurrentTab(nextTab)

    if (nextTab === 'progress') {
      void import('./unit-progress-tab')
    }

    const params = new URLSearchParams(searchParams.toString())
    if (nextTab === 'overview') {
      params.delete('tab')
    } else {
      params.set('tab', 'progress')
    }

    const nextSearch = params.toString()
    const href = nextSearch ? `${pathname}?${nextSearch}` : pathname
    window.history.replaceState(null, '', href)
  }

  return (
    <div className="w-full">
      {isSessionNoticeVisible ? (
        <div
          className="fixed inset-x-4 top-4 z-[70] mx-auto max-w-md rounded-2xl border border-cyan-300/35 bg-slate-950/95 p-4 text-cyan-50 shadow-[0_0_28px_rgba(34,211,238,0.22)] backdrop-blur-xl"
          role="status"
        >
          <div className="flex items-start gap-3">
            <div className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-cyan-300 shadow-[0_0_16px_rgba(34,211,238,0.8)]" />
            <div className="min-w-0">
              <p className="text-sm font-black uppercase tracking-[0.16em] text-cyan-300">
                Session Tracking
              </p>
              <p className="mt-2 text-sm font-semibold leading-6 text-white/85">
                Your session is now being tracked. Every minute of brush work,
                hesitation, and suspicious staring at grey bits is recorded for
                posterity. Proceed, your model will not paint itself.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setIsSessionNoticeVisible(false)}
              className="ml-auto flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-cyan-300/25 bg-black/35 text-lg leading-none text-cyan-100 transition hover:border-cyan-200/70 hover:bg-cyan-400/15"
              aria-label="Dismiss session tracking notice"
            >
              x
            </button>
          </div>
        </div>
      ) : null}

      {unit.notes?.trim() || isEditingHeader ? (
      <section
        id="unit-header-editor"
        className="mt-4 scroll-mt-4 rounded-2xl border border-white/10 bg-white/5 p-4"
      >
        {!isEditingHeader ? (
          <p className="text-sm leading-6 text-white/65">
            {unit.notes}
          </p>
        ) : (
          <>
            <form action={handleUpdateHeader} className="space-y-3">
              <input type="hidden" name="unitId" value={unit.id} />

              <div>
                <label className="mb-1 block text-sm text-white/60">
                  Name
                </label>
                <input
                  name="name"
                  defaultValue={unit.name}
                  required
                  className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-white"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm text-white/60">
                  Description
                </label>
                <textarea
                  name="description"
                  defaultValue={unit.notes || ''}
                  rows={3}
                  className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-white"
                />
              </div>

              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={isPending}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-cyan-500 px-4 py-2 font-medium text-black disabled:cursor-not-allowed disabled:bg-neutral-700 disabled:text-white/60 disabled:opacity-70"
                >
                  {isPending ? (
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  ) : null}
                  <span>{isPending ? 'Saving...' : 'Save'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setIsEditingHeader(false)}
                  className="rounded-xl border border-white/10 px-4 py-2 text-white"
                >
                  Cancel
                </button>
              </div>
            </form>

            <div className="mt-4">
              <DeleteConfirmationCard
                itemId={unit.id}
                itemIdFieldName="unitId"
                title="Delete Unit"
                buttonLabel="Delete This Unit"
                initialDescription="Permanently delete this unit from your gallery."
                confirmDescription="If you delete this unit, it will be removed along with all the progress, sessions, paints, guides, and images it contains. This action cannot be undone."
                deleteAction={deleteUnit}
              />
            </div>
          </>
        )}
      </section>
      ) : null}

    <div className="mt-4 grid gap-5">
  <div className="grid grid-cols-2 rounded-2xl border border-white/10 bg-slate-950/70 p-1 shadow-[0_0_24px_rgba(34,211,238,0.08)]">
    {[
      { key: 'overview' as const, label: 'Overview' },
      {
        key: 'progress' as const,
        label: 'Progress',
      },
    ].map((tab) => {
      const isActive = currentTab === tab.key

      return (
        <button
          key={tab.key}
          type="button"
          onClick={() => handleTabChange(tab.key)}
          className={[
            'rounded-xl px-2 py-3 text-center text-xs font-black transition',
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

      <div hidden={currentTab !== 'overview'} aria-hidden={currentTab !== 'overview'}>
        <div>
          <div
            id="unit-details-editor"
            className="mt-4 scroll-mt-4 rounded-2xl border border-white/10 bg-white/5 p-4"
          >
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
              <div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="flex flex-col gap-1">
                    <span className="text-[11px] text-white/50">
                      Complexity
                    </span>
                  <div className="text-lg font-bold">
                    {unit.complexity ? `${unit.complexity}/5` : '—'}
                  </div>
                </div>

                  <div className="flex flex-col gap-1">
                    <span className="text-[11px] text-white/50">
                      Model Count
                    </span>
                  <div className="text-lg font-bold">
                    {unit.unit_size || '—'}
                  </div>
                </div>

                  <div className="flex flex-col gap-1">
                    <span className="text-[11px] text-white/50">
                      Deadline
                    </span>
                  <div className="text-lg font-bold">
                    {unit.deadline
                      ? new Date(unit.deadline).toLocaleDateString()
                      : '—'}
                  </div>
                </div>
                </div>

                <div className="mt-4 grid grid-cols-3 gap-4 border-t border-white/10 pt-4">
                  <div className="col-span-2 flex min-w-0 flex-col gap-1">
                    <span className="text-[11px] text-white/50">
                      Parent Project
                    </span>
                    <div className="flex min-h-[32px] flex-wrap items-center gap-2">
                      {localParentProjects.length > 0 ? (
                        localParentProjects.map((project) => (
                          <button
                            key={project.id}
                            type="button"
                            onClick={() => router.push(`/projects/${project.id}`)}
                            className="rounded-full border border-cyan-400/25 bg-cyan-400/10 px-3 py-1 text-xs font-bold text-cyan-200 transition hover:border-cyan-300/60 hover:bg-cyan-400/20"
                          >
                            {project.name || 'Untitled project'}
                          </button>
                        ))
                      ) : (
                        <span className="text-lg font-bold">-</span>
                      )}
                    </div>
                  </div>

                  <div className="flex min-w-0 flex-col items-end gap-1">
                    <label
                      htmlFor="unit-status"
                      className="text-[11px] text-white/50"
                    >
                      Status
                    </label>
                    <div className="flex min-h-[32px] w-full items-center justify-end">
                      <select
                        id="unit-status"
                        value={statusValue}
                        onChange={(event) =>
                          handleUpdateStatus(event.target.value as UnitStatus)
                        }
                        disabled={isPending}
                        className="h-[26px] w-auto max-w-full rounded-full border border-cyan-500/30 bg-slate-900 px-3 py-0 text-xs font-medium text-slate-100 outline-none transition hover:bg-cyan-500/15 hover:text-white focus:border-cyan-300/60 focus:bg-slate-900 focus:text-white disabled:opacity-60"
                      >
                        {UNIT_STATUS_OPTIONS.map((option) => (
                          <option
                            key={option.value}
                            value={option.value}
                            className="bg-slate-900 text-slate-100 checked:bg-cyan-500/20 checked:text-white"
                          >
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </div>
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
                    Model Count
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

                <div className="flex flex-col gap-1">
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

                  <div className="flex flex-col gap-1">
                  <div className="text-xs text-white/50">
                    Parent Projects
                  </div>
                  <div className="mt-2 grid gap-2 rounded-xl border border-white/10 bg-black/25 p-2">
                    {availableProjects.length > 0 ? (
                      availableProjects.map((project) => (
                        <label
                          key={project.id}
                          className="flex items-center gap-3 rounded-lg px-2 py-2 text-sm font-semibold text-white/75 transition hover:bg-white/5"
                        >
                          <input
                            type="checkbox"
                            name="projectIds"
                            value={project.id}
                            defaultChecked={localSelectedProjectIds.includes(
                              project.id
                            )}
                            className="h-4 w-4 rounded border-white/20 bg-black/40 accent-cyan-400"
                          />
                          <span>{project.name || 'Untitled project'}</span>
                        </label>
                      ))
                    ) : (
                      <div className="px-2 py-2 text-sm text-white/35">
                        No projects yet.
                      </div>
                    )}
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isPending}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-cyan-400 px-4 py-2 text-sm font-bold text-black disabled:cursor-not-allowed disabled:bg-neutral-700 disabled:text-white/60 disabled:opacity-70"
                >
                  {isPending ? (
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  ) : null}
                  <span>{isPending ? 'Saving...' : 'Save Changes'}</span>
                </button>
              </form>
            )}
          </div>

          <LazyUnitSessionTracker
            unitId={unit.id}
            activeSession={localActiveSessionState}
            sessions={localSessionsState}
            totalLoggedSeconds={localTotalLoggedSecondsState}
            autoStart={autoStartSession}
            onMutationCommitted={queueBackgroundRefresh}
            onStateChange={handleSessionStateChange}
          />

          <section className="mt-6">
            <ProjectPaletteCard
              theme={projectTheme}
              projectId={unit.project_id || ''}
              unitId={unit.id}
            />
          </section>

          <UnitGallerySection
            images={localImages}
            isPending={isPending}
            galleryFilePreviews={galleryFilePreviews}
            selectedGalleryFiles={selectedGalleryFiles}
            galleryUploadError={galleryUploadError}
            isEditingGalleryImages={isEditingGalleryImages}
            selectedGalleryImageIds={selectedGalleryImageIds}
            isConfirmingGalleryDelete={isConfirmingGalleryDelete}
            fileInputRef={fileInputRef}
            cameraInputRef={cameraInputRef}
            onUploadClick={handleUploadClick}
            onCameraClick={handleCameraClick}
            onFileChange={handleFileChange}
            onRemovePendingGalleryFile={handleRemovePendingGalleryFile}
            onUploadSelectedGalleryFiles={handleUploadSelectedGalleryFiles}
            onClearPendingGalleryFiles={() => {
              setSelectedGalleryFiles([])
              setGalleryUploadError(null)
              if (fileInputRef.current) {
                fileInputRef.current.value = ''
              }
              if (cameraInputRef.current) {
                cameraInputRef.current.value = ''
              }
            }}
            onToggleEditingGalleryImages={() => {
              setIsEditingGalleryImages((current) => !current)
              setSelectedGalleryImageIds([])
              setIsConfirmingGalleryDelete(false)
            }}
            onToggleGalleryImageSelection={handleToggleGalleryImageSelection}
            onSelectAllGalleryImages={() => {
              setSelectedGalleryImageIds(localImages.map((image) => image.id))
            }}
            onClearSelectedGalleryImages={() => {
              setSelectedGalleryImageIds([])
              setIsConfirmingGalleryDelete(false)
            }}
            onDeleteSelectedGalleryImages={handleDeleteSelectedGalleryImages}
            onRequestDeleteSelectedGalleryImages={() =>
              setIsConfirmingGalleryDelete(true)
            }
            onToggleFeatured={handleSetFeatured}
          />
        </div>
      </div>
      <div hidden={currentTab !== 'progress'} aria-hidden={currentTab !== 'progress'}>
        {currentTab === 'progress' ? (
          <UnitProgressTab
            unitId={unit.id}
            isPending={isPending}
            completedCount={completedCount}
            totalStepCount={optimisticSteps.length}
            sortedSteps={sortedSteps}
            localImages={localImages}
            localStagePaints={localStagePaints}
            openStageId={openStageId}
            uploadingStageId={uploadingStageId}
            onToggleStep={handleToggleStep}
            onOpenStageChange={setOpenStageId}
            onStageFileChange={handleStageFileChange}
            onStagePaintAdded={handleStagePaintAdded}
            onRemoveStagePaint={handleRemoveStagePaint}
            onRemoveStagePhoto={handleRemoveStagePhoto}
          />
        ) : null}
      </div>

      {isUnitComplete ? (
        <UnitCompletedInlinePreview
          unitName={unit.name || 'Untitled unit'}
          completedAt={unit.completed_at}
          images={localImages}
          sessions={localSessionsState}
          onShareClick={() => setIsShareModalOpen(true)}
        />
      ) : null}

      <UnitCompletedShareModal
        unitId={unit.id}
        isOpen={isShareModalOpen}
        onClose={() => setIsShareModalOpen(false)}
      />

    </div>
  )
}

