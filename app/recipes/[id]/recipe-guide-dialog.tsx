'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { WheelEvent } from 'react'
import { createPortal } from 'react-dom'
import type {
  Recipe,
  RecipeImage,
  RecipeStep,
  StepPaintLink,
} from './components/types'
import {
  RecipeGuideCoverCard,
  RecipeGuideDescriptiveStepCard,
  RecipeGuideImageStepCard,
} from './components/recipe-guide-cards'

type Props = {
  isOpen: boolean
  onClose: () => void
  recipe: Recipe
  steps: RecipeStep[]
  featuredImage: RecipeImage | null
  paintsByStepId: Map<string, StepPaintLink[]>
  stepPaintLinks: StepPaintLink[]
}

type RecipeGuideCardDescriptor =
  | { key: 'cover'; type: 'cover' }
  | { key: string; type: 'step'; step: RecipeStep }

type SharePlatform = 'whatsapp' | 'facebook' | 'instagram'

const EXPORT_CARD_WIDTH = 540
const EXPORT_CARD_HEIGHT = 960
const EXPORT_PIXEL_RATIO = 2

function hasImage(value?: string | null) {
  const url = typeof value === 'string' ? value.trim() : ''
  return url.startsWith('http://') || url.startsWith('https://')
}

function sanitizeFilePart(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'recipe'
}

function buildRecipeCardFileName(recipeName: string, index: number, extension: string) {
  return `${sanitizeFilePart(recipeName)}-${String(index + 1).padStart(2, '0')}.${extension}`
}

function getAppUrl() {
  return window.location.origin
}

function getShareCaption(recipeName: string) {
  return `${recipeName} guide cards. Made with Obsidian Gallery. ${getAppUrl()}`
}

function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

function blobToDataUrl(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(blob)
  })
}

async function waitForImages(root: HTMLElement) {
  const images = Array.from(root.querySelectorAll('img'))

  await Promise.all(
    images.map((image) => {
      if (image.complete) {
        return image.decode?.().catch(() => undefined) ?? Promise.resolve()
      }

      return new Promise<void>((resolve) => {
        image.addEventListener('load', () => resolve(), { once: true })
        image.addEventListener('error', () => resolve(), { once: true })
      })
    })
  )
}

function canShareFiles(files: File[]) {
  if (typeof navigator.share !== 'function') return false

  try {
    return !navigator.canShare || navigator.canShare({ files })
  } catch {
    return false
  }
}

