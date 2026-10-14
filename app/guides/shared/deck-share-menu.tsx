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
const IMAGE_WAIT_TIMEOUT_MS = 8000
const FONT_EMBED_TIMEOUT_MS = 3000

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

// Signed storage links carry their own Content-Disposition, so a plain
// anchor click downloads the file without pulling it through JS first.
function downloadUrl(url: string, fileName: string) {
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  link.rel = 'noopener'
  document.body.appendChild(link)
  link.click()
  link.remove()
}

async function waitForImages(root: HTMLElement) {
  const images = Array.from(root.querySelectorAll('img'))

  await Promise.all(
    images.map((image) => {
      if (image.complete) {
        return image.decode?.().catch(() => undefined) ?? Promise.resolve()
      }

      // Capped so an image that never settles (e.g. a lazy image the
      // browser defers in the off-screen export layer) can't stall export.
      return new Promise<void>((resolve) => {
        image.addEventListener('load', () => resolve(), { once: true })
        image.addEventListener('error', () => resolve(), { once: true })
        setTimeout(resolve, IMAGE_WAIT_TIMEOUT_MS)
      })
    })
  )
}

// html-to-image inlines every computed property on every cloned element,
// including the design system's ~270 CSS custom properties (some, like the
// material textures, are long). Their var() uses are already resolved in the
// computed values, so they were pure dead weight: ~1.3 MB of inline style per
// card, built, serialized and decoded for every card - minutes on a phone.
let cachedStyleProperties: string[] | null = null
function exportStyleProperties() {
  cachedStyleProperties ??= Array.from(getComputedStyle(document.documentElement))
    .filter((name) => !name.startsWith('--'))
  return cachedStyleProperties
}

// Safari reports a computed style's full cssText (custom properties
// included), and html-to-image copies that wholesale instead of honouring
// includeStyleProperties. Hide cssText while capturing so every browser
// takes the filtered path; returns a function restoring the original.
function withoutComputedCssText() {
  const original = window.getComputedStyle
  window.getComputedStyle = function (element: Element, pseudoElement?: string | null) {
    const style = original.call(window, element, pseudoElement)
    if (!style.cssText) return style
    return new Proxy(style, {
      get(target, property) {
        if (property === 'cssText') return ''
        const value = Reflect.get(target, property, target)
        return typeof value === 'function' ? value.bind(target) : value
      },
    })
  } as typeof window.getComputedStyle
  return () => {
    window.getComputedStyle = original
  }
}

