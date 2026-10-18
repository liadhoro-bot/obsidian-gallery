'use client'

// The card editor sheet and its card-editing handlers, shared by the deck
// editor (every card of a deck) and the guide editor (Edit on a guide's
// direct card, saved in place).

import Image from 'next/image'
import { useMemo, useState } from 'react'
import type { ChangeEvent, Dispatch, SetStateAction } from 'react'
import PaintPickerDialog, {
  type PaintPickerPaint,
} from '../../../components/paints/paint-picker-dialog'
import { createClient } from '../../../utils/supabase/client'
import { downscaleImageFile } from '../../../utils/images/downscale-image'
import { getSafeImageExtension } from '../../../utils/images/gallery-upload'
import type { GuidesV3DeckDetail, GuidesV3DeckStep } from '../guides-v3-detail-data'
import { ImageFocalPointField } from './image-focal-point-field'
import { PaintAlignmentToggle, PaintVerticalAlignmentPicker } from './paint-alignment-toggle'
import { cardTypeLabel } from './card-templates'
import styles from '../decks/[id]/deck-editor-client.module.css'

export type CardEditorTemplate = 'cover' | 'step' | 'theme' | 'theme-alt' | 'image' | 'small-image' | 'paints' | 'video'

export type CardEditorPaint = {
  id: string
  brand: string | null
  line: string | null
  name: string | null
  hex_approx: string | null
  swatch_image_url: string | null
  ratio_text?: string | null
  is_owned?: boolean
  is_wishlist?: boolean
  source?: 'catalog' | 'custom'
}

export type CardEditorCard = {
  paintAlignment?: 'left' | 'right'
  paintVerticalAlignment?: 'top' | 'center' | 'bottom'
  subtitle?: string | null
  id: string
  title: string
  template: CardEditorTemplate
  body: string
  image: string | null
  paints: CardEditorPaint[]
  videoUrl: string | null
  imageFocalX: number
  imageFocalY: number
}

type CardTemplate = CardEditorTemplate
type PreviewPaint = CardEditorPaint
type EditorCard = CardEditorCard

type DropTarget = {
  edge: 'before' | 'after'
  id: string
}

const cardTemplateOptions: CardTemplate[] = ['step', 'theme', 'theme-alt', 'image', 'small-image', 'paints', 'video']
const themePaintLimit = 7
// Type B flows paints 8-14 into a second column.
const altThemePaintLimit = 14
const stepPaintLimit = 4
const DIRECT_UPLOAD_DOWNSCALE_THRESHOLD = 6 * 1024 * 1024

export async function uploadDeckEditorImage(file: File) {
  const supabase = createClient()
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) throw new Error('Sign in again to upload photos.')

  let uploadFile = file

  // Keep common phone photos quick and reliable on mobile connections. This
  // happens after the original file has already been used for the instant
  // local preview, so it never delays the visible UI response.
  if (file.size > DIRECT_UPLOAD_DOWNSCALE_THRESHOLD) {
    try {
      uploadFile = await downscaleImageFile(file)
    } catch {
      // Some formats (notably HEIC in certain browsers) cannot be decoded by
      // canvas. Direct upload still supports them, so retain the original.
      uploadFile = file
    }
  }

  const extension = getSafeImageExtension(uploadFile.name)
  const path = `users/${user.id}/deck-editor/${Date.now()}-${crypto.randomUUID()}.${extension}`
  const { error: uploadError } = await supabase.storage
    .from('obsidian-images')
    .upload(path, uploadFile, {
      cacheControl: '3600',
      contentType: uploadFile.type || undefined,
      upsert: false,
    })

  if (uploadError) throw new Error(uploadError.message)

  const {
    data: { publicUrl },
  } = supabase.storage.from('obsidian-images').getPublicUrl(path)

  return publicUrl
}

export function paintLimitForTemplate(template: CardTemplate) {
  if (template === 'theme') return themePaintLimit
  if (template === 'theme-alt') return altThemePaintLimit
  if (template === 'paints') return Infinity
  return stepPaintLimit
}

