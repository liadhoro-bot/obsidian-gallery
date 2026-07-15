'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { toBlob } from 'html-to-image'
import UnitCompletedCardPreview from './UnitCompletedCardPreview'
import UnitImagePicker from './UnitImagePicker'
import ShareActions from './ShareActions'
import { createClient } from '../../utils/supabase/client'
import { capturePostHog } from '../../utils/analytics/client'
import {
  UNIT_COMPLETED_SHARE_TYPE,
  buildShareFileName,
  buildUnitCompletedCaption,
  getRandomCuratorQuote,
  type UnitCompletedShareData,
  type UnitCompletedShareImage,
} from '@/lib/share/unitCompleted'

type Props = {
  unitId: string
  isOpen: boolean
  onClose: () => void
}

type UnitRow = {
  id: string
  name: string | null
  project_id: string | null
  completed_at: string | null
}

type UnitQueryError = {
  code?: string
  message?: string
}

type ImageRow = {
  id: string
  image_url: string | null
  is_featured: boolean | null
  created_at: string | null
  sort_order: number | null
  alt_text: string | null
}

type SessionRow = {
  started_at: string | null
  ended_at: string | null
  duration_seconds: number | null
}

const SHARE_CARD_WIDTH = 540
const SHARE_CARD_HEIGHT = 960
const SHARE_CARD_EXPORT_SCALE = 2

function isMissingCompletedAtColumn(error: UnitQueryError | null | undefined) {
  return error?.code === '42703' && error.message?.includes('completed_at')
}

