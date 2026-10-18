'use client'

import { useEditorChanges } from '@/app/components/navigation-feedback/unsaved-changes'

import { PaintAlignmentToggle, PaintVerticalAlignmentPicker } from '../../shared/paint-alignment-toggle'

import GuideBackButton from '@/app/guides/shared/guide-back-button'
import { useEditorTab } from '@/app/guides/shared/use-editor-tab'
import Image from 'next/image'
import { useEffect, useMemo, useRef, useState } from 'react'
import GalleryPager, { useGalleryPages } from '../../../components/gallery/gallery-pager'
import type { ChangeEvent, RefObject } from 'react'
import FeatureGuideLauncher from '../../../components/feature-guide-launcher'
import type { FeatureGuideEntry } from '../../../components/feature-guide-types'
import type { Recipe, RecipeImage, RecipeStep } from '../../shared/types'
import {
  RecipeGuideAltThemeStepCard,
  RecipeGuideCoverCard,
  RecipeGuideDescriptiveStepCard,
  RecipeGuideImageStepCard,
  RecipeGuidePaintsCard,
  RecipeGuideSmallImageStepCard,
  RecipeGuideThemeStepCard,
  RecipeGuideVideoCard,
} from '../../shared/recipe-guide-cards'
import PaintPickerDialog, {
  type PaintPickerPaint,
} from '../../../../components/paints/paint-picker-dialog'
import { createClient } from '../../../../utils/supabase/client'
import { downscaleImageFile } from '../../../../utils/images/downscale-image'
import { getSafeImageExtension } from '../../../../utils/images/gallery-upload'
import { hasUnuploadedImage } from '../../shared/deck-save-values'
import type { GuidesV3DeckDetail } from '../../guides-v3-detail-data'
import { ImageFocalPointField } from '../../shared/image-focal-point-field'
import styles from './deck-editor-client.module.css'
import { addableCardTypes, cardTypeDefaultBody, cardTypeLabel } from '../../shared/card-templates'
import { AddContentSheet, CardTypeSheet } from '../../shared/card-type-sheet'

type DeckEditorTab = 'details' | 'cards' | 'preview'
type DeckDifficulty = 'Beginner' | 'Intermediate' | 'Advanced'
type DeckStatus = 'Draft' | 'Private' | 'Public'
export type DeckEditorCardTemplate = 'cover' | 'step' | 'theme' | 'theme-alt' | 'image' | 'small-image' | 'paints' | 'video'
type CardTemplate = DeckEditorCardTemplate