// Matches each template's real image mount aspect ratio in the live card
// (see recipe-guide-cards.tsx), so the focal-point preview here shows
// exactly what will actually crop into view.
function focalAspectRatioForTemplate(template: CardTemplate) {
  if (template === 'cover') return 540 / (960 * 0.43)
  if (template === 'small-image') return 540 / (960 * 0.36)
  return 540 / 960
}

function cardTemplateFromSavedStep(
  template: string | null | undefined,
  image: string | null,
  videoUrl: string | null,
  title: string,
  paintCount: number
): CardTemplate {
  const lowerTitle = title.toLowerCase()
  const looksLikeTheme = lowerTitle.includes('theme') || lowerTitle.includes('palette')

  if (videoUrl) {
    return 'video'
  }

  if (template === 'image' && looksLikeTheme) {
    return 'theme'
  }

  if (
    template === 'step' ||
    template === 'theme' ||
    template === 'theme-alt' ||
    template === 'image' ||
    template === 'small-image' ||
    template === 'paints' ||
    template === 'video'
  ) {
    return template
  }

  if (looksLikeTheme) {
    return 'theme'
  }

  if (paintCount >= 4 && image) {
    return 'theme'
  }

  return image ? 'image' : 'step'
}

// A saved deck step as an editable card.
export function editorCardFromStep(step: GuidesV3DeckStep): CardEditorCard {
  return {
    id: step.id,
    title: step.title,
    template: cardTemplateFromSavedStep(
      step.template,
      step.image,
      step.videoUrl,
      step.title,
      step.paints.length
    ),
    body: step.instructions,
    // Use the untransformed source (GuidesV3DeckStep.rawImage), not the
    // thumbnail, so saving never downgrades the stored image.
    image: step.rawImage ?? step.image,
    paints: step.paints.map((paint) => ({
      id: paint.id,
      brand: paint.brand,
      line: paint.line,
      name: paint.name,
      hex_approx: paint.color,
      swatch_image_url: paint.swatchImageUrl,
      ratio_text: paint.ratioText,
      is_owned: paint.isOwned,
      is_wishlist: paint.isWishlist,
    })),
    videoUrl: step.videoUrl,
    imageFocalX: step.imageFocalX,
    imageFocalY: step.imageFocalY,
    paintAlignment: step.paintAlignment ?? 'left',
    paintVerticalAlignment: step.paintVerticalAlignment ?? 'top',
    subtitle: step.subtitle ?? null,
  }
}

function getYoutubeVideoId(url: string | null) {
  if (!url) return null

  try {
    const parsed = new URL(url)

    if (parsed.hostname.includes('youtu.be')) {
      return parsed.pathname.replace('/', '') || null
    }

    if (parsed.hostname.includes('youtube.com')) {
      const watchId = parsed.searchParams.get('v')
      if (watchId) return watchId

      if (parsed.pathname.startsWith('/shorts/')) {
        return parsed.pathname.split('/')[2] || null
      }

      if (parsed.pathname.startsWith('/embed/')) {
        return parsed.pathname.split('/')[2] || null
      }
    }

    return null
  } catch {
    return null
  }
}

function getYoutubeEmbedUrl(url: string | null) {
  const id = getYoutubeVideoId(url)
  return id ? `https://www.youtube.com/embed/${id}` : null
}

const templateLabel = (template: CardTemplate) => cardTypeLabel(template)

function templateEditorSubtitle(template: CardTemplate) {
  if (template === 'cover') return 'Cover image, title, and deck description'
  if (template === 'paints') return 'Choose deck paints and show ownership status'
  if (template === 'video') return 'YouTube link and a short caption'
  if (template === 'image') return 'Large image card with a compact title and instruction panel'
  if (template === 'small-image') return 'Small image card with a top reference image and more room for text'
  if (template === 'theme-alt') return 'Step content, paints, ratios, and image - parchment-panel layout'
  return 'Step content, paints, ratios, and image'
}

function splitPaintId(paintId: string) {
  if (paintId.startsWith('catalog:')) {
    return { source: 'catalog' as const, id: paintId.slice('catalog:'.length) }
  }

  if (paintId.startsWith('custom:')) {
    return { source: 'custom' as const, id: paintId.slice('custom:'.length) }
  }

  return { source: 'catalog' as const, id: paintId }
}