// html-to-image embeds an <img>'s `src`, which for next/image is the
// largest srcset variant (w=3840) rather than the size the browser actually
// loaded. That meant downloading every card's photo at full resolution
// (cache-busted, so never from cache) and base64-ing it into the card - the
// bulk of the export time on phones. Point each export image at its loaded
// `currentSrc` instead; it's already in the HTTP cache.
async function pinLoadedImageSources(root: HTMLElement) {
  let changed = false
  for (const image of Array.from(root.querySelectorAll('img'))) {
    const loaded = image.currentSrc
    if (!loaded || loaded === image.src) continue
    image.removeAttribute('srcset')
    image.removeAttribute('sizes')
    image.src = loaded
    changed = true
  }
  if (changed) await waitForImages(root)
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
  const [progress, setProgress] = useState<string | null>(null)
  const [pendingShare, setPendingShare] = useState<File[] | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const cardRefs = useRef<Array<HTMLDivElement | null>>([])

  const iconSize = size === 'sm' ? 13 : 16
  const buttonSizeClass =
    size === 'sm' ? 'gap-1 px-2 py-1 text-[10px]' : 'gap-1.5 px-2.5 py-1.5 text-xs'

  function openMenu() {
    setNotice(null)
    setError(null)
    setPendingShare(null)
    setHasOpened(true)
    setIsOpen(true)
  }

  function closeMenu() {
    setIsOpen(false)
  }

  async function runWork(work: () => Promise<void>) {
    setIsBusy(true)
    setProgress(null)
    setNotice(null)
    setError(null)

    try {
      await work()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not complete this action.')
    } finally {
      setIsBusy(false)
      setProgress(null)
    }
  }

  // Renders every card to a canvas once; callers pick the encoding.
  const captureCardCanvases = useCallback(async (onProgress?: (done: number, total: number) => void) => {
    const { toCanvas, getFontEmbedCSS } = await import('html-to-image')
    const nodes = cards.map((_, index) => cardRefs.current[index])

    if (nodes.some((node) => !node)) {
      throw new Error('Guide cards are not ready to export yet.')
    }

    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))

    // Every card uses the same fonts, so resolve the embed CSS once rather
    // than per card (each call re-fetches and scans every stylesheet). Its
    // fetches have no timeout and have been seen to stall, so cap it; an
    // empty string means "embed nothing" without retrying per card.
    const fontEmbedCSS = nodes[0]
      ? await Promise.race([
          getFontEmbedCSS(nodes[0]).catch(() => ''),
          new Promise<string>((resolve) => setTimeout(() => resolve(''), FONT_EMBED_TIMEOUT_MS)),
        ])
      : ''
    const canvases: HTMLCanvasElement[] = []

    const restoreComputedStyle = withoutComputedCssText()
    try {
      for (let index = 0; index < nodes.length; index += 1) {
        const node = nodes[index]
        if (!node) continue

        onProgress?.(index, nodes.length)
        await waitForImages(node)
        await pinLoadedImageSources(node)

        canvases.push(await toCanvas(node, {
          width: EXPORT_CARD_WIDTH,
          height: EXPORT_CARD_HEIGHT,
          pixelRatio: EXPORT_PIXEL_RATIO,
          cacheBust: true,
          backgroundColor: '#e6d7b8',
          canvasWidth: EXPORT_CARD_WIDTH,
          canvasHeight: EXPORT_CARD_HEIGHT,
          fontEmbedCSS,
          includeStyleProperties: exportStyleProperties(),
          // html-to-image caches embedded images by URL with the query
          // string stripped, and every next/image URL is
          // /_next/image?url=... - so without this every card reused the
          // first card's photo.
          includeQueryParams: true,
        }))
      }
    } finally {
      restoreComputedStyle()
    }

    return canvases
  }, [cards])

  const cardFileName = useCallback(
    (index: number, extension: string) =>
      `${sanitizeFilePart(fileBaseName)}-${String(index + 1).padStart(2, '0')}.${extension}`,
    [fileBaseName]
  )

  async function handleCopyLink() {
    await runWork(async () => {
      const url = `${window.location.origin}${sharePath}`
      await navigator.clipboard.writeText(url)
      setNotice('Link copied to clipboard.')
    })
  }

  function reportProgress(done: number, total: number) {
    setProgress(`${done}/${total}`)
  }

  // Server-side export (/api/export/cards): headless Chromium renders the
  // same card markup in seconds on any device, where html-to-image took
  // minutes on phones. Returns a short-lived download link.
  const requestServerExport = useCallback(async (format: 'pdf' | 'zip') => {
    const nodes = cards.map((_, index) => cardRefs.current[index])
    if (nodes.some((node) => !node)) {
      throw new Error('Guide cards are not ready to export yet.')
    }
    await Promise.all(nodes.map((node) => (node ? waitForImages(node) : undefined)))

    const markup = nodes.map((node) => {
      const clone = node!.cloneNode(true) as HTMLElement
      const originals = node!.querySelectorAll('img')
      clone.querySelectorAll('img').forEach((image, index) => {
        // Pin each image to the copy the browser already loaded, as an
        // absolute URL (the server renders under a <base> of this origin).
        const loaded = originals[index]?.currentSrc || originals[index]?.src
        if (loaded) image.setAttribute('src', new URL(loaded, window.location.href).href)
        image.removeAttribute('srcset')
        image.removeAttribute('sizes')
        image.setAttribute('loading', 'eager')
      })
      return clone.innerHTML
    })

    const response = await fetch('/api/export/cards', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        format,
        fileBaseName,
        cards: markup,
        stylesheets: Array.from(document.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"]')).map((link) => link.href),
        inlineStyles: Array.from(document.querySelectorAll('style')).map((style) => style.textContent ?? ''),
        htmlClass: document.documentElement.className,
        htmlStyle: document.documentElement.getAttribute('style') ?? '',
        bodyClass: document.body.className,
        bodyStyle: document.body.getAttribute('style') ?? '',
      }),
    })
    if (!response.ok) throw new Error(`Export failed (${response.status})`)
    return (await response.json()) as { url: string; fileName: string }
  }, [cards, fileBaseName])

  async function shareFiles(files: File[]) {
    if (!canShareFiles(files)) return false
    try {
      await navigator.share({ title: fileBaseName, files })
      setNotice('Share sheet opened.')
      return true
    } catch (err) {
      // AbortError means the person closed the native share sheet
      // themselves - respect that instead of dropping a zip on them.
      if (err instanceof Error && err.name === 'AbortError') return true
      // Phones only allow share() shortly after a tap, and a long export
      // can outlive that - offer a button for a fresh tap instead.
      if (err instanceof Error && err.name === 'NotAllowedError') {
        setPendingShare(files)
        return true
      }
      // Anything else (most commonly a permissions-policy rejection in
      // an embedded/webview context) falls through to the zip download.
      return false
    }
  }

  async function handleSharePending() {
    const files = pendingShare
    setPendingShare(null)
    if (files) await runWork(async () => { await shareFiles(files) })
  }

  async function saveImagesOnServer() {
    const { url, fileName } = await requestServerExport('zip')
    if (canShareFiles([new File([], 'probe.jpg', { type: 'image/jpeg' })])) {
      const archive = await (await fetch(url)).blob()
      const { default: JSZip } = await import('jszip')
      const zip = await JSZip.loadAsync(archive)
      const files = await Promise.all(
        Object.values(zip.files)
          .filter((entry) => !entry.dir)
          .sort((a, b) => a.name.localeCompare(b.name))
          .map(async (entry) => new File([await entry.async('blob')], entry.name, { type: 'image/jpeg' }))
      )
      if (await shareFiles(files)) return
    }
    downloadUrl(url, fileName)
    setNotice('Cards downloaded.')
  }

  async function handleSaveImages() {
    await runWork(async () => {
      try {
        await saveImagesOnServer()
        return
      } catch (err) {
        console.warn('Server export failed, rendering in the browser instead.', err)
      }

      const canvases = await captureCardCanvases(reportProgress)
      const files = await Promise.all(canvases.map(async (canvas, index) => {
        const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'))
        if (!blob) throw new Error('Could not render one of the guide cards.')
        return new File([blob], cardFileName(index, 'png'), { type: 'image/png' })
      }))

      if (await shareFiles(files)) return

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
      try {
        const { url, fileName } = await requestServerExport('pdf')
        downloadUrl(url, fileName)
        setNotice('PDF downloaded.')
        return
      } catch (err) {
        console.warn('Server export failed, rendering in the browser instead.', err)
      }

      const canvases = await captureCardCanvases(reportProgress)
      const { jsPDF } = await import('jspdf')
      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'px',
        format: [EXPORT_CARD_WIDTH, EXPORT_CARD_HEIGHT],
      })

      for (let index = 0; index < canvases.length; index += 1) {
        if (index > 0) {
          doc.addPage([EXPORT_CARD_WIDTH, EXPORT_CARD_HEIGHT], 'portrait')
        }

        // JPEG, not PNG: jsPDF embeds JPEG bytes as-is, but decodes and
        // re-deflates every PNG in JavaScript - over a minute for a 24-card
        // guide on desktop, long enough on a phone to look stuck on
        // "Preparing cards...".
        const dataUrl = canvases[index].toDataURL('image/jpeg', 0.92)
        // jsPDF caches added images by a hash of half their raw bytes, keyed
        // off an auto-generated alias when none is given. Every exported
        // card shares the same border/frame template and differs mainly in
        // the embedded photo, so that hash collides across cards and jsPDF
        // silently reuses an earlier image. Passing an explicit unique
        // alias per card bypasses that cache entirely.
        doc.addImage(dataUrl, 'JPEG', 0, 0, EXPORT_CARD_WIDTH, EXPORT_CARD_HEIGHT, `card-${index}`)
        // Let the progress label repaint between pages.
        await new Promise((resolve) => setTimeout(resolve, 0))
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
        data-glass-control="true"
        data-action-state="idle"
        className={`flex h-10 items-center rounded-full font-semibold transition-colors ${buttonSizeClass} ${className}`}
      >
        <ShareIcon size={iconSize} />
      </button>

      {isOpen && typeof document !== 'undefined'
        ? createPortal(
            <div
              role="dialog"
              aria-modal="true"
              aria-label="Share this guide"
              className="fixed inset-0 z-[1000] grid place-items-center bg-black/65 p-4 backdrop-blur-sm"
              onClick={(event) => {
                if (event.target === event.currentTarget) closeMenu()
              }}
              onPointerDown={(event) => event.stopPropagation()}
              onTouchStart={(event) => event.stopPropagation()}
              onWheel={(event) => event.stopPropagation()}
            >
              <div
                className="w-full max-w-xs rounded-[18px] p-4"
                style={{
                  border: '1px solid color-mix(in srgb, var(--og-brass-700) 56%, var(--og-border-subtle))',
                  backgroundColor: 'var(--og-surface-primary)',
                  backgroundImage: 'var(--og-material-parchment-panel)',
                  backgroundPosition: 'center',
                  backgroundRepeat: 'no-repeat, repeat, no-repeat',
                  backgroundSize: '100% 100%, 260px auto, 100% 100%',
                  color: 'var(--og-text-primary)',
                  boxShadow: 'var(--og-shadow-large)',
                }}
              >
                <div className="mb-3 flex items-center justify-between gap-3">
                  <p
                    className="text-xs font-black uppercase tracking-[0.24em]"
                    style={{ color: 'color-mix(in srgb, var(--og-status-warning) 82%, var(--og-ink-800))' }}
                  >
                    Share Guide
                  </p>
                  <button
                    type="button"
                    onClick={closeMenu}
                    aria-label="Close share menu"
                    className="grid h-8 w-8 place-items-center rounded-full text-sm font-black transition"
                    style={{
                      border: '1px solid color-mix(in srgb, var(--og-brass-700) 84%, var(--og-ink-950))',
                      backgroundColor: 'var(--og-walnut-950)',
                      backgroundImage: 'var(--og-material-ebonized-control)',
                      backgroundPosition: 'center',
                      backgroundRepeat: 'no-repeat, repeat, no-repeat',
                      backgroundSize: '100% 100%, 180px auto, 100% 100%',
                      color: 'var(--og-brass-500)',
                      boxShadow: 'var(--og-shadow-control-built)',
                    }}
                  >
                    x
                  </button>
                </div>

                <div className="grid gap-2">
                  <button
                    type="button"
                    onClick={handleCopyLink}
                    disabled={isBusy}
                    className="min-h-11 rounded-[8px] px-4 py-3 text-left text-sm font-black transition disabled:opacity-55"
                    style={{
                      border: '1px solid color-mix(in srgb, var(--og-brass-700) 76%, var(--og-ink-950))',
                      backgroundColor: 'var(--og-walnut-950)',
                      backgroundImage: 'var(--og-material-ebonized-control)',
                      backgroundPosition: 'center',
                      backgroundRepeat: 'no-repeat, repeat, no-repeat',
                      backgroundSize: '100% 100%, 180px auto, 100% 100%',
                      color: 'var(--og-paper-100)',
                      boxShadow: 'var(--og-shadow-control-built)',
                    }}
                  >
                    Copy Link
                  </button>
                  <button
                    type="button"
                    onClick={handleSavePdf}
                    disabled={isBusy}
                    className="min-h-11 rounded-[8px] px-4 py-3 text-left text-sm font-black transition disabled:opacity-55"
                    style={{
                      border: '1px solid color-mix(in srgb, var(--og-brass-500) 72%, var(--og-walnut-700))',
                      backgroundColor: 'var(--og-brass-500)',
                      backgroundImage: 'var(--og-material-brass)',
                      backgroundPosition: 'center',
                      backgroundRepeat: 'no-repeat, repeat, no-repeat',
                      backgroundSize: '100% 100%, 180px auto, 100% 100%',
                      color: 'var(--og-ink-950)',
                      boxShadow: 'var(--og-shadow-control-built)',
                    }}
                  >
                    Save as PDF
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveImages}
                    disabled={isBusy}
                    className="min-h-11 rounded-[8px] px-4 py-3 text-left text-sm font-black transition disabled:opacity-55"
                    style={{
                      border: '1px solid color-mix(in srgb, var(--og-brass-700) 76%, var(--og-ink-950))',
                      backgroundColor: 'var(--og-walnut-950)',
                      backgroundImage: 'var(--og-material-ebonized-control)',
                      backgroundPosition: 'center',
                      backgroundRepeat: 'no-repeat, repeat, no-repeat',
                      backgroundSize: '100% 100%, 180px auto, 100% 100%',
                      color: 'var(--og-brass-500)',
                      boxShadow: 'var(--og-shadow-control-built)',
                    }}
                  >
                    Save Images
                  </button>
                </div>

                {pendingShare && !isBusy ? (
                  <button
                    type="button"
                    onClick={handleSharePending}
                    className="mt-3 min-h-11 w-full rounded-[8px] px-4 py-3 text-left text-sm font-black transition"
                    style={{
                      border: '1px solid color-mix(in srgb, var(--og-brass-500) 72%, var(--og-walnut-700))',
                      backgroundColor: 'var(--og-brass-500)',
                      backgroundImage: 'var(--og-material-brass)',
                      backgroundPosition: 'center',
                      backgroundRepeat: 'no-repeat, repeat, no-repeat',
                      backgroundSize: '100% 100%, 180px auto, 100% 100%',
                      color: 'var(--og-ink-950)',
                      boxShadow: 'var(--og-shadow-control-built)',
                    }}
                  >
                    Share {pendingShare.length} images
                  </button>
                ) : null}
                {isBusy ? (
                  <p className="mt-3 text-xs font-bold" style={{ color: 'var(--og-text-secondary)' }}>
                    Preparing cards...{progress ? ` ${progress}` : ''}
                  </p>
                ) : null}
                {notice ? (
                  <p className="mt-3 text-xs font-bold" style={{ color: 'var(--og-text-secondary)' }}>
                    {notice}
                  </p>
                ) : null}
                {error ? (
                  <p
                    className="mt-3 text-xs font-bold"
                    style={{ color: 'color-mix(in srgb, var(--og-status-danger) 78%, var(--og-ink-950))' }}
                  >
                    {error}
                  </p>
                ) : null}
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
