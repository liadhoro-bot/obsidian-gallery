'use client'

import { useCallback, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { createPortal } from 'react-dom'

export type ShareCardEntry = {
  key: string
  node: ReactNode
}

type DeckShareMenuProps = {
  cards: ShareCardEntry[]
  fileBaseName: string
  sharePath: string
  className?: string
  size?: 'sm' | 'md'
}

const EXPORT_CARD_WIDTH = 540
const EXPORT_CARD_HEIGHT = 960
const EXPORT_PIXEL_RATIO = 2

function sanitizeFilePart(value: string) {
  return (
    value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 80) || 'guide'
  )
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
  if (typeof navigator === 'undefined' || typeof navigator.share !== 'function') {
    return false
  }

  try {
    return !navigator.canShare || navigator.canShare({ files })
  } catch {
    return false
  }
}

export default function DeckShareMenu({
  cards,
  fileBaseName,
  sharePath,
  className = '',
  size = 'md',
}: DeckShareMenuProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [hasOpened, setHasOpened] = useState(false)
  const [isBusy, setIsBusy] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const cardRefs = useRef<Array<HTMLDivElement | null>>([])

  const iconSize = size === 'sm' ? 13 : 16
  const buttonSizeClass =
    size === 'sm' ? 'gap-1 px-2 py-1 text-[10px]' : 'gap-1.5 px-2.5 py-1.5 text-xs'

  function openMenu() {
    setNotice(null)
    setError(null)
    setHasOpened(true)
    setIsOpen(true)
  }

  function closeMenu() {
    setIsOpen(false)
  }

  async function runWork(work: () => Promise<void>) {
    setIsBusy(true)
    setNotice(null)
    setError(null)

    try {
      await work()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not complete this action.')
    } finally {
      setIsBusy(false)
    }
  }

  const captureCardFiles = useCallback(async () => {
    const { toBlob } = await import('html-to-image')
    const nodes = cards.map((_, index) => cardRefs.current[index])

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
        backgroundColor: '#e6d7b8',
        canvasWidth: EXPORT_CARD_WIDTH,
        canvasHeight: EXPORT_CARD_HEIGHT,
      })

      if (!blob) {
        throw new Error('Could not render one of the guide cards.')
      }

      files.push(
        new File(
          [blob],
          `${sanitizeFilePart(fileBaseName)}-${String(index + 1).padStart(2, '0')}.png`,
          { type: 'image/png' }
        )
      )
    }

    return files
  }, [cards, fileBaseName])

  async function handleCopyLink() {
    await runWork(async () => {
      const url = `${window.location.origin}${sharePath}`
      await navigator.clipboard.writeText(url)
      setNotice('Link copied to clipboard.')
    })
  }

  async function handleSaveImages() {
    await runWork(async () => {
      const files = await captureCardFiles()

      if (canShareFiles(files)) {
        await navigator.share({ title: fileBaseName, files })
        setNotice('Share sheet opened.')
        return
      }

      const { default: JSZip } = await import('jszip')
      const zip = new JSZip()

      for (const file of files) {
        zip.file(file.name, file)
      }

      const zipBlob = await zip.generateAsync({ type: 'blob' })
      downloadBlob(zipBlob, `${sanitizeFilePart(fileBaseName)}-cards.zip`)
      setNotice('Cards downloaded.')
    })
  }

  async function handleSavePdf() {
    await runWork(async () => {
      const files = await captureCardFiles()
      const { jsPDF } = await import('jspdf')
      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'px',
        format: [EXPORT_CARD_WIDTH, EXPORT_CARD_HEIGHT],
      })

      for (let index = 0; index < files.length; index += 1) {
        if (index > 0) {
          doc.addPage([EXPORT_CARD_WIDTH, EXPORT_CARD_HEIGHT], 'portrait')
        }

        const dataUrl = await blobToDataUrl(files[index])
        doc.addImage(dataUrl, 'PNG', 0, 0, EXPORT_CARD_WIDTH, EXPORT_CARD_HEIGHT)
      }

      doc.save(`${sanitizeFilePart(fileBaseName)}-cards.pdf`)
      setNotice('PDF downloaded.')
    })
  }

  return (
    <>
      <button
        type="button"
        onClick={openMenu}
        onPointerDown={(event) => event.stopPropagation()}
        onTouchStart={(event) => event.stopPropagation()}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        aria-label="Share guide"
        className={`flex items-center rounded-full bg-black/50 font-semibold text-white/85 backdrop-blur-sm transition-colors hover:text-white ${buttonSizeClass} ${className}`}
      >
        <ShareIcon size={iconSize} />
      </button>

      {isOpen && typeof document !== 'undefined'
        ? createPortal(
            <div
              role="dialog"
              aria-modal="true"
              aria-label="Share this guide"
              className="fixed inset-0 z-[1000] grid place-items-center bg-black/60 p-4"
              onClick={(event) => {
                if (event.target === event.currentTarget) closeMenu()
              }}
            >
              <div className="w-full max-w-xs rounded-2xl border border-white/10 bg-[#0b1016] p-4 text-white shadow-2xl shadow-black/60">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <p className="text-xs font-black uppercase tracking-[0.24em] text-cyan-300">
                    Share Guide
                  </p>
                  <button
                    type="button"
                    onClick={closeMenu}
                    aria-label="Close share menu"
                    className="h-7 w-7 rounded-full border border-white/10 text-sm font-black text-white/70 transition hover:bg-white/10 hover:text-white"
                  >
                    x
                  </button>
                </div>

                <div className="grid gap-2">
                  <button
                    type="button"
                    onClick={handleCopyLink}
                    disabled={isBusy}
                    className="min-h-11 rounded-xl border border-white/10 bg-white/[0.05] px-4 py-3 text-left text-sm font-black text-white/85 transition disabled:opacity-55"
                  >
                    Copy Link
                  </button>
                  <button
                    type="button"
                    onClick={handleSavePdf}
                    disabled={isBusy}
                    className="min-h-11 rounded-xl bg-cyan-300 px-4 py-3 text-left text-sm font-black text-black transition disabled:opacity-55"
                  >
                    Save as PDF
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveImages}
                    disabled={isBusy}
                    className="min-h-11 rounded-xl border border-[#d8a84f]/45 bg-[#d8a84f]/12 px-4 py-3 text-left text-sm font-black text-[#f1d28a] transition disabled:opacity-55"
                  >
                    Save Images
                  </button>
                </div>

                {isBusy ? (
                  <p className="mt-3 text-xs font-bold text-cyan-100/75">Preparing cards...</p>
                ) : null}
                {notice ? (
                  <p className="mt-3 text-xs font-bold text-cyan-100/75">{notice}</p>
                ) : null}
                {error ? <p className="mt-3 text-xs font-bold text-red-200">{error}</p> : null}
              </div>
            </div>,
            document.body
          )
        : null}

      {hasOpened && typeof document !== 'undefined'
        ? createPortal(
            <div aria-hidden="true" className="pointer-events-none fixed left-[-12000px] top-0">
              {cards.map((card, index) => (
                <div
                  key={`export-${card.key}`}
                  ref={(node) => {
                    cardRefs.current[index] = node
                  }}
                  style={{
                    width: EXPORT_CARD_WIDTH,
                    height: EXPORT_CARD_HEIGHT,
                    marginBottom: 24,
                  }}
                >
                  {card.node}
                </div>
              ))}
            </div>,
            document.body
          )
        : null}
    </>
  )
}

function ShareIcon({ size }: { size: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="18" cy="5" r="3" />
      <circle cx="6" cy="12" r="3" />
      <circle cx="18" cy="19" r="3" />
      <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
      <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
    </svg>
  )
}