function editorPaintToPickerPaint(paint: PreviewPaint | null): PaintPickerPaint | null {
  if (!paint?.id || paint.id.startsWith('paint:')) return null

  const paintRef = splitPaintId(paint.id)

  return {
    id: paintRef.id,
    source: paint.source ?? paintRef.source,
    name: paint.name,
    brand: paint.brand,
    line: paint.line,
    swatch_image_url: paint.swatch_image_url,
    hex: paint.hex_approx,
    hex_approx: paint.hex_approx,
    is_owned: Boolean(paint.is_owned),
    is_wishlist: Boolean(paint.is_wishlist),
  }
}

function deckPaintToPickerPaint(
  paint: GuidesV3DeckDetail['paintList'][number]
): PaintPickerPaint {
  const paintRef = splitPaintId(paint.id)

  return {
    id: paintRef.id,
    source: paintRef.source,
    name: paint.name,
    brand: paint.brand,
    line: paint.line,
    swatch_image_url: paint.swatchImageUrl,
    hex: paint.color,
    hex_approx: paint.color,
    is_owned: paint.isOwned,
    is_wishlist: paint.isWishlist,
  }
}

function pickerPaintToEditorPaint(
  paint: PaintPickerPaint,
  ratioText?: string | null
): PreviewPaint {
  return {
    id: `${paint.source}:${paint.id}`,
    source: paint.source,
    brand: paint.brand,
    line: paint.line,
    name: paint.name,
    hex_approx: paint.hex_approx ?? paint.hex ?? null,
    swatch_image_url: paint.swatch_image_url,
    ratio_text: ratioText ?? null,
    is_owned: Boolean(paint.is_owned),
    is_wishlist: Boolean(paint.is_wishlist),
  }
}

export function DragHandleIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
      <circle cx="9" cy="6" r="1.7" />
      <circle cx="9" cy="12" r="1.7" />
      <circle cx="9" cy="18" r="1.7" />
      <circle cx="15" cy="6" r="1.7" />
      <circle cx="15" cy="12" r="1.7" />
      <circle cx="15" cy="18" r="1.7" />
    </svg>
  )
}