export type DeckEditorSavePaint = {
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

export type DeckEditorInitialCard = {
  paintAlignment?: 'left' | 'right'
  paintVerticalAlignment?: 'top' | 'center' | 'bottom'
  // Theme card kicker; empty means the default "Color Reference".
  subtitle?: string | null
  id: string
  title: string
  template: DeckEditorCardTemplate
  body: string
  image: string | null
  paints?: DeckEditorSavePaint[]
  videoUrl?: string | null
  imageFocalX?: number
  imageFocalY?: number
}

export type DeckEditorSavePayload = {
  title: string
  description: string
  difficulty: DeckDifficulty
  status: DeckStatus
  heroImage: string | null
  heroFocalX: number
  heroFocalY: number
  cards: DeckEditorInitialCard[]
  inventoryNotes: string
  expertTips: string
}

type EditorCard = {
  paintAlignment?: 'left' | 'right'
  paintVerticalAlignment?: 'top' | 'center' | 'bottom'
  subtitle?: string | null
  id: string
  title: string
  template: CardTemplate
  body: string
  image: string | null
  paints: PreviewPaint[]
  videoUrl: string | null
  imageFocalX: number
  imageFocalY: number
}

type EditorImage = {
  id: string
  url: string
  alt: string
}

type PreviewPaint = DeckEditorSavePaint

type DropTarget = {
  edge: 'before' | 'after'
  id: string
}

const difficultyOptions: DeckDifficulty[] = ['Beginner', 'Intermediate', 'Advanced']
const statusOptions: DeckStatus[] = ['Draft', 'Private', 'Public']
const cardTemplateOptions: CardTemplate[] = ['step', 'theme', 'theme-alt', 'image', 'small-image', 'paints', 'video']
const addCardTemplateOptions: CardTemplate[] = addableCardTypes
const themePaintLimit = 7
// Type B flows paints 8-14 into a second column.
const altThemePaintLimit = 14
const stepPaintLimit = 4
const DIRECT_UPLOAD_DOWNSCALE_THRESHOLD = 6 * 1024 * 1024

async function uploadDeckEditorImage(file: File) {
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

function inferDifficulty(cardCount: number): DeckDifficulty {
  if (cardCount >= 8) return 'Advanced'
  if (cardCount >= 4) return 'Intermediate'
  return 'Beginner'
}

function paintLimitForTemplate(template: CardTemplate) {
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

function initialDeckCards(deck: GuidesV3DeckDetail): EditorCard[] {
  const stepCards = deck.steps.map((step) => ({
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
    // Same reasoning as the cover image below - use the untransformed
    // source (GuidesV3DeckStep.rawImage), not the thumbnail.
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
  }))

  // Where the synthesized cover card belongs, if at all - undefined
  // defaults to 0 (cover first) for decks that predate this column, null
  // omits it. See app/guides/decks/[id]/page.tsx for the matching logic
  // used when rendering the live viewer.
  const rawCoverPosition = deck.coverPosition === undefined ? 0 : deck.coverPosition
  if (rawCoverPosition === null) return stepCards

  const coverPosition = Math.max(0, Math.min(rawCoverPosition, stepCards.length))
  const coverCard: EditorCard = {
    id: `${deck.id}:title`,
    title: deck.title,
    template: 'cover',
    body: deck.description,
    // Seed from the untransformed source image, not the list/grid
    // thumbnail rendition - otherwise saving without touching the cover
    // silently downgrades the deck's stored image to that small
    // thumbnail (see GuidesV3DeckDetail.fullImage).
    image: deck.fullImage ?? deck.image,
    paints: [],
    videoUrl: null,
    imageFocalX: deck.coverFocalX ?? 50,
    imageFocalY: deck.coverFocalY ?? 50,
  }

  return [
    ...stepCards.slice(0, coverPosition),
    coverCard,
    ...stepCards.slice(coverPosition),
  ]
}

function initialGallery(deck: GuidesV3DeckDetail): EditorImage[] {
  const images = [
    { id: `${deck.id}:cover`, url: deck.fullImage ?? deck.image, alt: deck.title },
    ...deck.steps
      .filter((step) => Boolean(step.rawImage ?? step.image))
      .map((step) => ({
        id: `${step.id}:image`,
        url: (step.rawImage ?? step.image) as string,
        alt: step.title,
      })),
  ]
  const seen = new Set<string>()

  return images.filter((image) => {
    if (seen.has(image.url)) return false
    seen.add(image.url)
    return true
  })
}

function isUsableImageUrl(value?: string | null) {
  const url = typeof value === 'string' ? value.trim() : ''
  return (
    url.startsWith('http://') ||
    url.startsWith('https://') ||
    (url.startsWith('/') && !url.startsWith('//')) ||
    url.startsWith('blob:') ||
    url.startsWith('data:image/')
  )
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

function DragHandleIcon() {
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

function makeNewCard(
  template: CardTemplate,
  index: number,
  deckPaints: GuidesV3DeckDetail['paintList']
): EditorCard {
  return {
    id: `new:${template}:${Date.now()}:${index}`,
    title: `${templateLabel(template)} Card`,
    template,
    body: cardTypeDefaultBody(template),
    image: null,
    paints:
      template === 'paints'
        ? deckPaints.map((paint) => ({
            id: paint.id,
            brand: paint.brand,
            line: paint.line,
            name: paint.name,
            hex_approx: paint.color,
            swatch_image_url: paint.swatchImageUrl,
            is_owned: paint.isOwned,
            is_wishlist: paint.isWishlist,
          }))
        : [],
    videoUrl: null,
    imageFocalX: 50,
    imageFocalY: 50,
  }
}

const editorTabs = ['details', 'cards', 'preview'] as const
// Decks and guides share one editor model; the tab ids stay put so existing
// ?editorTab= links keep working.
const editorTabLabels: Record<DeckEditorTab, string> = { details: 'Details', cards: 'Contents', preview: 'Preview' }
// Editing a guide's own cards (its inline deck): the guide's details live in
// the guide editor, so only the cards and their preview are shown here.
const inlineEditorTabs = ['cards', 'preview'] as const

export default function DeckEditorClient({
  backHref,
  deck,
  featureGuides,
  initialCards,
  initialInventoryNotes = '',
  initialExpertTips = '',
  inlineGuide,
  isSaving = false,
  onBack,
  openAddCard = false,
  openCardId,
  onExit,
  onDeleteDeck,
  onSaveDraft,
  saveError,
  saveLabel = 'Save',
}: {
  backHref: string
  deck: GuidesV3DeckDetail
  featureGuides: FeatureGuideEntry[]
  initialCards?: DeckEditorInitialCard[]
  initialInventoryNotes?: string
  initialExpertTips?: string
  // Set when these are a guide's own cards (recipes.inline_guide_id).
  inlineGuide?: { id: string; title: string }
  isSaving?: boolean
  onBack?: () => void
  // Open the new-card picker on arrival (+ Add > New Card in the guide editor).
  openAddCard?: boolean
  // Open this saved card's editor on arrival (Edit on a guide's direct card).
  openCardId?: string
  // Leave without saving (nothing changed in a single-card visit).
  onExit?: () => void
  onDeleteDeck?: () => Promise<void>
  onSaveDraft?: (payload: DeckEditorSavePayload) => void | Promise<boolean>
  onTogglePaintOwnership?: (formData: FormData) => void | Promise<void>
  saveError?: string | null
  saveLabel?: string
}) {
  const [activeTab, setActiveTab] = useEditorTab<DeckEditorTab>(inlineGuide ? 'cards' : 'details', inlineGuide ? inlineEditorTabs : editorTabs)
  const [title, setTitle] = useState(deck.title)
  const [description, setDescription] = useState(deck.description)
  const [inventoryNotes] = useState(initialInventoryNotes)
  const [expertTips] = useState(initialExpertTips)
  const [difficulty, setDifficulty] = useState<DeckDifficulty>(
    (deck.difficulty as DeckDifficulty) || inferDifficulty(deck.cards)
  )
  const [status, setStatus] = useState<DeckStatus>(deck.isPublic ? 'Public' : 'Private')
  const [cards, setCards] = useState<EditorCard[]>(() =>
    initialCards
      ? initialCards.map((card) => ({
          ...card,
          paints: card.paints ?? [],
          videoUrl: card.videoUrl ?? null,
          imageFocalX: card.imageFocalX ?? 50,
          imageFocalY: card.imageFocalY ?? 50,
        }))
      : initialDeckCards(deck)
  )
  const [gallery, setGallery] = useState<EditorImage[]>(() => initialGallery(deck))
  const [heroImageId, setHeroImageId] = useState(gallery[0]?.id ?? '')
  const [draggingCardId, setDraggingCardId] = useState<string | null>(null)
  const [draggingImageId, setDraggingImageId] = useState<string | null>(null)
  const [dropTarget, setDropTarget] = useState<DropTarget | null>(null)
  const [galleryDropTarget, setGalleryDropTarget] = useState<DropTarget | null>(null)
  const [isEditingGallery, setIsEditingGallery] = useState(false)
  const [selectedImageIds, setSelectedImageIds] = useState<string[]>([])
  const [expandedImage, setExpandedImage] = useState<EditorImage | null>(null)
  const [editingCardId, setEditingCardId] = useState<string | null>(() =>
    openCardId && cards.some((card) => card.id === openCardId) ? openCardId : null
  )
  const [imageUploadError, setImageUploadError] = useState<string | null>(null)
  const [pendingImageUploads, setPendingImageUploads] = useState(0)
  const [isAddCardOpen, setIsAddCardOpen] = useState(openAddCard)
  const [isAddMenuOpen, setIsAddMenuOpen] = useState(false)
  const galleryInputRef = useRef<HTMLInputElement>(null)
  const cameraInputRef = useRef<HTMLInputElement>(null)

  const heroImage = useMemo(
    () => gallery.find((image) => image.id === heroImageId)?.url ?? deck.fullImage ?? deck.image,
    [deck.fullImage, deck.image, gallery, heroImageId]
  )
  const editingCard = cards.find((card) => card.id === editingCardId) ?? null
  const coverCard = cards.find((card) => card.template === 'cover')
  const isUploadingImages = pendingImageUploads > 0
  const saveChanges = useEditorChanges(JSON.stringify({ title, description, inventoryNotes, expertTips, difficulty, status, cards, gallery, heroImageId }), isSaving || isUploadingImages)

  function reorderCard(cardId: string, targetId: string, edge: DropTarget['edge']) {
    if (cardId === targetId) return
    setCards((current) => {
      const fromIndex = current.findIndex((card) => card.id === cardId)
      const toIndex = current.findIndex((card) => card.id === targetId)
      if (fromIndex < 0 || toIndex < 0) return current
      const next = [...current]
      const [moved] = next.splice(fromIndex, 1)
      if (!moved) return current
      const targetOffset = edge === 'after' ? 1 : 0
      const adjustedIndex = fromIndex < toIndex ? toIndex - 1 : toIndex
      next.splice(adjustedIndex + targetOffset, 0, moved)
      return next
    })
  }

  function updateEditingCard(update: Partial<EditorCard>) {
    if (!editingCardId) return
    updateCardById(editingCardId, update)
  }

  function updateCardById(cardId: string, update: Partial<EditorCard>) {
    setCards((current) =>
      current.map((card) =>
        card.id === cardId ? { ...card, ...update } : card
      )
    )
  }

  function syncCoverImage(url: string | null) {
    setCards((current) =>
      current.map((card) => (card.template === 'cover' ? { ...card, image: url } : card))
    )
  }

  function selectHeroImage(image: EditorImage) {
    setHeroImageId(image.id)
    syncCoverImage(image.url)
  }

  function updateActiveCard(update: Partial<EditorCard>) {
    if (editingCard?.template === 'cover') {
      if (typeof update.title === 'string') setTitle(update.title)
      if (typeof update.body === 'string') setDescription(update.body)
    }
    updateEditingCard(update)
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

  function deleteEditingCard() {
    if (!editingCardId) return
    // A deck must always show at least one card. The cover card is no
    // longer special-cased here - it can be deleted like any other card,
    // same as it can now be added, removed, or reordered relative to the
    // steps (see initialDeckCards/handleSave's cover-position handling).
    if (cards.length <= 1) return
    setCards((current) => current.filter((card) => card.id !== editingCardId))
    setEditingCardId(null)
  }

  function addCard(template: CardTemplate) {
    const nextCard = makeNewCard(template, cards.length + 1, deck.paintList)
    // A re-added cover card should reflect the deck's current title and
    // description right away, not generic placeholder text - those fields
    // (not this card's own text) are what actually gets saved.
    if (template === 'cover') {
      nextCard.title = title
      nextCard.body = description
      nextCard.image = heroImage
    }
    setCards((current) => [...current, nextCard])
    setEditingCardId(nextCard.id)
    setIsAddCardOpen(false)
  }

  // Arriving from a guide's Contents to add or edit one card: closing the card
  // sheet ends the visit - saving if anything changed - instead of leaving the
  // creator in this editor's card list.
  const isSingleCardVisit = Boolean(inlineGuide && onExit && (openCardId || openAddCard))
  const [cardsOnArrival] = useState(() => JSON.stringify(cards))
  const finishSingleCardVisit = useRef<() => void>(() => {})
  finishSingleCardVisit.current = () => {
    if (JSON.stringify(cards) !== cardsOnArrival) handleSave()
    else onExit?.()
  }
  const previousSheet = useRef<{ editing: string | null; adding: boolean } | null>(null)
  useEffect(() => {
    const previous = previousSheet.current
    previousSheet.current = { editing: editingCardId, adding: isAddCardOpen }
    if (!isSingleCardVisit || !previous || editingCardId || isAddCardOpen) return
    if (previous.editing || previous.adding) finishSingleCardVisit.current()
  }, [editingCardId, isAddCardOpen, isSingleCardVisit])

  function handleSave() {
    if (isUploadingImages) {
      setImageUploadError('Wait for the image upload to finish before saving.')
      return
    }

    if (hasUnuploadedImage(cards.map((card) => card.image))) {
      setImageUploadError('One or more photos have not finished uploading. Retry or remove them before saving.')
      return
    }

    void saveChanges(() => onSaveDraft?.({
      title,
      description,
      difficulty,
      status,
      heroImage: coverCard?.image ?? heroImage,
      heroFocalX: coverCard?.imageFocalX ?? 50,
      heroFocalY: coverCard?.imageFocalY ?? 50,
      inventoryNotes,
      expertTips,
      cards: cards.map((card) => ({
        id: card.id,
        title: card.title,
        template: card.template,
        body: card.body,
        image: card.image,
        paints: card.paints,
        videoUrl: card.videoUrl,
        imageFocalX: card.imageFocalX,
        imageFocalY: card.imageFocalY,
        paintAlignment: card.paintAlignment ?? 'left',
        paintVerticalAlignment: card.paintVerticalAlignment ?? 'top',
        subtitle: card.subtitle?.trim() || null,
      })),
    }))
  }

  async function addGalleryFiles(
    event: ChangeEvent<HTMLInputElement>,
    source: 'camera' | 'gallery'
  ) {
    const files = Array.from(event.target.files ?? [])
    event.target.value = ''
    if (!files.length) return

    const pendingUploads = files.map((file, index) => ({
      id: `${source}:${Date.now()}:${index}:${file.name}`,
      url: URL.createObjectURL(file),
      alt: file.name,
      file,
    }))
    const previousHeroId = heroImageId
    const previousHeroUrl = gallery.find((image) => image.id === previousHeroId)?.url ?? null
    const wasGalleryEmpty = !heroImageId
    const firstNewImage = pendingUploads[0]

    setGallery((current) => [
      ...current,
      ...pendingUploads.map(({ id, url, alt }) => ({ id, url, alt })),
    ])
    if (wasGalleryEmpty && firstNewImage) {
      setHeroImageId(firstNewImage.id)
      syncCoverImage(firstNewImage.url)
    }

    setImageUploadError(null)
    setPendingImageUploads((count) => count + pendingUploads.length)

    await Promise.all(
      pendingUploads.map(async ({ id, url, file }) => {
        try {
          const uploadedUrl = await uploadDeckEditorImage(file)
          setGallery((current) =>
            current.map((image) => (image.id === id ? { ...image, url: uploadedUrl } : image))
          )
          setHeroImageId((currentHeroId) => {
            if (currentHeroId === id) syncCoverImage(uploadedUrl)
            return currentHeroId
          })
        } catch (error) {
          setGallery((current) => current.filter((image) => image.id !== id))
          setHeroImageId((currentHeroId) => {
            if (currentHeroId !== id) return currentHeroId
            syncCoverImage(previousHeroUrl)
            return previousHeroId
          })
          setImageUploadError(
            error instanceof Error ? error.message : 'Could not upload image.'
          )
        } finally {
          URL.revokeObjectURL(url)
          setPendingImageUploads((count) => Math.max(0, count - 1))
        }
      })
    )
  }

  function toggleImageSelection(imageId: string) {
    setSelectedImageIds((current) =>
      current.includes(imageId)
        ? current.filter((id) => id !== imageId)
        : [...current, imageId]
    )
  }

  function deleteSelectedImages() {
    const next = gallery.filter((image) => !selectedImageIds.includes(image.id))
    if (!next.some((image) => image.id === heroImageId)) {
      const fallbackHero = next[0] ?? null
      setHeroImageId(fallbackHero?.id ?? '')
      syncCoverImage(fallbackHero?.url ?? null)
    }
    setGallery(next)
    setSelectedImageIds([])
    setIsEditingGallery(false)
  }

  function reorderGalleryImage(imageId: string, targetId: string, edge: DropTarget['edge']) {
    if (imageId === targetId) return
    setGallery((current) => {
      const fromIndex = current.findIndex((image) => image.id === imageId)
      const toIndex = current.findIndex((image) => image.id === targetId)
      if (fromIndex < 0 || toIndex < 0) return current
      const next = [...current]
      const [moved] = next.splice(fromIndex, 1)
      if (!moved) return current
      const targetOffset = edge === 'after' ? 1 : 0
      const adjustedIndex = fromIndex < toIndex ? toIndex - 1 : toIndex
      next.splice(adjustedIndex + targetOffset, 0, moved)
      return next
    })
  }

  return (
    <section className={styles.deckEditorPage}>
      <div className={styles.editorFrame}>
        <header className={styles.hero}>
          <Image src={heroImage} alt="" fill priority sizes="760px" className={styles.heroImage} />
          <span className={styles.heroShade} />
          <div className={styles.heroTop}>
            {onBack ? (
              <button
                type="button"
                className={styles.iconButton}
                aria-label="Back to guides"
                onClick={onBack}
              >
                Back
              </button>
            ) : (
              <GuideBackButton fallbackHref={backHref} className={styles.iconButton} />
            )}
            <div className={styles.heroActions}>
              <FeatureGuideLauncher
                guides={featureGuides}
                label="Deck editor help"
                buttonClassName={styles.iconButton}
              />
              <button
                className={styles.saveButton}
                type="button"
                disabled={isSaving || isUploadingImages}
                onClick={handleSave}
              >
                <SaveIcon />
                {isSaving ? 'Saving...' : isUploadingImages ? 'Uploading...' : saveLabel}
              </button>
            </div>
          </div>
          <div className={styles.heroContent}>
            <p className={styles.eyebrow}>Guide Editor</p>
            <h1>{inlineGuide ? inlineGuide.title : title || 'Untitled Guide'}</h1>
            {inlineGuide ? (
              <div className={styles.counters}>
                <span>Cards in this guide</span>
              </div>
            ) : (
              <div className={styles.counters}>
                <span>{deck.likeCount ?? 0} likes</span>
                <span>{deck.saveCount ?? 0} saves</span>
              </div>
            )}
          </div>
        </header>

        <div className={styles.tabs} role="tablist" aria-label="Deck editor tabs">
          {(inlineGuide ? inlineEditorTabs : editorTabs).map((tab) => (
            <button
              key={tab}
              type="button"
              role="tab"
              aria-selected={activeTab === tab}
              data-active={activeTab === tab}
              data-deck-editor-tab={tab}
              className={activeTab === tab ? styles.activeTab : styles.tab}
              onClick={() => setActiveTab(tab)}
            >
              {editorTabLabels[tab]}
            </button>
          ))}
        </div>

        {activeTab === 'details' ? (
          <div className={styles.panelGrid}>
            <section className={styles.panel}>
              <div className={styles.formGrid}>
                <label className={`${styles.field} ${styles.fullWidthField}`}>
                  <span>Title</span>
                  <input value={title} onChange={(event) => setTitle(event.target.value)} />
                </label>
                <label className={styles.field}>
                  <span>Difficulty</span>
                  <select
                    value={difficulty}
                    onChange={(event) => setDifficulty(event.target.value as DeckDifficulty)}
                  >
                    {difficultyOptions.map((option) => (
                      <option key={option}>{option}</option>
                    ))}
                  </select>
                </label>
                <label className={styles.field}>
                  <span>Status</span>
                  <select
                    value={status}
                    onChange={(event) => setStatus(event.target.value as DeckStatus)}
                  >
                    {statusOptions.map((option) => (
                      <option key={option}>{option}</option>
                    ))}
                  </select>
                </label>
              </div>
              <label className={styles.descriptionPanel}>
                <span>Description</span>
                <textarea
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  rows={7}
                />
              </label>
            </section>


            <DeckGallery
              cameraInputRef={cameraInputRef}
              draggingImageId={draggingImageId}
              dropTarget={galleryDropTarget}
              galleryInputRef={galleryInputRef}
              heroImageId={heroImageId}
              images={gallery}
              isEditing={isEditingGallery}
              selectedImageIds={selectedImageIds}
              onAddFiles={addGalleryFiles}
              onClearSelection={() => setSelectedImageIds([])}
              onDeleteSelected={deleteSelectedImages}
              onExpandImage={setExpandedImage}
              onReorderImage={reorderGalleryImage}
              onSetDraggingImageId={setDraggingImageId}
              onSetDropTarget={setGalleryDropTarget}
              onSetHeroImage={selectHeroImage}
              onToggleEdit={() => {
                setIsEditingGallery((current) => !current)
                setSelectedImageIds([])
              }}
              onToggleSelection={toggleImageSelection}
            />

            {onDeleteDeck ? <DeckDeleteFailsafe onDelete={onDeleteDeck} /> : null}
          </div>
        ) : null}

        {activeTab === 'cards' ? (
          <section className={styles.panel}>
            <div className={styles.cardList}>
              {cards.map((card) => (
                <div
                  key={card.id}
                  className={[
                    styles.guideCardRow,
                    styles.topLevelCardRow,
                    draggingCardId === card.id ? styles.cardRowDragging : '',
                    dropTarget?.id === card.id && dropTarget.edge === 'before'
                      ? styles.cardRowDropBefore
                      : '',
                    dropTarget?.id === card.id && dropTarget.edge === 'after'
                      ? styles.cardRowDropAfter
                      : '',
                  ].join(' ')}
                  draggable
                  onDragStart={(event) => {
                    setDraggingCardId(card.id)
                    event.dataTransfer.effectAllowed = 'move'
                    event.dataTransfer.setData('text/plain', card.id)
                  }}
                  onDragOver={(event) => {
                    event.preventDefault()
                    const rect = event.currentTarget.getBoundingClientRect()
                    const edge =
                      event.clientY < rect.top + rect.height / 2 ? 'before' : 'after'
                    setDropTarget({ id: card.id, edge })
                    event.dataTransfer.dropEffect = 'move'
                  }}
                  onDragLeave={() => {
                    if (dropTarget?.id === card.id) setDropTarget(null)
                  }}
                  onDrop={(event) => {
                    event.preventDefault()
                    const draggedId = event.dataTransfer.getData('text/plain') || draggingCardId
                    if (draggedId) {
                      reorderCard(draggedId, card.id, dropTarget?.edge ?? 'before')
                    }
                    setDraggingCardId(null)
                    setDropTarget(null)
                  }}
                  onDragEnd={() => {
                    setDraggingCardId(null)
                    setDropTarget(null)
                  }}
                >
                  <span
                    className={styles.dragHandle}
                    aria-label={`Drag to reorder ${card.title}`}
                    title="Drag to reorder"
                  >
                    <DragHandleIcon />
                  </span>
                  <button type="button" className={styles.guideCardPreview} aria-hidden="true" tabIndex={-1} onClick={() => setEditingCardId(card.id)}>
                    <span className={styles.guideCardPreviewStage}>
                      <DeckPreviewCardNode card={card} cards={cards} deck={deck} description={description} heroImage={coverCard?.image ?? heroImage} status={status} title={title} />
                    </span>
                  </button>
                  <span className={styles.guideCardInfo}>
                    <span className={styles.cardTypeLabel}>{templateLabel(card.template)}</span>
                    <strong data-deck-card-title>{card.title}</strong>
                  </span>
                  <span className={styles.topLevelCardActions}>
                    <button
                      className={styles.visibilityButton}
                      type="button"
                      aria-label={`Edit ${card.title}`}
                      onClick={() => setEditingCardId(card.id)}
                    >
                      <RowEditIcon />Edit
                    </button>
                  </span>
                </div>
              ))}
            </div>
            <button
              type="button"
              className={styles.addCardButton}
              aria-haspopup="dialog"
              // A guide's own cards only take cards; a former deck gets the
              // same + Add choices as any guide.
              onClick={() => inlineGuide ? setIsAddCardOpen(true) : setIsAddMenuOpen(true)}
            >
              + Add
            </button>
          </section>
        ) : null}

        {activeTab === 'preview' ? (
          <DeckPreview
            cards={cards}
            deck={deck}
            description={description}
            heroImage={coverCard?.image ?? heroImage}
            status={status}
            title={title}
          />
        ) : null}

        {saveError || imageUploadError ? (
          <p className={styles.saveError}>{saveError ?? imageUploadError}</p>
        ) : null}
      </div>

      {editingCard ? (
        <CardEditorSheet
          canDelete={cards.length > 1}
          card={editingCard}
          deckPaints={deck.paintList}
          onAddPaint={addEditingCardPaint}
          onChange={updateActiveCard}
          onChangeImage={updateEditingCardImage}
          onChangePaint={updateEditingCardPaint}
          onClose={() => setEditingCardId(null)}
          onDelete={deleteEditingCard}
          onDeletePaint={deleteEditingCardPaint}
          onSelectPaint={selectEditingCardPaint}
        />
      ) : null}

      {isAddCardOpen ? (
        <CardTypeSheet
          // Only one cover card at a time; a guide's own cards never have one.
          templates={inlineGuide || cards.some((card) => card.template === 'cover')
            ? addCardTemplateOptions.filter((template) => template !== 'cover')
            : addCardTemplateOptions}
          guideIndex={inlineGuide ? undefined : {
            disabled: true,
            note: 'Lists the guides inside - available once this deck is upgraded to a full guide.',
            onAdd: () => {},
          }}
          onAddCard={addCard}
          onClose={() => setIsAddCardOpen(false)}
        />
      ) : null}

      {isAddMenuOpen ? (
        <AddContentSheet
          options={[
            { key: 'card', kind: 'Card', title: 'New Card', note: 'Add a card to this guide.' },
            { key: 'existing', kind: 'Guide', title: 'Existing Guide', note: 'Available once this deck is upgraded to a full guide.', disabled: true },
            { key: 'new', kind: 'Guide', title: 'New Guide', note: 'Available once this deck is upgraded to a full guide.', disabled: true },
          ]}
          onChoose={(key) => {
            setIsAddMenuOpen(false)
            if (key === 'card') setIsAddCardOpen(true)
          }}
          onClose={() => setIsAddMenuOpen(false)}
        />
      ) : null}

      {expandedImage ? (
        <div
          className={styles.imageLightbox}
          role="dialog"
          aria-modal="true"
          onClick={(event) => {
            if (event.target === event.currentTarget) setExpandedImage(null)
          }}
        >
          <button
            type="button"
            className={styles.lightboxClose}
            onClick={() => setExpandedImage(null)}
          >
            Close
          </button>
          <div className={styles.lightboxImage}>
            <Image
              src={expandedImage.url}
              alt={expandedImage.alt}
              width={1200}
              height={1200}
              sizes="100vw"
              unoptimized
            />
          </div>
        </div>
      ) : null}
    </section>
  )
}

function DeckGallery({
  cameraInputRef,
  draggingImageId,
  dropTarget,
  galleryInputRef,
  heroImageId,
  images,
  isEditing,
  onAddFiles,
  onClearSelection,
  onDeleteSelected,
  onExpandImage,
  onReorderImage,
  onSetDraggingImageId,
  onSetDropTarget,
  onSetHeroImage,
  onToggleEdit,
  onToggleSelection,
  selectedImageIds,
}: {
  cameraInputRef: RefObject<HTMLInputElement | null>
  draggingImageId: string | null
  dropTarget: DropTarget | null
  galleryInputRef: RefObject<HTMLInputElement | null>
  heroImageId: string
  images: EditorImage[]
  isEditing: boolean
  onAddFiles: (event: ChangeEvent<HTMLInputElement>, source: 'camera' | 'gallery') => void
  onClearSelection: () => void
  onDeleteSelected: () => void
  onExpandImage: (image: EditorImage) => void
  onReorderImage: (imageId: string, targetId: string, edge: DropTarget['edge']) => void
  onSetDraggingImageId: (imageId: string | null) => void
  onSetDropTarget: (target: DropTarget | null) => void
  onSetHeroImage: (image: EditorImage) => void
  onToggleEdit: () => void
  onToggleSelection: (imageId: string) => void
  selectedImageIds: string[]
}) {
  const [isAddImageOpen, setIsAddImageOpen] = useState(false)
  const pages = useGalleryPages(images)
  const previousImageCount = useRef(images.length)

  // Page to newly added images so the upload is visible.
  useEffect(() => {
    if (images.length > previousImageCount.current) {
      pages.showItemAt(previousImageCount.current)
    }
    previousImageCount.current = images.length
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [images.length])

  return (
    <section className={styles.galleryPanel}>
      <div className={styles.galleryHeader}>
        <div>
          <h2>Gallery</h2>
          <p>{images.length} images - reference and hero artwork</p>
        </div>
        <div className={styles.galleryActions}>
          <div className={styles.addImageMenu}>
            <button
              type="button"
              className={styles.addImageButton}
              aria-haspopup="menu"
              aria-expanded={isAddImageOpen}
              onClick={() => setIsAddImageOpen((current) => !current)}
            >
              Add Image
            </button>
            {isAddImageOpen ? (
              <>
                <button
                  type="button"
                  className={styles.addImageBackdrop}
                  aria-label="Close add image menu"
                  onClick={() => setIsAddImageOpen(false)}
                />
                <div className={styles.addImageChoices} role="menu">
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setIsAddImageOpen(false)
                      galleryInputRef.current?.click()
                    }}
                  >
                    From Gallery
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setIsAddImageOpen(false)
                      cameraInputRef.current?.click()
                    }}
                  >
                    From Camera
                  </button>
                </div>
              </>
            ) : null}
          </div>
          <button type="button" className={styles.galleryEditToggle} onClick={onToggleEdit}>
            {isEditing ? 'Done' : 'Edit'}
          </button>
        </div>
      </div>

      <input
        ref={galleryInputRef}
        type="file"
        accept="image/*"
        multiple
        className={styles.hiddenInput}
        onChange={(event) => onAddFiles(event, 'gallery')}
      />
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className={styles.hiddenInput}
        onChange={(event) => onAddFiles(event, 'camera')}
      />

      {isEditing ? (
        <div className={styles.gallerySelectionBar}>
          <span>
            {selectedImageIds.length
              ? `${selectedImageIds.length} selected`
              : 'Select images to delete or drag to reorder'}
          </span>
          <div>
            {selectedImageIds.length ? (
              <button type="button" onClick={onClearSelection}>
                Clear
              </button>
            ) : null}
            {selectedImageIds.length ? (
              <button type="button" onClick={onDeleteSelected}>
                Delete
              </button>
            ) : null}
          </div>
        </div>
      ) : null}

      <div className={styles.galleryGrid} {...pages.swipeHandlers}>
        {pages.pageItems.map((image) => {
          const isHero = image.id === heroImageId
          const isSelected = selectedImageIds.includes(image.id)

          return (
            <article
              key={image.id}
              className={[
                styles.galleryTile,
                draggingImageId === image.id ? styles.galleryTileDragging : '',
                dropTarget?.id === image.id && dropTarget.edge === 'before'
                  ? styles.galleryDropBefore
                  : '',
                dropTarget?.id === image.id && dropTarget.edge === 'after'
                  ? styles.galleryDropAfter
                  : '',
              ].join(' ')}
              draggable={isEditing}
              onDragStart={(event) => {
                if (!isEditing) return
                onSetDraggingImageId(image.id)
                event.dataTransfer.effectAllowed = 'move'
                event.dataTransfer.setData('text/plain', image.id)
              }}
              onDragOver={(event) => {
                if (!isEditing) return
                event.preventDefault()
                const rect = event.currentTarget.getBoundingClientRect()
                const edge =
                  event.clientX < rect.left + rect.width / 2 ? 'before' : 'after'
                onSetDropTarget({ id: image.id, edge })
                event.dataTransfer.dropEffect = 'move'
              }}
              onDrop={(event) => {
                if (!isEditing) return
                event.preventDefault()
                const draggedId = event.dataTransfer.getData('text/plain') || draggingImageId
                if (draggedId) {
                  onReorderImage(draggedId, image.id, dropTarget?.edge ?? 'before')
                }
                onSetDraggingImageId(null)
                onSetDropTarget(null)
              }}
              onDragEnd={() => {
                onSetDraggingImageId(null)
                onSetDropTarget(null)
              }}
            >
              {isEditing ? (
                <label className={styles.galleryCheckbox}>
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => onToggleSelection(image.id)}
                    aria-label={`Select ${image.alt}`}
                  />
                </label>
              ) : null}
              <button
                type="button"
                className={styles.galleryImageButton}
                onClick={() => onExpandImage(image)}
              >
                <Image src={image.url} alt={image.alt} fill sizes="132px" unoptimized />
              </button>
              <button
                type="button"
                className={isHero ? styles.heroBadge : styles.makeHeroButton}
                onClick={() => onSetHeroImage(image)}
              >
                {isHero ? 'Hero' : 'Hero'}
              </button>
            </article>
          )
        })}

        {pages.isLastPage && pages.pageItems.length < pages.pageSize ? (
          <button
            type="button"
            className={styles.galleryUploadTile}
            onClick={() => galleryInputRef.current?.click()}
          >
            Add Image
          </button>
        ) : null}
      </div>

      <GalleryPager page={pages.page} pageCount={pages.pageCount} onPageChange={pages.goToPage} />
    </section>
  )
}

type DeckDeleteStage = 'idle' | 'armed' | 'confirming'

function DeckDeleteFailsafe({ onDelete }: { onDelete: () => Promise<void> }) {
  const [stage, setStage] = useState<DeckDeleteStage>('idle')
  const [isDeleting, setIsDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  function reset() {
    if (isDeleting) return
    setStage('idle')
    setDeleteError(null)
  }

  async function confirmDelete() {
    setIsDeleting(true)
    setDeleteError(null)
    try {
      await onDelete()
    } catch (error) {
      setDeleteError(error instanceof Error ? error.message : 'Could not delete deck.')
      setIsDeleting(false)
    }
  }

  return (
    <section className={styles.deletePanel} data-deck-editor="delete-deck">
      <div className={styles.deletePanelCopy}>
        <p className={styles.deleteEyebrow}>Danger Zone</p>
        <p>Removes this deck with its cards, paints, and gallery images.</p>
      </div>
      <button
        type="button"
        className={styles.deleteDeckButton}
        data-delete-armed={stage !== 'idle' ? 'true' : 'false'}
        onClick={() => setStage((current) => (current === 'idle' ? 'armed' : 'confirming'))}
      >
        {stage === 'idle' ? 'Delete Deck' : 'Press Again to Delete'}
      </button>

      {stage === 'confirming' ? (
        <div
          className={styles.deleteBackdrop}
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="deck-delete-title"
          aria-describedby="deck-delete-description"
          onClick={(event) => {
            if (event.target === event.currentTarget) reset()
          }}
          onKeyDown={(event) => {
            if (event.key === 'Escape') reset()
          }}
        >
          <section className={styles.deleteDialog}>
            <p className={styles.deleteEyebrow}>Confirm Deletion</p>
            <h2 id="deck-delete-title">Delete this deck?</h2>
            <p id="deck-delete-description">
              Deleting is permanent. The deck and all of its cards, paints, and gallery
              images will be removed and cannot be recovered.
            </p>
            {deleteError ? <p className={styles.saveError}>{deleteError}</p> : null}
            <div className={styles.deleteDialogActions}>
              <button
                type="button"
                className={styles.deleteCancelButton}
                disabled={isDeleting}
                onClick={reset}
                autoFocus
              >
                Cancel
              </button>
              <button
                type="button"
                className={styles.deleteConfirmButton}
                disabled={isDeleting}
                onClick={confirmDelete}
              >
                {isDeleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </section>
  )
}

function CardEditorSheet({
  canDelete,
  card,
  deckPaints,
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
          <button type="button" onClick={onClose} aria-label="Close">
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

        <div className={styles.sheetActions}>
          {canDelete ? (
            <button type="button" className={styles.dangerButton} onClick={onDelete}>
              Delete Card
            </button>
          ) : <span />}
          <button type="button" className={styles.saveButton} onClick={onClose}>
            Done
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

type DeckPreviewProps = {
  cards: EditorCard[]
  deck: GuidesV3DeckDetail
  description: string
  heroImage: string
  status: DeckStatus
  title: string
}

function DeckPreview(props: DeckPreviewProps) {
  return (
    <section className={styles.previewStack} aria-label="Deck preview">
      {props.cards.map((card) => (
        <div key={card.id} className={styles.previewShareMount}>
          <DeckPreviewCardNode card={card} {...props} />
        </div>
      ))}
    </section>
  )
}

function DeckPreviewCardNode({
  card,
  cards,
  deck,
  description,
  heroImage,
  status,
  title,
}: DeckPreviewProps & { card: EditorCard }) {
  return renderDeckPreviewCard({ card, cards, deck, description, heroImage, status, title })
}

function renderDeckPreviewCard({
  card,
  cards,
  deck,
  description,
  heroImage,
  status,
  title,
}: {
  card: EditorCard
  cards: EditorCard[]
  deck: GuidesV3DeckDetail
  description: string
  heroImage: string
  status: DeckStatus
  title: string
}) {
  const recipe: Recipe = {
    id: deck.id,
    name: title || 'Untitled Deck',
    description,
    inventory_required: null,
    expert_tips: null,
    youtube_url: null,
    is_public: status === 'Public',
  }
  const previewCoverCard = cards.find((card) => card.template === 'cover')
  const featuredImage: RecipeImage | null = isUsableImageUrl(heroImage)
    ? {
        id: `${deck.id}:hero`,
        image_url: heroImage,
        is_featured: true,
        alt_text: title,
        focal_x: previewCoverCard?.imageFocalX ?? 50,
        focal_y: previewCoverCard?.imageFocalY ?? 50,
      }
    : null
  // Render every card in its actual editor order, cover included wherever
  // it sits (or omitted entirely if the owner removed it) - this must
  // match what the live viewer will actually show, not force the cover
  // to always lead.
  const stepCards = cards.filter((card) => card.template !== 'cover')

  {
        if (card.template === 'cover') {
          return (
            <>
              <RecipeGuideCoverCard
                recipe={recipe}
                featuredImage={featuredImage}
                cardCount={cards.length}
                paintCount={deck.paintList.length}
              />
            </>
          )
        }

        const step: RecipeStep = {
          id: card.id,
          step_number: stepCards.indexOf(card) + 1,
          title: card.title,
          instructions: card.body,
          image_url: card.image,
          image_focal_x: card.imageFocalX,
          image_focal_y: card.imageFocalY,
          paint_alignment: card.paintAlignment ?? 'left',
          paint_vertical_alignment: card.paintVerticalAlignment ?? 'top',
          subtitle: card.subtitle ?? null,
        }

        return (
          <>
            {card.template === 'paints' ? (
              <RecipeGuidePaintsCard
                title={card.title}
                description={card.body}
                paints={card.paints}
              />
            ) : card.template === 'video' ? (
              <RecipeGuideVideoCard
                title={card.title}
                description={card.body}
                youtubeUrl={card.videoUrl}
              />
            ) : card.template === 'theme' ? (
              <RecipeGuideThemeStepCard
                step={step}
                stepsLength={stepCards.length}
                paints={card.paints}
                fallbackImageUrl={heroImage}
                fallbackFocalX={previewCoverCard?.imageFocalX ?? 50}
                fallbackFocalY={previewCoverCard?.imageFocalY ?? 50}
              />
            ) : card.template === 'theme-alt' ? (
              <RecipeGuideAltThemeStepCard
                step={step}
                stepsLength={stepCards.length}
                paints={card.paints}
                fallbackImageUrl={heroImage}
                fallbackFocalX={previewCoverCard?.imageFocalX ?? 50}
                fallbackFocalY={previewCoverCard?.imageFocalY ?? 50}
              />
            ) : card.template === 'small-image' && isUsableImageUrl(card.image) ? (
              <RecipeGuideSmallImageStepCard
                step={step}
                stepsLength={stepCards.length}
                paints={card.paints}
              />
            ) : isUsableImageUrl(card.image) ? (
              <RecipeGuideImageStepCard
                step={step}
                stepsLength={stepCards.length}
                paints={card.paints}
              />
            ) : (
              <RecipeGuideDescriptiveStepCard
                step={step}
                stepsLength={stepCards.length}
                paints={card.paints}
              />
            )}
          </>
        )
  }
}

function RowEditIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m4 20 4.5-1 10-10a2.1 2.1 0 0 0-3-3l-10 10L4 20Z" />
      <path d="m14 7 3 3" />
    </svg>
  )
}

function SaveIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className={styles.buttonIcon}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2Z" />
      <path d="M17 21v-8H7v8" />
      <path d="M7 3v5h8" />
    </svg>
  )
}