export default function RecipeGuideDialog({
  isOpen,
  onClose,
  recipe,
  steps,
  featuredImage,
  paintsByStepId,
  stepPaintLinks,
}: Props) {
  const swipeStartX = useRef<number | null>(null)
  const swipeStartY = useRef<number | null>(null)
  const swipeLastX = useRef<number | null>(null)
  const wheelLocked = useRef(false)
  const exportCardRefs = useRef<Array<HTMLDivElement | null>>([])
  const [activeCardIndex, setActiveCardIndex] = useState(0)
  const [actionDialog, setActionDialog] = useState<'share' | 'export' | null>(
    null
  )
  const [isExporting, setIsExporting] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [exportError, setExportError] = useState<string | null>(null)
  const totalCards = steps.length + 1

  const orderedCards = useMemo<RecipeGuideCardDescriptor[]>(
    () => [
      { key: 'cover', type: 'cover' },
      ...steps.map((step) => ({
        key: step.id,
        type: 'step' as const,
        step,
      })),
    ],
    [steps]
  )

  const goPrevious = useCallback(() => {
    setActiveCardIndex((current) => Math.max(current - 1, 0))
  }, [])

  const goNext = useCallback(() => {
    setActiveCardIndex((current) => Math.min(current + 1, totalCards - 1))
  }, [totalCards])

  const paintCount = useMemo(() => {
    const ids = new Set<string>()

    for (const link of stepPaintLinks) {
      if (link.paint?.id) ids.add(link.paint.id)
    }

    return ids.size
  }, [stepPaintLinks])

  const getPaintsForStep = useCallback(
    (step: RecipeStep) => {
      const paintsForStep = paintsByStepId.get(step.id) || []

      return paintsForStep.flatMap((link) =>
        link.paint
          ? [
              {
                ...link.paint,
                ratio_text: link.ratio_text,
              },
            ]
          : []
      )
    },
    [paintsByStepId]
  )

  const renderRecipeCard = useCallback(
    (card: RecipeGuideCardDescriptor, showBrandMark = false) => {
      if (card.type === 'cover') {
        return (
          <RecipeGuideCoverCard
            recipe={recipe}
            featuredImage={featuredImage}
            stepCount={steps.length}
            paintCount={paintCount}
            showBrandMark={showBrandMark}
          />
        )
      }

      const paints = getPaintsForStep(card.step)

      return hasImage(card.step.image_url) ? (
        <RecipeGuideImageStepCard
          step={card.step}
          stepsLength={steps.length}
          paints={paints}
          showBrandMark={showBrandMark}
        />
      ) : (
        <RecipeGuideDescriptiveStepCard
          step={card.step}
          stepsLength={steps.length}
          paints={paints}
          showBrandMark={showBrandMark}
        />
      )
    },
    [featuredImage, getPaintsForStep, paintCount, recipe, steps.length]
  )

  const captureRecipeCardFiles = useCallback(async () => {
    const { toBlob } = await import('html-to-image')
    const nodes = orderedCards.map((_, index) => exportCardRefs.current[index])

    if (nodes.some((node) => !node)) {
      throw new Error('Guide cards are not ready to export yet.')
    }

    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))

    const files: File[] = []

    for (let index = 0; index < nodes.length; index += 1) {
      const node = nodes[index]
      if (!node) continue

      await waitForImages(node)

      const blob = await toBlob(node, {
        width: EXPORT_CARD_WIDTH,
        height: EXPORT_CARD_HEIGHT,
        pixelRatio: EXPORT_PIXEL_RATIO,
        cacheBust: true,
        backgroundColor: '#020806',
        canvasWidth: EXPORT_CARD_WIDTH,
        canvasHeight: EXPORT_CARD_HEIGHT,
      })

      if (!blob) {
        throw new Error('Could not render one of the guide cards.')
      }

      files.push(
        new File(
          [blob],
          buildRecipeCardFileName(recipe.name, index, 'png'),
          { type: 'image/png' }
        )
      )
    }

    return files
  }, [orderedCards, recipe.name])

  const downloadPicturesZip = useCallback(
    async (files: File[]) => {
      const { default: JSZip } = await import('jszip')
      const zip = new JSZip()

      for (const file of files) {
        zip.file(file.name, file)
      }

      const zipBlob = await zip.generateAsync({ type: 'blob' })
      downloadBlob(zipBlob, `${sanitizeFilePart(recipe.name)}-guide-cards.zip`)
    },
    [recipe.name]
  )

  const runExportWork = useCallback(async (work: () => Promise<void>) => {
    setIsExporting(true)
    setNotice(null)
    setExportError(null)

    try {
      await work()
    } catch (error) {
      setExportError(
        error instanceof Error
          ? error.message
          : 'Could not export the guide cards.'
      )
    } finally {
      setIsExporting(false)
    }
  }, [])

  const handleShare = useCallback(
    async (platform: SharePlatform) => {
      await runExportWork(async () => {
        const files = await captureRecipeCardFiles()
        const caption = getShareCaption(recipe.name)

        if (canShareFiles(files)) {
          await navigator.share({
            title: recipe.name,
            text: caption,
            files,
          })
          setNotice('Share sheet opened.')
          return
        }

        await downloadPicturesZip(files)

        if (platform === 'whatsapp') {
          window.open(`https://wa.me/?text=${encodeURIComponent(caption)}`, '_blank')
          setNotice('Cards downloaded. WhatsApp was opened with the caption.')
          return
        }

        if (platform === 'facebook') {
          await navigator.clipboard?.writeText(caption)
          window.open(
            `https://www.facebook.com/sharer/sharer.php?quote=${encodeURIComponent(
              caption
            )}`,
            '_blank'
          )
          setNotice('Cards downloaded and caption copied for Facebook.')
          return
        }

        await navigator.clipboard?.writeText(caption)
        setNotice('Cards downloaded and caption copied for Instagram.')
      })
    },
    [captureRecipeCardFiles, downloadPicturesZip, recipe.name, runExportWork]
  )

  const handleExportPictures = useCallback(async () => {
    await runExportWork(async () => {
      const files = await captureRecipeCardFiles()
      await downloadPicturesZip(files)
      setNotice('Ordered guide card pictures downloaded.')
    })
  }, [captureRecipeCardFiles, downloadPicturesZip, runExportWork])

  const handleExportPdf = useCallback(async () => {
    await runExportWork(async () => {
      const files = await captureRecipeCardFiles()
      const { jsPDF } = await import('jspdf')
      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'px',
        format: [EXPORT_CARD_WIDTH, EXPORT_CARD_HEIGHT],
      })
      const appUrl = getAppUrl()

      for (let index = 0; index < files.length; index += 1) {
        if (index > 0) {
          doc.addPage([EXPORT_CARD_WIDTH, EXPORT_CARD_HEIGHT], 'portrait')
        }

        const dataUrl = await blobToDataUrl(files[index])
        doc.addImage(dataUrl, 'PNG', 0, 0, EXPORT_CARD_WIDTH, EXPORT_CARD_HEIGHT)
        doc.link(0, EXPORT_CARD_HEIGHT - 72, EXPORT_CARD_WIDTH, 72, {
          url: appUrl,
        })
      }

      doc.save(`${sanitizeFilePart(recipe.name)}-guide-cards.pdf`)
      setNotice('Guide card PDF downloaded.')
    })
  }, [captureRecipeCardFiles, recipe.name, runExportWork])

  useEffect(() => {
    if (!isOpen) return

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) return

    const resetId = window.setTimeout(() => setActiveCardIndex(0), 0)
    return () => window.clearTimeout(resetId)
  }, [isOpen])

  useEffect(() => {
    if (isOpen) return

    setActionDialog(null)
    setNotice(null)
    setExportError(null)
    setIsExporting(false)
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) return

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
      if (event.key === 'ArrowRight') goNext()
      if (event.key === 'ArrowLeft') goPrevious()
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [goNext, goPrevious, isOpen, onClose])

  function handleSwipeStart(clientX: number, clientY: number) {
    swipeStartX.current = clientX
    swipeStartY.current = clientY
    swipeLastX.current = clientX
  }

  function handleSwipeMove(clientX: number) {
    swipeLastX.current = clientX
  }

  function handleSwipeEnd(clientX?: number, clientY?: number) {
    if (swipeStartX.current === null) return

    const endX = clientX ?? swipeLastX.current ?? swipeStartX.current
    const endY = clientY ?? swipeStartY.current ?? 0
    const diffX = swipeStartX.current - endX
    const diffY = (swipeStartY.current ?? 0) - endY

    if (Math.abs(diffX) > 44 && Math.abs(diffX) > Math.abs(diffY) * 1.2) {
      if (diffX > 0) {
        goNext()
      } else {
        goPrevious()
      }
    }

    swipeStartX.current = null
    swipeStartY.current = null
    swipeLastX.current = null
  }

  function handleWheel(event: WheelEvent<HTMLDivElement>) {
    if (wheelLocked.current) return

    const horizontalIntent = Math.abs(event.deltaX) > Math.abs(event.deltaY)
    if (!horizontalIntent || Math.abs(event.deltaX) < 24) return

    event.preventDefault()
    wheelLocked.current = true

    if (event.deltaX > 0) {
      goNext()
    } else {
      goPrevious()
    }

    window.setTimeout(() => {
      wheelLocked.current = false
    }, 450)
  }

  if (!isOpen) return null

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`${recipe.name} guide`}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        display: 'grid',
        placeItems: 'center',
        width: '100vw',
        height: '100dvh',
        overflow: 'hidden',
        background: 'rgba(0, 0, 0, 0.92)',
        padding: '10px 8px',
      }}
    >
      <div className="absolute right-3 top-3 z-20 flex items-center gap-2">
        <button
          type="button"
          aria-expanded={actionDialog === 'share'}
          onClick={() =>
            setActionDialog((current) => (current === 'share' ? null : 'share'))
          }
          className="tap-press h-8 rounded-full border border-cyan-300/30 bg-cyan-300/12 px-3 text-xs font-black uppercase tracking-[0.14em] text-cyan-100 shadow-lg shadow-black/40 backdrop-blur transition hover:bg-cyan-300/18"
        >
          Share
        </button>
        <button
          type="button"
          aria-expanded={actionDialog === 'export'}
          onClick={() =>
            setActionDialog((current) =>
              current === 'export' ? null : 'export'
            )
          }
          className="tap-press h-8 rounded-full border border-[#d8a84f]/35 bg-[#d8a84f]/12 px-3 text-xs font-black uppercase tracking-[0.14em] text-[#f1d28a] shadow-lg shadow-black/40 backdrop-blur transition hover:bg-[#d8a84f]/18"
        >
          Export
        </button>
        <button
          type="button"
          aria-label="Close guide cards"
          onClick={onClose}
          className="flex h-8 w-8 items-center justify-center rounded-full border border-white/15 bg-black/70 text-lg font-black leading-none text-white/80 shadow-lg shadow-black/40 backdrop-blur transition hover:bg-white/10 hover:text-white active:scale-95 active:opacity-80"
        >
          x
        </button>
      </div>

      {actionDialog ? (
        <div
          role="dialog"
          aria-label={
            actionDialog === 'share'
              ? 'Share guide cards'
              : 'Export guide cards'
          }
          className="absolute right-3 top-14 z-20 w-[min(360px,calc(100vw-24px))] rounded-2xl border border-white/10 bg-[#050908]/95 p-4 text-white shadow-2xl shadow-black/60 backdrop-blur"
        >
          <div className="mb-3 flex items-center justify-between gap-3">
            <p className="text-xs font-black uppercase tracking-[0.28em] text-cyan-300">
              {actionDialog === 'share' ? 'Share Cards' : 'Export Cards'}
            </p>
            <button
              type="button"
              onClick={() => setActionDialog(null)}
              className="h-7 w-7 rounded-full border border-white/10 text-sm font-black text-white/70 hover:bg-white/10 hover:text-white"
              aria-label="Close card action panel"
            >
              x
            </button>
          </div>

          {actionDialog === 'share' ? (
            <div className="grid gap-2">
              <button
                type="button"
                onClick={() => handleShare('whatsapp')}
                disabled={isExporting}
                className="tap-press min-h-11 rounded-xl bg-[#24d366] px-4 py-3 text-sm font-black text-black disabled:opacity-55"
              >
                WhatsApp
              </button>
              <button
                type="button"
                onClick={() => handleShare('facebook')}
                disabled={isExporting}
                className="tap-press min-h-11 rounded-xl border border-white/10 bg-white/[0.045] px-4 py-3 text-sm font-black text-white/80 disabled:opacity-55"
              >
                Facebook
              </button>
              <button
                type="button"
                onClick={() => handleShare('instagram')}
                disabled={isExporting}
                className="tap-press min-h-11 rounded-xl border border-white/10 bg-white/[0.045] px-4 py-3 text-sm font-black text-white/80 disabled:opacity-55"
              >
                Instagram
              </button>
            </div>
          ) : (
            <div className="grid gap-2">
              <button
                type="button"
                onClick={handleExportPdf}
                disabled={isExporting}
                className="tap-press min-h-11 rounded-xl bg-cyan-300 px-4 py-3 text-sm font-black text-black disabled:opacity-55"
              >
                Save PDF
              </button>
              <button
                type="button"
                onClick={handleExportPictures}
                disabled={isExporting}
                className="tap-press min-h-11 rounded-xl border border-[#d8a84f]/45 bg-[#d8a84f]/12 px-4 py-3 text-sm font-black text-[#f1d28a] disabled:opacity-55"
              >
                Save Pictures
              </button>
            </div>
          )}

          {isExporting ? (
            <p className="mt-3 text-xs font-bold text-cyan-100/75">
              Preparing cards...
            </p>
          ) : null}
          {notice ? (
            <p className="mt-3 text-xs font-bold text-cyan-100/75">{notice}</p>
          ) : null}
          {exportError ? (
            <p className="mt-3 text-xs font-bold text-red-200">{exportError}</p>
          ) : null}
        </div>
      ) : null}

      <div
        className="cursor-grab touch-pan-y overflow-hidden active:cursor-grabbing"
        style={{
          aspectRatio: '9 / 16',
          width:
            'min(430px, calc(100vw - 16px), calc((100dvh - 20px) * 0.5625))',
          maxWidth: 'calc(100vw - 16px)',
          maxHeight: 'calc(100dvh - 20px)',
        }}
        onWheel={handleWheel}
        onTouchStart={(event) =>
          handleSwipeStart(
            event.touches[0]?.clientX ?? 0,
            event.touches[0]?.clientY ?? 0
          )
        }
        onTouchMove={(event) =>
          handleSwipeMove(event.touches[0]?.clientX ?? 0)
        }
        onTouchEnd={(event) =>
          handleSwipeEnd(
            event.changedTouches[0]?.clientX ?? 0,
            event.changedTouches[0]?.clientY ?? 0
          )
        }
        onPointerDown={(event) => {
          if (event.pointerType !== 'touch') {
            event.currentTarget.setPointerCapture(event.pointerId)
            handleSwipeStart(event.clientX, event.clientY)
          }
        }}
        onPointerMove={(event) => {
          if (event.pointerType !== 'touch') handleSwipeMove(event.clientX)
        }}
        onPointerUp={(event) => {
          if (event.pointerType !== 'touch') {
            handleSwipeEnd(event.clientX, event.clientY)
            event.currentTarget.releasePointerCapture(event.pointerId)
          }
        }}
        onPointerCancel={(event) => {
          if (event.pointerType !== 'touch') handleSwipeEnd()
        }}
      >
        <div
          className="flex h-full transition-transform duration-700 ease-[cubic-bezier(0.22,1,0.36,1)]"
          style={{
            transform: `translateX(-${activeCardIndex * 100}%)`,
          }}
        >
          {orderedCards.map((card) => (
            <div
              key={card.key}
              className="h-full min-w-full max-w-full shrink-0 px-1"
            >
              {renderRecipeCard(card)}
            </div>
          ))}
        </div>
      </div>

      <div
        aria-hidden="true"
        className="pointer-events-none fixed left-[-12000px] top-0"
      >
        {orderedCards.map((card, index) => (
          <div
            key={`export-${card.key}`}
            ref={(node) => {
              exportCardRefs.current[index] = node
            }}
            style={{
              width: EXPORT_CARD_WIDTH,
              height: EXPORT_CARD_HEIGHT,
              marginBottom: 24,
            }}
          >
            {renderRecipeCard(card, true)}
          </div>
        ))}
      </div>
    </div>,
    document.body
  )
}