// The sheet's change handlers for the card being edited (`editingCardId`)
// within a list of cards. Image uploads report through the two setters so
// the owner can block saving while a photo is still uploading.
export function cardEditingHandlers({
  editingCard,
  editingCardId,
  setCards,
  setImageUploadError,
  setPendingImageUploads,
}: {
  editingCard: EditorCard | null
  editingCardId: string | null
  setCards: Dispatch<SetStateAction<EditorCard[]>>
  setImageUploadError: (error: string | null) => void
  setPendingImageUploads: Dispatch<SetStateAction<number>>
}) {
  function updateCardById(cardId: string, update: Partial<EditorCard>) {
    setCards((current) =>
      current.map((card) =>
        card.id === cardId ? { ...card, ...update } : card
      )
    )
  }

  function updateEditingCard(update: Partial<EditorCard>) {
    if (!editingCardId) return
    updateCardById(editingCardId, update)
  }

  function updateEditingCardPaint(
    paintIndex: number,
    patch: Partial<PreviewPaint>
  ) {
    if (!editingCardId) return
    setCards((current) =>
      current.map((card) => {
        if (card.id !== editingCardId) return card
        const paintLimit = paintLimitForTemplate(card.template)
        if (paintIndex >= paintLimit) return card
        const paints = [...card.paints]
        const existing = paints[paintIndex] ?? {
          id: `paint:${Date.now()}:${paintIndex}`,
          brand: null,
          line: null,
          name: null,
          hex_approx: null,
          swatch_image_url: null,
          ratio_text: null,
        }
        paints[paintIndex] = { ...existing, ...patch }
        return { ...card, paints }
      })
    )
  }

  function addEditingCardPaint() {
    if (!editingCardId) return
    setCards((current) =>
      current.map((card) =>
        card.id === editingCardId &&
        card.paints.length < paintLimitForTemplate(card.template)
          ? {
              ...card,
              paints: [
                ...card.paints,
                {
                  id: `paint:${Date.now()}:${card.paints.length}`,
                  brand: null,
                  line: null,
                  name: null,
                  hex_approx: null,
                  swatch_image_url: null,
                  ratio_text: null,
                },
              ],
            }
          : card
      )
    )
  }

  function deleteEditingCardPaint(paintIndex: number) {
    if (!editingCardId) return
    setCards((current) =>
      current.map((card) =>
        card.id === editingCardId
          ? {
              ...card,
              paints: card.paints.filter((_, index) => index !== paintIndex),
            }
          : card
      )
    )
  }

  function selectEditingCardPaint(
    paintIndex: number,
    selectedPaint: PaintPickerPaint | null
  ) {
    const existingRatio = editingCard?.paints[paintIndex]?.ratio_text ?? null
    updateEditingCardPaint(
      paintIndex,
      selectedPaint
        ? pickerPaintToEditorPaint(selectedPaint, existingRatio)
        : {
            id: `paint:${Date.now()}:${paintIndex}`,
            brand: null,
            line: null,
            name: null,
            hex_approx: null,
            swatch_image_url: null,
          }
    )
  }

  async function updateEditingCardImage(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    const activeCardId = editingCardId
    if (!file || !activeCardId) return
    const previousImage = editingCard?.image ?? null
    const url = URL.createObjectURL(file)
    const template =
      editingCard?.template === 'cover' ||
      editingCard?.template === 'theme' ||
      editingCard?.template === 'theme-alt' ||
      editingCard?.template === 'small-image'
        ? editingCard.template
        : 'image'

    setImageUploadError(null)
    setPendingImageUploads((count) => count + 1)
    // A newly picked photo has no established framing yet - start it
    // centered rather than carrying over whatever the previous image's
    // focal point happened to be.
    updateCardById(activeCardId, {
      image: url,
      template,
      imageFocalX: 50,
      imageFocalY: 50,
    })
    event.target.value = ''

    try {
      const uploadedUrl = await uploadDeckEditorImage(file)
      setCards((current) =>
        current.map((card) =>
          card.id === activeCardId && card.image === url
            ? { ...card, image: uploadedUrl, template }
            : card
        )
      )
    } catch (error) {
      setCards((current) =>
        current.map((card) =>
          card.id === activeCardId && card.image === url
            ? { ...card, image: previousImage }
            : card
        )
      )
      setImageUploadError(
        error instanceof Error ? error.message : 'Could not upload image.'
      )
    } finally {
      URL.revokeObjectURL(url)
      setPendingImageUploads((count) => Math.max(0, count - 1))
    }
  }

  return {
    addEditingCardPaint,
    deleteEditingCardPaint,
    selectEditingCardPaint,
    updateCardById,
    updateEditingCard,
    updateEditingCardImage,
    updateEditingCardPaint,
  }
}

