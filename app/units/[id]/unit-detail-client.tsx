'use client'

import { useEffect, useMemo, useRef, useState, useTransition } from 'react'
import type { ChangeEvent } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import { useRouter } from 'next/navigation'
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
import UnitSessionTracker from './components/unit-session-tracker'
import ProjectPaletteCard from '../../projects/[id]/project-palette-card'
import GalleryImageCard from '@/app/components/gallery/gallery-image-card'
import DeleteConfirmationCard from '../../components/delete-confirmation-card'

const StagePaintPicker = dynamic(() => import('./components/stage-paint-picker'))

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
}

type ExpandedStagePhoto = {
  src: string
  alt: string
  label: string
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

function getStagePaintHref(paint: StagePaint) {
  const paintId =
    paint.paint_source === 'custom'
      ? paint.custom_paint_id || paint.custom_paint?.id
      : paint.paint_catalog_id || paint.catalog_paint?.id

  return paintId ? `/vault/${paint.paint_source}/${paintId}` : null
}

export default function UnitDetailClient({
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
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [isSessionNoticeVisible, setIsSessionNoticeVisible] = useState(
    showSessionStartedNotice
  )
  const [liveNow, setLiveNow] = useState(() => Date.now())
  const [unit, setLocalUnit] = useState(initialUnit)
  const [localImages, setLocalImages] = useState(images)
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
  const [activeTab, setActiveTab] = useState<'overview' | 'progress'>(
    'overview'
  )
  const [openStageId, setOpenStageId] = useState<string | null>(null)
  const [uploadingStageId, setUploadingStageId] = useState<string | null>(null)
  const [expandedStagePhoto, setExpandedStagePhoto] =
    useState<ExpandedStagePhoto | null>(null)
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

  useEffect(() => {
    setLocalUnit(initialUnit)
  }, [initialUnit])

  useEffect(() => {
    setLocalImages(images)
  }, [images])

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
    router.replace(`/units/${unit.id}`, { scroll: false })
  }, [showSessionStartedNotice, router, unit.id])

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

  useEffect(() => {
    setStatusValue(unit.status)
  }, [unit.status])

  useEffect(() => {
    return () => {
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
        await toggleStepDone(formData)
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

    startTransition(async () => {
      try {
        await updateUnitDetails(formData)
        setIsEditingDetails(false)
      } catch (error) {
        setLocalUnit(previousUnit)
        setLocalParentProjects(previousParentProjects)
        setLocalSelectedProjectIds(previousSelectedProjectIds)
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

    startTransition(async () => {
      try {
        await updateUnitHeader(formData)
        setIsEditingHeader(false)
      } catch (error) {
        setLocalUnit(previousUnit)
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
        await updateUnitStatus(unit.id, nextStatus)
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

    startTransition(async () => {
      const formData = new FormData()
      formData.set('unitId', unit.id)
      formData.set('uploadSource', galleryUploadSource)
      selectedGalleryFiles.forEach((file) => formData.append('image', file))

      setGalleryUploadError(null)

      const result = await uploadUnitGalleryImages(formData)

      if (result?.failed.length) {
        setGalleryUploadError(
          `Could not upload ${result.failed
            .map((failure) => `${failure.fileName}: ${failure.reason}`)
            .join('; ')}`
        )
      } else {
        if (result?.uploadedImages?.length) {
          setLocalImages((current) => [
            ...result.uploadedImages!,
            ...current.map((image) =>
              result.uploadedImages!.some((uploaded) => uploaded.is_featured)
                ? { ...image, is_featured: false }
                : image
            ),
          ])
        }
        setSelectedGalleryFiles([])
        if (fileInputRef.current) {
          fileInputRef.current.value = ''
        }
        if (cameraInputRef.current) {
          cameraInputRef.current.value = ''
        }
      }
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

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      alert('You must be logged in.')
      return false
    }

    const fileExt = file.name.split('.').pop() || 'jpg'
    const filePath = `units/${unit.id}/${crypto.randomUUID()}.${fileExt}`

    const { error: uploadError } = await supabase.storage
      .from('obsidian-images')
      .upload(filePath, file)

    if (uploadError) {
      alert(uploadError.message)
      return false
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
        user_id: user.id,
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
      alert(insertError.message)
      return false
    }

    if (imageAsset) {
      setLocalImages((current) => [
        imageAsset,
        ...current.map((image) =>
          imageAsset.is_featured ? { ...image, is_featured: false } : image
        ),
      ])
    }

    return true
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

    try {
      await uploadUnitImage({
        file,
        altText: `stage:${step.step_key}`,
        makeFeaturedIfEmpty: true,
      })
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
                confirmDescription="If you delete this unit, it will be removed along with all the progress, sessions, paints, recipes, and images it contains. This action cannot be undone."
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

                <div className="mt-4 grid grid-cols-1 gap-4 border-t border-white/10 pt-4 sm:grid-cols-3">
                  <div className="flex flex-col gap-1 sm:col-span-2">
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

                  <div className="flex flex-col gap-1">
                    <label
                      htmlFor="unit-status"
                      className="text-[11px] text-white/50"
                    >
                      Status
                    </label>
                    <div className="flex min-h-[32px] items-center">
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
              unitId={unit.id}
            />
          </section>

          <section className="mt-10">
            <div className="mb-2 flex items-center justify-between">
                <div className="flex flex-col gap-1">
                <h2 className="text-2xl font-bold">
                  Inspiration & Art Gallery
                </h2>
                <p className="text-sm text-white/50">
                  Concept art, stage photos, and reference images
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={handleUploadClick}
                  className="tap-press mobile-upload-action rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-xs font-semibold text-white/70 hover:border-cyan-300/35 hover:text-cyan-100"
                >
                  Upload from Gallery
                </button>
                <button
                  type="button"
                  onClick={handleCameraClick}
                  className="tap-press mobile-upload-action rounded-xl bg-cyan-400 px-3 py-2 text-xs font-bold text-black hover:bg-cyan-300"
                >
                  Take Photo
                </button>
              </div>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(event) => handleFileChange(event, 'gallery_picker')}
            />
            <input
              ref={cameraInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(event) => handleFileChange(event, 'camera')}
            />

            {galleryFilePreviews.length > 0 ? (
              <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.03] p-3">
                <div className="grid grid-cols-3 gap-2">
                  {galleryFilePreviews.map((preview, index) => (
                    <div
                      key={`${preview.file.name}-${preview.file.lastModified}-${index}`}
                      className="relative overflow-hidden rounded-xl border border-white/10 bg-black/30"
                    >
                      <Image
                        src={preview.previewUrl}
                        alt={preview.file.name}
                        width={120}
                        height={96}
                        unoptimized
                        className="h-20 w-full object-cover"
                      />
                      <button
                        type="button"
                        onClick={() => handleRemovePendingGalleryFile(index)}
                        className="tap-press absolute right-1 top-1 flex h-8 w-8 items-center justify-center rounded-full bg-black/75 text-xs font-black text-white"
                        aria-label={`Remove ${preview.file.name}`}
                      >
                        X
                      </button>
                    </div>
                  ))}
                </div>

                {galleryUploadError ? (
                  <p className="mt-3 rounded-xl border border-red-400/40 bg-red-500/10 p-3 text-sm text-red-200">
                    {galleryUploadError}
                  </p>
                ) : null}

                <div className="mt-3 flex gap-2">
                  <button
                    type="button"
                    onClick={handleUploadSelectedGalleryFiles}
                    disabled={isPending || selectedGalleryFiles.length === 0}
                    className="tap-press tap-target inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-cyan-400 px-4 py-3 text-sm font-bold text-black disabled:cursor-not-allowed disabled:bg-neutral-700 disabled:text-white/60 disabled:opacity-70"
                  >
                    {isPending ? (
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                    ) : null}
                    <span>
                      {isPending
                        ? selectedGalleryFiles.length > 1
                          ? 'Uploading images...'
                          : 'Uploading image...'
                        : selectedGalleryFiles.length > 1
                          ? `Upload ${selectedGalleryFiles.length} images`
                          : 'Upload image'}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setSelectedGalleryFiles([])
                      setGalleryUploadError(null)
                      if (fileInputRef.current) {
                        fileInputRef.current.value = ''
                      }
                      if (cameraInputRef.current) {
                        cameraInputRef.current.value = ''
                      }
                    }}
                    className="tap-press tap-target rounded-xl border border-white/10 px-4 py-2 text-sm font-semibold text-white/70"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : galleryUploadError ? (
              <p className="mt-4 rounded-xl border border-red-400/40 bg-red-500/10 p-3 text-sm text-red-200">
                {galleryUploadError}
              </p>
            ) : null}

            {localImages.length > 0 ? (
              <>
                <div className="mt-4 flex justify-end">
                  <button
                    type="button"
                    onClick={() => {
                      setIsEditingGalleryImages((current) => !current)
                      setSelectedGalleryImageIds([])
                      setIsConfirmingGalleryDelete(false)
                    }}
                    className="tap-press rounded-lg border border-white/10 px-3 py-2 text-xs font-semibold text-white/70"
                  >
                    {isEditingGalleryImages ? 'Done' : 'Edit'}
                  </button>
                </div>

                {isEditingGalleryImages ? (
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-white/10 bg-white/[0.03] p-3">
                    <p className="text-xs font-semibold text-white/55">
                      {selectedGalleryImageIds.length > 0
                        ? `${selectedGalleryImageIds.length} selected`
                        : 'Select images to erase'}
                    </p>

                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          setSelectedGalleryImageIds(
                            localImages.map((image) => image.id)
                          )
                        }
                        className="tap-press rounded-lg border border-white/10 px-3 py-2 text-xs font-semibold text-white/70"
                      >
                        Select All
                      </button>

                      {selectedGalleryImageIds.length > 0 ? (
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedGalleryImageIds([])
                            setIsConfirmingGalleryDelete(false)
                          }}
                          className="tap-press rounded-lg border border-white/10 px-3 py-2 text-xs font-semibold text-white/70"
                        >
                          Clear
                        </button>
                      ) : null}

                      {selectedGalleryImageIds.length > 0 ? (
                        <button
                          type="button"
                          onClick={() =>
                            isConfirmingGalleryDelete
                              ? handleDeleteSelectedGalleryImages()
                              : setIsConfirmingGalleryDelete(true)
                          }
                          disabled={isPending}
                          className="tap-press rounded-lg bg-red-500 px-3 py-2 text-xs font-bold text-white disabled:opacity-60"
                        >
                          {isPending
                            ? 'Deleting...'
                            : isConfirmingGalleryDelete
                              ? `Erase ${selectedGalleryImageIds.length}`
                              : 'Delete Selected'}
                        </button>
                      ) : null}
                    </div>
                  </div>
                ) : null}
              </>
            ) : null}

            <div className="mt-4 grid grid-cols-3 gap-3">
              {localImages.map((image) => (
                <div key={image.id} className="relative">
                  {isEditingGalleryImages ? (
                    <label className="absolute right-2 top-2 z-20 flex h-8 w-8 items-center justify-center rounded-full bg-black/70 ring-1 ring-white/20">
                      <input
                        type="checkbox"
                        checked={selectedGalleryImageIds.includes(image.id)}
                        onChange={() =>
                          handleToggleGalleryImageSelection(image.id)
                        }
                        className="h-4 w-4 accent-red-500"
                        aria-label="Select image for deletion"
                      />
                    </label>
                  ) : null}

                  <GalleryImageCard
                    image={image}
                    canEdit={true}
                    onToggleFeatured={async (imageId) => {
                      handleSetFeatured(imageId)
                    }}
                  />
                </div>
              ))}

              <button
                type="button"
                onClick={handleUploadClick}
                className="tap-card flex aspect-square min-h-24 items-center justify-center rounded-2xl border border-dashed border-white/20 bg-white/[0.03] text-sm font-medium text-white/60"
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
              const stagePhoto = localImages.find(
                (image) => image.alt_text === `stage:${step.step_key}`
              )
              const isStageUploading = uploadingStageId === step.id
const paintsForStage = localStagePaints
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
                      className="tap-press tap-target shrink-0 disabled:opacity-80"
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
    <div className="mt-2 grid w-28 grid-cols-3 gap-1.5">
      {paintsForStage.slice(0, 6).map((paint) => {
        const displayHex =
          paint.paint_source === 'custom'
            ? paint.custom_paint?.color_hex
            : paint.catalog_paint?.hex_approx

        const displayName =
          paint.paint_source === 'custom'
            ? paint.custom_paint?.name
            : paint.catalog_paint?.name

        const imageUrl =
          paint.paint_source === 'custom'
            ? null
            : paint.catalog_paint?.swatch_image_url
        const paintHref = getStagePaintHref(paint)

        const swatch = imageUrl ? (
          <Image
            src={imageUrl}
            alt={displayName || 'Paint swatch'}
            width={32}
            height={32}
            sizes="32px"
            className="h-8 w-8 rounded-lg border border-[#07111b] object-cover"
          />
        ) : (
          <span
            className="block h-8 w-8 rounded-lg border border-[#07111b]"
            style={{ backgroundColor: displayHex || '#262626' }}
          />
        )

        return paintHref ? (
          <Link
            key={paint.id}
            href={paintHref}
            className="tap-press rounded-lg hover:ring-2 hover:ring-cyan-300/60 focus:outline-none focus:ring-2 focus:ring-cyan-300/70"
            aria-label={`Open ${displayName || 'paint'} details`}
          >
            {swatch}
          </Link>
        ) : (
          <span key={paint.id}>{swatch}</span>
        )
      })}

      {paintsForStage.length > 6 ? (
        <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#07111b] bg-white/10 text-[10px] font-black text-white/70">
          +{paintsForStage.length - 6}
        </div>
      ) : null}
    </div>
  ) : null}
</div>

                    {isStageUploading ? (
                      <div
                        className="stage-photo-loading-pattern relative flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-cyan-300/30 bg-black/30"
                        aria-label="Uploading stage photo"
                      >
                        <span className="h-4 w-4 animate-spin rounded-full border-2 border-cyan-200 border-t-transparent" />
                      </div>
                    ) : stagePhoto ? (
                      <button
                        type="button"
                        onClick={() =>
                          setExpandedStagePhoto({
                            src: stagePhoto.image_url,
                            alt: stagePhoto.alt_text || step.step_label,
                            label: step.step_label,
                          })
                        }
                        className="tap-press relative h-12 w-12 shrink-0 overflow-hidden rounded-xl border border-white/10 bg-black/30 hover:border-cyan-300/60 focus:outline-none focus:ring-2 focus:ring-cyan-300/70"
                        aria-label={`Expand ${step.step_label} photo`}
                      >
                        <Image
                          src={stagePhoto.image_url}
                          alt={stagePhoto.alt_text || step.step_label}
                          fill
                          sizes="48px"
                          className="object-cover"
                        />
                      </button>
                    ) : null}

                    <button
                      type="button"
                      onClick={() =>
                        setOpenStageId(isOpen ? null : step.id)
                      }
                      className="tap-press tap-target flex items-center justify-center rounded-xl border border-cyan-400/30 bg-cyan-400/10 text-2xl font-light leading-none text-cyan-300"
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

  {localStagePaints.filter((paint) => paint.progress_step_id === step.id).length > 0 ? (
    <div className="mt-2 grid grid-cols-3 gap-2">
      {localStagePaints
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
              className="relative min-w-0 rounded-xl border border-white/10 bg-black/25 p-2"
            >
              <button
                type="button"
                onClick={() => handleRemoveStagePaint(paint.id)}
                disabled={isPending}
                className="tap-press absolute right-1 top-1 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-black/75 text-[10px] font-black text-white/70"
                aria-label="Remove paint"
              >
                ×
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

              <div className="mt-0.5 truncate text-[10px] leading-tight text-white/35">
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

  <StagePaintPicker
    unitId={unit.id}
    progressStepId={step.id}
    onPaintAdded={handleStagePaintAdded}
  />
</div>

                        <div>
                          <label className="text-xs font-bold uppercase tracking-[0.16em] text-white/40">
                            Stage Photo
                          </label>

                          <input
                            id={`stage-photo-${step.id}`}
                            type="file"
                            accept="image/*"
                            disabled={isStageUploading}
                            className="hidden"
                            onChange={(event) =>
                              handleStageFileChange(event, step)
                            }
                          />
                          <input
                            id={`stage-photo-camera-${step.id}`}
                            type="file"
                            accept="image/*"
                            capture="environment"
                            disabled={isStageUploading}
                            className="hidden"
                            onChange={(event) =>
                              handleStageFileChange(event, step)
                            }
                          />

                          <div className="mt-2 grid grid-cols-2 gap-2">
                            <label
                              htmlFor={`stage-photo-${step.id}`}
                              className={`tap-press mobile-upload-action flex cursor-pointer items-center justify-center gap-2 overflow-hidden rounded-xl border px-3 py-3 text-center text-xs font-semibold ${
                                isStageUploading
                                  ? 'stage-photo-loading-pattern cursor-wait border-cyan-300/35 bg-cyan-300/[0.08] text-cyan-100'
                                  : 'border-white/15 bg-white/[0.03] text-white/60 hover:border-cyan-300/30 hover:text-white/80'
                              }`}
                            >
                              {isStageUploading ? (
                                <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                              ) : null}
                              {isStageUploading
                                ? 'Uploading...'
                                : 'Upload from Gallery'}
                            </label>

                            <label
                              htmlFor={`stage-photo-camera-${step.id}`}
                              className={`tap-press mobile-upload-action flex cursor-pointer items-center justify-center rounded-xl px-3 py-3 text-center text-xs font-bold ${
                                isStageUploading
                                  ? 'stage-photo-loading-pattern cursor-wait bg-cyan-300/[0.08] text-cyan-100'
                                  : 'bg-cyan-400 text-black hover:bg-cyan-300'
                              }`}
                            >
                              {isStageUploading ? 'Uploading...' : 'Take Photo'}
                            </label>
                          </div>

                          {isStageUploading ? (
  <div className="mt-3 flex items-center gap-3 rounded-xl border border-cyan-300/20 bg-cyan-300/[0.06] p-2 text-cyan-100">
    <div
      className="stage-photo-loading-pattern relative flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-black"
      aria-hidden="true"
    >
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
    </div>

    <div className="min-w-0 flex-1">
      <div className="text-sm font-bold">
        Uploading photo
      </div>
      <div className="text-xs text-cyan-100/60">
        This will appear in the stage card and unit gallery.
      </div>
    </div>
  </div>
) : stagePhoto ? (
  <div className="mt-3 flex items-center gap-3 rounded-xl border border-white/10 bg-black/30 p-2">
    <button
      type="button"
      onClick={() =>
        setExpandedStagePhoto({
          src: stagePhoto.image_url,
          alt: stagePhoto.alt_text || step.step_label,
          label: step.step_label,
        })
      }
      className="relative h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-black transition hover:ring-2 hover:ring-cyan-300/60 focus:outline-none focus:ring-2 focus:ring-cyan-300/70"
      aria-label={`Expand ${step.step_label} photo`}
    >
      <Image
        src={stagePhoto.image_url}
        alt={stagePhoto.alt_text || step.step_label}
        fill
        sizes="56px"
        className="object-cover"
      />
    </button>

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

      {expandedStagePhoto ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label={`${expandedStagePhoto.label} photo`}
          onClick={() => setExpandedStagePhoto(null)}
        >
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

    </div>
  )
}