export default function UnitCompletedShareModal({
  unitId,
  isOpen,
  onClose,
}: Props) {
  const cardRef = useRef<HTMLDivElement | null>(null)
  const previewRef = useRef<HTMLDivElement | null>(null)
  const expandedPreviewRef = useRef<HTMLDivElement | null>(null)
  const [shareData, setShareData] = useState<UnitCompletedShareData | null>(null)
  const [selectedImage, setSelectedImage] =
    useState<UnitCompletedShareImage | null>(null)
  const [quote, setQuote] = useState(() => getRandomCuratorQuote())
  const [isLoading, setIsLoading] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [canNativeShare, setCanNativeShare] = useState(false)
  const [previewWidth, setPreviewWidth] = useState(0)
  const [isPreviewExpanded, setIsPreviewExpanded] = useState(false)
  const [expandedPreviewBounds, setExpandedPreviewBounds] = useState({
    width: 0,
    height: 0,
  })

  useEffect(() => {
    if (!isOpen || !previewRef.current) {
      return
    }

    const previewElement = previewRef.current
    const updatePreviewWidth = () => {
      setPreviewWidth(previewElement.getBoundingClientRect().width)
    }
    const observer = new ResizeObserver(updatePreviewWidth)

    updatePreviewWidth()
    observer.observe(previewElement)

    return () => observer.disconnect()
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) {
      return
    }

    const testFile = new File([''], 'unit-completed.png', {
      type: 'image/png',
    })
    setCanNativeShare(
      typeof navigator !== 'undefined' &&
        typeof navigator.share === 'function' &&
        typeof navigator.canShare === 'function' &&
        navigator.canShare({ files: [testFile] })
    )
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) {
      setIsPreviewExpanded(false)
    }
  }, [isOpen])

  useEffect(() => {
    if (!isPreviewExpanded || !expandedPreviewRef.current) {
      return
    }

    const previewElement = expandedPreviewRef.current
    const updatePreviewBounds = () => {
      const rect = previewElement.getBoundingClientRect()
      setExpandedPreviewBounds({
        width: rect.width,
        height: rect.height,
      })
    }
    const observer = new ResizeObserver(updatePreviewBounds)

    updatePreviewBounds()
    observer.observe(previewElement)

    return () => observer.disconnect()
  }, [isPreviewExpanded])

  useEffect(() => {
    if (!isOpen) {
      return
    }

    let cancelled = false
    const supabase = createClient()

    async function loadShareData() {
      setIsLoading(true)
      setError(null)
      setNotice(null)

      try {
        const { data: authData, error: authError } =
          await supabase.auth.getUser()

        if (authError || !authData.user) {
          throw authError || new Error('You need to be signed in to share.')
        }

        const [unitResult, imagesResult, sessionsResult] = await Promise.all([
          supabase
            .from('units')
            .select('id, name, project_id, completed_at')
            .eq('id', unitId)
            .eq('user_id', authData.user.id)
            .maybeSingle(),
          supabase
            .from('image_assets')
            .select('id, image_url, is_featured, created_at, sort_order, alt_text')
            .eq('entity_type', 'unit')
            .eq('entity_id', unitId)
            .eq('user_id', authData.user.id)
            .order('is_featured', { ascending: false })
            .order('sort_order', { ascending: true })
            .order('created_at', { ascending: false }),
          supabase
            .from('unit_sessions')
            .select('started_at, ended_at, duration_seconds')
            .eq('unit_id', unitId)
            .eq('user_id', authData.user.id)
            .not('ended_at', 'is', null),
        ])

        let unit = unitResult.data as UnitRow | null
        let unitError = unitResult.error as UnitQueryError | null

        if (isMissingCompletedAtColumn(unitError)) {
          const fallbackUnitResult = await supabase
            .from('units')
            .select('id, name, project_id')
            .eq('id', unitId)
            .eq('user_id', authData.user.id)
            .maybeSingle()

          unit = fallbackUnitResult.data
            ? {
                ...fallbackUnitResult.data,
                completed_at: null,
              }
            : null
          unitError = fallbackUnitResult.error as UnitQueryError | null
        }

        if (unitError) throw unitError
        if (imagesResult.error) throw imagesResult.error
        if (sessionsResult.error) throw sessionsResult.error

        if (!unit) {
          throw new Error('Unit not found.')
        }

        let projectImage: ImageRow | null = null
        if (unit.project_id) {
          const { data: projectImageData } = await supabase
            .from('image_assets')
            .select('id, image_url, is_featured, created_at, sort_order, alt_text')
            .eq('entity_type', 'project')
            .eq('entity_id', unit.project_id)
            .eq('user_id', authData.user.id)
            .order('is_featured', { ascending: false })
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle()

          projectImage = projectImageData as ImageRow | null
        }

        const images = buildImageOptions({
          unitName: unit.name || 'Untitled unit',
          unitImages: (imagesResult.data ?? []) as ImageRow[],
          projectImage,
        })
        const sessions = (sessionsResult.data ?? []) as SessionRow[]
        const totalSeconds = sessions.reduce(
          (sum, session) =>
            sum + getSessionDurationSeconds(session),
          0
        )

        const nextShareData: UnitCompletedShareData = {
          unitId: unit.id,
          unitName: unit.name || 'Untitled unit',
          completedAt: unit.completed_at || new Date().toISOString(),
          totalSeconds,
          sessionCount: sessions.length,
          images,
          selectedImage: images[0],
        }

        if (!cancelled) {
          setShareData(nextShareData)
          setSelectedImage(images[0])
          setQuote(getRandomCuratorQuote())
          void capturePostHog('unit_completed_share_modal_opened', {
            unit_id: unit.id,
            image_count: images.length,
            session_count: sessions.length,
          })
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : 'Could not prepare the share card.'
          )
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false)
        }
      }
    }

    void loadShareData()

    return () => {
      cancelled = true
    }
  }, [isOpen, unitId])

  const activeImage = selectedImage ?? shareData?.selectedImage ?? null
  const previewScale = previewWidth > 0 ? previewWidth / SHARE_CARD_WIDTH : 0
  const expandedPreviewScale =
    expandedPreviewBounds.width > 0 && expandedPreviewBounds.height > 0
      ? Math.min(
          expandedPreviewBounds.width / SHARE_CARD_WIDTH,
          expandedPreviewBounds.height / SHARE_CARD_HEIGHT
        )
      : 0
  const caption = useMemo(() => {
    if (!shareData) return ''

    return buildUnitCompletedCaption(shareData)
  }, [shareData])

  const trackShareEvent = useCallback(
    async (platform: string) => {
      if (!shareData) return

      const supabase = createClient()
      const { data } = await supabase.auth.getUser()

      if (data.user) {
        await supabase.from('share_events').insert({
          user_id: data.user.id,
          entity_type: 'unit',
          entity_id: shareData.unitId,
          share_type: UNIT_COMPLETED_SHARE_TYPE,
          platform,
        })
      }

      void capturePostHog(
        platform === 'download'
          ? 'unit_completed_share_image_downloaded'
          : 'unit_completed_share_clicked',
        {
          unit_id: shareData.unitId,
          platform,
        }
      )
    },
    [shareData]
  )

  const exportBlob = useCallback(async () => {
    if (!cardRef.current || !shareData) {
      throw new Error('Share card is not ready yet.')
    }

    setIsExporting(true)
    setError(null)
    setNotice(null)

    try {
      const blob = await toBlob(cardRef.current, {
        width: SHARE_CARD_WIDTH,
        height: SHARE_CARD_HEIGHT,
        pixelRatio: SHARE_CARD_EXPORT_SCALE,
        cacheBust: true,
        backgroundColor: '#050607',
      })

      if (!blob) {
        throw new Error('Could not render the PNG.')
      }

      return blob
    } catch (exportError) {
      setError(
        'The image could not be exported. Remote image CORS settings can block browser rendering; try downloading with the placeholder or another uploaded image.'
      )
      throw exportError
    } finally {
      setIsExporting(false)
    }
  }, [shareData])

  const downloadBlob = useCallback(
    async (platform = 'download') => {
      if (!shareData) return

      const blob = await exportBlob()
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = buildShareFileName(shareData.unitName)
      document.body.appendChild(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(url)
      await trackShareEvent(platform)
      setNotice(
        platform === 'instagram'
          ? 'Image downloaded. Open Instagram and upload it from your photos.'
          : 'Image downloaded.'
      )
    },
    [exportBlob, shareData, trackShareEvent]
  )

  const nativeShare = useCallback(async () => {
    if (!shareData) return

    const blob = await exportBlob()
    const file = new File([blob], buildShareFileName(shareData.unitName), {
      type: 'image/png',
    })

    if (
      typeof navigator.share === 'function' &&
      (!navigator.canShare || navigator.canShare({ files: [file] }))
    ) {
      await navigator.share({
        title: 'Unit Completed',
        text: caption,
        files: [file],
      })
      await trackShareEvent('native')
      return
    }

    await downloadBlob('download')
  }, [caption, downloadBlob, exportBlob, shareData, trackShareEvent])

  const whatsAppShare = useCallback(async () => {
    if (!shareData) return

    try {
      const blob = await exportBlob()
      const file = new File([blob], buildShareFileName(shareData.unitName), {
        type: 'image/png',
      })

      if (
        typeof navigator.share === 'function' &&
        (!navigator.canShare || navigator.canShare({ files: [file] }))
      ) {
        await navigator.share({
          title: 'Unit Completed',
          text: caption,
          files: [file],
        })
      } else {
        await downloadBlob('download')
        window.open(`https://wa.me/?text=${encodeURIComponent(caption)}`, '_blank')
      }
    } finally {
      await trackShareEvent('whatsapp')
    }
  }, [caption, downloadBlob, exportBlob, shareData, trackShareEvent])

  const instagramDownload = useCallback(async () => {
    await downloadBlob('instagram')
  }, [downloadBlob])

  const facebookShare = useCallback(async () => {
    if (!shareData) return

    await downloadBlob('facebook')
    await navigator.clipboard?.writeText(caption)
    window.open(
      `https://www.facebook.com/sharer/sharer.php?quote=${encodeURIComponent(
        caption
      )}`,
      '_blank'
    )
    setNotice('Image downloaded and caption copied for Facebook.')
  }, [caption, downloadBlob, shareData])

  const copyCaption = useCallback(async () => {
    await navigator.clipboard?.writeText(caption)
    setNotice('Caption copied.')
  }, [caption])

  if (!isOpen) {
    return null
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/80 p-3 backdrop-blur-sm sm:items-center sm:p-5"
      role="dialog"
      aria-modal="true"
      aria-labelledby="unit-completed-share-title"
    >
      <div className="mobile-sheet w-full max-w-5xl border border-white/10 bg-[#080d11] shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-white/10 p-4 sm:p-5">
          <div>
            <h2
              id="unit-completed-share-title"
              className="text-2xl font-black text-white"
            >
              Unit Completed
            </h2>
            <p className="mt-1 text-sm text-white/50">
              The grey has been defeated. Shall we make witnesses of them?
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="tap-press mobile-close-button flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.03] text-xl font-bold text-white/70"
            aria-label="Close"
          >
            x
          </button>
        </div>

        <div className="grid min-h-0 gap-5 overflow-y-auto p-4 mobile-scroll sm:grid-cols-[minmax(280px,420px)_1fr] sm:p-5">
          <div className="mx-auto w-full max-w-[420px]">
            <div
              ref={previewRef}
              className="group relative aspect-[9/16] w-full cursor-zoom-in overflow-hidden rounded-lg border border-[#d8a84f]/35 bg-black"
              role="button"
              tabIndex={shareData && activeImage ? 0 : -1}
              aria-label="Expand share card preview"
              onClick={() => {
                if (shareData && activeImage) {
                  setIsPreviewExpanded(true)
                }
              }}
              onKeyDown={(event) => {
                if (
                  shareData &&
                  activeImage &&
                  (event.key === 'Enter' || event.key === ' ')
                ) {
                  event.preventDefault()
                  setIsPreviewExpanded(true)
                }
              }}
            >
              {shareData && activeImage && previewScale > 0 ? (
                <>
                  <div
                    className="absolute left-0 top-0 origin-top-left"
                    style={{
                      width: SHARE_CARD_WIDTH,
                      height: SHARE_CARD_HEIGHT,
                      transform: `scale(${previewScale})`,
                    }}
                  >
                    <UnitCompletedCardPreview
                      unitName={shareData.unitName}
                      image={activeImage}
                      totalSeconds={shareData.totalSeconds}
                      completedAt={shareData.completedAt}
                      sessionCount={shareData.sessionCount}
                      quote={quote}
                    />
                  </div>
                  <span className="absolute bottom-3 right-3 rounded-full border border-white/15 bg-black/70 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.14em] text-white/80 opacity-0 shadow-lg backdrop-blur transition group-hover:opacity-100 group-focus:opacity-100">
                    Expand
                  </span>
                </>
              ) : (
                <div className="flex h-full items-center justify-center text-sm text-white/45">
                  {isLoading ? 'Preparing share card...' : 'Share card unavailable'}
                </div>
              )}
            </div>
          </div>

          <div className="flex min-w-0 flex-col gap-4">
            {error ? (
              <div className="rounded-xl border border-red-400/30 bg-red-500/10 p-3 text-sm text-red-100">
                {error}
              </div>
            ) : null}
            {notice ? (
              <div className="rounded-xl border border-cyan-300/25 bg-cyan-300/10 p-3 text-sm text-cyan-100">
                {notice}
              </div>
            ) : null}

            {shareData && activeImage ? (
              <>
                <UnitImagePicker
                  images={shareData.images}
                  selectedImageId={activeImage.id}
                  onSelectImage={(image) => {
                    setSelectedImage(image)
                    void capturePostHog('unit_completed_share_image_changed', {
                      unit_id: shareData.unitId,
                      image_source: image.source,
                    })
                  }}
                />

                <div>
                  <div className="mb-2 text-xs font-bold uppercase tracking-[0.16em] text-white/45">
                    Curator quote
                  </div>
                  <div className="rounded-xl border border-white/10 bg-white/[0.035] p-3 text-sm text-white/70">
                    &quot;{quote}&quot;
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setQuote((current) => getRandomCuratorQuote(current))
                      void capturePostHog(
                        'unit_completed_share_quote_regenerated',
                        { unit_id: shareData.unitId }
                      )
                    }}
                    className="tap-press mt-2 rounded-xl border border-cyan-300/20 bg-cyan-300/10 px-3 py-2 text-xs font-bold text-cyan-100"
                  >
                    Regenerate quote
                  </button>
                </div>

                <ShareActions
                  isExporting={isExporting}
                  canNativeShare={canNativeShare}
                  onDownload={downloadBlob}
                  onNativeShare={nativeShare}
                  onWhatsApp={whatsAppShare}
                  onInstagram={instagramDownload}
                  onFacebook={facebookShare}
                  onCopyCaption={copyCaption}
                />

                <div className="text-xs leading-relaxed text-white/35">
                  WhatsApp mobile uses native image sharing when the browser
                  allows it. Instagram web uploads are not supported, so this
                  downloads the card for manual posting.
                </div>
              </>
            ) : null}
          </div>
        </div>

        <div className="pointer-events-none fixed -left-[9999px] top-0">
          {shareData && activeImage ? (
            <div ref={cardRef}>
              <UnitCompletedCardPreview
                unitName={shareData.unitName}
                image={activeImage}
                totalSeconds={shareData.totalSeconds}
                completedAt={shareData.completedAt}
                sessionCount={shareData.sessionCount}
                quote={quote}
              />
            </div>
          ) : null}
        </div>
      </div>

      {isPreviewExpanded && shareData && activeImage ? (
        <div
          className="fixed inset-0 z-[70] bg-black/92 p-3 backdrop-blur-md sm:p-6"
          role="dialog"
          aria-modal="true"
          aria-label="Expanded share card preview"
          onClick={() => setIsPreviewExpanded(false)}
        >
          <button
            type="button"
            onClick={() => setIsPreviewExpanded(false)}
            className="tap-press absolute right-4 top-4 z-10 flex h-11 w-11 items-center justify-center rounded-full border border-white/15 bg-white/[0.06] text-xl font-bold text-white/80"
            aria-label="Close expanded preview"
          >
            x
          </button>
          <div
            ref={expandedPreviewRef}
            className="flex h-full w-full items-center justify-center"
          >
            {expandedPreviewScale > 0 ? (
              <div
                className="relative overflow-hidden rounded-xl border border-[#d8a84f]/35 bg-black shadow-[0_28px_90px_rgba(0,0,0,0.85)]"
                style={{
                  width: SHARE_CARD_WIDTH * expandedPreviewScale,
                  height: SHARE_CARD_HEIGHT * expandedPreviewScale,
                }}
                onClick={(event) => event.stopPropagation()}
              >
                <div
                  className="absolute left-0 top-0 origin-top-left"
                  style={{
                    width: SHARE_CARD_WIDTH,
                    height: SHARE_CARD_HEIGHT,
                    transform: `scale(${expandedPreviewScale})`,
                  }}
                >
                  <UnitCompletedCardPreview
                    unitName={shareData.unitName}
                    image={activeImage}
                    totalSeconds={shareData.totalSeconds}
                    completedAt={shareData.completedAt}
                    sessionCount={shareData.sessionCount}
                    quote={quote}
                  />
                </div>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  )
}

function buildImageOptions({
  unitName,
  unitImages,
  projectImage,
}: {
  unitName: string
  unitImages: ImageRow[]
  projectImage: ImageRow | null
}) {
  const options: UnitCompletedShareImage[] = []
  const seenUrls = new Set<string>()
  const addImage = (
    image: ImageRow | null | undefined,
    source: UnitCompletedShareImage['source'],
    label: string
  ) => {
    if (!image?.image_url || seenUrls.has(image.image_url)) return

    seenUrls.add(image.image_url)
    options.push({
      id: `${source}-${image.id}`,
      url: image.image_url,
      label,
      alt: image.alt_text || unitName,
      source,
    })
  }

  const sortedImages = [...unitImages].sort((a, b) => {
    if (Boolean(a.is_featured) !== Boolean(b.is_featured)) {
      return a.is_featured ? -1 : 1
    }

    return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
  })
  const featured = sortedImages.find((image) => image.is_featured)
  const galleryImages = sortedImages.filter(
    (image) => !image.alt_text?.startsWith('stage:')
  )
  const stageImages = sortedImages.filter((image) =>
    image.alt_text?.startsWith('stage:')
  )

  addImage(featured, 'featured', 'Featured')

  for (const image of galleryImages) {
    addImage(image, 'gallery', image.is_featured ? 'Featured' : 'Gallery')
  }

  for (const image of stageImages) {
    addImage(image, 'stage', 'Stage')
  }

  if (options.length === 0) {
    addImage(projectImage, 'project', 'Project')
  }

  for (const image of sortedImages) {
    addImage(
      image,
      image.alt_text?.startsWith('stage:') ? 'stage' : 'gallery',
      image.alt_text?.startsWith('stage:') ? 'Stage' : 'Gallery'
    )
  }

  options.push({
    id: 'placeholder',
    url: '',
    label: 'Placeholder',
    alt: unitName,
    source: 'placeholder',
  })

  return options
}

function getSessionDurationSeconds(session: SessionRow) {
  if (typeof session.duration_seconds === 'number') {
    return Math.max(0, session.duration_seconds)
  }

  if (!session.started_at || !session.ended_at) {
    return 0
  }

  const started = new Date(session.started_at).getTime()
  const ended = new Date(session.ended_at).getTime()

  if (Number.isNaN(started) || Number.isNaN(ended) || ended <= started) {
    return 0
  }

  return Math.floor((ended - started) / 1000)
}