export function CardEditorSheet({
  canDelete,
  card,
  deckPaints,
  error,
  isSaving = false,
  onAddPaint,
  onChange,
  onChangeImage,
  onChangePaint,
  onClose,
  onDelete,
  onDeletePaint,
  onSelectPaint,
}: {
  canDelete: boolean
  card: EditorCard
  deckPaints: GuidesV3DeckDetail['paintList']
  // Shown in the sheet when it saves on close (the guide editor).
  error?: string | null
  isSaving?: boolean
  onAddPaint: () => void
  onChange: (patch: Partial<EditorCard>) => void
  onChangeImage: (event: ChangeEvent<HTMLInputElement>) => void
  onChangePaint: (paintIndex: number, patch: Partial<PreviewPaint>) => void
  onClose: () => void
  onDelete: () => void
  onDeletePaint: (paintIndex: number) => void
  onSelectPaint: (paintIndex: number, paint: PaintPickerPaint | null) => void
}) {
  const isCover = card.template === 'cover'
  const isStepLike =
    card.template === 'step' || card.template === 'theme' || card.template === 'theme-alt'
  const isImageCard = card.template === 'image' || card.template === 'small-image'
  const isPaintsList = card.template === 'paints'
  const isVideo = card.template === 'video'
  const canRepositionImage =
    isCover || isImageCard || card.template === 'theme' || card.template === 'theme-alt'
  const [isRepositioningImage, setIsRepositioningImage] = useState(false)
  const paintLimit = paintLimitForTemplate(card.template)
  const embedUrl = isVideo ? getYoutubeEmbedUrl(card.videoUrl) : null
  const initialPaints = useMemo(
    () => deckPaints.map(deckPaintToPickerPaint),
    [deckPaints]
  )
  const [draggingPaintId, setDraggingPaintId] = useState<string | null>(null)
  const [paintDropTarget, setPaintDropTarget] = useState<DropTarget | null>(null)

  function reorderPaint(paintId: string, targetId: string, edge: DropTarget['edge']) {
    if (paintId === targetId) return
    const fromIndex = card.paints.findIndex((paint) => paint.id === paintId)
    const toIndex = card.paints.findIndex((paint) => paint.id === targetId)
    if (fromIndex < 0 || toIndex < 0) return
    const next = [...card.paints]
    const [moved] = next.splice(fromIndex, 1)
    if (!moved) return
    const targetOffset = edge === 'after' ? 1 : 0
    const adjustedIndex = fromIndex < toIndex ? toIndex - 1 : toIndex
    next.splice(adjustedIndex + targetOffset, 0, moved)
    onChange({ paints: next })
  }

  return (
    <div className={styles.sheetBackdrop} role="dialog" aria-modal="true">
      <section className={styles.sheet}>
        <header>
          <span>
            <h2>Edit {templateLabel(card.template)} Card</h2>
            <p>{templateEditorSubtitle(card.template)}</p>
          </span>
          <button type="button" onClick={onClose} aria-label="Close" disabled={isSaving}>
            Close
          </button>
        </header>

        <label className={styles.field}>
          <span>{isCover ? 'Cover Title' : 'Title'}</span>
          <input
            value={card.title}
            onChange={(event) => onChange({ title: event.target.value })}
          />
        </label>

        {card.template === 'theme' || card.template === 'theme-alt' ? (
          <label className={styles.field}>
            <span>Subtitle</span>
            <input
              value={card.subtitle ?? 'Color Reference'}
              placeholder="Color Reference"
              maxLength={60}
              onChange={(event) => onChange({ subtitle: event.target.value })}
            />
          </label>
        ) : null}

        {!isPaintsList && !isVideo ? (
          <section className={styles.cardImageEditor}>
            <div className={styles.cardImagePreview}>
              {card.image ? (
                <Image src={card.image} alt="" fill sizes="420px" unoptimized />
              ) : (
                <span>No image selected</span>
              )}
              {card.image && canRepositionImage ? (
                <button
                  type="button"
                  className={styles.repositionToggle}
                  onClick={() => setIsRepositioningImage((current) => !current)}
                >
                  {isRepositioningImage ? 'Done' : 'Reposition'}
                </button>
              ) : null}
            </div>
            <div className={styles.cardImageActions}>
              <label>
                <input
                  type="file"
                  accept="image/*"
                  className={styles.hiddenInput}
                  onChange={onChangeImage}
                />
                From Gallery
              </label>
              <label>
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className={styles.hiddenInput}
                  onChange={onChangeImage}
                />
                Camera
              </label>
            </div>
            {card.image && canRepositionImage && isRepositioningImage ? (
              <ImageFocalPointField
                key={card.image}
                src={card.image}
                x={card.imageFocalX}
                y={card.imageFocalY}
                aspectRatio={focalAspectRatioForTemplate(card.template)}
                onChange={(x, y) => onChange({ imageFocalX: x, imageFocalY: y })}
              />
            ) : null}
          </section>
        ) : null}

        {isVideo ? (
          <section className={styles.videoEditor}>
            <label className={styles.field}>
              <span>YouTube URL</span>
              <input
                type="url"
                value={card.videoUrl ?? ''}
                onChange={(event) => onChange({ videoUrl: event.target.value })}
                placeholder="https://www.youtube.com/watch?v=..."
              />
            </label>
            {card.videoUrl?.trim() ? (
              embedUrl ? (
                <div className={styles.videoPreview}>
                  <iframe src={embedUrl} title="Video preview" allowFullScreen />
                </div>
              ) : (
                <p className={styles.videoPreviewError}>
                  Paste a valid YouTube link to see the preview.
                </p>
              )
            ) : null}
          </section>
        ) : null}

        {!isCover ? (
          <label className={styles.field}>
            <span>Card Type</span>
            <select
              value={card.template}
              onChange={(event) =>
                onChange({ template: event.target.value as CardTemplate })
              }
            >
              {cardTemplateOptions.map((template) => (
                <option key={template} value={template}>
                  {templateLabel(template)}
                </option>
              ))}
            </select>
          </label>
        ) : null}

        <label className={styles.descriptionPanel}>
          <span>{isCover ? 'Description' : isPaintsList || isVideo ? 'Caption' : isImageCard ? 'Text' : 'Instructions'}</span>
          <textarea
            value={card.body}
            onChange={(event) => onChange({ body: event.target.value })}
            rows={6}
          />
        </label>

        {isStepLike ? (
          <section className={styles.paintEditor}>
            <div className={styles.paintEditorHeader}>
              <h3>Paints & Ratios</h3>
              <div className={styles.paintEditorActions}>
              {card.template === 'theme-alt' ? (
                <PaintVerticalAlignmentPicker
                  value={card.paintVerticalAlignment}
                  onChange={(paintVerticalAlignment) => onChange({ paintVerticalAlignment })}
                />
              ) : null}
              {card.template === 'theme' || card.template === 'theme-alt' ? (
                <PaintAlignmentToggle
                  value={card.paintAlignment}
                  onChange={(paintAlignment) => onChange({ paintAlignment })}
                />
              ) : null}
              {card.paints.length < paintLimit ? (
                <button type="button" onClick={onAddPaint}>
                  Add Paint
                </button>
              ) : null}
              </div>
            </div>
            {card.paints.length ? (
              <div className={styles.paintRows}>
                {card.paints.map((paint, index) => (
                  <div
                    key={paint.id}
                    className={[
                      styles.paintRow,
                      draggingPaintId === paint.id ? styles.paintRowDragging : '',
                      paintDropTarget?.id === paint.id && paintDropTarget.edge === 'before'
                        ? styles.paintRowDropBefore
                        : '',
                      paintDropTarget?.id === paint.id && paintDropTarget.edge === 'after'
                        ? styles.paintRowDropAfter
                        : '',
                    ].join(' ')}
                    draggable
                    onDragStart={(event) => {
                      setDraggingPaintId(paint.id)
                      event.dataTransfer.effectAllowed = 'move'
                      event.dataTransfer.setData('text/plain', paint.id)
                    }}
                    onDragOver={(event) => {
                      event.preventDefault()
                      const rect = event.currentTarget.getBoundingClientRect()
                      const edge =
                        event.clientY < rect.top + rect.height / 2 ? 'before' : 'after'
                      setPaintDropTarget({ id: paint.id, edge })
                      event.dataTransfer.dropEffect = 'move'
                    }}
                    onDragLeave={() => {
                      if (paintDropTarget?.id === paint.id) setPaintDropTarget(null)
                    }}
                    onDrop={(event) => {
                      event.preventDefault()
                      const draggedId = event.dataTransfer.getData('text/plain') || draggingPaintId
                      if (draggedId) {
                        reorderPaint(draggedId, paint.id, paintDropTarget?.edge ?? 'before')
                      }
                      setDraggingPaintId(null)
                      setPaintDropTarget(null)
                    }}
                    onDragEnd={() => {
                      setDraggingPaintId(null)
                      setPaintDropTarget(null)
                    }}
                  >
                    <span
                      className={styles.dragHandle}
                      aria-label={`Drag to reorder ${paint.name || `paint ${index + 1}`}`}
                      title="Drag to reorder"
                    >
                      <DragHandleIcon />
                    </span>
                    <DeckPaintPickerField
                      initialPaints={initialPaints}
                      paint={paint}
                      onClearPaint={() => onSelectPaint(index, null)}
                      onSelectPaint={(selectedPaint) =>
                        onSelectPaint(index, selectedPaint)
                      }
                    />
                    <label>
                      <span>Ratio</span>
                      <input
                        value={paint.ratio_text ?? ''}
                        onChange={(event) =>
                          onChangePaint(index, { ratio_text: event.target.value })
                        }
                        placeholder="1:1"
                      />
                    </label>
                    <button
                      type="button"
                      className={styles.paintDeleteButton}
                      onClick={() => onDeletePaint(index)}
                      aria-label={`Remove paint ${index + 1}`}
                    >
                      X
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <button
                type="button"
                className={styles.emptyPaintButton}
                onClick={onAddPaint}
              >
                Add Paint
              </button>
            )}
          </section>
        ) : null}

        {isPaintsList ? (
          <section className={styles.paintEditor}>
            <div className={styles.paintEditorHeader}>
              <h3>Deck Paints</h3>
              <button type="button" onClick={onAddPaint}>
                Add Paint
              </button>
            </div>
            {card.paints.length ? (
              <div className={styles.paintRows}>
                {card.paints.map((paint, index) => (
                  <div key={`${paint.id}:${index}`} className={styles.paintsListRow}>
                    <DeckPaintPickerField
                      initialPaints={initialPaints}
                      paint={paint}
                      onClearPaint={() => onSelectPaint(index, null)}
                      onSelectPaint={(selectedPaint) =>
                        onSelectPaint(index, selectedPaint)
                      }
                    />
                    <span
                      className={
                        paint.is_owned
                          ? styles.ownershipBadgeOwned
                          : paint.is_wishlist
                            ? styles.ownershipBadgeWishlist
                            : styles.ownershipBadge
                      }
                    >
                      {paint.is_owned ? 'Owned' : paint.is_wishlist ? 'Wishlist' : 'Not Owned'}
                    </span>
                    <button
                      type="button"
                      className={styles.paintDeleteButton}
                      onClick={() => onDeletePaint(index)}
                      aria-label={`Remove paint ${index + 1}`}
                    >
                      X
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <button
                type="button"
                className={styles.emptyPaintButton}
                onClick={onAddPaint}
              >
                Add Paint
              </button>
            )}
          </section>
        ) : null}

        {error ? <p className={styles.saveError} role="alert">{error}</p> : null}

        <div className={styles.sheetActions}>
          {canDelete ? (
            <button type="button" className={styles.dangerButton} onClick={onDelete} disabled={isSaving}>
              Delete Card
            </button>
          ) : <span />}
          <button type="button" className={styles.saveButton} onClick={onClose} disabled={isSaving}>
            {isSaving ? 'Saving...' : 'Done'}
          </button>
        </div>
      </section>
    </div>
  )
}

function DeckPaintPickerField({
  initialPaints,
  onClearPaint,
  onSelectPaint,
  paint,
}: {
  initialPaints: PaintPickerPaint[]
  onClearPaint: () => void
  onSelectPaint: (paint: PaintPickerPaint) => void
  paint: PreviewPaint
}) {
  const [isOpen, setIsOpen] = useState(false)
  const selectedPaint = editorPaintToPickerPaint(paint)
  const paintLabel = [paint.brand, paint.line, paint.name].filter(Boolean).join(' / ')

  return (
    <div className={styles.paintPickerField}>
      <span className={styles.paintPickerLabel}>Paint</span>
      <button
        type="button"
        className={styles.paintPickerButton}
        onClick={() => setIsOpen(true)}
      >
        <span
          className={styles.paintPickerSwatch}
          style={{ backgroundColor: paint.hex_approx ?? 'var(--og-brass-500)' }}
        />
        <span className={styles.paintPickerCopy}>
          <strong>{paintLabel || 'No paint selected'}</strong>
          <small>{paintLabel ? 'Catalog paint' : 'Choose from paint catalog'}</small>
        </span>
        <span className={styles.paintPickerAction}>Choose</span>
      </button>
      {selectedPaint ? (
        <button
          type="button"
          className={styles.paintPickerClear}
          onClick={onClearPaint}
        >
          Clear
        </button>
      ) : null}
      <PaintPickerDialog
        open={isOpen}
        onOpenChange={setIsOpen}
        title="Choose Paint"
        selectedPaint={selectedPaint}
        selectedPaintId={selectedPaint ? `${selectedPaint.source}:${selectedPaint.id}` : null}
        onSelectPaint={(nextPaint) => {
          onSelectPaint(nextPaint)
          setIsOpen(false)
        }}
        source="deck_card_editor"
        initialPaints={initialPaints}
      />
    </div>
  )
}
